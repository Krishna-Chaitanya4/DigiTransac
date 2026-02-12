using DigiTransac.Api.Services.Caching;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging;

namespace DigiTransac.Api.Tests.Services;

public class MemoryCacheServiceTests
{
    private readonly MemoryCacheService _cacheService;
    private readonly IMemoryCache _memoryCache;

    public MemoryCacheServiceTests()
    {
        _memoryCache = new MemoryCache(new MemoryCacheOptions { SizeLimit = 1000 });
        var logger = Mock.Of<ILogger<MemoryCacheService>>();
        _cacheService = new MemoryCacheService(_memoryCache, logger);
    }

    [Fact]
    public async Task GetOrCreateAsync_WhenCacheMiss_ShouldCallFactory()
    {
        // Arrange
        var factoryCalled = false;
        Func<Task<string>> factory = () =>
        {
            factoryCalled = true;
            return Task.FromResult("test value");
        };

        // Act
        var result = await _cacheService.GetOrCreateAsync("test-key", factory);

        // Assert
        factoryCalled.Should().BeTrue();
        result.Should().Be("test value");
    }

    [Fact]
    public async Task GetOrCreateAsync_WhenCacheHit_ShouldNotCallFactory()
    {
        // Arrange
        await _cacheService.SetAsync("cached-key", "cached value");
        var factoryCalled = false;
        Func<Task<string>> factory = () =>
        {
            factoryCalled = true;
            return Task.FromResult("new value");
        };

        // Act
        var result = await _cacheService.GetOrCreateAsync("cached-key", factory);

        // Assert
        factoryCalled.Should().BeFalse();
        result.Should().Be("cached value");
    }

    [Fact]
    public async Task SetAsync_ShouldStorValue()
    {
        // Arrange
        var key = "set-test";
        var value = "stored value";

        // Act
        await _cacheService.SetAsync(key, value);
        var retrieved = await _cacheService.GetAsync<string>(key);

        // Assert
        retrieved.Should().Be(value);
    }

    [Fact]
    public async Task RemoveAsync_ShouldRemoveItem()
    {
        // Arrange
        var key = "remove-test";
        await _cacheService.SetAsync(key, "value");

        // Act
        await _cacheService.RemoveAsync(key);
        var result = await _cacheService.GetAsync<string>(key);

        // Assert
        result.Should().BeNull();
    }

    [Fact]
    public async Task RemoveByPatternAsync_ShouldRemoveMatchingItems()
    {
        // Arrange
        await _cacheService.SetAsync("user:123:profile", "profile1");
        await _cacheService.SetAsync("user:123:settings", "settings1");
        await _cacheService.SetAsync("user:456:profile", "profile2");

        // Act
        await _cacheService.RemoveByPatternAsync("user:123:*");

        // Assert
        var profile1 = await _cacheService.GetAsync<string>("user:123:profile");
        var settings1 = await _cacheService.GetAsync<string>("user:123:settings");
        var profile2 = await _cacheService.GetAsync<string>("user:456:profile");

        profile1.Should().BeNull();
        settings1.Should().BeNull();
        profile2.Should().Be("profile2");
    }

    [Fact]
    public async Task InvalidateByTagAsync_ShouldRemoveTaggedItems()
    {
        // Arrange
        await _cacheService.SetAsync("item1", "value1", new CacheOptions { Tags = new[] { "group-a" } });
        await _cacheService.SetAsync("item2", "value2", new CacheOptions { Tags = new[] { "group-a" } });
        await _cacheService.SetAsync("item3", "value3", new CacheOptions { Tags = new[] { "group-b" } });

        // Act
        await _cacheService.InvalidateByTagAsync("group-a");

        // Assert
        var item1 = await _cacheService.GetAsync<string>("item1");
        var item2 = await _cacheService.GetAsync<string>("item2");
        var item3 = await _cacheService.GetAsync<string>("item3");

        item1.Should().BeNull();
        item2.Should().BeNull();
        item3.Should().Be("value3");
    }

    [Fact]
    public void CacheOptions_WithExpiration_ShouldSetAbsoluteExpiration()
    {
        // Act
        var options = CacheOptions.WithExpiration(TimeSpan.FromMinutes(5));

        // Assert
        options.AbsoluteExpiration.Should().Be(TimeSpan.FromMinutes(5));
        options.Tags.Should().BeNull();
    }

    [Fact]
    public void CacheOptions_WithExpiration_ShouldIncludeTags()
    {
        // Act
        var options = CacheOptions.WithExpiration(TimeSpan.FromMinutes(2), "user:123", "transactions");

        // Assert
        options.AbsoluteExpiration.Should().Be(TimeSpan.FromMinutes(2));
        options.Tags.Should().Contain("user:123");
        options.Tags.Should().Contain("transactions");
    }

    [Fact]
    public void CacheKeys_ShouldGenerateConsistentKeys()
    {
        // Arrange
        var userId = "user123";
        var transactionId = "tx456";

        // Assert
        CacheKeys.UserAccounts(userId).Should().Be("digitransac:user:user123:accounts");
        CacheKeys.Transaction(transactionId).Should().Be("digitransac:transaction:tx456");
        CacheKeys.UserTransactions(userId).Should().Be("digitransac:user:user123:transactions");
        CacheKeys.UserAnalytics(userId).Should().Be("digitransac:user:user123:analytics");
        CacheKeys.UserBudgets(userId).Should().Be("digitransac:user:user123:budgets");
        CacheKeys.UserCategories(userId).Should().Be("digitransac:user:user123:categories");
    }
}