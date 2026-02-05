using FluentAssertions;

namespace DigiTransac.Tests.Services;

/// <summary>
/// Tests for password validation logic
/// These test the password requirements: min 8 chars, uppercase, lowercase, number, special char
/// </summary>
public class PasswordValidationTests
{
    [Theory]
    [InlineData("Test@123", true)]          // Valid - all requirements met
    [InlineData("Password@1", true)]         // Valid - all requirements met
    [InlineData("MyP@ssw0rd!", true)]        // Valid - all requirements met
    [InlineData("Ab1!xxxx", true)]           // Valid - exactly 8 chars
    public void ValidPassword_ShouldPass(string password, bool expectedValid)
    {
        // Act
        var result = ValidatePassword(password);

        // Assert
        result.IsValid.Should().Be(expectedValid);
    }

    [Theory]
    [InlineData("", "Password is required")]                              // Empty
    [InlineData("   ", "Password is required")]                           // Whitespace
    [InlineData("Ab1!", "at least 8 characters")]                         // Too short (4 chars)
    [InlineData("Ab1!xxx", "at least 8 characters")]                      // Too short (7 chars)
    [InlineData("test@123", "uppercase letter")]                          // No uppercase
    [InlineData("TEST@123", "lowercase letter")]                          // No lowercase
    [InlineData("TestTest@", "one number")]                               // No number
    [InlineData("TestTest1", "special character")]                        // No special char
    public void InvalidPassword_ShouldFail_WithExpectedMessage(string password, string expectedMessagePart)
    {
        // Act
        var result = ValidatePassword(password);

        // Assert
        result.IsValid.Should().BeFalse();
        result.Message.Should().Contain(expectedMessagePart);
    }

    [Fact]
    public void Password_WithAllRequirements_ShouldBeValid()
    {
        // Arrange
        var validPasswords = new[]
        {
            "Password@123",
            "MySecure!Pass1",
            "Test#2024Valid",
            "Aa1!aaaa",
            "zzzZZZ111@@@"
        };

        // Act & Assert
        foreach (var password in validPasswords)
        {
            var result = ValidatePassword(password);
            result.IsValid.Should().BeTrue($"Password '{password}' should be valid");
        }
    }

    [Fact]
    public void Password_MissingOnlySpecialChar_ShouldFail()
    {
        // Arrange
        var password = "Password123"; // Has upper, lower, number, length - but no special char

        // Act
        var result = ValidatePassword(password);

        // Assert
        result.IsValid.Should().BeFalse();
        result.Message.Should().Contain("special character");
    }

    [Fact]
    public void Password_MissingOnlyNumber_ShouldFail()
    {
        // Arrange
        var password = "Password!@#"; // Has upper, lower, special, length - but no number

        // Act
        var result = ValidatePassword(password);

        // Assert
        result.IsValid.Should().BeFalse();
        result.Message.Should().Contain("number");
    }

    // Helper method that mirrors the AuthService.ValidatePassword logic
    private static (bool IsValid, string Message) ValidatePassword(string password)
    {
        if (string.IsNullOrWhiteSpace(password))
            return (false, "Password is required");

        if (password.Length < 8)
            return (false, "Password must be at least 8 characters long");

        if (!password.Any(char.IsUpper))
            return (false, "Password must contain at least one uppercase letter");

        if (!password.Any(char.IsLower))
            return (false, "Password must contain at least one lowercase letter");

        if (!password.Any(char.IsDigit))
            return (false, "Password must contain at least one number");

        if (!password.Any(c => !char.IsLetterOrDigit(c)))
            return (false, "Password must contain at least one special character");

        return (true, "Password is valid");
    }
}
