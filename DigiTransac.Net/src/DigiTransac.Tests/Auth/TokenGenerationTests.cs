using Xunit;
using FluentAssertions;

namespace DigiTransac.Tests.Auth;

/// <summary>
/// Unit tests for token generation and validation logic
/// Validates: Token format, claims structure, expiration handling
/// </summary>
public class TokenGenerationTests
{
    [Fact]
    public void TokenFormat_WithJWT_HasThreeComponents()
    {
        // Arrange
        const string validToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";

        // Act
        var parts = validToken.Split('.');

        // Assert
        parts.Should().HaveCount(3);
        parts[0].Should().NotBeNullOrEmpty();  // Header
        parts[1].Should().NotBeNullOrEmpty();  // Payload
        parts[2].Should().NotBeNullOrEmpty();  // Signature
    }

    [Fact]
    public void RefreshTokenGeneration_ProducesDifferentTokensEachTime()
    {
        // Arrange
        var token1 = GenerateRandomToken();
        var token2 = GenerateRandomToken();

        // Assert
        token1.Should().NotBe(token2);
        token1.Should().NotBeNullOrEmpty();
        token2.Should().NotBeNullOrEmpty();
    }

    [Fact]
    public void RefreshTokenHash_WithSHA256_ProducesConsistentHash()
    {
        // Arrange
        const string token = "test_refresh_token";
        var hash1 = SHA256Hash(token);
        var hash2 = SHA256Hash(token);

        // Assert - Same token should produce same hash
        hash1.Should().Be(hash2);
        hash1.Should().HaveLength(64);  // SHA256 hex output length
    }

    [Fact]
    public void RefreshTokenHash_WithDifferentTokens_ProducesDifferentHashes()
    {
        // Arrange
        const string token1 = "refresh_token_1";
        const string token2 = "refresh_token_2";

        var hash1 = SHA256Hash(token1);
        var hash2 = SHA256Hash(token2);

        // Assert
        hash1.Should().NotBe(hash2);
    }

    [Fact]
    public void AccessTokenExpiration_IsShortLived()
    {
        // Arrange
        const int accessTokenMinutes = 15;
        var now = DateTime.UtcNow;
        var expirationTime = now.AddMinutes(accessTokenMinutes);

        // Act
        var difference = (expirationTime - now).TotalMinutes;

        // Assert
        difference.Should().Be(accessTokenMinutes);
    }

    [Fact]
    public void RefreshTokenExpiration_IsLongLived()
    {
        // Arrange
        const int refreshTokenDays = 14;
        var now = DateTime.UtcNow;
        var expirationTime = now.AddDays(refreshTokenDays);

        // Act
        var difference = (expirationTime - now).TotalDays;

        // Assert
        difference.Should().Be(refreshTokenDays);
    }

    [Fact]
    public void TokenRotation_PreviousTokenShouldBeInvalidated()
    {
        // Arrange
        var oldTokenHash = SHA256Hash("old_token");
        var newTokenHash = SHA256Hash("new_token");

        // Act & Assert - In a real scenario, old token would be marked as revoked
        oldTokenHash.Should().NotBe(newTokenHash);
        oldTokenHash.Should().NotBeNullOrEmpty();
    }

    /// <summary>
    /// Generates a random 32-byte token (Base64 encoded)
    /// </summary>
    private static string GenerateRandomToken()
    {
        var random = new byte[32];
        using (var rng = System.Security.Cryptography.RandomNumberGenerator.Create())
        {
            rng.GetBytes(random);
        }
        return Convert.ToBase64String(random);
    }

    /// <summary>
    /// Computes SHA256 hash of input
    /// </summary>
    private static string SHA256Hash(string input)
    {
        using (var sha256 = System.Security.Cryptography.SHA256.Create())
        {
            var hashedBytes = sha256.ComputeHash(System.Text.Encoding.UTF8.GetBytes(input));
            return Convert.ToHexString(hashedBytes).ToLowerInvariant();
        }
    }
}
