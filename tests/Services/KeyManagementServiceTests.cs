using DigiTransac.Api.Services;
using DigiTransac.Api.Settings;
using FluentAssertions;
using Microsoft.Extensions.Options;

namespace DigiTransac.Tests.Services;

public class KeyManagementServiceTests
{
    private readonly LocalKeyManagementService _keyManagementService;
    private readonly byte[] _validKek;

    public KeyManagementServiceTests()
    {
        // Generate a valid 32-byte KEK for testing
        _validKek = new byte[32];
        for (int i = 0; i < 32; i++)
        {
            _validKek[i] = (byte)(i + 1);
        }

        var settings = Options.Create(new EncryptionSettings
        {
            Kek = Convert.ToBase64String(_validKek),
            Provider = "Local"
        });

        _keyManagementService = new LocalKeyManagementService(settings);
    }

    #region Constructor Tests

    [Fact]
    public void Constructor_WithValidKek_ShouldSucceed()
    {
        // Arrange
        var settings = Options.Create(new EncryptionSettings
        {
            Kek = Convert.ToBase64String(new byte[32]),
            Provider = "Local"
        });

        // Act
        var service = new LocalKeyManagementService(settings);

        // Assert
        service.Should().NotBeNull();
    }

    [Fact]
    public void Constructor_WithNullKek_ShouldThrowException()
    {
        // Arrange
        var settings = Options.Create(new EncryptionSettings
        {
            Kek = null!,
            Provider = "Local"
        });

        // Act & Assert
        var action = () => new LocalKeyManagementService(settings);
        action.Should().Throw<InvalidOperationException>()
            .WithMessage("*KEK not configured*");
    }

    [Fact]
    public void Constructor_WithEmptyKek_ShouldThrowException()
    {
        // Arrange
        var settings = Options.Create(new EncryptionSettings
        {
            Kek = "",
            Provider = "Local"
        });

        // Act & Assert
        var action = () => new LocalKeyManagementService(settings);
        action.Should().Throw<InvalidOperationException>()
            .WithMessage("*KEK not configured*");
    }

    [Fact]
    public void Constructor_WithInvalidBase64Kek_ShouldThrowException()
    {
        // Arrange
        var settings = Options.Create(new EncryptionSettings
        {
            Kek = "not-valid-base64!!!",
            Provider = "Local"
        });

        // Act & Assert
        var action = () => new LocalKeyManagementService(settings);
        action.Should().Throw<InvalidOperationException>()
            .WithMessage("*valid Base64*");
    }

    [Fact]
    public void Constructor_WithWrongSizeKek_ShouldThrowException()
    {
        // Arrange - 16 bytes instead of 32
        var settings = Options.Create(new EncryptionSettings
        {
            Kek = Convert.ToBase64String(new byte[16]),
            Provider = "Local"
        });

        // Act & Assert
        var action = () => new LocalKeyManagementService(settings);
        action.Should().Throw<InvalidOperationException>()
            .WithMessage("*32 bytes*");
    }

    #endregion

    #region GenerateDek Tests

    [Fact]
    public void GenerateDek_ShouldReturn32ByteKey()
    {
        // Act
        var dek = _keyManagementService.GenerateDek();

        // Assert
        dek.Should().NotBeNull();
        dek.Length.Should().Be(32);
    }

    [Fact]
    public void GenerateDek_ShouldGenerateUniqueKeys()
    {
        // Act
        var dek1 = _keyManagementService.GenerateDek();
        var dek2 = _keyManagementService.GenerateDek();
        var dek3 = _keyManagementService.GenerateDek();

        // Assert
        dek1.Should().NotBeEquivalentTo(dek2);
        dek2.Should().NotBeEquivalentTo(dek3);
        dek1.Should().NotBeEquivalentTo(dek3);
    }

    [Fact]
    public void GenerateDek_ShouldNotReturnAllZeros()
    {
        // Act
        var dek = _keyManagementService.GenerateDek();

        // Assert
        dek.Should().Contain(b => b != 0);
    }

    #endregion

    #region WrapKeyAsync Tests

    [Fact]
    public async Task WrapKeyAsync_ShouldReturnWrappedKey()
    {
        // Arrange
        var dek = _keyManagementService.GenerateDek();

        // Act
        var wrappedDek = await _keyManagementService.WrapKeyAsync(dek);

        // Assert
        wrappedDek.Should().NotBeNull();
        wrappedDek.Length.Should().BeGreaterThan(dek.Length); // Wrapped key includes nonce and tag
    }

    [Fact]
    public async Task WrapKeyAsync_ShouldProduceDifferentOutputForSameInput()
    {
        // Arrange - Due to random nonce, same DEK should produce different wrapped outputs
        var dek = _keyManagementService.GenerateDek();

        // Act
        var wrapped1 = await _keyManagementService.WrapKeyAsync(dek);
        var wrapped2 = await _keyManagementService.WrapKeyAsync(dek);

        // Assert - Different due to random nonce
        wrapped1.Should().NotBeEquivalentTo(wrapped2);
    }

    [Fact]
    public async Task WrapKeyAsync_WithEmptyDek_ShouldStillWork()
    {
        // Arrange
        var emptyDek = new byte[0];

        // Act
        var wrapped = await _keyManagementService.WrapKeyAsync(emptyDek);

        // Assert
        wrapped.Should().NotBeNull();
        wrapped.Length.Should().BeGreaterThan(0); // At least nonce + tag
    }

    #endregion

    #region UnwrapKeyAsync Tests

    [Fact]
    public async Task UnwrapKeyAsync_ShouldRecoverOriginalDek()
    {
        // Arrange
        var originalDek = _keyManagementService.GenerateDek();
        var wrappedDek = await _keyManagementService.WrapKeyAsync(originalDek);

        // Act
        var unwrappedDek = await _keyManagementService.UnwrapKeyAsync(wrappedDek);

        // Assert
        unwrappedDek.Should().BeEquivalentTo(originalDek);
    }

    [Fact]
    public async Task UnwrapKeyAsync_WithTamperedData_ShouldThrowException()
    {
        // Arrange
        var dek = _keyManagementService.GenerateDek();
        var wrappedDek = await _keyManagementService.WrapKeyAsync(dek);
        
        // Tamper with the wrapped data
        wrappedDek[wrappedDek.Length / 2] ^= 0xFF;

        // Act & Assert
        var action = async () => await _keyManagementService.UnwrapKeyAsync(wrappedDek);
        await action.Should().ThrowAsync<Exception>();
    }

    [Fact]
    public async Task UnwrapKeyAsync_WithTooShortData_ShouldThrowException()
    {
        // Arrange - Less than nonce + tag (12 + 16 = 28 bytes minimum)
        var shortData = new byte[10];

        // Act & Assert
        var action = async () => await _keyManagementService.UnwrapKeyAsync(shortData);
        await action.Should().ThrowAsync<Exception>();
    }

    [Fact]
    public async Task UnwrapKeyAsync_WithDifferentKek_ShouldFail()
    {
        // Arrange
        var dek = _keyManagementService.GenerateDek();
        var wrappedDek = await _keyManagementService.WrapKeyAsync(dek);

        // Create a service with different KEK
        var differentKek = new byte[32];
        new Random(42).NextBytes(differentKek);
        var differentSettings = Options.Create(new EncryptionSettings
        {
            Kek = Convert.ToBase64String(differentKek),
            Provider = "Local"
        });
        var differentService = new LocalKeyManagementService(differentSettings);

        // Act & Assert
        var action = async () => await differentService.UnwrapKeyAsync(wrappedDek);
        await action.Should().ThrowAsync<Exception>();
    }

    #endregion

    #region Round-Trip Tests

    [Fact]
    public async Task WrapAndUnwrap_MultipleRoundTrips_ShouldAlwaysSucceed()
    {
        // Arrange & Act & Assert
        for (int i = 0; i < 10; i++)
        {
            var originalDek = _keyManagementService.GenerateDek();
            var wrapped = await _keyManagementService.WrapKeyAsync(originalDek);
            var unwrapped = await _keyManagementService.UnwrapKeyAsync(wrapped);
            
            unwrapped.Should().BeEquivalentTo(originalDek, $"Round trip {i + 1} failed");
        }
    }

    [Fact]
    public async Task WrapAndUnwrap_WithSpecificBytePatterns_ShouldWork()
    {
        // Arrange - Test with specific patterns
        var patterns = new[]
        {
            new byte[32], // All zeros
            Enumerable.Range(0, 32).Select(i => (byte)0xFF).ToArray(), // All ones
            Enumerable.Range(0, 32).Select(i => (byte)i).ToArray(), // Sequential
            Enumerable.Range(0, 32).Select(i => (byte)(i % 2 == 0 ? 0xAA : 0x55)).ToArray(), // Alternating
        };

        foreach (var pattern in patterns)
        {
            // Act
            var wrapped = await _keyManagementService.WrapKeyAsync(pattern);
            var unwrapped = await _keyManagementService.UnwrapKeyAsync(wrapped);

            // Assert
            unwrapped.Should().BeEquivalentTo(pattern);
        }
    }

    #endregion
}
