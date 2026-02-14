using DigiTransac.Api.Common;
using DigiTransac.Api.Models;
using DigiTransac.Api.Models.Dto;

namespace DigiTransac.Api.Services;

public partial class AuthService
{
    public async Task<Result> DeleteAccountAsync(string userId, string password)
    {
        _logger.LogInformation("Delete account request for UserId: {UserId}", userId);

        var user = await _userRepository.GetByIdAsync(userId);
        if (user == null)
        {
            _logger.LogWarning("Delete account failed - user not found: {UserId}", userId);
            return DomainErrors.User.NotFound;
        }

        var userEmail = user.Email;

        // Verify password
        if (!BCrypt.Net.BCrypt.Verify(password, user.PasswordHash))
        {
            _logger.LogWarning("Delete account failed - invalid password for UserId: {UserId}", userId);
            
            // Audit log for failed account deletion attempt
            await _auditService.LogAsync(
                AuditAction.AccountDeleted,
                AuditCategory.AccountManagement,
                success: false,
                description: "Account deletion attempt failed - invalid password",
                userId: userId,
                userEmail: userEmail);
            
            return DomainErrors.Auth.InvalidPassword;
        }

        // Delete all associated data
        // Note: DeleteAll* repository methods don't support IClientSessionHandle,
        // so we execute sequentially with best-effort cleanup on failure.
        // A partial failure is logged but doesn't leave dangling auth state since
        // the user record is deleted last.
        _logger.LogInformation("Deleting all data for user: {Email}", userEmail);

        try
        {
            // 1. Delete all transactions for the user
            await _transactionRepository.DeleteAllByUserIdAsync(userId);
            _logger.LogInformation("Deleted transactions for user: {UserId}", userId);

            // 2. Delete all accounts for the user
            await _accountRepository.DeleteAllByUserIdAsync(userId);
            _logger.LogInformation("Deleted accounts for user: {UserId}", userId);

            // 3. Delete all labels for the user
            await _labelRepository.DeleteAllByUserIdAsync(userId);
            _logger.LogInformation("Deleted labels for user: {UserId}", userId);

            // 4. Delete all tags for the user
            await _tagRepository.DeleteAllByUserIdAsync(userId);
            _logger.LogInformation("Deleted tags for user: {UserId}", userId);

            // 5. Delete all budgets for the user
            await _budgetRepository.DeleteAllByUserIdAsync(userId);
            _logger.LogInformation("Deleted budgets for user: {UserId}", userId);

            // 6. Delete all chat messages for the user (both sent and received)
            await _chatMessageRepository.DeleteAllByUserIdAsync(userId);
            _logger.LogInformation("Deleted chat messages for user: {UserId}", userId);

            // 7. Delete all refresh tokens for the user
            await _refreshTokenRepository.DeleteByUserIdAsync(userId);
            _logger.LogInformation("Deleted refresh tokens for user: {UserId}", userId);

            // 8. Delete all two-factor tokens for the user
            await _twoFactorTokenRepository.DeleteAllByUserIdAsync(userId);
            _logger.LogInformation("Deleted two-factor tokens for user: {UserId}", userId);

            // 9. Delete all email verifications for the user
            await _emailVerificationRepository.DeleteAllByEmailAsync(userEmail);
            _logger.LogInformation("Deleted email verifications for user: {UserId}", userId);

            // 10. Delete the user record (last, so partial failure still leaves a valid user)
            var deleted = await _userRepository.DeleteAsync(userId);
            if (!deleted)
            {
                throw new InvalidOperationException($"Failed to delete user record for UserId: {userId}");
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Delete account failed during transactional deletion for UserId: {UserId}", userId);
            return DomainErrors.Auth.AccountDeletionFailed;
        }

        _logger.LogInformation("Account deleted successfully with all associated data: {Email}", userEmail);
        
        // Audit log for successful account deletion (outside transaction - fire and forget)
        await _auditService.LogAccountDeletedAsync(userId, userEmail);
        
        return Result.Success();
    }

    public async Task<Result> UpdateNameAsync(string userId, string newName)
    {
        _logger.LogInformation("Update name request for UserId: {UserId}", userId);

        if (string.IsNullOrWhiteSpace(newName))
        {
            return DomainErrors.Auth.NameEmpty;
        }

        if (newName.Length < 2 || newName.Length > 100)
        {
            return DomainErrors.Auth.NameLength;
        }

        var user = await _userRepository.GetByIdAsync(userId);
        if (user == null)
        {
            _logger.LogWarning("Update name failed - user not found: {UserId}", userId);
            return DomainErrors.User.NotFound;
        }

        user.FullName = newName.Trim();
        await _userRepository.UpdateAsync(user);

        _logger.LogInformation("Name updated successfully for UserId: {UserId}", userId);
        return Result.Success();
    }

    public async Task<Result> SendEmailChangeCodeAsync(string userId, string newEmail)
    {
        _logger.LogInformation("Email change request for UserId: {UserId} to {NewEmail}", userId, newEmail);

        if (!IsValidEmail(newEmail))
        {
            return DomainErrors.Auth.InvalidEmail;
        }

        var user = await _userRepository.GetByIdAsync(userId);
        if (user == null)
        {
            _logger.LogWarning("Email change failed - user not found: {UserId}", userId);
            return DomainErrors.User.NotFound;
        }

        var normalizedNewEmail = newEmail.ToLowerInvariant();

        // Check if new email is same as current
        if (user.Email == normalizedNewEmail)
        {
            return DomainErrors.Auth.EmailSameAsCurrent;
        }

        // Check if email is already taken by another user
        var existingUser = await _userRepository.GetByEmailAsync(normalizedNewEmail);
        if (existingUser != null)
        {
            _logger.LogWarning("Email change failed - email already in use: {NewEmail}", normalizedNewEmail);
            return DomainErrors.Auth.EmailAlreadyInUse;
        }

        // Generate and send verification code
        var code = GenerateVerificationCode();
        
        // Delete any existing email change verification for this email
        await _emailVerificationRepository.DeleteByEmailAsync(normalizedNewEmail, VerificationPurpose.EmailChange);

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
        return Result.Success();
    }

    public async Task<Result> VerifyAndUpdateEmailAsync(string userId, string newEmail, string code)
    {
        _logger.LogInformation("Verifying email change for UserId: {UserId}", userId);

        var normalizedNewEmail = newEmail.ToLowerInvariant();

        // Find the verification record
        var verification = await _emailVerificationRepository.GetByEmailAndCodeAsync(normalizedNewEmail, code, VerificationPurpose.EmailChange);
        
        if (verification == null || verification.ExpiresAt < DateTime.UtcNow || verification.UserId != userId)
        {
            _logger.LogWarning("Invalid or expired email change code for {NewEmail}", normalizedNewEmail);
            return DomainErrors.Auth.InvalidOrExpiredCode;
        }

        // Verify email isn't taken (double-check)
        var existingUser = await _userRepository.GetByEmailAsync(normalizedNewEmail);
        if (existingUser != null)
        {
            return DomainErrors.Auth.EmailAlreadyInUse;
        }

        var user = await _userRepository.GetByIdAsync(userId);
        if (user == null)
        {
            return DomainErrors.User.NotFound;
        }

        var oldEmail = user.Email;
        user.Email = normalizedNewEmail;
        await _userRepository.UpdateAsync(user);

        // Clean up verification record
        await _emailVerificationRepository.DeleteByEmailAsync(normalizedNewEmail, VerificationPurpose.EmailChange);

        _logger.LogInformation("Email changed successfully from {OldEmail} to {NewEmail}", oldEmail, normalizedNewEmail);
        return Result.Success();
    }
}