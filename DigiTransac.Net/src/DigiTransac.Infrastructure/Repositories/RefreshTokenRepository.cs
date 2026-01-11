using DigiTransac.Core.Models;
using DigiTransac.Infrastructure.Interfaces;
using MongoDB.Driver;

namespace DigiTransac.Infrastructure.Repositories;

public class RefreshTokenRepository : IRefreshTokenRepository
{
    private readonly IMongoCollection<RefreshToken> _refreshTokens;

    public RefreshTokenRepository(IMongoClient mongoClient)
    {
        var databaseName = Environment.GetEnvironmentVariable("MONGODB_DATABASE_NAME")
            ?? Environment.GetEnvironmentVariable("COSMOS_DATABASE_NAME")
            ?? "DigiTransacDB";

        var database = mongoClient.GetDatabase(databaseName);
        _refreshTokens = database.GetCollection<RefreshToken>("refreshTokens");

        // Create indexes for performance
        try
        {
            _refreshTokens.Indexes.CreateOne(
                new CreateIndexModel<RefreshToken>(
                    Builders<RefreshToken>.IndexKeys.Ascending(r => r.TokenHash)
                )
            );

            _refreshTokens.Indexes.CreateOne(
                new CreateIndexModel<RefreshToken>(
                    Builders<RefreshToken>.IndexKeys.Ascending(r => r.UserId)
                )
            );

            _refreshTokens.Indexes.CreateOne(
                new CreateIndexModel<RefreshToken>(
                    Builders<RefreshToken>.IndexKeys.Ascending(r => r.ExpiresAt),
                    new CreateIndexOptions { ExpireAfter = TimeSpan.Zero }
                )
            );
        }
        catch
        {
            // Index creation might fail if collection doesn't exist yet, which is fine
        }
    }

    public async Task<RefreshToken> CreateAsync(RefreshToken refreshToken)
    {
        refreshToken.CreatedAt = DateTime.UtcNow;
        await _refreshTokens.InsertOneAsync(refreshToken);
        return refreshToken;
    }

    public async Task<RefreshToken?> GetByTokenHashAsync(string tokenHash)
    {
        return await _refreshTokens
            .Find(r => r.TokenHash == tokenHash && !r.IsRevoked && r.ExpiresAt > DateTime.UtcNow)
            .FirstOrDefaultAsync();
    }

    public async Task<List<RefreshToken>> GetByUserIdAsync(string userId)
    {
        return await _refreshTokens
            .Find(r => r.UserId == userId && !r.IsRevoked && r.ExpiresAt > DateTime.UtcNow)
            .ToListAsync();
    }

    public async Task<bool> RevokeAsync(string tokenHash)
    {
        var result = await _refreshTokens.UpdateOneAsync(
            r => r.TokenHash == tokenHash,
            Builders<RefreshToken>.Update
                .Set(r => r.IsRevoked, true)
                .Set(r => r.RevokedAt, DateTime.UtcNow)
        );

        return result.ModifiedCount > 0;
    }

    public async Task<bool> RevokeAllUserTokensAsync(string userId)
    {
        var result = await _refreshTokens.UpdateManyAsync(
            r => r.UserId == userId && !r.IsRevoked,
            Builders<RefreshToken>.Update
                .Set(r => r.IsRevoked, true)
                .Set(r => r.RevokedAt, DateTime.UtcNow)
        );

        return result.ModifiedCount > 0;
    }

    public async Task DeleteExpiredAsync()
    {
        await _refreshTokens.DeleteManyAsync(
            r => r.ExpiresAt < DateTime.UtcNow
        );
    }
}
