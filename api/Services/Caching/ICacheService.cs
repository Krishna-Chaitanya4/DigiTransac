namespace DigiTransac.Api.Services.Caching;

/// <summary>
/// Abstraction for caching operations with support for tags, pattern-based removal,
/// and configurable expiration. Implementations include in-memory (MemoryCacheService)
/// and distributed Redis (RedisCacheService).
/// </summary>
public interface ICacheService
{
    /// <summary>
    /// Gets a cached value by key, returning default if not found or expired.
    /// </summary>
    Task<T?> GetAsync<T>(string key, CancellationToken cancellationToken = default);

    /// <summary>
    /// Sets a value in cache with the specified options.
    /// </summary>
    Task SetAsync<T>(string key, T value, CacheOptions? options = null, CancellationToken cancellationToken = default);

    /// <summary>
    /// Gets or creates a cached value. If the key exists, returns the cached value.
    /// If not, calls the factory to create the value, caches it, and returns it.
    /// </summary>
    Task<T?> GetOrCreateAsync<T>(string key, Func<Task<T>> factory, CacheOptions? options = null, CancellationToken cancellationToken = default);

    /// <summary>
    /// Removes a specific key from cache.
    /// </summary>
    Task RemoveAsync(string key, CancellationToken cancellationToken = default);

    /// <summary>
    /// Removes all keys matching a glob pattern (e.g., "user:123:*").
    /// </summary>
    Task RemoveByPatternAsync(string pattern, CancellationToken cancellationToken = default);

    /// <summary>
    /// Invalidates all cache entries associated with the given tag.
    /// </summary>
    Task InvalidateByTagAsync(string tag, CancellationToken cancellationToken = default);
}

/// <summary>
/// Options for configuring cache entry behavior.
/// </summary>
public class CacheOptions
{
    /// <summary>
    /// Absolute expiration relative to now. Defaults to 5 minutes if not set.
    /// </summary>
    public TimeSpan? AbsoluteExpiration { get; set; }

    /// <summary>
    /// Sliding expiration — the entry expires if not accessed within this duration.
    /// </summary>
    public TimeSpan? SlidingExpiration { get; set; }

    /// <summary>
    /// Size of the cache entry (for memory-constrained caches). Defaults to 1.
    /// </summary>
    public long? Size { get; set; }

    /// <summary>
    /// Tags for group-based invalidation (e.g., "user:123", "transactions").
    /// </summary>
    public IEnumerable<string>? Tags { get; set; }

    /// <summary>
    /// Creates cache options with a simple absolute expiration.
    /// </summary>
    public static CacheOptions WithExpiration(TimeSpan expiration, params string[] tags)
    {
        return new CacheOptions
        {
            AbsoluteExpiration = expiration,
            Tags = tags.Length > 0 ? tags : null
        };
    }
}