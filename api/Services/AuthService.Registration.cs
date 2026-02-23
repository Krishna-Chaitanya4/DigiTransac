using System.Security.Cryptography;
using DigiTransac.Api.Common;
using DigiTransac.Api.Models;
using DigiTransac.Api.Models.Dto;

namespace DigiTransac.Api.Services;

public partial class AuthService
{
    public async Task<Result> SendVerificationCodeAsync(string email, CancellationToken ct = default)
    {
        _logger.LogDebug("Verification code request for {EmailPrefix}***", email[..Math.Min(3, email.Length)]);

        // Validate email format
        if (!IsValidEmail(email))
        {
            _logger.LogWarning("Invalid email format attempted");
            return DomainErrors.Auth.InvalidEmail;
        }

        // Check if email already registered — return generic success to prevent enumeration
        var existingUser = await _userRepository.GetByEmailAsync(email);
        if (existingUser != null)
        {
            _logger.LogDebug("Verification skipped for existing email");
            return Result.Success(); // Don't reveal that the email is already registered
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

        _logger.LogInformation("Verification code sent successfully");
        return Result.Success();
    }

    public async Task<Result<string>> VerifyCodeAsync(string email, string code, CancellationToken ct = default)
    {
        _logger.LogInformation("Verifying code for {Email}", email);

        var verification = await _emailVerificationRepository.GetByEmailAndCodeAsync(email, code, VerificationPurpose.Registration);
        
        if (verification == null)
        {
            _logger.LogWarning("Invalid or expired verification code for {Email}", email);
            return DomainErrors.Auth.InvalidOrExpiredCode;
        }

        // Mark as verified and generate a token for registration
        verification.IsVerified = true;
        verification.VerificationToken = GenerateSecureToken();
        verification.ExpiresAt = DateTime.UtcNow.AddMinutes(30); // 30 mins to complete registration

        await _emailVerificationRepository.UpdateAsync(verification);

        _logger.LogInformation("Email verified successfully for {Email}", email);
        return verification.VerificationToken;
    }

    public async Task<AuthResponse?> CompleteRegistrationAsync(CompleteRegistrationRequest request, CancellationToken ct = default)
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

        // Generate server-side DEK for user (wrapped with server KEK)
        var dek = _keyManagementService.GenerateDek();
        var wrappedDek = await _keyManagementService.WrapKeyAsync(dek);

        // Create user
        var user = new User
        {
            Email = request.Email,
            FullName = request.FullName,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password),
            IsEmailVerified = true, // Already verified!
            PrimaryCurrency = primaryCurrency,
            WrappedDek = wrappedDek,
            CreatedAt = DateTime.UtcNow
        };

        await _userRepository.CreateAsync(user);

        // Create default labels for the new user
        await _labelService.CreateDefaultLabelsAsync(user.Id);

        // Create welcome message in Personal conversation (self-chat)
        // This ensures the Personal conversation is always visible for new users
        await _chatMessageRepository.CreateSystemMessageAsync(
            userId: user.Id,
            counterpartyUserId: user.Id, // Self-chat: sender and recipient are the same
            content: "👋 Welcome to DigiTransac! This is your personal space for notes, reminders, and tracking transactions that don't involve other DigiTransac users.",
            systemSource: "Registration"
        );

        // Clean up verification record
        await _emailVerificationRepository.DeleteByEmailAsync(request.Email, VerificationPurpose.Registration);

        _logger.LogInformation("User registered successfully, UserId: {UserId}", user.Id);

        var accessToken = GenerateJwtToken(user);
        var refreshToken = await GenerateRefreshTokenAsync(user.Id);
        
        return new AuthResponse(accessToken, refreshToken.Token, user.Email, user.FullName, user.IsEmailVerified, user.PrimaryCurrency);
    }
}