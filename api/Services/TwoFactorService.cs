using OtpNet;
using DigiTransac.Api.Common;
using DigiTransac.Api.Models;
using DigiTransac.Api.Repositories;

namespace DigiTransac.Api.Services;

public interface ITwoFactorService
{
    /// <summary>
    /// Generates a new 2FA secret and returns setup information
    /// </summary>
    Task<TwoFactorSetupInfo> GenerateSetupInfoAsync(string userId, CancellationToken ct = default);
    
    /// <summary>
    /// Validates a TOTP code against the user's secret
    /// </summary>
    bool ValidateCode(string secret, string code);
    
    /// <summary>
    /// Enables 2FA for a user after verifying their code
    /// </summary>
    Task<Result> EnableTwoFactorAsync(string userId, string code, CancellationToken ct = default);
    
    /// <summary>
    /// Disables 2FA for a user after verifying password
    /// </summary>
    Task<Result> DisableTwoFactorAsync(string userId, string password, CancellationToken ct = default);
    
    /// <summary>
    /// Verifies 2FA code during login
    /// </summary>
    Task<bool> VerifyTwoFactorAsync(string userId, string code, CancellationToken ct = default);
}

public class TwoFactorSetupInfo
{
    public string Secret { get; set; } = null!;
    public string QrCodeUri { get; set; } = null!;
    public string ManualEntryKey { get; set; } = null!;
}

public class TwoFactorService : ITwoFactorService
{
    private readonly IUserRepository _userRepository;
    private readonly ILogger<TwoFactorService> _logger;
    private const string Issuer = "DigiTransac";

    public TwoFactorService(IUserRepository userRepository, ILogger<TwoFactorService> logger)
    {
        _userRepository = userRepository;
        _logger = logger;
    }

    public async Task<TwoFactorSetupInfo> GenerateSetupInfoAsync(string userId, CancellationToken ct = default)
    {
        var user = await _userRepository.GetByIdAsync(userId);
        if (user == null)
        {
            throw new InvalidOperationException("User not found");
        }

        // Generate a new secret key
        var secretKey = KeyGeneration.GenerateRandomKey(20);
        var base32Secret = Base32Encoding.ToString(secretKey);

        // Store the secret temporarily (will be confirmed when 2FA is enabled)
        user.TwoFactorSecret = base32Secret;
        await _userRepository.UpdateAsync(user);

        // Generate the otpauth URI for QR code
        var otpauthUri = GenerateOtpAuthUri(user.Email, base32Secret);

        _logger.LogInformation("Generated 2FA setup info for user {UserId}", userId);

        return new TwoFactorSetupInfo
        {
            Secret = base32Secret,
            QrCodeUri = otpauthUri,
            ManualEntryKey = FormatSecretForManualEntry(base32Secret)
        };
    }

    public bool ValidateCode(string secret, string code)
    {
        if (string.IsNullOrEmpty(secret) || string.IsNullOrEmpty(code))
        {
            return false;
        }

        try
        {
            var secretBytes = Base32Encoding.ToBytes(secret);
            var totp = new Totp(secretBytes);
            
            // Verify with a window of 1 step (30 seconds before and after)
            return totp.VerifyTotp(code, out _, new VerificationWindow(previous: 1, future: 1));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error validating TOTP code");
            return false;
        }
    }

    public async Task<Result> EnableTwoFactorAsync(string userId, string code, CancellationToken ct = default)
    {
        var user = await _userRepository.GetByIdAsync(userId);
        if (user == null)
            return Error.NotFound("User");

        if (user.TwoFactorEnabled)
            return Error.Validation("Two-factor authentication is already enabled");

        if (string.IsNullOrEmpty(user.TwoFactorSecret))
            return Error.Validation("Please generate a 2FA setup first");

        // Validate the code to ensure user has set up their authenticator app correctly
        if (!ValidateCode(user.TwoFactorSecret, code))
        {
            _logger.LogWarning("Invalid 2FA code during enable for user {UserId}", userId);
            return Error.Validation("Invalid verification code. Please check your authenticator app and try again.");
        }

        // Enable 2FA
        user.TwoFactorEnabled = true;
        await _userRepository.UpdateAsync(user);

        _logger.LogInformation("2FA enabled for user {UserId}", userId);
        return Result.Success();
    }

    public async Task<Result> DisableTwoFactorAsync(string userId, string password, CancellationToken ct = default)
    {
        var user = await _userRepository.GetByIdAsync(userId);
        if (user == null)
            return Error.NotFound("User");

        if (!user.TwoFactorEnabled)
            return Error.Validation("Two-factor authentication is not enabled");

        // Verify password before disabling 2FA
        if (!BCrypt.Net.BCrypt.Verify(password, user.PasswordHash))
        {
            _logger.LogWarning("Invalid password during 2FA disable for user {UserId}", userId);
            return Error.Unauthorized("Invalid password");
        }

        // Disable 2FA and clear the secret
        user.TwoFactorEnabled = false;
        user.TwoFactorSecret = null;
        await _userRepository.UpdateAsync(user);

        _logger.LogInformation("2FA disabled for user {UserId}", userId);
        return Result.Success();
    }

    public async Task<bool> VerifyTwoFactorAsync(string userId, string code, CancellationToken ct = default)
    {
        var user = await _userRepository.GetByIdAsync(userId);
        if (user == null || !user.TwoFactorEnabled || string.IsNullOrEmpty(user.TwoFactorSecret))
        {
            return false;
        }

        var isValid = ValidateCode(user.TwoFactorSecret, code);
        
        if (isValid)
        {
            _logger.LogInformation("2FA verification successful for user {UserId}", userId);
        }
        else
        {
            _logger.LogWarning("2FA verification failed for user {UserId}", userId);
        }

        return isValid;
    }

    private string GenerateOtpAuthUri(string email, string secret)
    {
        // Format: otpauth://totp/Issuer:email?secret=SECRET&issuer=Issuer&algorithm=SHA1&digits=6&period=30
        var encodedIssuer = Uri.EscapeDataString(Issuer);
        var encodedEmail = Uri.EscapeDataString(email);
        
        return $"otpauth://totp/{encodedIssuer}:{encodedEmail}?secret={secret}&issuer={encodedIssuer}&algorithm=SHA1&digits=6&period=30";
    }

    private string FormatSecretForManualEntry(string secret)
    {
        // Format the secret with spaces for easier manual entry (groups of 4)
        var formatted = string.Join(" ", Enumerable.Range(0, (secret.Length + 3) / 4)
            .Select(i => secret.Substring(i * 4, Math.Min(4, secret.Length - i * 4))));
        return formatted;
    }
}
