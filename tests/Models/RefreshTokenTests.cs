using DigiTransac.Api.Models;
using FluentAssertions;

namespace DigiTransac.Tests.Models;

public class RefreshTokenTests
{
    [Fact]
    public void IsExpired_WhenExpiresAtInFuture_ShouldReturnFalse()
    {
        // Arrange
        var token = new RefreshToken
        {
            UserId = "user-123",
            Token = "test-token",
            ExpiresAt = DateTime.UtcNow.AddDays(7)
        };

        // Act & Assert
        token.IsExpired.Should().BeFalse();
    }

    [Fact]
    public void IsExpired_WhenExpiresAtInPast_ShouldReturnTrue()
    {
        // Arrange
        var token = new RefreshToken
        {
            UserId = "user-123",
            Token = "test-token",
            ExpiresAt = DateTime.UtcNow.AddMinutes(-1)
        };

        // Act & Assert
        token.IsExpired.Should().BeTrue();
    }

    [Fact]
    public void IsRevoked_WhenRevokedAtIsNull_ShouldReturnFalse()
    {
        // Arrange
        var token = new RefreshToken
        {
            UserId = "user-123",
            Token = "test-token",
            ExpiresAt = DateTime.UtcNow.AddDays(7),
            RevokedAt = null
        };

        // Act & Assert
        token.IsRevoked.Should().BeFalse();
    }

    [Fact]
    public void IsRevoked_WhenRevokedAtIsSet_ShouldReturnTrue()
    {
        // Arrange
        var token = new RefreshToken
        {
            UserId = "user-123",
            Token = "test-token",
            ExpiresAt = DateTime.UtcNow.AddDays(7),
            RevokedAt = DateTime.UtcNow
        };

        // Act & Assert
        token.IsRevoked.Should().BeTrue();
    }

    [Fact]
    public void IsActive_WhenNotRevokedAndNotExpired_ShouldReturnTrue()
    {
        // Arrange
        var token = new RefreshToken
        {
            UserId = "user-123",
            Token = "test-token",
            ExpiresAt = DateTime.UtcNow.AddDays(7),
            RevokedAt = null
        };

        // Act & Assert
        token.IsActive.Should().BeTrue();
    }

    [Fact]
    public void IsActive_WhenRevoked_ShouldReturnFalse()
    {
        // Arrange
        var token = new RefreshToken
        {
            UserId = "user-123",
            Token = "test-token",
            ExpiresAt = DateTime.UtcNow.AddDays(7),
            RevokedAt = DateTime.UtcNow
        };

        // Act & Assert
        token.IsActive.Should().BeFalse();
    }

    [Fact]
    public void IsActive_WhenExpired_ShouldReturnFalse()
    {
        // Arrange
        var token = new RefreshToken
        {
            UserId = "user-123",
            Token = "test-token",
            ExpiresAt = DateTime.UtcNow.AddMinutes(-1),
            RevokedAt = null
        };

        // Act & Assert
        token.IsActive.Should().BeFalse();
    }

    [Fact]
    public void IsActive_WhenBothRevokedAndExpired_ShouldReturnFalse()
    {
        // Arrange
        var token = new RefreshToken
        {
            UserId = "user-123",
            Token = "test-token",
            ExpiresAt = DateTime.UtcNow.AddMinutes(-1),
            RevokedAt = DateTime.UtcNow.AddMinutes(-10)
        };

        // Act & Assert
        token.IsActive.Should().BeFalse();
    }

    [Fact]
    public void CreatedAt_ShouldDefaultToUtcNow()
    {
        // Arrange
        var before = DateTime.UtcNow;
        var token = new RefreshToken
        {
            UserId = "user-123",
            Token = "test-token",
            ExpiresAt = DateTime.UtcNow.AddDays(7)
        };
        var after = DateTime.UtcNow;

        // Act & Assert
        token.CreatedAt.Should().BeOnOrAfter(before);
        token.CreatedAt.Should().BeOnOrBefore(after);
    }

    [Fact]
    public void ReplacedByToken_ShouldTrackTokenRotation()
    {
        // Arrange
        var oldToken = new RefreshToken
        {
            UserId = "user-123",
            Token = "old-token",
            ExpiresAt = DateTime.UtcNow.AddDays(7)
        };

        // Act
        oldToken.RevokedAt = DateTime.UtcNow;
        oldToken.ReplacedByToken = "new-token";

        // Assert
        oldToken.IsRevoked.Should().BeTrue();
        oldToken.IsActive.Should().BeFalse();
        oldToken.ReplacedByToken.Should().Be("new-token");
    }
}
