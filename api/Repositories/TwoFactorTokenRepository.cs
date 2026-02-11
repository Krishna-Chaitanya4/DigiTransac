using DigiTransac.Api.Models;
using DigiTransac.Api.Services;
using MongoDB.Driver;

namespace DigiTransac.Api.Repositories;

public interface ITwoFactorTokenRepository
{
    Task<TwoFactorToken?> GetByTokenAsync(string token, CancellationToken ct = default);
    Task<TwoFactorToken> CreateAsync(TwoFactorToken twoFactorToken, CancellationToken ct = default);
    Task MarkAsUsedAsync(string id, CancellationToken ct = default);
    Task DeleteByUserIdAsync(string userId, CancellationToken ct = default);
    Task DeleteAllByUserIdAsync(string userId, CancellationToken ct = default);
    Task SetEmailOtpAsync(string id, string emailOtpCode, CancellationToken ct = default);
}

public class TwoFactorTokenRepository : ITwoFactorTokenRepository
{
    private readonly IMongoCollection<TwoFactorToken> _tokens;

    public TwoFactorTokenRepository(IMongoDbService mongoDbService)
    {
        _tokens = mongoDbService.GetCollection<TwoFactorToken>("two_factor_tokens");

        // Create index on token
        var tokenIndex = Builders<TwoFactorToken>.IndexKeys.Ascending(t => t.Token);
        _tokens.Indexes.CreateOne(new CreateIndexModel<TwoFactorToken>(tokenIndex));

        // Create index on userId
        var userIndex = Builders<TwoFactorToken>.IndexKeys.Ascending(t => t.UserId);
        _tokens.Indexes.CreateOne(new CreateIndexModel<TwoFactorToken>(userIndex));

        // Create TTL index to auto-delete expired tokens after 10 minutes
        var ttlIndex = Builders<TwoFactorToken>.IndexKeys.Ascending(t => t.ExpiresAt);
        var ttlOptions = new CreateIndexOptions { ExpireAfter = TimeSpan.Zero };
        _tokens.Indexes.CreateOne(new CreateIndexModel<TwoFactorToken>(ttlIndex, ttlOptions));
    }

    public async Task<TwoFactorToken?> GetByTokenAsync(string token, CancellationToken ct = default)
    {
        return await _tokens
            .Find(t => t.Token == token && !t.IsUsed && t.ExpiresAt > DateTime.UtcNow)
            .FirstOrDefaultAsync(ct);
    }

    public async Task<TwoFactorToken> CreateAsync(TwoFactorToken twoFactorToken, CancellationToken ct = default)
    {
        await _tokens.InsertOneAsync(twoFactorToken, options: null, ct);
        return twoFactorToken;
    }

    public async Task MarkAsUsedAsync(string id, CancellationToken ct = default)
    {
        var update = Builders<TwoFactorToken>.Update.Set(t => t.IsUsed, true);
        await _tokens.UpdateOneAsync(t => t.Id == id, update, options: null, ct);
    }

    public async Task SetEmailOtpAsync(string id, string emailOtpCode, CancellationToken ct = default)
    {
        var update = Builders<TwoFactorToken>.Update
            .Set(t => t.EmailOtpCode, emailOtpCode)
            .Set(t => t.EmailOtpSentAt, DateTime.UtcNow);
        await _tokens.UpdateOneAsync(t => t.Id == id, update, options: null, ct);
    }

    public async Task DeleteByUserIdAsync(string userId, CancellationToken ct = default)
    {
        await _tokens.DeleteManyAsync(t => t.UserId == userId, ct);
    }

    public async Task DeleteAllByUserIdAsync(string userId, CancellationToken ct = default)
    {
        // Alias for DeleteByUserIdAsync for consistency
        await DeleteByUserIdAsync(userId, ct);
    }
}
