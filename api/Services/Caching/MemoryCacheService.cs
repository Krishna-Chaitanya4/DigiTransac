using System.Collections.Concurrent;
using System.Text.RegularExpressions;
using Microsoft.Extensions.Caching.Memory;

namespace DigiTransac.Api.Services.Caching;

/// <summary>
/// In-memory implementation of ICacheService using Microsoft.Extensions.Caching.Memory.
/// Supports tag-based invalidation and pattern-based removal.
/// </summary>
public class MemoryCacheService : ICacheService
{
    private readonly IMemoryCache _cache;
    private readonly ILogger<MemoryCacheService> _logger;
    
    // Track keys by tag for invalidation
    private readonly ConcurrentDictionary<string, HashSet<string>> _tagToKeys = new();
    
    // Track all keys for pattern matching
    private readonly ConcurrentDictionary<string, byte> _allKeys = new();
    
    private readonly object _lockObject = new();

    public MemoryCacheService(IMemoryCache cache, ILogger<MemoryCacheService> logger)
    {
        _cache = cache;
        _logger = logger;
    }

    public async Task<T?> GetOrCreateAsync<T>(
        string key, 
        Func<Task<T>> factory, 
        CacheOptions? options = null,
        CancellationToken cancellationToken = default)
    {
        if (_cache.TryGetValue(key, out T? cachedValue))
        {
            _logger.LogDebug("Cache hit for key: {Key}", key);
            return cachedValue;
        }

        _logger.LogDebug("Cache miss for key: {Key}", key);
        var value = await factory();
        
        if (value != null)
        {
            await SetAsync(key, value, options, cancellationToken);
        }

        return value;
    }

    public Task<T?> GetAsync<T>(string key, CancellationToken cancellationToken = default)
    {
        var value = _cache.Get<T>(key);
        if (value != null)
        {
            _logger.LogDebug("Cache hit for key: {Key}", key);
        }
        return Task.FromResult(value);
    }

    public Task SetAsync<T>(string key, T value, CacheOptions? options = null, CancellationToken cancellationToken = default)
    {
        var cacheOptions = new MemoryCacheEntryOptions();
        
        if (options?.AbsoluteExpiration.HasValue == true)
        {
            cacheOptions.SetAbsoluteExpiration(options.AbsoluteExpiration.Value);
        }
        else
        {
            // Default expiration of 5 minutes
            cacheOptions.SetAbsoluteExpiration(TimeSpan.FromMinutes(5));
        }

        if (options?.SlidingExpiration.HasValue == true)
        {
            cacheOptions.SetSlidingExpiration(options.SlidingExpiration.Value);
        }

        cacheOptions.SetSize(options?.Size ?? 1);

        // Set up eviction callback to clean up tracking
        cacheOptions.RegisterPostEvictionCallback((evictedKey, _, _, _) =>
        {
            var keyStr = evictedKey.ToString()!;
            _allKeys.TryRemove(keyStr, out _);
            
            // Remove from tag tracking
            foreach (var tagSet in _tagToKeys.Values)
            {
                lock (_lockObject)
                {
                    tagSet.Remove(keyStr);
                }
            }
        });

        _cache.Set(key, value, cacheOptions);
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
        return Task.CompletedTask;
    }

    public Task RemoveAsync(string key, CancellationToken cancellationToken = default)
    {
        _cache.Remove(key);
        _allKeys.TryRemove(key, out _);
        
        _logger.LogDebug("Removed cache entry: {Key}", key);
        return Task.CompletedTask;
    }

    public Task RemoveByPatternAsync(string pattern, CancellationToken cancellationToken = default)
    {
        var regex = new Regex(
            "^" + Regex.Escape(pattern).Replace("\\*", ".*") + "$",
            RegexOptions.Compiled);

        var keysToRemove = _allKeys.Keys.Where(k => regex.IsMatch(k)).ToList();
        
        foreach (var key in keysToRemove)
        {
            _cache.Remove(key);
            _allKeys.TryRemove(key, out _);
        }

        _logger.LogDebug("Removed {Count} cache entries matching pattern: {Pattern}", keysToRemove.Count, pattern);
        return Task.CompletedTask;
    }

    public Task InvalidateByTagAsync(string tag, CancellationToken cancellationToken = default)
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
                _cache.Remove(key);
                _allKeys.TryRemove(key, out _);
            }

            _logger.LogDebug("Invalidated {Count} cache entries with tag: {Tag}", keysToRemove.Count, tag);
        }

        return Task.CompletedTask;
    }
}