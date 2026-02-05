using DigiTransac.Api.Models;
using DigiTransac.Api.Repositories;
using DigiTransac.Api.Services;
using FluentAssertions;
using Microsoft.Extensions.Logging;
using Moq;

namespace DigiTransac.Tests.Services;

public class TwoFactorServiceTests
{
    private readonly Mock<IUserRepository> _userRepositoryMock;
    private readonly Mock<ILogger<TwoFactorService>> _loggerMock;
    private readonly TwoFactorService _twoFactorService;

    public TwoFactorServiceTests()
    {
        _userRepositoryMock = new Mock<IUserRepository>();
        _loggerMock = new Mock<ILogger<TwoFactorService>>();
        _twoFactorService = new TwoFactorService(_userRepositoryMock.Object, _loggerMock.Object);
    }

    #region GenerateSetupInfoAsync Tests

    [Fact]
    public async Task GenerateSetupInfoAsync_WithValidUser_ShouldReturnSetupInfo()
    {
        // Arrange
        var user = new User
        {
            Id = "user-123",
            Email = "test@example.com",
            FullName = "Test User",
            TwoFactorEnabled = false
        };
        _userRepositoryMock.Setup(x => x.GetByIdAsync(user.Id)).ReturnsAsync(user);
        _userRepositoryMock.Setup(x => x.UpdateAsync(It.IsAny<User>())).Returns(Task.CompletedTask);

        // Act
        var result = await _twoFactorService.GenerateSetupInfoAsync(user.Id);

        // Assert
        result.Should().NotBeNull();
        result.Secret.Should().NotBeNullOrEmpty();
        result.QrCodeUri.Should().Contain("otpauth://totp/");
        result.QrCodeUri.Should().Contain("DigiTransac");
        result.QrCodeUri.Should().Contain("test%40example.com"); // URL-encoded email
        result.ManualEntryKey.Should().NotBeNullOrEmpty();
        _userRepositoryMock.Verify(x => x.UpdateAsync(It.Is<User>(u => !string.IsNullOrEmpty(u.TwoFactorSecret))), Times.Once);
    }

    [Fact]
    public async Task GenerateSetupInfoAsync_WithNonExistentUser_ShouldThrowException()
    {
        // Arrange
        var userId = "non-existent";
        _userRepositoryMock.Setup(x => x.GetByIdAsync(userId)).ReturnsAsync((User?)null);

        // Act
        var act = async () => await _twoFactorService.GenerateSetupInfoAsync(userId);

        // Assert
        await act.Should().ThrowAsync<InvalidOperationException>()
            .WithMessage("*not found*");
    }

    [Fact]
    public async Task GenerateSetupInfoAsync_WithTwoFactorAlreadyEnabled_ShouldGenerateNewSetup()
    {
        // Arrange - User can regenerate setup even if 2FA was previously enabled
        var user = new User
        {
            Id = "user-123",
            Email = "test@example.com",
            FullName = "Test User",
            TwoFactorEnabled = true,
            TwoFactorSecret = "EXISTING_SECRET"
        };
        _userRepositoryMock.Setup(x => x.GetByIdAsync(user.Id)).ReturnsAsync(user);
        _userRepositoryMock.Setup(x => x.UpdateAsync(It.IsAny<User>())).Returns(Task.CompletedTask);

        // Act
        var result = await _twoFactorService.GenerateSetupInfoAsync(user.Id);

        // Assert - Should generate new setup info
        result.Should().NotBeNull();
        result.Secret.Should().NotBeNullOrEmpty();
        result.Secret.Should().NotBe("EXISTING_SECRET"); // Should be a new secret
    }

    #endregion

    #region EnableTwoFactorAsync Tests

    [Fact]
    public async Task EnableTwoFactorAsync_WithValidCode_ShouldEnableTwoFactor()
    {
        // Arrange
        var secret = "JBSWY3DPEHPK3PXP"; // Valid Base32 secret
        var user = new User
        {
            Id = "user-123",
            Email = "test@example.com",
            FullName = "Test User",
            TwoFactorEnabled = false,
            TwoFactorSecret = secret
        };
        _userRepositoryMock.Setup(x => x.GetByIdAsync(user.Id)).ReturnsAsync(user);
        _userRepositoryMock.Setup(x => x.UpdateAsync(It.IsAny<User>())).Returns(Task.CompletedTask);

        // Generate a valid code using the same TOTP algorithm
        var totp = new OtpNet.Totp(OtpNet.Base32Encoding.ToBytes(secret));
        var validCode = totp.ComputeTotp();

        // Act
        var (success, message) = await _twoFactorService.EnableTwoFactorAsync(user.Id, validCode);

        // Assert
        success.Should().BeTrue();
        message.Should().Contain("enabled");
        _userRepositoryMock.Verify(x => x.UpdateAsync(It.Is<User>(u => u.TwoFactorEnabled == true)), Times.Once);
    }

    [Fact]
    public async Task EnableTwoFactorAsync_WithInvalidCode_ShouldReturnFalse()
    {
        // Arrange
        var user = new User
        {
            Id = "user-123",
            Email = "test@example.com",
            FullName = "Test User",
            TwoFactorEnabled = false,
            TwoFactorSecret = "JBSWY3DPEHPK3PXP"
        };
        _userRepositoryMock.Setup(x => x.GetByIdAsync(user.Id)).ReturnsAsync(user);

        // Act
        var (success, message) = await _twoFactorService.EnableTwoFactorAsync(user.Id, "000000");

        // Assert
        success.Should().BeFalse();
        _userRepositoryMock.Verify(x => x.UpdateAsync(It.IsAny<User>()), Times.Never);
    }

    [Fact]
    public async Task EnableTwoFactorAsync_WithNoSecret_ShouldReturnFalse()
    {
        // Arrange
        var user = new User
        {
            Id = "user-123",
            Email = "test@example.com",
            FullName = "Test User",
            TwoFactorEnabled = false,
            TwoFactorSecret = null
        };
        _userRepositoryMock.Setup(x => x.GetByIdAsync(user.Id)).ReturnsAsync(user);

        // Act
        var (success, message) = await _twoFactorService.EnableTwoFactorAsync(user.Id, "123456");

        // Assert
        success.Should().BeFalse();
    }

    #endregion

    #region DisableTwoFactorAsync Tests

    [Fact]
    public async Task DisableTwoFactorAsync_WithValidPassword_ShouldDisableTwoFactor()
    {
        // Arrange
        var password = "Password123!";
        var user = new User
        {
            Id = "user-123",
            Email = "test@example.com",
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(password),
            FullName = "Test User",
            TwoFactorEnabled = true,
            TwoFactorSecret = "SECRET"
        };
        _userRepositoryMock.Setup(x => x.GetByIdAsync(user.Id)).ReturnsAsync(user);
        _userRepositoryMock.Setup(x => x.UpdateAsync(It.IsAny<User>())).Returns(Task.CompletedTask);

        // Act
        var (success, message) = await _twoFactorService.DisableTwoFactorAsync(user.Id, password);

        // Assert
        success.Should().BeTrue();
        message.Should().Contain("disabled");
        _userRepositoryMock.Verify(x => x.UpdateAsync(It.Is<User>(u => 
            u.TwoFactorEnabled == false && u.TwoFactorSecret == null)), Times.Once);
    }

    [Fact]
    public async Task DisableTwoFactorAsync_WithInvalidPassword_ShouldReturnFalse()
    {
        // Arrange
        var user = new User
        {
            Id = "user-123",
            Email = "test@example.com",
            PasswordHash = BCrypt.Net.BCrypt.HashPassword("CorrectPassword"),
            FullName = "Test User",
            TwoFactorEnabled = true,
            TwoFactorSecret = "SECRET"
        };
        _userRepositoryMock.Setup(x => x.GetByIdAsync(user.Id)).ReturnsAsync(user);

        // Act
        var (success, message) = await _twoFactorService.DisableTwoFactorAsync(user.Id, "WrongPassword");

        // Assert
        success.Should().BeFalse();
        _userRepositoryMock.Verify(x => x.UpdateAsync(It.IsAny<User>()), Times.Never);
    }

    [Fact]
    public async Task DisableTwoFactorAsync_WhenNotEnabled_ShouldReturnFalse()
    {
        // Arrange
        var user = new User
        {
            Id = "user-123",
            Email = "test@example.com",
            PasswordHash = BCrypt.Net.BCrypt.HashPassword("Password123!"),
            FullName = "Test User",
            TwoFactorEnabled = false
        };
        _userRepositoryMock.Setup(x => x.GetByIdAsync(user.Id)).ReturnsAsync(user);

        // Act
        var (success, message) = await _twoFactorService.DisableTwoFactorAsync(user.Id, "Password123!");

        // Assert
        success.Should().BeFalse();
    }

    #endregion

    #region VerifyTwoFactorAsync Tests

    [Fact]
    public async Task VerifyTwoFactorAsync_WithValidCode_ShouldReturnTrue()
    {
        // Arrange
        var secret = "JBSWY3DPEHPK3PXP";
        var user = new User
        {
            Id = "user-123",
            Email = "test@example.com",
            FullName = "Test User",
            TwoFactorEnabled = true,
            TwoFactorSecret = secret
        };
        _userRepositoryMock.Setup(x => x.GetByIdAsync(user.Id)).ReturnsAsync(user);

        // Generate valid code
        var totp = new OtpNet.Totp(OtpNet.Base32Encoding.ToBytes(secret));
        var validCode = totp.ComputeTotp();

        // Act
        var result = await _twoFactorService.VerifyTwoFactorAsync(user.Id, validCode);

        // Assert
        result.Should().BeTrue();
    }

    [Fact]
    public async Task VerifyTwoFactorAsync_WithInvalidCode_ShouldReturnFalse()
    {
        // Arrange
        var user = new User
        {
            Id = "user-123",
            Email = "test@example.com",
            FullName = "Test User",
            TwoFactorEnabled = true,
            TwoFactorSecret = "JBSWY3DPEHPK3PXP"
        };
        _userRepositoryMock.Setup(x => x.GetByIdAsync(user.Id)).ReturnsAsync(user);

        // Act
        var result = await _twoFactorService.VerifyTwoFactorAsync(user.Id, "000000");

        // Assert
        result.Should().BeFalse();
    }

    [Fact]
    public async Task VerifyTwoFactorAsync_WithTwoFactorDisabled_ShouldReturnFalse()
    {
        // Arrange
        var user = new User
        {
            Id = "user-123",
            Email = "test@example.com",
            FullName = "Test User",
            TwoFactorEnabled = false
        };
        _userRepositoryMock.Setup(x => x.GetByIdAsync(user.Id)).ReturnsAsync(user);

        // Act
        var result = await _twoFactorService.VerifyTwoFactorAsync(user.Id, "123456");

        // Assert
        result.Should().BeFalse();
    }

    [Fact]
    public async Task VerifyTwoFactorAsync_WithNonExistentUser_ShouldReturnFalse()
    {
        // Arrange
        var userId = "non-existent";
        _userRepositoryMock.Setup(x => x.GetByIdAsync(userId)).ReturnsAsync((User?)null);

        // Act
        var result = await _twoFactorService.VerifyTwoFactorAsync(userId, "123456");

        // Assert
        result.Should().BeFalse();
    }

    #endregion
}
