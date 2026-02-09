using DigiTransac.Api.Models;
using DigiTransac.Api.Services;
using MongoDB.Bson;
using MongoDB.Driver;

namespace DigiTransac.Api.Repositories;

public interface IPushSubscriptionRepository
{
    /// <summary>
    /// Get all push subscriptions for a user
    /// </summary>
    Task<List<PushSubscription>> GetByUserIdAsync(string userId);

    /// <summary>
    /// Get a subscription by its endpoint
    /// </summary>
    Task<PushSubscription?> GetByEndpointAsync(string endpoint);

    /// <summary>
    /// Create a new push subscription
    /// </summary>
    Task<PushSubscription> CreateAsync(PushSubscription subscription);

    /// <summary>
    /// Update a subscription (e.g., update lastUsedAt)
    /// </summary>
    Task UpdateAsync(PushSubscription subscription);

    /// <summary>
    /// Delete a subscription by ID
    /// </summary>
    Task<bool> DeleteAsync(string id);

    /// <summary>
    /// Delete a subscription by endpoint
    /// </summary>
    Task<bool> DeleteByEndpointAsync(string endpoint);

    /// <summary>
    /// Delete all subscriptions for a user
    /// </summary>
    Task<long> DeleteByUserIdAsync(string userId);

    /// <summary>
    /// Mark a subscription's last used time
    /// </summary>
    Task UpdateLastUsedAsync(string id);
}

public class PushSubscriptionRepository : IPushSubscriptionRepository
{
    private readonly IMongoCollection<PushSubscription> _subscriptions;
    private readonly ILogger<PushSubscriptionRepository> _logger;
    private static bool _indexesCreated = false;
    private static readonly object _indexLock = new();

    public PushSubscriptionRepository(IMongoDbService mongoDbService, ILogger<PushSubscriptionRepository> logger)
    {
        _subscriptions = mongoDbService.GetCollection<PushSubscription>("pushSubscriptions");
        _logger = logger;

        // Create indexes (only once per application lifecycle)
        if (!_indexesCreated)
        {
            lock (_indexLock)
            {
                if (!_indexesCreated)
                {
                    try
                    {
                        // Unique index on endpoint - each browser can only have one subscription
                        var endpointIndex = Builders<PushSubscription>.IndexKeys.Ascending(s => s.Endpoint);
                        var endpointOptions = new CreateIndexOptions { Unique = true };
                        _subscriptions.Indexes.CreateOne(new CreateIndexModel<PushSubscription>(endpointIndex, endpointOptions));

                        // Index on userId for efficient lookup
                        var userIdIndex = Builders<PushSubscription>.IndexKeys.Ascending(s => s.UserId);
                        _subscriptions.Indexes.CreateOne(new CreateIndexModel<PushSubscription>(userIdIndex));

                        _logger.LogInformation("Push subscription indexes created successfully");
                    }
                    catch (MongoCommandException ex)
                    {
                        // Index already exists - this is okay
                        _logger.LogDebug(ex, "Push subscription indexes already exist");
                    }
                    _indexesCreated = true;
                }
            }
        }
    }

    public async Task<List<PushSubscription>> GetByUserIdAsync(string userId)
    {
        var filter = Builders<PushSubscription>.Filter.Eq(s => s.UserId, userId) &
                     Builders<PushSubscription>.Filter.Eq(s => s.IsEnabled, true);
        return await _subscriptions.Find(filter).ToListAsync();
    }

    public async Task<PushSubscription?> GetByEndpointAsync(string endpoint)
    {
        return await _subscriptions.Find(s => s.Endpoint == endpoint).FirstOrDefaultAsync();
    }

    public async Task<PushSubscription> CreateAsync(PushSubscription subscription)
    {
        await _subscriptions.InsertOneAsync(subscription);
        _logger.LogInformation("Created push subscription {Id} for user {UserId}", subscription.Id, subscription.UserId);
        return subscription;
    }

    public async Task UpdateAsync(PushSubscription subscription)
    {
        await _subscriptions.ReplaceOneAsync(s => s.Id == subscription.Id, subscription);
    }

    public async Task<bool> DeleteAsync(string id)
    {
        var filter = Builders<PushSubscription>.Filter.Eq("_id", new ObjectId(id));
        var result = await _subscriptions.DeleteOneAsync(filter);
        if (result.DeletedCount > 0)
        {
            _logger.LogInformation("Deleted push subscription {Id}", id);
        }
        return result.DeletedCount > 0;
    }

    public async Task<bool> DeleteByEndpointAsync(string endpoint)
    {
        var result = await _subscriptions.DeleteOneAsync(s => s.Endpoint == endpoint);
        if (result.DeletedCount > 0)
        {
            _logger.LogInformation("Deleted push subscription by endpoint");
        }
        return result.DeletedCount > 0;
    }

    public async Task<long> DeleteByUserIdAsync(string userId)
    {
        var result = await _subscriptions.DeleteManyAsync(s => s.UserId == userId);
        _logger.LogInformation("Deleted {Count} push subscriptions for user {UserId}", result.DeletedCount, userId);
        return result.DeletedCount;
    }

    public async Task UpdateLastUsedAsync(string id)
    {
        var update = Builders<PushSubscription>.Update.Set(s => s.LastUsedAt, DateTime.UtcNow);
        await _subscriptions.UpdateOneAsync(s => s.Id == id, update);
    }
}