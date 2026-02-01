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
    private readonly Mock<ITwoFactorTokenRepository> _twoFactorTokenRepositoryMock;
    private readonly Mock<IEmailService> _emailServiceMock;
    private readonly Mock<ILabelService> _labelServiceMock;
    private readonly Mock<ITwoFactorService> _twoFactorServiceMock;
    private readonly Mock<IKeyManagementService> _keyManagementServiceMock;
    private readonly Mock<IAuditService> _auditServiceMock;
    private readonly Mock<ILogger<AuthService>> _loggerMock;
    private readonly IOptions<JwtSettings> _jwtSettings;
    private readonly AuthService _authService;
    private readonly byte[] _testDek = new byte[32];

    public AuthServiceTests()
    {
        _userRepositoryMock = new Mock<IUserRepository>();
        _emailVerificationRepositoryMock = new Mock<IEmailVerificationRepository>();
        _refreshTokenRepositoryMock = new Mock<IRefreshTokenRepository>();
        _twoFactorTokenRepositoryMock = new Mock<ITwoFactorTokenRepository>();
        _emailServiceMock = new Mock<IEmailService>();
        _labelServiceMock = new Mock<ILabelService>();
        _twoFactorServiceMock = new Mock<ITwoFactorService>();
        _keyManagementServiceMock = new Mock<IKeyManagementService>();
        _auditServiceMock = new Mock<IAuditService>();
        _loggerMock = new Mock<ILogger<AuthService>>();
        _jwtSettings = Options.Create(new JwtSettings
        {
            Key = "super-secret-key-for-testing-at-least-32-characters-long",
            Issuer = "DigiTransac-Test",
            Audience = "DigiTransac-Test-Users",
            AccessTokenExpireMinutes = 15,
            RefreshTokenExpireDays = 7
        });

        // Setup key management service for server-side encryption
        _keyManagementServiceMock.Setup(x => x.GenerateDek())
            .Returns(_testDek);
        _keyManagementServiceMock.Setup(x => x.WrapKeyAsync(It.IsAny<byte[]>()))
            .ReturnsAsync(new byte[64]);
        _keyManagementServiceMock.Setup(x => x.UnwrapKeyAsync(It.IsAny<byte[]>()))
            .ReturnsAsync(_testDek);

        // Setup refresh token repository to return the token passed to it
        _refreshTokenRepositoryMock.Setup(x => x.CreateAsync(It.IsAny<RefreshToken>()))
            .ReturnsAsync((RefreshToken t) => t);

        _authService = new AuthService(
            _userRepositoryMock.Object,
            _emailVerificationRepositoryMock.Object,
            _refreshTokenRepositoryMock.Object,
            _twoFactorTokenRepositoryMock.Object,
            _emailServiceMock.Object,
            _labelServiceMock.Object,
            _twoFactorServiceMock.Object,
            _keyManagementServiceMock.Object,
            _auditServiceMock.Object,
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
    public async Task LoginAsync_WithInvalidPassword_ShouldReturnEmptyResponse()
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
        result.Should().NotBeNull();
        result.AccessToken.Should().BeNull();
        result.RefreshToken.Should().BeNull();
    }

    [Fact]
    public async Task LoginAsync_WithNonExistentUser_ShouldReturnEmptyResponse()
    {
        // Arrange
        var request = new LoginRequest(Email: "nonexistent@example.com", Password: "Test@123!");

        _userRepositoryMock.Setup(x => x.GetByEmailAsync(request.Email))
            .ReturnsAsync((User?)null);

        // Act
        var result = await _authService.LoginAsync(request);

        // Assert
        result.Should().NotBeNull();
        result.AccessToken.Should().BeNull();
        result.RefreshToken.Should().BeNull();
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

        // First call returns user, second call (verification) returns null
        _userRepositoryMock.SetupSequence(x => x.GetByIdAsync(userId))
            .ReturnsAsync(user)
            .ReturnsAsync((User?)null);
        _refreshTokenRepositoryMock.Setup(x => x.DeleteByUserIdAsync(userId))
            .Returns(Task.CompletedTask);
        _emailVerificationRepositoryMock.Setup(x => x.DeleteAllByEmailAsync(user.Email))
            .Returns(Task.CompletedTask);
        _userRepositoryMock.Setup(x => x.DeleteAsync(userId))
            .ReturnsAsync(true);

        // Act
        var result = await _authService.DeleteAccountAsync(userId, password);

        // Assert
        result.Success.Should().BeTrue();
        result.Message.Should().Contain("deleted successfully");
        _refreshTokenRepositoryMock.Verify(x => x.DeleteByUserIdAsync(userId), Times.Once);
        _emailVerificationRepositoryMock.Verify(x => x.DeleteAllByEmailAsync(user.Email), Times.Once);
        _userRepositoryMock.Verify(x => x.DeleteAsync(userId), Times.Once);
        _userRepositoryMock.Verify(x => x.GetByIdAsync(userId), Times.Exactly(2)); // Initial + verification
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

    #region UpdateNameAsync Tests

    [Fact]
    public async Task UpdateNameAsync_WithValidName_ShouldReturnSuccess()
    {
        // Arrange
        var userId = "user-123";
        var newName = "Updated Name";
        var user = new User
        {
            Id = userId,
            Email = "test@example.com",
            FullName = "Original Name"
        };

        _userRepositoryMock.Setup(x => x.GetByIdAsync(userId))
            .ReturnsAsync(user);
        _userRepositoryMock.Setup(x => x.UpdateAsync(It.IsAny<User>()))
            .Returns(Task.CompletedTask);

        // Act
        var result = await _authService.UpdateNameAsync(userId, newName);

        // Assert
        result.Success.Should().BeTrue();
        result.Message.Should().Contain("updated successfully");
        _userRepositoryMock.Verify(x => x.UpdateAsync(It.Is<User>(u => u.FullName == newName)), Times.Once);
    }

    [Fact]
    public async Task UpdateNameAsync_WithEmptyName_ShouldReturnFailure()
    {
        // Act
        var result = await _authService.UpdateNameAsync("user-123", "");

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().Contain("empty");
    }

    [Fact]
    public async Task UpdateNameAsync_WithNonExistentUser_ShouldReturnFailure()
    {
        // Arrange
        var userId = "nonexistent";
        _userRepositoryMock.Setup(x => x.GetByIdAsync(userId))
            .ReturnsAsync((User?)null);

        // Act
        var result = await _authService.UpdateNameAsync(userId, "New Name");

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().Contain("not found");
    }

    #endregion

    #region SendEmailChangeCodeAsync Tests

    [Fact]
    public async Task SendEmailChangeCodeAsync_WithValidEmail_ShouldReturnSuccess()
    {
        // Arrange
        var userId = "user-123";
        var newEmail = "newemail@example.com";
        var user = new User
        {
            Id = userId,
            Email = "oldemail@example.com",
            FullName = "Test User"
        };

        _userRepositoryMock.Setup(x => x.GetByIdAsync(userId))
            .ReturnsAsync(user);
        _userRepositoryMock.Setup(x => x.GetByEmailAsync(newEmail))
            .ReturnsAsync((User?)null);
        _emailVerificationRepositoryMock.Setup(x => x.CreateAsync(It.IsAny<EmailVerification>()))
            .ReturnsAsync((EmailVerification v) => v);
        _emailServiceMock.Setup(x => x.SendVerificationCodeAsync(newEmail, It.IsAny<string>()))
            .Returns(Task.CompletedTask);

        // Act
        var result = await _authService.SendEmailChangeCodeAsync(userId, newEmail);

        // Assert
        result.Success.Should().BeTrue();
        result.Message.Should().Contain("Verification code sent");
        _emailServiceMock.Verify(x => x.SendVerificationCodeAsync(newEmail, It.IsAny<string>()), Times.Once);
    }

    [Fact]
    public async Task SendEmailChangeCodeAsync_WithSameEmail_ShouldReturnFailure()
    {
        // Arrange
        var userId = "user-123";
        var email = "same@example.com";
        var user = new User
        {
            Id = userId,
            Email = email,
            FullName = "Test User"
        };

        _userRepositoryMock.Setup(x => x.GetByIdAsync(userId))
            .ReturnsAsync(user);

        // Act
        var result = await _authService.SendEmailChangeCodeAsync(userId, email);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().Contain("same as current");
    }

    [Fact]
    public async Task SendEmailChangeCodeAsync_WithEmailInUse_ShouldReturnFailure()
    {
        // Arrange
        var userId = "user-123";
        var newEmail = "taken@example.com";
        var user = new User
        {
            Id = userId,
            Email = "current@example.com",
            FullName = "Test User"
        };
        var existingUser = new User
        {
            Id = "other-user",
            Email = newEmail
        };

        _userRepositoryMock.Setup(x => x.GetByIdAsync(userId))
            .ReturnsAsync(user);
        _userRepositoryMock.Setup(x => x.GetByEmailAsync(newEmail))
            .ReturnsAsync(existingUser);

        // Act
        var result = await _authService.SendEmailChangeCodeAsync(userId, newEmail);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().Contain("already in use");
    }

    #endregion

    #region VerifyAndUpdateEmailAsync Tests

    [Fact]
    public async Task VerifyAndUpdateEmailAsync_WithValidCode_ShouldReturnSuccess()
    {
        // Arrange
        var userId = "user-123";
        var newEmail = "newemail@example.com";
        var code = "123456";
        var user = new User
        {
            Id = userId,
            Email = "oldemail@example.com",
            FullName = "Test User"
        };
        var verification = new EmailVerification
        {
            Email = newEmail,
            Code = code,
            Purpose = VerificationPurpose.EmailChange,
            UserId = userId,
            ExpiresAt = DateTime.UtcNow.AddMinutes(5)
        };

        _emailVerificationRepositoryMock.Setup(x => x.GetByEmailAndCodeAsync(newEmail, code, VerificationPurpose.EmailChange))
            .ReturnsAsync(verification);
        _userRepositoryMock.Setup(x => x.GetByEmailAsync(newEmail))
            .ReturnsAsync((User?)null);
        _userRepositoryMock.Setup(x => x.GetByIdAsync(userId))
            .ReturnsAsync(user);
        _userRepositoryMock.Setup(x => x.UpdateAsync(It.IsAny<User>()))
            .Returns(Task.CompletedTask);
        _emailVerificationRepositoryMock.Setup(x => x.DeleteByEmailAsync(newEmail, VerificationPurpose.EmailChange))
            .Returns(Task.CompletedTask);

        // Act
        var result = await _authService.VerifyAndUpdateEmailAsync(userId, newEmail, code);

        // Assert
        result.Success.Should().BeTrue();
        result.Message.Should().Contain("updated successfully");
        _userRepositoryMock.Verify(x => x.UpdateAsync(It.Is<User>(u => u.Email == newEmail)), Times.Once);
    }

    [Fact]
    public async Task VerifyAndUpdateEmailAsync_WithInvalidCode_ShouldReturnFailure()
    {
        // Arrange
        var userId = "user-123";
        var newEmail = "newemail@example.com";

        _emailVerificationRepositoryMock.Setup(x => x.GetByEmailAndCodeAsync(newEmail, "wrongcode", VerificationPurpose.EmailChange))
            .ReturnsAsync((EmailVerification?)null);

        // Act
        var result = await _authService.VerifyAndUpdateEmailAsync(userId, newEmail, "wrongcode");

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().Contain("Invalid or expired");
    }

    [Fact]
    public async Task VerifyAndUpdateEmailAsync_WithDifferentUserId_ShouldReturnFailure()
    {
        // Arrange
        var userId = "user-123";
        var newEmail = "newemail@example.com";
        var code = "123456";
        var verification = new EmailVerification
        {
            Email = newEmail,
            Code = code,
            Purpose = VerificationPurpose.EmailChange,
            UserId = "different-user", // Different user
            ExpiresAt = DateTime.UtcNow.AddMinutes(5)
        };

        _emailVerificationRepositoryMock.Setup(x => x.GetByEmailAndCodeAsync(newEmail, code, VerificationPurpose.EmailChange))
            .ReturnsAsync(verification);

        // Act
        var result = await _authService.VerifyAndUpdateEmailAsync(userId, newEmail, code);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().Contain("Invalid or expired");
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

    #region RefreshTokenAsync Tests

    [Fact]
    public async Task RefreshTokenAsync_WithValidToken_ShouldReturnNewTokens()
    {
        // Arrange
        var userId = "user-123";
        var oldRefreshToken = "valid-refresh-token";
        var user = new User
        {
            Id = userId,
            Email = "test@example.com",
            FullName = "Test User",
            PasswordHash = BCrypt.Net.BCrypt.HashPassword("Password@123"),
            IsEmailVerified = true
        };

        var storedToken = new RefreshToken
        {
            Id = "token-id",
            UserId = userId,
            Token = oldRefreshToken,
            ExpiresAt = DateTime.UtcNow.AddDays(7),
            CreatedAt = DateTime.UtcNow
        };

        _refreshTokenRepositoryMock.Setup(x => x.GetByTokenAsync(oldRefreshToken))
            .ReturnsAsync(storedToken);
        _userRepositoryMock.Setup(x => x.GetByIdAsync(userId))
            .ReturnsAsync(user);
        _refreshTokenRepositoryMock.Setup(x => x.UpdateAsync(It.IsAny<RefreshToken>()))
            .Returns(Task.CompletedTask);

        // Act
        var result = await _authService.RefreshTokenAsync(oldRefreshToken);

        // Assert
        result.Should().NotBeNull();
        result!.AccessToken.Should().NotBeNullOrEmpty();
        result.RefreshToken.Should().NotBeNullOrEmpty();
        result.RefreshToken.Should().NotBe(oldRefreshToken); // Token rotation
        result.Email.Should().Be(user.Email);
        _refreshTokenRepositoryMock.Verify(x => x.CreateAsync(It.IsAny<RefreshToken>()), Times.Once);
        _refreshTokenRepositoryMock.Verify(x => x.UpdateAsync(It.Is<RefreshToken>(t => t.RevokedAt != null)), Times.Once);
    }

    [Fact]
    public async Task RefreshTokenAsync_WithExpiredToken_ShouldReturnNull()
    {
        // Arrange
        var oldRefreshToken = "expired-refresh-token";
        var storedToken = new RefreshToken
        {
            Id = "token-id",
            UserId = "user-123",
            Token = oldRefreshToken,
            ExpiresAt = DateTime.UtcNow.AddDays(-1), // Expired
            CreatedAt = DateTime.UtcNow.AddDays(-8)
        };

        _refreshTokenRepositoryMock.Setup(x => x.GetByTokenAsync(oldRefreshToken))
            .ReturnsAsync(storedToken);

        // Act
        var result = await _authService.RefreshTokenAsync(oldRefreshToken);

        // Assert
        result.Should().BeNull();
        _userRepositoryMock.Verify(x => x.GetByIdAsync(It.IsAny<string>()), Times.Never);
    }

    [Fact]
    public async Task RefreshTokenAsync_WithRevokedToken_ShouldRevokeAllUserTokens()
    {
        // Arrange - Token theft detection scenario
        var userId = "user-123";
        var revokedRefreshToken = "revoked-refresh-token";
        var storedToken = new RefreshToken
        {
            Id = "token-id",
            UserId = userId,
            Token = revokedRefreshToken,
            ExpiresAt = DateTime.UtcNow.AddDays(7),
            CreatedAt = DateTime.UtcNow,
            RevokedAt = DateTime.UtcNow.AddMinutes(-5) // Already revoked
        };

        _refreshTokenRepositoryMock.Setup(x => x.GetByTokenAsync(revokedRefreshToken))
            .ReturnsAsync(storedToken);
        _refreshTokenRepositoryMock.Setup(x => x.RevokeAllByUserIdAsync(userId))
            .Returns(Task.CompletedTask);

        // Act
        var result = await _authService.RefreshTokenAsync(revokedRefreshToken);

        // Assert
        result.Should().BeNull();
        // Verify that all user tokens were revoked due to potential theft
        _refreshTokenRepositoryMock.Verify(x => x.RevokeAllByUserIdAsync(userId), Times.Once);
    }

    [Fact]
    public async Task RefreshTokenAsync_WithNonExistentToken_ShouldReturnNull()
    {
        // Arrange
        var nonExistentToken = "non-existent-token";

        _refreshTokenRepositoryMock.Setup(x => x.GetByTokenAsync(nonExistentToken))
            .ReturnsAsync((RefreshToken?)null);

        // Act
        var result = await _authService.RefreshTokenAsync(nonExistentToken);

        // Assert
        result.Should().BeNull();
    }

    [Fact]
    public async Task RefreshTokenAsync_WithValidToken_ButUserNotFound_ShouldReturnNull()
    {
        // Arrange
        var refreshToken = "valid-refresh-token";
        var storedToken = new RefreshToken
        {
            Id = "token-id",
            UserId = "deleted-user-123",
            Token = refreshToken,
            ExpiresAt = DateTime.UtcNow.AddDays(7),
            CreatedAt = DateTime.UtcNow
        };

        _refreshTokenRepositoryMock.Setup(x => x.GetByTokenAsync(refreshToken))
            .ReturnsAsync(storedToken);
        _userRepositoryMock.Setup(x => x.GetByIdAsync(storedToken.UserId))
            .ReturnsAsync((User?)null);

        // Act
        var result = await _authService.RefreshTokenAsync(refreshToken);

        // Assert
        result.Should().BeNull();
    }

    #endregion

    #region RevokeTokenAsync Tests

    [Fact]
    public async Task RevokeTokenAsync_WithValidActiveToken_ShouldReturnTrue()
    {
        // Arrange
        var refreshToken = "valid-refresh-token";
        var storedToken = new RefreshToken
        {
            Id = "token-id",
            UserId = "user-123",
            Token = refreshToken,
            ExpiresAt = DateTime.UtcNow.AddDays(7),
            CreatedAt = DateTime.UtcNow
        };

        _refreshTokenRepositoryMock.Setup(x => x.GetByTokenAsync(refreshToken))
            .ReturnsAsync(storedToken);
        _refreshTokenRepositoryMock.Setup(x => x.UpdateAsync(It.IsAny<RefreshToken>()))
            .Returns(Task.CompletedTask);

        // Act
        var result = await _authService.RevokeTokenAsync(refreshToken);

        // Assert
        result.Should().BeTrue();
        _refreshTokenRepositoryMock.Verify(x => x.UpdateAsync(It.Is<RefreshToken>(t => t.RevokedAt != null)), Times.Once);
    }

    [Fact]
    public async Task RevokeTokenAsync_WithNonExistentToken_ShouldReturnFalse()
    {
        // Arrange
        var nonExistentToken = "non-existent-token";

        _refreshTokenRepositoryMock.Setup(x => x.GetByTokenAsync(nonExistentToken))
            .ReturnsAsync((RefreshToken?)null);

        // Act
        var result = await _authService.RevokeTokenAsync(nonExistentToken);

        // Assert
        result.Should().BeFalse();
    }

    [Fact]
    public async Task RevokeTokenAsync_WithAlreadyRevokedToken_ShouldReturnFalse()
    {
        // Arrange
        var alreadyRevokedToken = "revoked-token";
        var storedToken = new RefreshToken
        {
            Id = "token-id",
            UserId = "user-123",
            Token = alreadyRevokedToken,
            ExpiresAt = DateTime.UtcNow.AddDays(7),
            CreatedAt = DateTime.UtcNow,
            RevokedAt = DateTime.UtcNow.AddMinutes(-10)
        };

        _refreshTokenRepositoryMock.Setup(x => x.GetByTokenAsync(alreadyRevokedToken))
            .ReturnsAsync(storedToken);

        // Act
        var result = await _authService.RevokeTokenAsync(alreadyRevokedToken);

        // Assert
        result.Should().BeFalse();
        _refreshTokenRepositoryMock.Verify(x => x.UpdateAsync(It.IsAny<RefreshToken>()), Times.Never);
    }

    #endregion

    #region RevokeAllUserTokensAsync Tests

    [Fact]
    public async Task RevokeAllUserTokensAsync_ShouldCallRepository()
    {
        // Arrange
        var userId = "user-123";
        _refreshTokenRepositoryMock.Setup(x => x.RevokeAllByUserIdAsync(userId))
            .Returns(Task.CompletedTask);

        // Act
        await _authService.RevokeAllUserTokensAsync(userId);

        // Assert
        _refreshTokenRepositoryMock.Verify(x => x.RevokeAllByUserIdAsync(userId), Times.Once);
    }

    #endregion

    #region Two-Factor Authentication Tests

    [Fact]
    public async Task LoginAsync_WithTwoFactorEnabled_ShouldReturnTwoFactorRequired()
    {
        // Arrange
        var email = "test@example.com";
        var password = "Password123!";
        var user = new User
        {
            Id = "user-123",
            Email = email,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(password),
            FullName = "Test User",
            TwoFactorEnabled = true,
            TwoFactorSecret = "TESTSECRET"
        };
        _userRepositoryMock.Setup(x => x.GetByEmailAsync(email)).ReturnsAsync(user);
        _twoFactorTokenRepositoryMock.Setup(x => x.CreateAsync(It.IsAny<TwoFactorToken>()))
            .ReturnsAsync((TwoFactorToken t) => t);

        // Act
        var result = await _authService.LoginAsync(new LoginRequest(email, password));

        // Assert
        result.Should().NotBeNull();
        result!.RequiresTwoFactor.Should().BeTrue();
        result.TwoFactorToken.Should().NotBeNullOrEmpty();
        result.AccessToken.Should().BeNull();
    }

    [Fact]
    public async Task LoginAsync_WithTwoFactorDisabled_ShouldReturnTokens()
    {
        // Arrange
        var email = "test@example.com";
        var password = "Password123!";
        var user = new User
        {
            Id = "user-123",
            Email = email,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(password),
            FullName = "Test User",
            TwoFactorEnabled = false
        };
        _userRepositoryMock.Setup(x => x.GetByEmailAsync(email)).ReturnsAsync(user);

        // Act
        var result = await _authService.LoginAsync(new LoginRequest(email, password));

        // Assert
        result.Should().NotBeNull();
        result!.RequiresTwoFactor.Should().BeFalse();
        result.AccessToken.Should().NotBeNullOrEmpty();
        result.RefreshToken.Should().NotBeNullOrEmpty();
    }

    [Fact]
    public async Task VerifyTwoFactorLoginAsync_WithValidCode_ShouldReturnAuthResponse()
    {
        // Arrange
        var tokenString = "valid-2fa-token";
        var secret = "JBSWY3DPEHPK3PXP"; // Valid Base32 secret
        var user = new User
        {
            Id = "user-123",
            Email = "test@example.com",
            FullName = "Test User",
            TwoFactorEnabled = true,
            TwoFactorSecret = secret
        };
        var twoFactorToken = new TwoFactorToken
        {
            Id = "token-id",
            Token = tokenString,
            UserId = user.Id,
            ExpiresAt = DateTime.UtcNow.AddMinutes(5),
            IsUsed = false
        };
        
        // Generate valid code
        var totp = new OtpNet.Totp(OtpNet.Base32Encoding.ToBytes(secret));
        var validCode = totp.ComputeTotp();
        
        _twoFactorTokenRepositoryMock.Setup(x => x.GetByTokenAsync(tokenString))
            .ReturnsAsync(twoFactorToken);
        _twoFactorServiceMock.Setup(x => x.ValidateCode(secret, validCode))
            .Returns(true);
        _userRepositoryMock.Setup(x => x.GetByIdAsync(user.Id))
            .ReturnsAsync(user);

        // Act
        var result = await _authService.VerifyTwoFactorLoginAsync(tokenString, validCode);

        // Assert
        result.Should().NotBeNull();
        result!.AccessToken.Should().NotBeNullOrEmpty();
        result.RefreshToken.Should().NotBeNullOrEmpty();
        _twoFactorTokenRepositoryMock.Verify(x => x.MarkAsUsedAsync(twoFactorToken.Id), Times.Once);
    }

    [Fact]
    public async Task VerifyTwoFactorLoginAsync_WithInvalidCode_ShouldReturnNull()
    {
        // Arrange
        var tokenString = "valid-2fa-token";
        var code = "000000";
        var user = new User
        {
            Id = "user-123",
            Email = "test@example.com",
            FullName = "Test User",
            TwoFactorEnabled = true,
            TwoFactorSecret = "TESTSECRET"
        };
        var twoFactorToken = new TwoFactorToken
        {
            Id = "token-id",
            Token = tokenString,
            UserId = user.Id,
            ExpiresAt = DateTime.UtcNow.AddMinutes(5),
            IsUsed = false
        };
        
        _twoFactorTokenRepositoryMock.Setup(x => x.GetByTokenAsync(tokenString))
            .ReturnsAsync(twoFactorToken);
        _userRepositoryMock.Setup(x => x.GetByIdAsync(user.Id))
            .ReturnsAsync(user);
        _twoFactorServiceMock.Setup(x => x.ValidateCode(It.IsAny<string>(), code))
            .Returns(false);

        // Act
        var result = await _authService.VerifyTwoFactorLoginAsync(tokenString, code);

        // Assert
        result.Should().BeNull();
    }

    [Fact]
    public async Task VerifyTwoFactorLoginAsync_WithExpiredToken_ShouldReturnNull()
    {
        // Arrange
        var tokenString = "expired-2fa-token";
        var code = "123456";
        var twoFactorToken = new TwoFactorToken
        {
            Id = "token-id",
            Token = tokenString,
            UserId = "user-123",
            ExpiresAt = DateTime.UtcNow.AddMinutes(-5), // Expired
            IsUsed = false
        };
        
        _twoFactorTokenRepositoryMock.Setup(x => x.GetByTokenAsync(tokenString))
            .ReturnsAsync(twoFactorToken);

        // Act
        var result = await _authService.VerifyTwoFactorLoginAsync(tokenString, code);

        // Assert
        result.Should().BeNull();
    }

    [Fact]
    public async Task VerifyTwoFactorLoginAsync_WithUsedToken_ShouldReturnNull()
    {
        // Arrange
        var tokenString = "used-2fa-token";
        var code = "123456";
        var twoFactorToken = new TwoFactorToken
        {
            Id = "token-id",
            Token = tokenString,
            UserId = "user-123",
            ExpiresAt = DateTime.UtcNow.AddMinutes(5),
            IsUsed = true // Already used
        };
        
        _twoFactorTokenRepositoryMock.Setup(x => x.GetByTokenAsync(tokenString))
            .ReturnsAsync(twoFactorToken);

        // Act
        var result = await _authService.VerifyTwoFactorLoginAsync(tokenString, code);

        // Assert
        result.Should().BeNull();
    }

    [Fact]
    public async Task SendTwoFactorEmailOtpAsync_WithValidToken_ShouldSendEmail()
    {
        // Arrange
        var tokenString = "valid-2fa-token";
        var user = new User
        {
            Id = "user-123",
            Email = "test@example.com",
            FullName = "Test User"
        };
        var twoFactorToken = new TwoFactorToken
        {
            Id = "token-id",
            Token = tokenString,
            UserId = user.Id,
            ExpiresAt = DateTime.UtcNow.AddMinutes(5),
            IsUsed = false
        };
        
        _twoFactorTokenRepositoryMock.Setup(x => x.GetByTokenAsync(tokenString))
            .ReturnsAsync(twoFactorToken);
        _userRepositoryMock.Setup(x => x.GetByIdAsync(user.Id))
            .ReturnsAsync(user);
        _emailServiceMock.Setup(x => x.SendTwoFactorBackupCodeAsync(user.Email, It.IsAny<string>()))
            .Returns(Task.CompletedTask);

        // Act
        var (success, message) = await _authService.SendTwoFactorEmailOtpAsync(tokenString);

        // Assert
        success.Should().BeTrue();
        message.Should().Contain("Verification code sent");
        _emailServiceMock.Verify(x => x.SendTwoFactorBackupCodeAsync(user.Email, It.IsAny<string>()), Times.Once);
    }

    [Fact]
    public async Task SendTwoFactorEmailOtpAsync_WithInvalidToken_ShouldReturnFalse()
    {
        // Arrange
        var tokenString = "invalid-2fa-token";
        _twoFactorTokenRepositoryMock.Setup(x => x.GetByTokenAsync(tokenString))
            .ReturnsAsync((TwoFactorToken?)null);

        // Act
        var (success, message) = await _authService.SendTwoFactorEmailOtpAsync(tokenString);

        // Assert
        success.Should().BeFalse();
        message.Should().Contain("Invalid or expired session");
    }

    [Fact]
    public async Task SendTwoFactorEmailOtpAsync_WithRecentlySentCode_ShouldRateLimitReturnFalse()
    {
        // Arrange
        var tokenString = "valid-2fa-token";
        var twoFactorToken = new TwoFactorToken
        {
            Id = "token-id",
            Token = tokenString,
            UserId = "user-123",
            ExpiresAt = DateTime.UtcNow.AddMinutes(5),
            IsUsed = false,
            EmailOtpSentAt = DateTime.UtcNow.AddSeconds(-30) // Sent 30 seconds ago
        };
        
        _twoFactorTokenRepositoryMock.Setup(x => x.GetByTokenAsync(tokenString))
            .ReturnsAsync(twoFactorToken);

        // Act
        var (success, message) = await _authService.SendTwoFactorEmailOtpAsync(tokenString);

        // Assert
        success.Should().BeFalse();
        message.Should().Contain("wait");
    }

    [Fact]
    public async Task VerifyTwoFactorEmailOtpAsync_WithValidCode_ShouldReturnAuthResponse()
    {
        // Arrange
        var tokenString = "valid-2fa-token";
        var emailCode = "654321";
        var user = new User
        {
            Id = "user-123",
            Email = "test@example.com",
            FullName = "Test User"
        };
        var twoFactorToken = new TwoFactorToken
        {
            Id = "token-id",
            Token = tokenString,
            UserId = user.Id,
            ExpiresAt = DateTime.UtcNow.AddMinutes(5),
            IsUsed = false,
            EmailOtpCode = emailCode,
            EmailOtpSentAt = DateTime.UtcNow.AddMinutes(-2) // Sent 2 minutes ago
        };
        
        _twoFactorTokenRepositoryMock.Setup(x => x.GetByTokenAsync(tokenString))
            .ReturnsAsync(twoFactorToken);
        _userRepositoryMock.Setup(x => x.GetByIdAsync(user.Id))
            .ReturnsAsync(user);

        // Act
        var result = await _authService.VerifyTwoFactorEmailOtpAsync(tokenString, emailCode);

        // Assert
        result.Should().NotBeNull();
        result!.AccessToken.Should().NotBeNullOrEmpty();
        result.RefreshToken.Should().NotBeNullOrEmpty();
        _twoFactorTokenRepositoryMock.Verify(x => x.MarkAsUsedAsync(twoFactorToken.Id), Times.Once);
    }

    [Fact]
    public async Task VerifyTwoFactorEmailOtpAsync_WithInvalidCode_ShouldReturnNull()
    {
        // Arrange
        var tokenString = "valid-2fa-token";
        var correctCode = "654321";
        var wrongCode = "111111";
        var twoFactorToken = new TwoFactorToken
        {
            Id = "token-id",
            Token = tokenString,
            UserId = "user-123",
            ExpiresAt = DateTime.UtcNow.AddMinutes(5),
            IsUsed = false,
            EmailOtpCode = correctCode,
            EmailOtpSentAt = DateTime.UtcNow.AddMinutes(-2)
        };
        
        _twoFactorTokenRepositoryMock.Setup(x => x.GetByTokenAsync(tokenString))
            .ReturnsAsync(twoFactorToken);

        // Act
        var result = await _authService.VerifyTwoFactorEmailOtpAsync(tokenString, wrongCode);

        // Assert
        result.Should().BeNull();
    }

    [Fact]
    public async Task VerifyTwoFactorEmailOtpAsync_WithExpiredCode_ShouldReturnNull()
    {
        // Arrange
        var tokenString = "valid-2fa-token";
        var emailCode = "654321";
        var twoFactorToken = new TwoFactorToken
        {
            Id = "token-id",
            Token = tokenString,
            UserId = "user-123",
            ExpiresAt = DateTime.UtcNow.AddMinutes(5),
            IsUsed = false,
            EmailOtpCode = emailCode,
            EmailOtpSentAt = DateTime.UtcNow.AddMinutes(-15) // Sent 15 minutes ago - expired
        };
        
        _twoFactorTokenRepositoryMock.Setup(x => x.GetByTokenAsync(tokenString))
            .ReturnsAsync(twoFactorToken);

        // Act
        var result = await _authService.VerifyTwoFactorEmailOtpAsync(tokenString, emailCode);

        // Assert
        result.Should().BeNull();
    }

    #endregion
}
