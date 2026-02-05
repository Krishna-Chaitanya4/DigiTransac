using DigiTransac.Api.Services;
using FluentAssertions;
using Microsoft.Extensions.Caching.Memory;

namespace DigiTransac.Tests.Services;

public class DekCacheServiceTests
{
    private readonly DekCacheService _cacheService;
    private readonly IMemoryCache _memoryCache;

    public DekCacheServiceTests()
    {
        _memoryCache = new MemoryCache(new MemoryCacheOptions
        {
            SizeLimit = 1000
        });
        _cacheService = new DekCacheService(_memoryCache);
    }

    #region GetDek Tests

    [Fact]
    public void GetDek_WithNonExistentUserId_ShouldReturnNull()
    {
        // Arrange
        var userId = "non-existent-user";

        // Act
        var result = _cacheService.GetDek(userId);

        // Assert
        result.Should().BeNull();
    }

    [Fact]
    public void GetDek_AfterSetDek_ShouldReturnStoredValue()
    {
        // Arrange
        var userId = "test-user-123";
        var dek = new byte[] { 1, 2, 3, 4, 5, 6, 7, 8, 9, 10 };
        _cacheService.SetDek(userId, dek);

        // Act
        var result = _cacheService.GetDek(userId);

        // Assert
        result.Should().NotBeNull();
        result.Should().BeEquivalentTo(dek);
    }

    [Fact]
    public void GetDek_WithDifferentUserIds_ShouldReturnCorrectValues()
    {
        // Arrange
        var user1 = "user-1";
        var user2 = "user-2";
        var dek1 = new byte[] { 1, 1, 1, 1 };
        var dek2 = new byte[] { 2, 2, 2, 2 };
        
        _cacheService.SetDek(user1, dek1);
        _cacheService.SetDek(user2, dek2);

        // Act
        var result1 = _cacheService.GetDek(user1);
        var result2 = _cacheService.GetDek(user2);

        // Assert
        result1.Should().BeEquivalentTo(dek1);
        result2.Should().BeEquivalentTo(dek2);
    }

    #endregion

    #region SetDek Tests

    [Fact]
    public void SetDek_ShouldStoreValue()
    {
        // Arrange
        var userId = "test-user";
        var dek = new byte[32];
        new Random(42).NextBytes(dek);

        // Act
        _cacheService.SetDek(userId, dek);

        // Assert
        var retrieved = _cacheService.GetDek(userId);
        retrieved.Should().BeEquivalentTo(dek);
    }

    [Fact]
    public void SetDek_WithSameUserId_ShouldOverwritePreviousValue()
    {
        // Arrange
        var userId = "test-user";
        var dek1 = new byte[] { 1, 2, 3, 4 };
        var dek2 = new byte[] { 5, 6, 7, 8 };

        // Act
        _cacheService.SetDek(userId, dek1);
        _cacheService.SetDek(userId, dek2);

        // Assert
        var result = _cacheService.GetDek(userId);
        result.Should().BeEquivalentTo(dek2);
    }

    [Fact]
    public void SetDek_WithEmptyArray_ShouldStoreEmptyArray()
    {
        // Arrange
        var userId = "test-user";
        var dek = Array.Empty<byte>();

        // Act
        _cacheService.SetDek(userId, dek);

        // Assert
        var result = _cacheService.GetDek(userId);
        result.Should().NotBeNull();
        result.Should().BeEmpty();
    }

    [Fact]
    public void SetDek_WithStandardDekSize_ShouldWork()
    {
        // Arrange
        var userId = "test-user";
        var dek = new byte[32]; // Standard 32-byte DEK
        new Random(42).NextBytes(dek);

        // Act
        _cacheService.SetDek(userId, dek);

        // Assert
        var result = _cacheService.GetDek(userId);
        result.Should().BeEquivalentTo(dek);
    }

    #endregion

    #region RemoveDek Tests

    [Fact]
    public void RemoveDek_WithExistingUserId_ShouldRemoveValue()
    {
        // Arrange
        var userId = "test-user";
        var dek = new byte[] { 1, 2, 3, 4 };
        _cacheService.SetDek(userId, dek);

        // Verify it exists
        _cacheService.GetDek(userId).Should().NotBeNull();

        // Act
        _cacheService.RemoveDek(userId);

        // Assert
        _cacheService.GetDek(userId).Should().BeNull();
    }

    [Fact]
    public void RemoveDek_WithNonExistentUserId_ShouldNotThrow()
    {
        // Arrange
        var userId = "non-existent-user";

        // Act & Assert
        var action = () => _cacheService.RemoveDek(userId);
        action.Should().NotThrow();
    }

    [Fact]
    public void RemoveDek_ShouldOnlyRemoveSpecifiedUser()
    {
        // Arrange
        var user1 = "user-1";
        var user2 = "user-2";
        var dek1 = new byte[] { 1, 1, 1, 1 };
        var dek2 = new byte[] { 2, 2, 2, 2 };
        
        _cacheService.SetDek(user1, dek1);
        _cacheService.SetDek(user2, dek2);

        // Act
        _cacheService.RemoveDek(user1);

        // Assert
        _cacheService.GetDek(user1).Should().BeNull();
        _cacheService.GetDek(user2).Should().BeEquivalentTo(dek2);
    }

    #endregion

    #region Cache Behavior Tests

    [Fact]
    public void Cache_ShouldIsolateUsersByPrefix()
    {
        // Arrange - Users with similar IDs
        var userId1 = "123";
        var userId2 = "1234";
        var userId3 = "12345";
        
        var dek1 = new byte[] { 1 };
        var dek2 = new byte[] { 2 };
        var dek3 = new byte[] { 3 };

        // Act
        _cacheService.SetDek(userId1, dek1);
        _cacheService.SetDek(userId2, dek2);
        _cacheService.SetDek(userId3, dek3);

        // Assert - Each should be independent
        _cacheService.GetDek(userId1).Should().BeEquivalentTo(dek1);
        _cacheService.GetDek(userId2).Should().BeEquivalentTo(dek2);
        _cacheService.GetDek(userId3).Should().BeEquivalentTo(dek3);
    }

    [Fact]
    public void Cache_MultipleOperations_ShouldWorkCorrectly()
    {
        // Arrange
        var userId = "test-user";

        // Act & Assert - Multiple set/get/remove cycles
        for (int i = 0; i < 5; i++)
        {
            var dek = new byte[] { (byte)i };
            
            _cacheService.SetDek(userId, dek);
            _cacheService.GetDek(userId).Should().BeEquivalentTo(dek);
            
            _cacheService.RemoveDek(userId);
            _cacheService.GetDek(userId).Should().BeNull();
        }
    }

    [Fact]
    public void Cache_WithSpecialCharactersInUserId_ShouldWork()
    {
        // Arrange
        var specialUserIds = new[]
        {
            "user@example.com",
            "user:with:colons",
            "user/with/slashes",
            "user with spaces",
            "用户" // Unicode
        };

        // Act & Assert
        foreach (var userId in specialUserIds)
        {
            var dek = new byte[] { 1, 2, 3 };
            
            _cacheService.SetDek(userId, dek);
            var result = _cacheService.GetDek(userId);
            
            result.Should().BeEquivalentTo(dek, $"Failed for userId: {userId}");
            
            _cacheService.RemoveDek(userId);
        }
    }

    #endregion
}
