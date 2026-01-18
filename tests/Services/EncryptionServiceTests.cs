using DigiTransac.Api.Services;
using FluentAssertions;

namespace DigiTransac.Tests.Services;

public class EncryptionServiceTests
{
    private readonly EncryptionService _encryptionService;
    private readonly byte[] _testDek;

    public EncryptionServiceTests()
    {
        _encryptionService = new EncryptionService();
        
        // Generate a 32-byte DEK for testing
        _testDek = new byte[32];
        for (int i = 0; i < 32; i++)
        {
            _testDek[i] = (byte)(i + 1);
        }
    }

    #region Encrypt with DEK Tests

    [Fact]
    public void Encrypt_WithValidPlainTextAndDek_ShouldReturnEncryptedString()
    {
        // Arrange
        var plainText = "Hello, World!";

        // Act
        var encrypted = _encryptionService.Encrypt(plainText, _testDek);

        // Assert
        encrypted.Should().NotBeNullOrEmpty();
        encrypted.Should().NotBe(plainText);
        encrypted.Should().StartWith("ENC:v1:"); // Version prefix
    }

    [Fact]
    public void Encrypt_SamePlainText_ShouldProduceDifferentCiphertext()
    {
        // Arrange - Due to random nonce
        var plainText = "Hello, World!";

        // Act
        var encrypted1 = _encryptionService.Encrypt(plainText, _testDek);
        var encrypted2 = _encryptionService.Encrypt(plainText, _testDek);

        // Assert - Different due to random nonce
        encrypted1.Should().NotBe(encrypted2);
    }

    [Fact]
    public void Encrypt_WithEmptyString_ShouldThrowArgumentException()
    {
        // Arrange
        var plainText = "";

        // Act & Assert
        var action = () => _encryptionService.Encrypt(plainText, _testDek);
        action.Should().Throw<ArgumentException>();
    }

    [Fact]
    public void Encrypt_WithLongText_ShouldWork()
    {
        // Arrange
        var plainText = new string('A', 10000); // 10KB of text

        // Act
        var encrypted = _encryptionService.Encrypt(plainText, _testDek);

        // Assert
        encrypted.Should().NotBeNullOrEmpty();
        encrypted.Should().StartWith("ENC:v1:");
    }

    [Fact]
    public void Encrypt_WithUnicodeText_ShouldWork()
    {
        // Arrange
        var plainText = "Hello, 世界! 🌍 مرحبا";

        // Act
        var encrypted = _encryptionService.Encrypt(plainText, _testDek);

        // Assert
        encrypted.Should().NotBeNullOrEmpty();
        encrypted.Should().StartWith("ENC:v1:");
    }

    [Fact]
    public void Encrypt_WithSpecialCharacters_ShouldWork()
    {
        // Arrange
        var plainText = "!@#$%^&*()_+-=[]{}|;':\",./<>?\n\t\r";

        // Act
        var encrypted = _encryptionService.Encrypt(plainText, _testDek);

        // Assert
        encrypted.Should().NotBeNullOrEmpty();
    }

    #endregion

    #region Decrypt with DEK Tests

    [Fact]
    public void Decrypt_WithValidCiphertext_ShouldReturnOriginalText()
    {
        // Arrange
        var plainText = "Hello, World!";
        var encrypted = _encryptionService.Encrypt(plainText, _testDek);

        // Act
        var decrypted = _encryptionService.Decrypt(encrypted, _testDek);

        // Assert
        decrypted.Should().Be(plainText);
    }

    [Fact]
    public void Decrypt_WithEmptyOriginal_ShouldThrowArgumentException()
    {
        // Arrange - Cannot encrypt empty string, so test the encryption throws
        var plainText = "";

        // Act & Assert
        var action = () => _encryptionService.Encrypt(plainText, _testDek);
        action.Should().Throw<ArgumentException>();
    }

    [Fact]
    public void Decrypt_WithLongText_ShouldWork()
    {
        // Arrange
        var plainText = new string('X', 10000);
        var encrypted = _encryptionService.Encrypt(plainText, _testDek);

        // Act
        var decrypted = _encryptionService.Decrypt(encrypted, _testDek);

        // Assert
        decrypted.Should().Be(plainText);
    }

    [Fact]
    public void Decrypt_WithUnicodeText_ShouldWork()
    {
        // Arrange
        var plainText = "Hello, 世界! 🌍 مرحبا";
        var encrypted = _encryptionService.Encrypt(plainText, _testDek);

        // Act
        var decrypted = _encryptionService.Decrypt(encrypted, _testDek);

        // Assert
        decrypted.Should().Be(plainText);
    }

    [Fact]
    public void Decrypt_WithWrongDek_ShouldThrowException()
    {
        // Arrange
        var plainText = "Hello, World!";
        var encrypted = _encryptionService.Encrypt(plainText, _testDek);
        
        var wrongDek = new byte[32];
        new Random(99).NextBytes(wrongDek);

        // Act & Assert
        var action = () => _encryptionService.Decrypt(encrypted, wrongDek);
        action.Should().Throw<Exception>();
    }

    [Fact]
    public void Decrypt_WithTamperedCiphertext_ShouldThrowException()
    {
        // Arrange
        var plainText = "Hello, World!";
        var encrypted = _encryptionService.Encrypt(plainText, _testDek);
        
        // Tamper with the ciphertext (after the version prefix)
        var tampered = encrypted.Substring(0, 20) + "XXXX" + encrypted.Substring(24);

        // Act & Assert
        var action = () => _encryptionService.Decrypt(tampered, _testDek);
        action.Should().Throw<Exception>();
    }

    [Fact]
    public void Decrypt_WithInvalidFormat_ShouldThrowException()
    {
        // Arrange
        var invalidCiphertext = "not-a-valid-encrypted-string";

        // Act & Assert
        var action = () => _encryptionService.Decrypt(invalidCiphertext, _testDek);
        action.Should().Throw<Exception>();
    }

    [Fact]
    public void Decrypt_WithMissingVersionPrefix_ShouldThrowException()
    {
        // Arrange - Valid base64 but missing prefix
        var invalidCiphertext = Convert.ToBase64String(new byte[50]);

        // Act & Assert
        var action = () => _encryptionService.Decrypt(invalidCiphertext, _testDek);
        action.Should().Throw<Exception>();
    }

    #endregion

    #region Round-Trip Tests

    [Fact]
    public void EncryptAndDecrypt_MultipleRoundTrips_ShouldAlwaysSucceed()
    {
        // Arrange
        var testCases = new[]
        {
            "Simple text",
            "A",
            new string('B', 1000),
            "Unicode: 你好世界",
            "Emoji: 😀🎉🔐",
            "Numbers: 1234567890",
            "Special: !@#$%^&*()",
            "Mixed: Hello123!@#世界😀"
        };

        foreach (var plainText in testCases)
        {
            // Act
            var encrypted = _encryptionService.Encrypt(plainText, _testDek);
            var decrypted = _encryptionService.Decrypt(encrypted, _testDek);

            // Assert
            decrypted.Should().Be(plainText, $"Round trip failed for: {plainText}");
        }
    }

    [Fact]
    public void EncryptAndDecrypt_WithDifferentDeks_ShouldWork()
    {
        // Arrange
        var plainText = "Hello, World!";
        var dek1 = new byte[32];
        var dek2 = new byte[32];
        new Random(1).NextBytes(dek1);
        new Random(2).NextBytes(dek2);

        // Act
        var encrypted1 = _encryptionService.Encrypt(plainText, dek1);
        var encrypted2 = _encryptionService.Encrypt(plainText, dek2);

        var decrypted1 = _encryptionService.Decrypt(encrypted1, dek1);
        var decrypted2 = _encryptionService.Decrypt(encrypted2, dek2);

        // Assert
        encrypted1.Should().NotBe(encrypted2); // Different DEKs = different ciphertext
        decrypted1.Should().Be(plainText);
        decrypted2.Should().Be(plainText);
    }

    #endregion

    #region Version Prefix Tests

    [Fact]
    public void Encrypt_ShouldIncludeVersionPrefix()
    {
        // Arrange
        var plainText = "Test";

        // Act
        var encrypted = _encryptionService.Encrypt(plainText, _testDek);

        // Assert
        encrypted.Should().StartWith("ENC:v1:");
    }

    [Fact]
    public void Decrypt_ShouldHandleVersionPrefix()
    {
        // Arrange
        var plainText = "Test with version prefix";
        var encrypted = _encryptionService.Encrypt(plainText, _testDek);

        // Act
        var decrypted = _encryptionService.Decrypt(encrypted, _testDek);

        // Assert
        decrypted.Should().Be(plainText);
    }

    #endregion

    #region Edge Cases

    [Fact]
    public void Encrypt_WithWhitespaceOnly_ShouldWork()
    {
        // Arrange
        var plainText = "   \t\n\r   ";

        // Act
        var encrypted = _encryptionService.Encrypt(plainText, _testDek);
        var decrypted = _encryptionService.Decrypt(encrypted, _testDek);

        // Assert
        decrypted.Should().Be(plainText);
    }

    [Fact]
    public void Encrypt_WithNewlines_ShouldPreserveNewlines()
    {
        // Arrange
        var plainText = "Line1\nLine2\r\nLine3\rLine4";

        // Act
        var encrypted = _encryptionService.Encrypt(plainText, _testDek);
        var decrypted = _encryptionService.Decrypt(encrypted, _testDek);

        // Assert
        decrypted.Should().Be(plainText);
    }

    [Fact]
    public void Encrypt_WithNullBytes_ShouldWork()
    {
        // Arrange
        var plainText = "Hello\0World\0!";

        // Act
        var encrypted = _encryptionService.Encrypt(plainText, _testDek);
        var decrypted = _encryptionService.Decrypt(encrypted, _testDek);

        // Assert
        decrypted.Should().Be(plainText);
    }

    #endregion
}
