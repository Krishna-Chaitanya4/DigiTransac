using DigiTransac.Core.Models;

namespace DigiTransac.Infrastructure.Interfaces;

public interface IRefreshTokenRepository
{
    Task<RefreshToken> CreateAsync(RefreshToken refreshToken);
    Task<RefreshToken?> GetByTokenHashAsync(string tokenHash);
    Task<List<RefreshToken>> GetByUserIdAsync(string userId);
    Task<bool> RevokeAsync(string tokenHash);
    Task<bool> RevokeAllUserTokensAsync(string userId);
    Task DeleteExpiredAsync();
}
