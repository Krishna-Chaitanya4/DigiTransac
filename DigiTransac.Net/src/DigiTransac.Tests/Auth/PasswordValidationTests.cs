using Xunit;
using FluentAssertions;

namespace DigiTransac.Tests.Auth;

/// <summary>
/// Unit tests for password validation
/// Validates: Password strength requirements
/// </summary>
public class PasswordValidationTests
{
    [Theory]
    [InlineData("short")]                // Too short (6 chars)
    [InlineData("NoNumbers!")]           // No digits
    [InlineData("NoSpecial123")]         // No special chars
    [InlineData("onlylowercase123!")]    // No uppercase
    public void ValidatePasswordStrength_WithWeakPassword_ShouldFail(string password)
    {
        // Arrange & Act
        var isValid = IsPasswordStrong(password);

        // Assert
        isValid.Should().BeFalse($"Password '{password}' should be considered weak");
    }

    [Theory]
    [InlineData("ValidPass123!")]
    [InlineData("Secure@Pass2024")]
    [InlineData("Complex#Password99")]
    [InlineData("Test@123Secure")]
    public void ValidatePasswordStrength_WithStrongPassword_ShouldSucceed(string password)
    {
        // Arrange & Act
        var isValid = IsPasswordStrong(password);

        // Assert
        isValid.Should().BeTrue($"Password '{password}' should be considered strong");
    }

    [Fact]
    public void ValidatePasswordStrength_WithEmptyPassword_ReturnsFalse()
    {
        // Arrange
        var password = string.Empty;

        // Act
        var isValid = IsPasswordStrong(password);

        // Assert
        isValid.Should().BeFalse();
    }

    [Fact]
    public void ValidatePasswordStrength_WithNullPassword_ReturnsFalse()
    {
        // Arrange
        string? password = null;

        // Act
        var isValid = IsPasswordStrong(password);

        // Assert
        isValid.Should().BeFalse();
    }

    [Fact]
    public void ValidatePasswordStrength_WithTooShortPassword_ReturnsFalse()
    {
        // Arrange
        const string password = "Pass1!";  // 6 chars, needs 8 min

        // Act
        var isValid = IsPasswordStrong(password);

        // Assert
        isValid.Should().BeFalse("Password must be at least 8 characters");
    }

    [Fact]
    public void PasswordStrengthRequirements_AreConsistentlyEnforced()
    {
        // Test that all requirements are checked simultaneously
        // Arrange
        var testCases = new[]
        {
            ("ValidPass123!", true),           // All requirements met
            ("nouppercase123!", false),        // Missing uppercase
            ("NOLOWERCASE123!", false),        // Missing lowercase
            ("NoDigitsHere!", false),          // Missing digit
            ("NoSpecial123", false),           // Missing special char
            ("Pass123!", true),                // All requirements, minimal
        };

        // Act & Assert
        foreach (var (password, expected) in testCases)
        {
            var result = IsPasswordStrong(password);
            result.Should().Be(expected, $"Password '{password}' should be {(expected ? "valid" : "invalid")}");
        }
    }

    /// <summary>
    /// Validates password strength
    /// Requirements: Min 8 chars, uppercase, lowercase, digit, special char
    /// </summary>
    private static bool IsPasswordStrong(string? password)
    {
        if (string.IsNullOrEmpty(password) || password.Length < 8)
            return false;

        bool hasUppercase = password.Any(char.IsUpper);
        bool hasLowercase = password.Any(char.IsLower);
        bool hasDigit = password.Any(char.IsDigit);
        bool hasSpecialChar = password.Any(c => !char.IsLetterOrDigit(c));

        return hasUppercase && hasLowercase && hasDigit && hasSpecialChar;
    }
}
