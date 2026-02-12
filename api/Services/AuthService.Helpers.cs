using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using DigiTransac.Api.Models;
using Microsoft.IdentityModel.Tokens;

namespace DigiTransac.Api.Services;

public partial class AuthService
{
    private async Task<RefreshToken> GenerateRefreshTokenAsync(string userId, string? deviceInfo = null, bool rememberMe = true)
    {
        var refreshToken = new RefreshToken
        {
            UserId = userId,
            Token = GenerateSecureToken(),
            ExpiresAt = DateTime.UtcNow.AddDays(_jwtSettings.RefreshTokenExpireDays),
            DeviceInfo = deviceInfo,
            RememberMe = rememberMe
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