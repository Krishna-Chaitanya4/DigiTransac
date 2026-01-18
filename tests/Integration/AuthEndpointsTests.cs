using System.Net;
using System.Net.Http.Json;
using DigiTransac.Api.Models;
using DigiTransac.Api.Models.Dto;
using FluentAssertions;
using Moq;

namespace DigiTransac.Tests.Integration;

public class AuthEndpointsTests : IClassFixture<DigiTransacWebApplicationFactory>
{
    private readonly DigiTransacWebApplicationFactory _factory;
    private readonly HttpClient _client;

    public AuthEndpointsTests(DigiTransacWebApplicationFactory factory)
    {
        _factory = factory;
        _client = factory.CreateClient();
    }

    #region Registration Flow Tests

    [Fact]
    public async Task SendVerificationCode_WithValidEmail_ReturnsOk()
    {
        // Arrange
        var email = "newuser@example.com";
        _factory.UserRepositoryMock.Setup(x => x.GetByEmailAsync(email))
            .ReturnsAsync((User?)null);
        _factory.EmailServiceMock.Setup(x => x.SendVerificationCodeAsync(email, It.IsAny<string>()))
            .Returns(Task.CompletedTask);
        _factory.EmailVerificationRepositoryMock.Setup(x => x.CreateAsync(It.IsAny<EmailVerification>()))
            .ReturnsAsync(new EmailVerification());
        _factory.EmailVerificationRepositoryMock.Setup(x => x.DeleteByEmailAsync(email, VerificationPurpose.Registration))
            .Returns(Task.CompletedTask);

        var request = new SendVerificationRequest(email);

        // Act
        var response = await _client.PostAsJsonAsync("/api/auth/send-verification", request);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var result = await response.Content.ReadFromJsonAsync<MessageResponse>();
        result.Should().NotBeNull();
        result!.Message.Should().Contain("Verification code sent");
    }

    [Fact]
    public async Task SendVerificationCode_WithInvalidEmail_ReturnsBadRequest()
    {
        // Arrange
        var request = new SendVerificationRequest("invalid-email");

        // Act
        var response = await _client.PostAsJsonAsync("/api/auth/send-verification", request);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task SendVerificationCode_WithExistingEmail_ReturnsBadRequest()
    {
        // Arrange
        var email = "existing@example.com";
        _factory.UserRepositoryMock.Setup(x => x.GetByEmailAsync(email))
            .ReturnsAsync(new User { Email = email, FullName = "Existing User", PasswordHash = "hash" });

        var request = new SendVerificationRequest(email);

        // Act
        var response = await _client.PostAsJsonAsync("/api/auth/send-verification", request);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    #endregion

    #region Login Tests

    [Fact]
    public async Task Login_WithValidCredentials_ReturnsOkWithToken()
    {
        // Arrange
        var password = "Test@123!";
        var user = new User
        {
            Id = "user-123",
            Email = "test@example.com",
            FullName = "Test User",
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(password),
            IsEmailVerified = true,
            WrappedDek = new byte[64] // Server-wrapped DEK
        };

        _factory.UserRepositoryMock.Setup(x => x.GetByEmailAsync(user.Email))
            .ReturnsAsync(user);

        var request = new LoginRequest(user.Email, password);

        // Act
        var response = await _client.PostAsJsonAsync("/api/auth/login", request);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var result = await response.Content.ReadFromJsonAsync<AuthResponse>();
        result.Should().NotBeNull();
        result!.Email.Should().Be(user.Email);
        result.AccessToken.Should().NotBeNullOrEmpty();
        // RefreshToken is now sent via HttpOnly cookie, not in the response body
        // Verify the Set-Cookie header is present
        response.Headers.TryGetValues("Set-Cookie", out var cookies).Should().BeTrue();
        cookies.Should().Contain(c => c.Contains("digitransac_refresh_token"));
    }

    [Fact]
    public async Task Login_WithInvalidPassword_ReturnsUnauthorized()
    {
        // Arrange
        var user = new User
        {
            Email = "test@example.com",
            FullName = "Test User",
            PasswordHash = BCrypt.Net.BCrypt.HashPassword("CorrectPassword@123")
        };

        _factory.UserRepositoryMock.Setup(x => x.GetByEmailAsync(user.Email))
            .ReturnsAsync(user);

        var request = new LoginRequest(user.Email, "WrongPassword@123");

        // Act
        var response = await _client.PostAsJsonAsync("/api/auth/login", request);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task Login_WithNonExistentUser_ReturnsUnauthorized()
    {
        // Arrange
        _factory.UserRepositoryMock.Setup(x => x.GetByEmailAsync(It.IsAny<string>()))
            .ReturnsAsync((User?)null);

        var request = new LoginRequest("nonexistent@example.com", "Test@123!");

        // Act
        var response = await _client.PostAsJsonAsync("/api/auth/login", request);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    #endregion

    #region Protected Endpoint Tests

    [Fact]
    public async Task GetCurrentUser_WithoutToken_ReturnsUnauthorized()
    {
        // Act
        var response = await _client.GetAsync("/api/auth/me");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task GetCurrentUser_WithValidToken_ReturnsUser()
    {
        // Arrange - First login to get a token
        var password = "Test@123!";
        var user = new User
        {
            Id = "user-123",
            Email = "test@example.com",
            FullName = "Test User",
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(password),
            IsEmailVerified = true
        };

        _factory.UserRepositoryMock.Setup(x => x.GetByEmailAsync(user.Email))
            .ReturnsAsync(user);
        _factory.UserRepositoryMock.Setup(x => x.GetByIdAsync(user.Id))
            .ReturnsAsync(user);

        var loginRequest = new LoginRequest(user.Email, password);
        var loginResponse = await _client.PostAsJsonAsync("/api/auth/login", loginRequest);
        var authResponse = await loginResponse.Content.ReadFromJsonAsync<AuthResponse>();

        // Act - Use the token to access protected endpoint
        _client.DefaultRequestHeaders.Authorization = 
            new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", authResponse!.AccessToken);
        var response = await _client.GetAsync("/api/auth/me");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var result = await response.Content.ReadFromJsonAsync<UserResponse>();
        result.Should().NotBeNull();
        result!.Email.Should().Be(user.Email);

        // Cleanup
        _client.DefaultRequestHeaders.Authorization = null;
    }

    #endregion
}

// Helper record for message responses
public record MessageResponse(string Message);
public record UserResponse(string Email, string FullName, bool IsEmailVerified);
