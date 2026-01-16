using DigiTransac.Api.Models;
using DigiTransac.Api.Models.Dto;
using DigiTransac.Api.Repositories;
using DigiTransac.Api.Services;
using DigiTransac.Api.Settings;
using FluentAssertions;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Moq;

namespace DigiTransac.Tests.Services;

public class AuthServiceTests
{
    private readonly Mock<IUserRepository> _userRepositoryMock;
    private readonly Mock<IEmailVerificationRepository> _emailVerificationRepositoryMock;
    private readonly Mock<IRefreshTokenRepository> _refreshTokenRepositoryMock;
    private readonly Mock<IEmailService> _emailServiceMock;
    private readonly Mock<ILogger<AuthService>> _loggerMock;
    private readonly IOptions<JwtSettings> _jwtSettings;
    private readonly AuthService _authService;

    public AuthServiceTests()
    {
        _userRepositoryMock = new Mock<IUserRepository>();
        _emailVerificationRepositoryMock = new Mock<IEmailVerificationRepository>();
        _refreshTokenRepositoryMock = new Mock<IRefreshTokenRepository>();
        _emailServiceMock = new Mock<IEmailService>();
        _loggerMock = new Mock<ILogger<AuthService>>();
        _jwtSettings = Options.Create(new JwtSettings
        {
            Key = "super-secret-key-for-testing-at-least-32-characters-long",
            Issuer = "DigiTransac-Test",
            Audience = "DigiTransac-Test-Users",
            AccessTokenExpireMinutes = 15,
            RefreshTokenExpireDays = 7
        });

        // Setup refresh token repository to return the token passed to it
        _refreshTokenRepositoryMock.Setup(x => x.CreateAsync(It.IsAny<RefreshToken>()))
            .ReturnsAsync((RefreshToken t) => t);

        _authService = new AuthService(
            _userRepositoryMock.Object,
            _emailVerificationRepositoryMock.Object,
            _refreshTokenRepositoryMock.Object,
            _emailServiceMock.Object,
            _jwtSettings,
            _loggerMock.Object
        );
    }

    #region SendVerificationCodeAsync Tests

    [Fact]
    public async Task SendVerificationCodeAsync_WithValidEmail_ShouldReturnSuccess()
    {
        // Arrange
        var email = "test@example.com";
        _userRepositoryMock.Setup(x => x.GetByEmailAsync(email))
            .ReturnsAsync((User?)null);
        _emailServiceMock.Setup(x => x.SendVerificationCodeAsync(email, It.IsAny<string>()))
            .Returns(Task.CompletedTask);

        // Act
        var result = await _authService.SendVerificationCodeAsync(email);

        // Assert
        result.Success.Should().BeTrue();
        result.Message.Should().Contain("Verification code sent");
        _emailServiceMock.Verify(x => x.SendVerificationCodeAsync(email, It.IsAny<string>()), Times.Once);
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("invalid-email")]
    [InlineData("@example.com")]
    [InlineData("test@")]
    public async Task SendVerificationCodeAsync_WithInvalidEmail_ShouldReturnFailure(string email)
    {
        // Act
        var result = await _authService.SendVerificationCodeAsync(email);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().Contain("Invalid email format");
    }

    [Fact]
    public async Task SendVerificationCodeAsync_WithExistingEmail_ShouldReturnFailure()
    {
        // Arrange
        var email = "existing@example.com";
        _userRepositoryMock.Setup(x => x.GetByEmailAsync(email))
            .ReturnsAsync(new User { Email = email, FullName = "Existing User", PasswordHash = "hash" });

        // Act
        var result = await _authService.SendVerificationCodeAsync(email);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().Contain("Email already registered");
    }

    #endregion

    #region VerifyCodeAsync Tests

    [Fact]
    public async Task VerifyCodeAsync_WithValidCode_ShouldReturnSuccessAndToken()
    {
        // Arrange
        var email = "test@example.com";
        var code = "123456";
        var verification = new EmailVerification
        {
            Email = email,
            Code = code,
            ExpiresAt = DateTime.UtcNow.AddMinutes(5),
            IsVerified = false,
            Purpose = VerificationPurpose.Registration
        };

        _emailVerificationRepositoryMock.Setup(x => x.GetByEmailAndCodeAsync(email, code, VerificationPurpose.Registration))
            .ReturnsAsync(verification);
        _emailVerificationRepositoryMock.Setup(x => x.UpdateAsync(It.IsAny<EmailVerification>()))
            .Returns(Task.CompletedTask);

        // Act
        var result = await _authService.VerifyCodeAsync(email, code);

        // Assert
        result.Success.Should().BeTrue();
        result.Message.Should().Contain("Email verified successfully");
        result.VerificationToken.Should().NotBeNullOrEmpty();
    }

    [Fact]
    public async Task VerifyCodeAsync_WithInvalidCode_ShouldReturnFailure()
    {
        // Arrange
        var email = "test@example.com";
        var code = "000000";

        _emailVerificationRepositoryMock.Setup(x => x.GetByEmailAndCodeAsync(email, code, VerificationPurpose.Registration))
            .ReturnsAsync((EmailVerification?)null);

        // Act
        var result = await _authService.VerifyCodeAsync(email, code);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().Contain("Invalid or expired");
        result.VerificationToken.Should().BeNull();
    }

    #endregion

    #region CompleteRegistrationAsync Tests

    [Fact]
    public async Task CompleteRegistrationAsync_WithValidData_ShouldReturnAuthResponse()
    {
        // Arrange
        var request = new CompleteRegistrationRequest(
            Email: "test@example.com",
            VerificationToken: "valid-token",
            Password: "Test@123!",
            FullName: "Test User"
        );

        var verification = new EmailVerification
        {
            Email = request.Email,
            VerificationToken = request.VerificationToken,
            IsVerified = true,
            ExpiresAt = DateTime.UtcNow.AddMinutes(15),
            Purpose = VerificationPurpose.Registration
        };

        _emailVerificationRepositoryMock.Setup(x => x.GetByVerificationTokenAsync(request.VerificationToken, VerificationPurpose.Registration))
            .ReturnsAsync(verification);
        _userRepositoryMock.Setup(x => x.GetByEmailAsync(request.Email))
            .ReturnsAsync((User?)null);
        _userRepositoryMock.Setup(x => x.CreateAsync(It.IsAny<User>()))
            .Callback<User>(u => u.Id = "generated-user-id") // Simulate MongoDB assigning an Id
            .ReturnsAsync((User u) => u);

        // Act
        var result = await _authService.CompleteRegistrationAsync(request);

        // Assert
        result.Should().NotBeNull();
        result!.Email.Should().Be(request.Email);
        result.FullName.Should().Be(request.FullName);
        result.AccessToken.Should().NotBeNullOrEmpty();
        result.RefreshToken.Should().NotBeNullOrEmpty();
        result.IsEmailVerified.Should().BeTrue();
    }

    [Fact]
    public async Task CompleteRegistrationAsync_WithInvalidToken_ShouldReturnNull()
    {
        // Arrange
        var request = new CompleteRegistrationRequest(
            Email: "test@example.com",
            VerificationToken: "invalid-token",
            Password: "Test@123!",
            FullName: "Test User"
        );

        _emailVerificationRepositoryMock.Setup(x => x.GetByVerificationTokenAsync(request.VerificationToken, VerificationPurpose.Registration))
            .ReturnsAsync((EmailVerification?)null);

        // Act
        var result = await _authService.CompleteRegistrationAsync(request);

        // Assert
        result.Should().BeNull();
    }

    [Fact]
    public async Task CompleteRegistrationAsync_WithExistingEmail_ShouldReturnNull()
    {
        // Arrange
        var request = new CompleteRegistrationRequest(
            Email: "existing@example.com",
            VerificationToken: "valid-token",
            Password: "Test@123!",
            FullName: "Test User"
        );

        var verification = new EmailVerification
        {
            Email = request.Email,
            VerificationToken = request.VerificationToken,
            IsVerified = true,
            ExpiresAt = DateTime.UtcNow.AddMinutes(15),
            Purpose = VerificationPurpose.Registration
        };

        _emailVerificationRepositoryMock.Setup(x => x.GetByVerificationTokenAsync(request.VerificationToken, VerificationPurpose.Registration))
            .ReturnsAsync(verification);
        _userRepositoryMock.Setup(x => x.GetByEmailAsync(request.Email))
            .ReturnsAsync(new User { Email = request.Email, FullName = "Existing", PasswordHash = "hash" });

        // Act
        var result = await _authService.CompleteRegistrationAsync(request);

        // Assert
        result.Should().BeNull();
    }

    #endregion

    #region LoginAsync Tests

    [Fact]
    public async Task LoginAsync_WithValidCredentials_ShouldReturnAuthResponse()
    {
        // Arrange
        var password = "Test@123!";
        var passwordHash = BCrypt.Net.BCrypt.HashPassword(password);
        var user = new User
        {
            Id = "user-123",
            Email = "test@example.com",
            FullName = "Test User",
            PasswordHash = passwordHash,
            IsEmailVerified = true
        };

        var request = new LoginRequest(Email: user.Email, Password: password);

        _userRepositoryMock.Setup(x => x.GetByEmailAsync(request.Email))
            .ReturnsAsync(user);

        // Act
        var result = await _authService.LoginAsync(request);

        // Assert
        result.Should().NotBeNull();
        result!.Email.Should().Be(user.Email);
        result.FullName.Should().Be(user.FullName);
        result.AccessToken.Should().NotBeNullOrEmpty();
        result.RefreshToken.Should().NotBeNullOrEmpty();
    }

    [Fact]
    public async Task LoginAsync_WithInvalidPassword_ShouldReturnNull()
    {
        // Arrange
        var user = new User
        {
            Email = "test@example.com",
            FullName = "Test User",
            PasswordHash = BCrypt.Net.BCrypt.HashPassword("CorrectPassword@123"),
            IsEmailVerified = true
        };

        var request = new LoginRequest(Email: user.Email, Password: "WrongPassword@123");

        _userRepositoryMock.Setup(x => x.GetByEmailAsync(request.Email))
            .ReturnsAsync(user);

        // Act
        var result = await _authService.LoginAsync(request);

        // Assert
        result.Should().BeNull();
    }

    [Fact]
    public async Task LoginAsync_WithNonExistentUser_ShouldReturnNull()
    {
        // Arrange
        var request = new LoginRequest(Email: "nonexistent@example.com", Password: "Test@123!");

        _userRepositoryMock.Setup(x => x.GetByEmailAsync(request.Email))
            .ReturnsAsync((User?)null);

        // Act
        var result = await _authService.LoginAsync(request);

        // Assert
        result.Should().BeNull();
    }

    #endregion

    #region DeleteAccountAsync Tests

    [Fact]
    public async Task DeleteAccountAsync_WithCorrectPassword_ShouldReturnSuccess()
    {
        // Arrange
        var userId = "user-123";
        var password = "Test@123!";
        var user = new User
        {
            Id = userId,
            Email = "test@example.com",
            FullName = "Test User",
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(password)
        };

        _userRepositoryMock.Setup(x => x.GetByIdAsync(userId))
            .ReturnsAsync(user);
        _userRepositoryMock.Setup(x => x.DeleteAsync(userId))
            .ReturnsAsync(true);

        // Act
        var result = await _authService.DeleteAccountAsync(userId, password);

        // Assert
        result.Success.Should().BeTrue();
        result.Message.Should().Contain("deleted successfully");
        _userRepositoryMock.Verify(x => x.DeleteAsync(userId), Times.Once);
    }

    [Fact]
    public async Task DeleteAccountAsync_WithIncorrectPassword_ShouldReturnFailure()
    {
        // Arrange
        var userId = "user-123";
        var user = new User
        {
            Id = userId,
            Email = "test@example.com",
            FullName = "Test User",
            PasswordHash = BCrypt.Net.BCrypt.HashPassword("CorrectPassword@123")
        };

        _userRepositoryMock.Setup(x => x.GetByIdAsync(userId))
            .ReturnsAsync(user);

        // Act
        var result = await _authService.DeleteAccountAsync(userId, "WrongPassword@123");

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().Contain("Invalid password");
        _userRepositoryMock.Verify(x => x.DeleteAsync(It.IsAny<string>()), Times.Never);
    }

    [Fact]
    public async Task DeleteAccountAsync_WithNonExistentUser_ShouldReturnFailure()
    {
        // Arrange
        var userId = "nonexistent-user";

        _userRepositoryMock.Setup(x => x.GetByIdAsync(userId))
            .ReturnsAsync((User?)null);

        // Act
        var result = await _authService.DeleteAccountAsync(userId, "Test@123!");

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().Contain("User not found");
    }

    #endregion

    #region Password Reset Tests

    [Fact]
    public async Task SendPasswordResetCodeAsync_WithExistingUser_ShouldReturnSuccess()
    {
        // Arrange
        var email = "test@example.com";
        var user = new User { Email = email, FullName = "Test User", PasswordHash = "hash" };

        _userRepositoryMock.Setup(x => x.GetByEmailAsync(email))
            .ReturnsAsync(user);
        _emailServiceMock.Setup(x => x.SendPasswordResetCodeAsync(email, It.IsAny<string>()))
            .Returns(Task.CompletedTask);
        _emailVerificationRepositoryMock.Setup(x => x.DeleteByEmailAsync(email, VerificationPurpose.PasswordReset))
            .Returns(Task.CompletedTask);
        _emailVerificationRepositoryMock.Setup(x => x.CreateAsync(It.IsAny<EmailVerification>()))
            .ReturnsAsync(new EmailVerification());

        // Act
        var result = await _authService.SendPasswordResetCodeAsync(email);

        // Assert
        result.Success.Should().BeTrue();
        // The actual message is "If an account with that email exists, a reset code has been sent"
        result.Message.Should().Contain("reset code");
    }

    [Fact]
    public async Task SendPasswordResetCodeAsync_WithNonExistentUser_ShouldReturnSuccess_ForSecurity()
    {
        // Arrange - For security, don't reveal if email exists
        var email = "nonexistent@example.com";

        _userRepositoryMock.Setup(x => x.GetByEmailAsync(email))
            .ReturnsAsync((User?)null);

        // Act
        var result = await _authService.SendPasswordResetCodeAsync(email);

        // Assert
        // For security, we return success even if user doesn't exist
        result.Success.Should().BeTrue();
    }

    [Fact]
    public async Task ResetPasswordAsync_WithValidToken_ShouldReturnSuccess()
    {
        // Arrange
        var email = "test@example.com";
        var verificationToken = "valid-reset-token";
        var newPassword = "NewPassword@123!";
        
        var user = new User
        {
            Id = "user-123",
            Email = email,
            FullName = "Test User",
            PasswordHash = BCrypt.Net.BCrypt.HashPassword("OldPassword@123")
        };

        var verification = new EmailVerification
        {
            Email = email,
            VerificationToken = verificationToken,
            IsVerified = true,
            ExpiresAt = DateTime.UtcNow.AddMinutes(15),
            Purpose = VerificationPurpose.PasswordReset
        };

        var request = new ResetPasswordRequest(email, verificationToken, newPassword);

        _emailVerificationRepositoryMock.Setup(x => x.GetByVerificationTokenAsync(verificationToken, VerificationPurpose.PasswordReset))
            .ReturnsAsync(verification);
        _userRepositoryMock.Setup(x => x.GetByEmailAsync(email))
            .ReturnsAsync(user);
        _userRepositoryMock.Setup(x => x.UpdateAsync(It.IsAny<User>()))
            .Returns(Task.CompletedTask);

        // Act
        var result = await _authService.ResetPasswordAsync(request);

        // Assert
        result.Success.Should().BeTrue();
        result.Message.Should().Contain("reset successfully");
        _userRepositoryMock.Verify(x => x.UpdateAsync(It.Is<User>(u => u.Email == email)), Times.Once);
    }

    [Fact]
    public async Task ResetPasswordAsync_WithInvalidToken_ShouldReturnFailure()
    {
        // Arrange
        var request = new ResetPasswordRequest("test@example.com", "invalid-token", "NewPassword@123!");

        _emailVerificationRepositoryMock.Setup(x => x.GetByVerificationTokenAsync(request.VerificationToken, VerificationPurpose.PasswordReset))
            .ReturnsAsync((EmailVerification?)null);

        // Act
        var result = await _authService.ResetPasswordAsync(request);

        // Assert
        result.Success.Should().BeFalse();
    }

    #endregion
}
