using DigiTransac.Api.Models;
using DigiTransac.Api.Models.Dto;

namespace DigiTransac.Api.Services;

public partial class AuthService
{
    public async Task<AuthResponse?> RefreshTokenAsync(string refreshToken, CancellationToken ct = default)
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

        // Rotate refresh token (revoke old, create new — preserve rememberMe preference)
        storedToken.RevokedAt = DateTime.UtcNow;
        var newRefreshToken = await GenerateRefreshTokenAsync(user.Id, rememberMe: storedToken.RememberMe);
        storedToken.ReplacedByToken = newRefreshToken.Token;
        await _refreshTokenRepository.UpdateAsync(storedToken);

        var accessToken = GenerateJwtToken(user);

        _logger.LogInformation("Token refreshed successfully for UserId: {UserId}", user.Id);
        return new AuthResponse(accessToken, newRefreshToken.Token, user.Email, user.FullName, user.IsEmailVerified, user.PrimaryCurrency, storedToken.RememberMe);
    }

    public async Task<bool> RevokeTokenAsync(string refreshToken, CancellationToken ct = default)
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

    public async Task RevokeAllUserTokensAsync(string userId, CancellationToken ct = default)
    {
        await _refreshTokenRepository.RevokeAllByUserIdAsync(userId);
        _logger.LogInformation("All refresh tokens revoked for UserId: {UserId}", userId);
    }
}