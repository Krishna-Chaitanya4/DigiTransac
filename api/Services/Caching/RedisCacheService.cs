using System.Collections.Concurrent;
using System.Text.Json;
using Microsoft.Extensions.Caching.Distributed;

namespace DigiTransac.Api.Services.Caching;

/// <summary>
/// Redis-backed distributed cache service using IDistributedCache.
/// Supports tag-based invalidation via a local tag-to-key tracking dictionary and
/// wraps all operations in try/catch to gracefully degrade if Redis is unavailable.
/// </summary>
public sealed class RedisCacheService : ICacheService
{
    private readonly IDistributedCache _cache;
    private readonly ILogger<RedisCacheService> _logger;

    // Track keys by tag for invalidation (since IDistributedCache doesn't support tags natively)
    private readonly ConcurrentDictionary<string, HashSet<string>> _tagToKeys = new();
    private readonly ConcurrentDictionary<string, byte> _allKeys = new();
    private readonly object _lockObject = new();

    private static readonly TimeSpan DefaultExpiration = TimeSpan.FromMinutes(5);

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull
    };

    public RedisCacheService(IDistributedCache cache, ILogger<RedisCacheService> logger)
    {
        _cache = cache;
        _logger = logger;
    }

    public async Task<T?> GetAsync<T>(string key, CancellationToken cancellationToken = default)
    {
        try
        {
            var data = await _cache.GetStringAsync(key, cancellationToken);
            if (data is null)
                return default;

            _logger.LogDebug("Cache hit for key: {Key}", key);
            return JsonSerializer.Deserialize<T>(data, JsonOptions);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to get cache key {CacheKey}", key);
            return default;
        }
    }

    public async Task SetAsync<T>(string key, T value, CacheOptions? options = null, CancellationToken cancellationToken = default)
    {
        try
        {
            var json = JsonSerializer.Serialize(value, JsonOptions);
            var entryOptions = new DistributedCacheEntryOptions
            {
                AbsoluteExpirationRelativeToNow = options?.AbsoluteExpiration ?? DefaultExpiration
            };

            if (options?.SlidingExpiration.HasValue == true)
            {
                entryOptions.SlidingExpiration = options.SlidingExpiration;
            }

            await _cache.SetStringAsync(key, json, entryOptions, cancellationToken);
            _allKeys.TryAdd(key, 0);

            // Track tags
            if (options?.Tags != null)
            {
                foreach (var tag in options.Tags)
                {
                    var tagKeys = _tagToKeys.GetOrAdd(tag, _ => new HashSet<string>());
                    lock (_lockObject)
                    {
                        tagKeys.Add(key);
                    }
                }
            }

            _logger.LogDebug("Cached value for key: {Key}", key);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to set cache key {CacheKey}", key);
        }
    }

    public async Task<T?> GetOrCreateAsync<T>(string key, Func<Task<T>> factory, CacheOptions? options = null, CancellationToken cancellationToken = default)
    {
        var cached = await GetAsync<T>(key, cancellationToken);
        if (cached is not null)
            return cached;

        _logger.LogDebug("Cache miss for key: {Key}", key);
        var value = await factory();

        if (value is not null)
        {
            await SetAsync(key, value, options, cancellationToken);
        }

        return value;
    }

    public async Task RemoveAsync(string key, CancellationToken cancellationToken = default)
    {
        try
        {
            await _cache.RemoveAsync(key, cancellationToken);
            _allKeys.TryRemove(key, out _);

            // Remove from tag tracking
            foreach (var tagSet in _tagToKeys.Values)
            {
                lock (_lockObject)
                {
                    tagSet.Remove(key);
                }
            }

            _logger.LogDebug("Removed cache entry: {Key}", key);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to remove cache key {CacheKey}", key);
        }
    }

    public async Task RemoveByPatternAsync(string pattern, CancellationToken cancellationToken = default)
    {
        // Use local key tracking for pattern matching since IDistributedCache doesn't support SCAN
        var regex = new System.Text.RegularExpressions.Regex(
            "^" + System.Text.RegularExpressions.Regex.Escape(pattern).Replace("\\*", ".*") + "$",
            System.Text.RegularExpressions.RegexOptions.None);

        var keysToRemove = _allKeys.Keys.Where(k => regex.IsMatch(k)).ToList();

        foreach (var key in keysToRemove)
        {
            await RemoveAsync(key, cancellationToken);
        }

        _logger.LogDebug("Removed {Count} cache entries matching pattern: {Pattern}", keysToRemove.Count, pattern);
    }

    public async Task InvalidateByTagAsync(string tag, CancellationToken cancellationToken = default)
    {
        if (_tagToKeys.TryGetValue(tag, out var keys))
        {
            List<string> keysToRemove;
            lock (_lockObject)
            {
                keysToRemove = keys.ToList();
                keys.Clear();
            }

            foreach (var key in keysToRemove)
            {
                await RemoveAsync(key, cancellationToken);
            }

            _logger.LogDebug("Invalidated {Count} cache entries with tag: {Tag}", keysToRemove.Count, tag);
        }
    }
}