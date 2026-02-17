using DigiTransac.Api.Models;
using DigiTransac.Api.Services;
using MongoDB.Driver;

namespace DigiTransac.Api.Repositories;

public interface IRefreshTokenRepository
{
    Task<RefreshToken?> GetByTokenAsync(string token, CancellationToken ct = default);
    Task<IEnumerable<RefreshToken>> GetByUserIdAsync(string userId, CancellationToken ct = default);
    Task<RefreshToken> CreateAsync(RefreshToken refreshToken, CancellationToken ct = default);
    Task UpdateAsync(RefreshToken refreshToken, CancellationToken ct = default);
    Task RevokeAllByUserIdAsync(string userId, CancellationToken ct = default);
    Task DeleteByUserIdAsync(string userId, CancellationToken ct = default);
    Task DeleteExpiredAsync(CancellationToken ct = default);
}

public class RefreshTokenRepository : IRefreshTokenRepository
{
    private readonly IMongoCollection<RefreshToken> _refreshTokens;

    public RefreshTokenRepository(IMongoDbService mongoDbService)
    {
        _refreshTokens = mongoDbService.GetCollection<RefreshToken>("refresh_tokens");

        // Create index on token for fast lookups
        var tokenIndex = Builders<RefreshToken>.IndexKeys.Ascending(t => t.Token);
        _refreshTokens.Indexes.CreateOne(new CreateIndexModel<RefreshToken>(
            tokenIndex, 
            new CreateIndexOptions { Unique = true }
        ));

        // Create index on userId for user lookups
        var userIdIndex = Builders<RefreshToken>.IndexKeys.Ascending(t => t.UserId);
        _refreshTokens.Indexes.CreateOne(new CreateIndexModel<RefreshToken>(userIdIndex));

        // Create TTL index to auto-delete expired tokens after 1 day grace period
        var ttlIndex = Builders<RefreshToken>.IndexKeys.Ascending(t => t.ExpiresAt);
        var ttlOptions = new CreateIndexOptions { ExpireAfter = TimeSpan.FromDays(1) };
        _refreshTokens.Indexes.CreateOne(new CreateIndexModel<RefreshToken>(ttlIndex, ttlOptions));
    }

    public async Task<RefreshToken?> GetByTokenAsync(string token, CancellationToken ct = default)
    {
        return await _refreshTokens
            .Find(t => t.Token == token)
            .FirstOrDefaultAsync(ct);
    }

    public async Task<IEnumerable<RefreshToken>> GetByUserIdAsync(string userId, CancellationToken ct = default)
    {
        return await _refreshTokens
            .Find(t => t.UserId == userId)
            .ToListAsync(ct);
    }

    public async Task<RefreshToken> CreateAsync(RefreshToken refreshToken, CancellationToken ct = default)
    {
        await _refreshTokens.InsertOneAsync(refreshToken, options: null, ct);
        return refreshToken;
    }

    public async Task UpdateAsync(RefreshToken refreshToken, CancellationToken ct = default)
    {
        await _refreshTokens.ReplaceOneAsync(t => t.Id == refreshToken.Id, refreshToken, options: (ReplaceOptions?)null, ct);
    }

    public async Task RevokeAllByUserIdAsync(string userId, CancellationToken ct = default)
    {
        var update = Builders<RefreshToken>.Update
            .Set(t => t.RevokedAt, DateTime.UtcNow);
        
        await _refreshTokens.UpdateManyAsync(
            t => t.UserId == userId && t.RevokedAt == null,
            update, options: null, ct
        );
    }

    public async Task DeleteByUserIdAsync(string userId, CancellationToken ct = default)
    {
        await _refreshTokens.DeleteManyAsync(t => t.UserId == userId, ct);
    }

    public async Task DeleteExpiredAsync(CancellationToken ct = default)
    {
        await _refreshTokens.DeleteManyAsync(
            t => t.ExpiresAt < DateTime.UtcNow && t.RevokedAt != null, ct
        );
    }
}
