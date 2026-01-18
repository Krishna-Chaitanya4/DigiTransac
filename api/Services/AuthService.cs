using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using DigiTransac.Api.Models;
using DigiTransac.Api.Models.Dto;
using DigiTransac.Api.Repositories;
using DigiTransac.Api.Settings;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;

namespace DigiTransac.Api.Services;

public interface IAuthService
{
    // Registration verification flow
    Task<(bool Success, string Message)> SendVerificationCodeAsync(string email);
    Task<(bool Success, string Message, string? VerificationToken)> VerifyCodeAsync(string email, string code);
    Task<AuthResponse?> CompleteRegistrationAsync(CompleteRegistrationRequest request);
    
    // Login
    Task<LoginResponse> LoginAsync(LoginRequest request);
    Task<AuthResponse?> VerifyTwoFactorLoginAsync(string twoFactorToken, string code);
    Task<(bool Success, string Message)> SendTwoFactorEmailOtpAsync(string twoFactorToken);
    Task<AuthResponse?> VerifyTwoFactorEmailOtpAsync(string twoFactorToken, string emailCode);
    Task<User?> GetCurrentUserAsync(string userId);
    
    // Token refresh
    Task<AuthResponse?> RefreshTokenAsync(string refreshToken);
    Task<bool> RevokeTokenAsync(string refreshToken);
    Task RevokeAllUserTokensAsync(string userId);
    
    // Account management
    Task<(bool Success, string Message)> DeleteAccountAsync(string userId, string password);
    Task<(bool Success, string Message)> UpdateNameAsync(string userId, string newName);
    Task<(bool Success, string Message)> SendEmailChangeCodeAsync(string userId, string newEmail);
    Task<(bool Success, string Message)> VerifyAndUpdateEmailAsync(string userId, string newEmail, string code);
    
    // Forgot password flow
    Task<(bool Success, string Message)> SendPasswordResetCodeAsync(string email);
    Task<(bool Success, string Message, string? VerificationToken)> VerifyPasswordResetCodeAsync(string email, string code);
    Task<(bool Success, string Message)> ResetPasswordAsync(ResetPasswordRequest request);
}

public class AuthService : IAuthService
{
    private readonly IUserRepository _userRepository;
    private readonly IEmailVerificationRepository _emailVerificationRepository;
    private readonly IRefreshTokenRepository _refreshTokenRepository;
    private readonly ITwoFactorTokenRepository _twoFactorTokenRepository;
    private readonly IEmailService _emailService;
    private readonly ILabelService _labelService;
    private readonly ITwoFactorService _twoFactorService;
    private readonly JwtSettings _jwtSettings;
    private readonly ILogger<AuthService> _logger;

    public AuthService(
        IUserRepository userRepository,
        IEmailVerificationRepository emailVerificationRepository,
        IRefreshTokenRepository refreshTokenRepository,
        ITwoFactorTokenRepository twoFactorTokenRepository,
        IEmailService emailService,
        ILabelService labelService,
        ITwoFactorService twoFactorService,
        IOptions<JwtSettings> jwtSettings,
        ILogger<AuthService> logger)
    {
        _userRepository = userRepository;
        _emailVerificationRepository = emailVerificationRepository;
        _refreshTokenRepository = refreshTokenRepository;
        _twoFactorTokenRepository = twoFactorTokenRepository;
        _emailService = emailService;
        _labelService = labelService;
        _twoFactorService = twoFactorService;
        _jwtSettings = jwtSettings.Value;
        _logger = logger;
    }

    public async Task<(bool Success, string Message)> SendVerificationCodeAsync(string email)
    {
        _logger.LogInformation("Sending verification code to {Email}", email);

        // Validate email format
        if (!IsValidEmail(email))
        {
            _logger.LogWarning("Invalid email format attempted: {Email}", email);
            return (false, "Invalid email format");
        }

        // Check if email already registered
        var existingUser = await _userRepository.GetByEmailAsync(email);
        if (existingUser != null)
        {
            _logger.LogWarning("Registration attempted with existing email: {Email}", email);
            return (false, "Email already registered");
        }

        // Delete any existing verification for this email
        await _emailVerificationRepository.DeleteByEmailAsync(email, VerificationPurpose.Registration);

        // Generate 6-digit code
        var code = GenerateVerificationCode();

        // Create verification record
        var verification = new EmailVerification
        {
            Email = email,
            Code = code,
            ExpiresAt = DateTime.UtcNow.AddMinutes(10), // Code valid for 10 minutes
            IsVerified = false,
            Purpose = VerificationPurpose.Registration
        };

        await _emailVerificationRepository.CreateAsync(verification);

        // Send email
        await _emailService.SendVerificationCodeAsync(email, code);

        _logger.LogInformation("Verification code sent successfully to {Email}", email);
        return (true, "Verification code sent to your email");
    }

    public async Task<(bool Success, string Message, string? VerificationToken)> VerifyCodeAsync(string email, string code)
    {
        _logger.LogInformation("Verifying code for {Email}", email);

        var verification = await _emailVerificationRepository.GetByEmailAndCodeAsync(email, code, VerificationPurpose.Registration);
        
        if (verification == null)
        {
            _logger.LogWarning("Invalid or expired verification code for {Email}", email);
            return (false, "Invalid or expired verification code", null);
        }

        // Mark as verified and generate a token for registration
        verification.IsVerified = true;
        verification.VerificationToken = GenerateSecureToken();
        verification.ExpiresAt = DateTime.UtcNow.AddMinutes(30); // 30 mins to complete registration

        await _emailVerificationRepository.UpdateAsync(verification);

        _logger.LogInformation("Email verified successfully for {Email}", email);
        return (true, "Email verified successfully", verification.VerificationToken);
    }

    public async Task<AuthResponse?> CompleteRegistrationAsync(CompleteRegistrationRequest request)
    {
        _logger.LogInformation("Completing registration for {Email}", request.Email);

        // Verify the token is valid
        var verification = await _emailVerificationRepository.GetByVerificationTokenAsync(request.VerificationToken, VerificationPurpose.Registration);
        
        if (verification == null || verification.Email.ToLowerInvariant() != request.Email.ToLowerInvariant())
        {
            _logger.LogWarning("Invalid verification token for {Email}", request.Email);
            return null; // Invalid or expired token
        }

        // Check if email already registered (race condition check)
        var existingUser = await _userRepository.GetByEmailAsync(request.Email);
        if (existingUser != null)
        {
            _logger.LogWarning("Registration failed - email already exists: {Email}", request.Email);
            return null;
        }

        // Validate password strength
        var passwordValidation = ValidatePassword(request.Password);
        if (!passwordValidation.IsValid)
        {
            _logger.LogWarning("Registration failed - weak password for {Email}: {Reason}", request.Email, passwordValidation.Message);
            return null;
        }

        // Validate and set primary currency
        var primaryCurrency = "USD"; // Default (international)
        if (!string.IsNullOrWhiteSpace(request.PrimaryCurrency))
        {
            var currencyCode = request.PrimaryCurrency.ToUpperInvariant();
            if (CurrencyConfig.IsValidCurrency(currencyCode))
            {
                primaryCurrency = currencyCode;
            }
        }

        // Create user
        var user = new User
        {
            Email = request.Email,
            FullName = request.FullName,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password),
            IsEmailVerified = true, // Already verified!
            PrimaryCurrency = primaryCurrency,
            CreatedAt = DateTime.UtcNow
        };

        await _userRepository.CreateAsync(user);

        // Create default labels for the new user
        await _labelService.CreateDefaultLabelsAsync(user.Id);

        // Clean up verification record
        await _emailVerificationRepository.DeleteByEmailAsync(request.Email, VerificationPurpose.Registration);

        _logger.LogInformation("User registered successfully: {Email}, UserId: {UserId}", user.Email, user.Id);

        var accessToken = GenerateJwtToken(user);
        var refreshToken = await GenerateRefreshTokenAsync(user.Id);
        
        return new AuthResponse(accessToken, refreshToken.Token, user.Email, user.FullName, user.IsEmailVerified);
    }

    public async Task<LoginResponse> LoginAsync(LoginRequest request)
    {
        _logger.LogInformation("Login attempt for {Email}", request.Email);

        var user = await _userRepository.GetByEmailAsync(request.Email);
        if (user == null || !BCrypt.Net.BCrypt.Verify(request.Password, user.PasswordHash))
        {
            _logger.LogWarning("Failed login attempt for {Email}", request.Email);
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

        var accessToken = GenerateJwtToken(user);
        var refreshToken = await GenerateRefreshTokenAsync(user.Id);
        
        return new LoginResponse(accessToken, refreshToken.Token, user.Email, user.FullName, user.IsEmailVerified);
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
            return null;
        }

        // Mark token as used
        await _twoFactorTokenRepository.MarkAsUsedAsync(twoFactorToken.Id);

        _logger.LogInformation("2FA login successful for user {Email}", user.Email);

        var accessToken = GenerateJwtToken(user);
        var refreshToken = await GenerateRefreshTokenAsync(user.Id);
        
        return new AuthResponse(accessToken, refreshToken.Token, user.Email, user.FullName, user.IsEmailVerified);
    }

    public async Task<(bool Success, string Message)> SendTwoFactorEmailOtpAsync(string twoFactorTokenString)
    {
        var twoFactorToken = await _twoFactorTokenRepository.GetByTokenAsync(twoFactorTokenString);
        if (twoFactorToken == null)
        {
            _logger.LogWarning("Invalid or expired 2FA token for email OTP");
            return (false, "Invalid or expired session. Please login again.");
        }

        // Rate limit: only allow one email OTP per minute
        if (twoFactorToken.EmailOtpSentAt != null && 
            DateTime.UtcNow - twoFactorToken.EmailOtpSentAt.Value < TimeSpan.FromMinutes(1))
        {
            return (false, "Please wait before requesting another code");
        }

        var user = await _userRepository.GetByIdAsync(twoFactorToken.UserId);
        if (user == null)
        {
            return (false, "User not found");
        }

        // Generate 6-digit code
        var code = GenerateVerificationCode();
        
        // Store the code in the 2FA token
        await _twoFactorTokenRepository.SetEmailOtpAsync(twoFactorToken.Id, code);

        // Send email
        await _emailService.SendTwoFactorBackupCodeAsync(user.Email, code);

        _logger.LogInformation("2FA backup code sent to {Email}", user.Email);
        return (true, "Verification code sent to your email");
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

        var accessToken = GenerateJwtToken(user);
        var refreshToken = await GenerateRefreshTokenAsync(user.Id);
        
        return new AuthResponse(accessToken, refreshToken.Token, user.Email, user.FullName, user.IsEmailVerified);
    }

    public async Task<User?> GetCurrentUserAsync(string userId)
    {
        return await _userRepository.GetByIdAsync(userId);
    }

    public async Task<(bool Success, string Message)> DeleteAccountAsync(string userId, string password)
    {
        _logger.LogInformation("Delete account request for UserId: {UserId}", userId);

        var user = await _userRepository.GetByIdAsync(userId);
        if (user == null)
        {
            _logger.LogWarning("Delete account failed - user not found: {UserId}", userId);
            return (false, "User not found");
        }

        var userEmail = user.Email;

        // Verify password
        if (!BCrypt.Net.BCrypt.Verify(password, user.PasswordHash))
        {
            _logger.LogWarning("Delete account failed - invalid password for UserId: {UserId}", userId);
            return (false, "Invalid password");
        }

        // Delete all associated data
        _logger.LogInformation("Deleting all data for user: {Email}", userEmail);

        // 1. Delete all refresh tokens for the user
        await _refreshTokenRepository.DeleteByUserIdAsync(userId);

        // 2. Delete all email verifications for the user
        await _emailVerificationRepository.DeleteAllByEmailAsync(userEmail);

        // 3. Delete the user record
        var deleted = await _userRepository.DeleteAsync(userId);
        if (!deleted)
        {
            _logger.LogError("Delete account failed - could not delete user: {UserId}", userId);
            return (false, "Failed to delete account");
        }

        // Verify deletion
        var verifyUser = await _userRepository.GetByIdAsync(userId);
        if (verifyUser != null)
        {
            _logger.LogError("Delete account verification failed - user still exists: {UserId}", userId);
            return (false, "Failed to delete account");
        }

        _logger.LogInformation("Account deleted successfully: {Email}", userEmail);
        return (true, "Account deleted successfully");
    }

    public async Task<(bool Success, string Message)> UpdateNameAsync(string userId, string newName)
    {
        _logger.LogInformation("Update name request for UserId: {UserId}", userId);

        if (string.IsNullOrWhiteSpace(newName))
        {
            return (false, "Name cannot be empty");
        }

        if (newName.Length < 2 || newName.Length > 100)
        {
            return (false, "Name must be between 2 and 100 characters");
        }

        var user = await _userRepository.GetByIdAsync(userId);
        if (user == null)
        {
            _logger.LogWarning("Update name failed - user not found: {UserId}", userId);
            return (false, "User not found");
        }

        user.FullName = newName.Trim();
        await _userRepository.UpdateAsync(user);

        _logger.LogInformation("Name updated successfully for UserId: {UserId}", userId);
        return (true, "Name updated successfully");
    }

    public async Task<(bool Success, string Message)> SendEmailChangeCodeAsync(string userId, string newEmail)
    {
        _logger.LogInformation("Email change request for UserId: {UserId} to {NewEmail}", userId, newEmail);

        if (!IsValidEmail(newEmail))
        {
            return (false, "Invalid email format");
        }

        var user = await _userRepository.GetByIdAsync(userId);
        if (user == null)
        {
            _logger.LogWarning("Email change failed - user not found: {UserId}", userId);
            return (false, "User not found");
        }

        var normalizedNewEmail = newEmail.ToLowerInvariant();

        // Check if new email is same as current
        if (user.Email == normalizedNewEmail)
        {
            return (false, "New email is the same as current email");
        }

        // Check if email is already taken by another user
        var existingUser = await _userRepository.GetByEmailAsync(normalizedNewEmail);
        if (existingUser != null)
        {
            _logger.LogWarning("Email change failed - email already in use: {NewEmail}", normalizedNewEmail);
            return (false, "Email is already in use");
        }

        // Generate and send verification code
        var code = GenerateVerificationCode();
        
        // Store verification with EmailChange purpose
        var verification = new EmailVerification
        {
            Email = normalizedNewEmail,
            Code = code,
            Purpose = VerificationPurpose.EmailChange,
            ExpiresAt = DateTime.UtcNow.AddMinutes(10),
            UserId = userId // Store the user ID for verification
        };

        await _emailVerificationRepository.CreateAsync(verification);

        // Send verification email to the NEW email
        await _emailService.SendVerificationCodeAsync(normalizedNewEmail, code);

        _logger.LogInformation("Email change verification code sent to {NewEmail}", normalizedNewEmail);
        return (true, "Verification code sent to your new email address");
    }

    public async Task<(bool Success, string Message)> VerifyAndUpdateEmailAsync(string userId, string newEmail, string code)
    {
        _logger.LogInformation("Verifying email change for UserId: {UserId}", userId);

        var normalizedNewEmail = newEmail.ToLowerInvariant();

        // Find the verification record
        var verification = await _emailVerificationRepository.GetByEmailAndCodeAsync(normalizedNewEmail, code, VerificationPurpose.EmailChange);
        
        if (verification == null || verification.ExpiresAt < DateTime.UtcNow || verification.UserId != userId)
        {
            _logger.LogWarning("Invalid or expired email change code for {NewEmail}", normalizedNewEmail);
            return (false, "Invalid or expired verification code");
        }

        // Verify email isn't taken (double-check)
        var existingUser = await _userRepository.GetByEmailAsync(normalizedNewEmail);
        if (existingUser != null)
        {
            return (false, "Email is already in use");
        }

        var user = await _userRepository.GetByIdAsync(userId);
        if (user == null)
        {
            return (false, "User not found");
        }

        var oldEmail = user.Email;
        user.Email = normalizedNewEmail;
        await _userRepository.UpdateAsync(user);

        // Clean up verification record
        await _emailVerificationRepository.DeleteByEmailAsync(normalizedNewEmail, VerificationPurpose.EmailChange);

        _logger.LogInformation("Email changed successfully from {OldEmail} to {NewEmail}", oldEmail, normalizedNewEmail);
        return (true, "Email updated successfully");
    }

    public async Task<(bool Success, string Message)> SendPasswordResetCodeAsync(string email)
    {
        _logger.LogInformation("Sending password reset code to {Email}", email);

        // Validate email format
        if (!IsValidEmail(email))
        {
            _logger.LogWarning("Invalid email format for password reset: {Email}", email);
            return (false, "Invalid email format");
        }

        // Check if email exists
        var existingUser = await _userRepository.GetByEmailAsync(email);
        if (existingUser == null)
        {
            // Don't reveal that email doesn't exist (security best practice)
            _logger.LogWarning("Password reset attempted for non-existent email: {Email}", email);
            return (true, "If an account with that email exists, a reset code has been sent");
        }

        // Delete any existing password reset verification for this email
        await _emailVerificationRepository.DeleteByEmailAsync(email, VerificationPurpose.PasswordReset);

        // Generate 6-digit code
        var code = GenerateVerificationCode();

        // Create verification record
        var verification = new EmailVerification
        {
            Email = email,
            Code = code,
            ExpiresAt = DateTime.UtcNow.AddMinutes(10),
            IsVerified = false,
            Purpose = VerificationPurpose.PasswordReset
        };

        await _emailVerificationRepository.CreateAsync(verification);

        // Send email
        await _emailService.SendPasswordResetCodeAsync(email, code);

        _logger.LogInformation("Password reset code sent successfully to {Email}", email);
        return (true, "If an account with that email exists, a reset code has been sent");
    }

    public async Task<(bool Success, string Message, string? VerificationToken)> VerifyPasswordResetCodeAsync(string email, string code)
    {
        _logger.LogInformation("Verifying password reset code for {Email}", email);

        var verification = await _emailVerificationRepository.GetByEmailAndCodeAsync(email, code, VerificationPurpose.PasswordReset);
        
        if (verification == null)
        {
            _logger.LogWarning("Invalid or expired password reset code for {Email}", email);
            return (false, "Invalid or expired code", null);
        }

        // Mark as verified and generate a token for password reset
        verification.IsVerified = true;
        verification.VerificationToken = GenerateSecureToken();
        verification.ExpiresAt = DateTime.UtcNow.AddMinutes(30);

        await _emailVerificationRepository.UpdateAsync(verification);

        _logger.LogInformation("Password reset code verified for {Email}", email);
        return (true, "Code verified successfully", verification.VerificationToken);
    }

    public async Task<(bool Success, string Message)> ResetPasswordAsync(ResetPasswordRequest request)
    {
        _logger.LogInformation("Resetting password for {Email}", request.Email);

        // Verify the token is valid
        var verification = await _emailVerificationRepository.GetByVerificationTokenAsync(request.VerificationToken, VerificationPurpose.PasswordReset);
        
        if (verification == null || verification.Email.ToLowerInvariant() != request.Email.ToLowerInvariant())
        {
            _logger.LogWarning("Invalid password reset token for {Email}", request.Email);
            return (false, "Invalid or expired reset token");
        }

        // Validate password strength
        var passwordValidation = ValidatePassword(request.NewPassword);
        if (!passwordValidation.IsValid)
        {
            _logger.LogWarning("Password reset failed - weak password for {Email}: {Reason}", request.Email, passwordValidation.Message);
            return (false, passwordValidation.Message);
        }

        // Get the user
        var user = await _userRepository.GetByEmailAsync(request.Email);
        if (user == null)
        {
            _logger.LogWarning("Password reset failed - user not found: {Email}", request.Email);
            return (false, "User not found");
        }

        // Update password
        user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.NewPassword);
        await _userRepository.UpdateAsync(user);

        // Clean up verification record
        await _emailVerificationRepository.DeleteByEmailAsync(request.Email, VerificationPurpose.PasswordReset);

        _logger.LogInformation("Password reset successfully for {Email}", request.Email);
        return (true, "Password reset successfully");
    }

    public async Task<AuthResponse?> RefreshTokenAsync(string refreshToken)
    {
        _logger.LogInformation("Token refresh attempt");

        var storedToken = await _refreshTokenRepository.GetByTokenAsync(refreshToken);
        
        if (storedToken == null)
        {
            _logger.LogWarning("Refresh token not found");
            return null;
        }

        if (!storedToken.IsActive)
        {
            _logger.LogWarning("Refresh token is no longer active for UserId: {UserId}", storedToken.UserId);
            
            // If token was revoked, revoke all tokens for this user (potential token theft)
            if (storedToken.IsRevoked)
            {
                await _refreshTokenRepository.RevokeAllByUserIdAsync(storedToken.UserId);
                _logger.LogWarning("Potential token theft detected. All tokens revoked for UserId: {UserId}", storedToken.UserId);
            }
            
            return null;
        }

        var user = await _userRepository.GetByIdAsync(storedToken.UserId);
        if (user == null)
        {
            _logger.LogWarning("User not found for refresh token: {UserId}", storedToken.UserId);
            return null;
        }

        // Rotate refresh token (revoke old, create new)
        storedToken.RevokedAt = DateTime.UtcNow;
        var newRefreshToken = await GenerateRefreshTokenAsync(user.Id);
        storedToken.ReplacedByToken = newRefreshToken.Token;
        await _refreshTokenRepository.UpdateAsync(storedToken);

        var accessToken = GenerateJwtToken(user);

        _logger.LogInformation("Token refreshed successfully for UserId: {UserId}", user.Id);
        return new AuthResponse(accessToken, newRefreshToken.Token, user.Email, user.FullName, user.IsEmailVerified);
    }

    public async Task<bool> RevokeTokenAsync(string refreshToken)
    {
        var storedToken = await _refreshTokenRepository.GetByTokenAsync(refreshToken);
        
        if (storedToken == null || !storedToken.IsActive)
        {
            return false;
        }

        storedToken.RevokedAt = DateTime.UtcNow;
        await _refreshTokenRepository.UpdateAsync(storedToken);
        
        _logger.LogInformation("Refresh token revoked for UserId: {UserId}", storedToken.UserId);
        return true;
    }

    public async Task RevokeAllUserTokensAsync(string userId)
    {
        await _refreshTokenRepository.RevokeAllByUserIdAsync(userId);
        _logger.LogInformation("All refresh tokens revoked for UserId: {UserId}", userId);
    }

    private async Task<RefreshToken> GenerateRefreshTokenAsync(string userId, string? deviceInfo = null)
    {
        var refreshToken = new RefreshToken
        {
            UserId = userId,
            Token = GenerateSecureToken(),
            ExpiresAt = DateTime.UtcNow.AddDays(_jwtSettings.RefreshTokenExpireDays),
            DeviceInfo = deviceInfo
        };

        await _refreshTokenRepository.CreateAsync(refreshToken);
        return refreshToken;
    }

    private string GenerateJwtToken(User user)
    {
        var securityKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_jwtSettings.Key));
        var credentials = new SigningCredentials(securityKey, SecurityAlgorithms.HmacSha256);

        var claims = new[]
        {
            new Claim(JwtRegisteredClaimNames.Sub, user.Id),
            new Claim(JwtRegisteredClaimNames.Email, user.Email),
            new Claim(ClaimTypes.Name, user.FullName),
            new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString())
        };

        var token = new JwtSecurityToken(
            issuer: _jwtSettings.Issuer,
            audience: _jwtSettings.Audience,
            claims: claims,
            expires: DateTime.UtcNow.AddMinutes(_jwtSettings.AccessTokenExpireMinutes),
            signingCredentials: credentials
        );

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    private static string GenerateVerificationCode()
    {
        // Generate 6-digit code
        return RandomNumberGenerator.GetInt32(100000, 999999).ToString();
    }

    private static string GenerateSecureToken()
    {
        var bytes = new byte[32];
        RandomNumberGenerator.Fill(bytes);
        return Convert.ToBase64String(bytes).Replace("+", "-").Replace("/", "_").TrimEnd('=');
    }

    private static bool IsValidEmail(string email)
    {
        if (string.IsNullOrWhiteSpace(email))
            return false;

        // Basic email validation pattern
        var pattern = @"^[^@\s]+@[^@\s]+\.[^@\s]+$";
        return Regex.IsMatch(email, pattern, RegexOptions.IgnoreCase);
    }

    private static (bool IsValid, string Message) ValidatePassword(string password)
    {
        if (string.IsNullOrWhiteSpace(password))
            return (false, "Password is required");

        if (password.Length < 8)
            return (false, "Password must be at least 8 characters long");

        if (!password.Any(char.IsUpper))
            return (false, "Password must contain at least one uppercase letter");

        if (!password.Any(char.IsLower))
            return (false, "Password must contain at least one lowercase letter");

        if (!password.Any(char.IsDigit))
            return (false, "Password must contain at least one number");

        if (!password.Any(c => !char.IsLetterOrDigit(c)))
            return (false, "Password must contain at least one special character");

        return (true, "Password is valid");
    }
}
