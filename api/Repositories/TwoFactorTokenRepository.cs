using DigiTransac.Api.Models;
using DigiTransac.Api.Services;
using MongoDB.Driver;

namespace DigiTransac.Api.Repositories;

public interface ITwoFactorTokenRepository
{
    Task<TwoFactorToken?> GetByTokenAsync(string token);
    Task<TwoFactorToken> CreateAsync(TwoFactorToken twoFactorToken);
    Task MarkAsUsedAsync(string id);
    Task DeleteByUserIdAsync(string userId);
    Task SetEmailOtpAsync(string id, string emailOtpCode);
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

    public async Task<TwoFactorToken?> GetByTokenAsync(string token)
    {
        return await _tokens
            .Find(t => t.Token == token && !t.IsUsed && t.ExpiresAt > DateTime.UtcNow)
            .FirstOrDefaultAsync();
    }

    public async Task<TwoFactorToken> CreateAsync(TwoFactorToken twoFactorToken)
    {
        await _tokens.InsertOneAsync(twoFactorToken);
        return twoFactorToken;
    }

    public async Task MarkAsUsedAsync(string id)
    {
        var update = Builders<TwoFactorToken>.Update.Set(t => t.IsUsed, true);
        await _tokens.UpdateOneAsync(t => t.Id == id, update);
    }

    public async Task SetEmailOtpAsync(string id, string emailOtpCode)
    {
        var update = Builders<TwoFactorToken>.Update
            .Set(t => t.EmailOtpCode, emailOtpCode)
            .Set(t => t.EmailOtpSentAt, DateTime.UtcNow);
        await _tokens.UpdateOneAsync(t => t.Id == id, update);
    }

    public async Task DeleteByUserIdAsync(string userId)
    {
        await _tokens.DeleteManyAsync(t => t.UserId == userId);
    }
}
