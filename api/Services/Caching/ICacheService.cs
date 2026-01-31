namespace DigiTransac.Api.Services.Caching;

/// <summary>
/// Abstraction for caching operations.
/// Supports cache-aside pattern with automatic refresh.
/// </summary>
public interface ICacheService
{
    /// <summary>
    /// Gets an item from cache, or creates it using the factory if not present.
    /// </summary>
    Task<T?> GetOrCreateAsync<T>(
        string key, 
        Func<Task<T>> factory, 
        CacheOptions? options = null,
        CancellationToken cancellationToken = default);
    
    /// <summary>
    /// Gets an item from cache by key.
    /// </summary>
    Task<T?> GetAsync<T>(string key, CancellationToken cancellationToken = default);
    
    /// <summary>
    /// Sets an item in cache.
    /// </summary>
    Task SetAsync<T>(string key, T value, CacheOptions? options = null, CancellationToken cancellationToken = default);
    
    /// <summary>
    /// Removes an item from cache.
    /// </summary>
    Task RemoveAsync(string key, CancellationToken cancellationToken = default);
    
    /// <summary>
    /// Removes all items matching a pattern (e.g., "user:123:*").
    /// </summary>
    Task RemoveByPatternAsync(string pattern, CancellationToken cancellationToken = default);
    
    /// <summary>
    /// Invalidates cache entries by tag.
    /// </summary>
    Task InvalidateByTagAsync(string tag, CancellationToken cancellationToken = default);
}

/// <summary>
/// Options for cache entries
/// </summary>
public record CacheOptions
{
    /// <summary>
    /// How long the item should be cached
    /// </summary>
    public TimeSpan? AbsoluteExpiration { get; init; }
    
    /// <summary>
    /// Sliding expiration - resets each time the item is accessed
    /// </summary>
    public TimeSpan? SlidingExpiration { get; init; }
    
    /// <summary>
    /// Tags for cache invalidation
    /// </summary>
    public string[]? Tags { get; init; }
    
    /// <summary>
    /// Size of the cache entry (for memory cache)
    /// </summary>
    public int Size { get; init; } = 1;
    
    // Preset options for common scenarios
    public static CacheOptions Short => new() { AbsoluteExpiration = TimeSpan.FromSeconds(30) };
    public static CacheOptions Medium => new() { AbsoluteExpiration = TimeSpan.FromMinutes(2) };
    public static CacheOptions Long => new() { AbsoluteExpiration = TimeSpan.FromMinutes(10) };
    public static CacheOptions ExchangeRates => new() { AbsoluteExpiration = TimeSpan.FromMinutes(5), Tags = new[] { "exchange-rates" } };
    
    public static CacheOptions ForUser(string userId) => new() 
    { 
        AbsoluteExpiration = TimeSpan.FromMinutes(2),
        Tags = new[] { $"user:{userId}" }
    };
}

/// <summary>
/// Cache key generator for consistent key naming
/// </summary>
public static class CacheKeys
{
    public static string UserLabels(string userId) => $"labels:user:{userId}";
    public static string UserTags(string userId) => $"tags:user:{userId}";
    public static string UserAccounts(string userId) => $"accounts:user:{userId}";
    public static string UserAccountsWithArchived(string userId) => $"accounts:user:{userId}:all";
    public static string Transaction(string id) => $"transaction:{id}";
    public static string UserDek(string userId) => $"dek:user:{userId}";
    public static string ExchangeRates => "exchange-rates:latest";
    public static string UserTransactionSummary(string userId, string filterHash) => $"summary:user:{userId}:{filterHash}";
}