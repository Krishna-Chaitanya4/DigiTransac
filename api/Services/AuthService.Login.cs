using DigiTransac.Api.Common;
using DigiTransac.Api.Models;
using DigiTransac.Api.Models.Dto;

namespace DigiTransac.Api.Services;

public partial class AuthService
{
    public async Task<LoginResponse> LoginAsync(LoginRequest request)
    {
        _logger.LogInformation("Login attempt for {Email}", request.Email);

        var user = await _userRepository.GetByEmailAsync(request.Email);

        // Constant-time comparison: always run BCrypt.Verify to prevent timing-based user enumeration.
        // When user is null, verify against a dummy hash so the response time is consistent.
        var passwordHash = user?.PasswordHash ?? "$2a$12$LJ3m4ys3Lz0Y3x0r5r5Q4eDpGh.X1PoMf6TkRdqj8XGz5q8y0Y5Ky";
        var passwordValid = BCrypt.Net.BCrypt.Verify(request.Password, passwordHash);

        if (user == null || !passwordValid)
        {
            _logger.LogWarning("Failed login attempt for {Email}", request.Email);
            
            // Audit log for failed login
            await _auditService.LogLoginFailedAsync(request.Email, "Invalid credentials");
            
            return new LoginResponse(null, null, null, null, null); // Invalid credentials
        }

        // Check if 2FA is enabled
        if (user.TwoFactorEnabled)
        {
            _logger.LogInformation("2FA required for user {Email}", request.Email);
            
            // Generate a temporary 2FA token
            var twoFactorToken = new TwoFactorToken
            {
                UserId = user.Id,
                Token = GenerateSecureToken(),
                ExpiresAt = DateTime.UtcNow.AddMinutes(5) // 5 minutes to complete 2FA
            };
            
            await _twoFactorTokenRepository.CreateAsync(twoFactorToken);
            
            return new LoginResponse(
                null, null, null, null, null,
                RequiresTwoFactor: true,
                TwoFactorToken: twoFactorToken.Token
            );
        }

        _logger.LogInformation("User logged in successfully: {Email}, UserId: {UserId}", user.Email, user.Id);
        
        // Audit log for successful login
        await _auditService.LogLoginSuccessAsync(user.Id, user.Email);

        var accessToken = GenerateJwtToken(user);
        var refreshToken = await GenerateRefreshTokenAsync(user.Id, rememberMe: request.RememberMe);
        
        return new LoginResponse(accessToken, refreshToken.Token, user.Email, user.FullName, user.IsEmailVerified, user.PrimaryCurrency);
    }

    public async Task<AuthResponse?> VerifyTwoFactorLoginAsync(string twoFactorTokenString, string code)
    {
        var twoFactorToken = await _twoFactorTokenRepository.GetByTokenAsync(twoFactorTokenString);
        if (twoFactorToken == null)
        {
            _logger.LogWarning("Invalid or expired 2FA token");
            return null;
        }

        var user = await _userRepository.GetByIdAsync(twoFactorToken.UserId);
        if (user == null || !user.TwoFactorEnabled || string.IsNullOrEmpty(user.TwoFactorSecret))
        {
            _logger.LogWarning("2FA verification failed - user not found or 2FA not enabled");
            return null;
        }

        // Verify the TOTP code
        if (!_twoFactorService.ValidateCode(user.TwoFactorSecret, code))
        {
            _logger.LogWarning("Invalid 2FA code for user {UserId}", user.Id);
            
            // Audit log for failed 2FA verification
            await _auditService.LogTwoFactorVerificationAsync(user.Id, user.Email, success: false);
            
            return null;
        }

        // Mark token as used
        await _twoFactorTokenRepository.MarkAsUsedAsync(twoFactorToken.Id);

        _logger.LogInformation("2FA login successful for user {Email}", user.Email);
        
        // Audit log for successful 2FA login
        await _auditService.LogLoginSuccessAsync(user.Id, user.Email);

        var accessToken = GenerateJwtToken(user);
        var refreshToken = await GenerateRefreshTokenAsync(user.Id);
        
        return new AuthResponse(accessToken, refreshToken.Token, user.Email, user.FullName, user.IsEmailVerified, user.PrimaryCurrency);
    }

    public async Task<Result> SendTwoFactorEmailOtpAsync(string twoFactorTokenString)
    {
        var twoFactorToken = await _twoFactorTokenRepository.GetByTokenAsync(twoFactorTokenString);
        if (twoFactorToken == null)
        {
            _logger.LogWarning("Invalid or expired 2FA token for email OTP");
            return DomainErrors.Auth.InvalidOrExpiredSession;
        }

        // Rate limit: only allow one email OTP per minute
        if (twoFactorToken.EmailOtpSentAt != null &&
            DateTime.UtcNow - twoFactorToken.EmailOtpSentAt.Value < TimeSpan.FromMinutes(1))
        {
            return DomainErrors.Auth.RateLimited;
        }

        var user = await _userRepository.GetByIdAsync(twoFactorToken.UserId);
        if (user == null)
        {
            return DomainErrors.User.NotFound;
        }

        // Generate 6-digit code
        var code = GenerateVerificationCode();
        
        // Store the code in the 2FA token
        await _twoFactorTokenRepository.SetEmailOtpAsync(twoFactorToken.Id, code);

        // Send email
        await _emailService.SendTwoFactorBackupCodeAsync(user.Email, code);

        _logger.LogInformation("2FA backup code sent to {Email}", user.Email);
        return Result.Success();
    }

    public async Task<AuthResponse?> VerifyTwoFactorEmailOtpAsync(string twoFactorTokenString, string emailCode)
    {
        var twoFactorToken = await _twoFactorTokenRepository.GetByTokenAsync(twoFactorTokenString);
        if (twoFactorToken == null)
        {
            _logger.LogWarning("Invalid or expired 2FA token for email OTP verification");
            return null;
        }

        // Verify the email OTP code
        if (string.IsNullOrEmpty(twoFactorToken.EmailOtpCode) || twoFactorToken.EmailOtpCode != emailCode)
        {
            _logger.LogWarning("Invalid email OTP code for user {UserId}", twoFactorToken.UserId);
            
            // Audit log for failed email OTP
            await _auditService.LogAsync(
                AuditAction.TwoFactorFailed,
                AuditCategory.TwoFactor,
                success: false,
                description: "Invalid email OTP code",
                userId: twoFactorToken.UserId);
            
            return null;
        }

        // Check if email OTP has expired (10 minutes)
        if (twoFactorToken.EmailOtpSentAt == null ||
            DateTime.UtcNow - twoFactorToken.EmailOtpSentAt.Value > TimeSpan.FromMinutes(10))
        {
            _logger.LogWarning("Email OTP expired for user {UserId}", twoFactorToken.UserId);
            return null;
        }

        var user = await _userRepository.GetByIdAsync(twoFactorToken.UserId);
        if (user == null)
        {
            return null;
        }

        // Mark token as used
        await _twoFactorTokenRepository.MarkAsUsedAsync(twoFactorToken.Id);

        _logger.LogInformation("2FA email OTP login successful for user {Email}", user.Email);
        
        // Audit log for successful 2FA email OTP login
        await _auditService.LogLoginSuccessAsync(user.Id, user.Email);

        var accessToken = GenerateJwtToken(user);
        var refreshToken = await GenerateRefreshTokenAsync(user.Id);
        
        return new AuthResponse(accessToken, refreshToken.Token, user.Email, user.FullName, user.IsEmailVerified, user.PrimaryCurrency);
    }

    public async Task<User?> GetCurrentUserAsync(string userId)
    {
        return await _userRepository.GetByIdAsync(userId);
    }
}