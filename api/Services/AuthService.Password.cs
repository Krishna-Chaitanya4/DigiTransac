using DigiTransac.Api.Common;
using DigiTransac.Api.Models;
using DigiTransac.Api.Models.Dto;

namespace DigiTransac.Api.Services;

public partial class AuthService
{
    public async Task<Result> ChangePasswordAsync(string userId, string currentPassword, string newPassword)
    {
        _logger.LogInformation("Password change attempt for UserId: {UserId}", userId);

        var user = await _userRepository.GetByIdAsync(userId);
        if (user == null)
        {
            return DomainErrors.User.NotFound;
        }

        // Verify current password
        if (!BCrypt.Net.BCrypt.Verify(currentPassword, user.PasswordHash))
        {
            _logger.LogWarning("Password change failed - incorrect current password for UserId: {UserId}", userId);
            
            // Audit log for failed password change
            await _auditService.LogPasswordChangeAsync(userId, user.Email, false, "Incorrect current password");
            
            return DomainErrors.Auth.CurrentPasswordIncorrect;
        }

        // Validate new password strength
        var passwordValidation = ValidatePassword(newPassword);
        if (!passwordValidation.IsValid)
        {
            return DomainErrors.Auth.WeakPassword(passwordValidation.Message);
        }

        // Check new password is different
        if (BCrypt.Net.BCrypt.Verify(newPassword, user.PasswordHash))
        {
            return DomainErrors.Auth.NewPasswordSameAsCurrent;
        }

        // With server-side encryption, we don't need to re-encrypt the DEK
        // The DEK is wrapped with server KEK, not user password
        // Just update the password hash
        user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(newPassword);
        await _userRepository.UpdateAsync(user);

        _logger.LogInformation("Password changed successfully for UserId: {UserId}", userId);
        
        // Audit log for successful password change
        await _auditService.LogPasswordChangeAsync(userId, user.Email, true);
        
        return Result.Success();
    }

    public async Task<Result> SendPasswordResetCodeAsync(string email)
    {
        _logger.LogInformation("Sending password reset code to {Email}", email);

        // Validate email format
        if (!IsValidEmail(email))
        {
            _logger.LogWarning("Invalid email format for password reset: {Email}", email);
            return DomainErrors.Auth.InvalidEmail;
        }

        // Check if email exists
        var existingUser = await _userRepository.GetByEmailAsync(email);
        if (existingUser == null)
        {
            // Don't reveal that email doesn't exist (security best practice)
            _logger.LogWarning("Password reset attempted for non-existent email: {Email}", email);
            return Result.Success(); // Always return success for security
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
        return Result.Success();
    }

    public async Task<Result<string>> VerifyPasswordResetCodeAsync(string email, string code)
    {
        _logger.LogInformation("Verifying password reset code for {Email}", email);

        var verification = await _emailVerificationRepository.GetByEmailAndCodeAsync(email, code, VerificationPurpose.PasswordReset);
        
        if (verification == null)
        {
            _logger.LogWarning("Invalid or expired password reset code for {Email}", email);
            return DomainErrors.Auth.InvalidOrExpiredCode;
        }

        // Mark as verified and generate a token for password reset
        verification.IsVerified = true;
        verification.VerificationToken = GenerateSecureToken();
        verification.ExpiresAt = DateTime.UtcNow.AddMinutes(30);

        await _emailVerificationRepository.UpdateAsync(verification);

        _logger.LogInformation("Password reset code verified for {Email}", email);
        return verification.VerificationToken;
    }

    public async Task<Result> ResetPasswordAsync(ResetPasswordRequest request)
    {
        _logger.LogInformation("Resetting password for {Email}", request.Email);

        // Verify the token is valid
        var verification = await _emailVerificationRepository.GetByVerificationTokenAsync(request.VerificationToken, VerificationPurpose.PasswordReset);
        
        if (verification == null || verification.Email.ToLowerInvariant() != request.Email.ToLowerInvariant())
        {
            _logger.LogWarning("Invalid password reset token for {Email}", request.Email);
            return DomainErrors.Auth.InvalidOrExpiredResetToken;
        }

        // Validate password strength
        var passwordValidation = ValidatePassword(request.NewPassword);
        if (!passwordValidation.IsValid)
        {
            _logger.LogWarning("Password reset failed - weak password for {Email}: {Reason}", request.Email, passwordValidation.Message);
            return DomainErrors.Auth.WeakPassword(passwordValidation.Message);
        }

        // Get the user
        var user = await _userRepository.GetByEmailAsync(request.Email);
        if (user == null)
        {
            _logger.LogWarning("Password reset failed - user not found: {Email}", request.Email);
            return DomainErrors.User.NotFound;
        }

        // Update password
        user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.NewPassword);

        // With server-side encryption, the DEK doesn't need to change on password reset
        // Generate DEK if user doesn't have one (legacy account migration)
        if (user.WrappedDek == null)
        {
            var dek = _keyManagementService.GenerateDek();
            user.WrappedDek = await _keyManagementService.WrapKeyAsync(dek);
        }
        
        await _userRepository.UpdateAsync(user);

        // Clean up verification record
        await _emailVerificationRepository.DeleteByEmailAsync(request.Email, VerificationPurpose.PasswordReset);

        _logger.LogInformation("Password reset successfully for {Email}", request.Email);
        
        // Audit log for password reset
        await _auditService.LogAsync(
            AuditAction.PasswordReset,
            AuditCategory.AccountManagement,
            success: true,
            description: "Password reset via email verification",
            userId: user.Id,
            userEmail: user.Email);
        
        return Result.Success();
    }
}