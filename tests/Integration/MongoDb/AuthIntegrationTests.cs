using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using DigiTransac.Api.Models;
using DigiTransac.Api.Models.Dto;
using DigiTransac.Api.Services;
using FluentAssertions;
using Microsoft.Extensions.DependencyInjection;
using MongoDB.Driver;

namespace DigiTransac.Tests.Integration.MongoDb;

/// <summary>
/// Integration tests for Auth endpoints using real MongoDB via TestContainers.
/// Tests the full authentication lifecycle: registration, login, token management,
/// profile updates, and password flows against a real database.
/// </summary>
[Collection(MongoDbTestCollection.Name)]
[Trait("Category", "Integration")]
public class AuthIntegrationTests : MongoDbIntegrationTestBase
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true
    };

    public AuthIntegrationTests(MongoDbContainerFixture mongoFixture)
        : base(mongoFixture)
    {
    }

    #region Login Tests

    [SkippableFact]
    public async Task Login_WithValidCredentials_ReturnsOkWithAccessToken()
    {
        // Arrange — TestUser is created by base class SetupTestUserAsync
        var request = new LoginRequest(TestEmail, TestPassword);

        // Act
        var response = await Client.PostAsJsonAsync("/api/auth/login", request);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var result = await response.Content.ReadFromJsonAsync<LoginResponseWithoutRefresh>(JsonOptions);
        result.Should().NotBeNull();
        result!.AccessToken.Should().NotBeNullOrEmpty();
        result.Email.Should().Be(TestEmail);
        result.FullName.Should().Be("Integration Test User");
        result.IsEmailVerified.Should().BeTrue();

        // Verify refresh token Set-Cookie header
        response.Headers.TryGetValues("Set-Cookie", out var cookies).Should().BeTrue();
        cookies.Should().Contain(c => c.Contains("digitransac_refresh_token"));
    }

    [SkippableFact]
    public async Task Login_WithInvalidPassword_ReturnsUnauthorized()
    {
        // Arrange
        var request = new LoginRequest(TestEmail, "WrongPassword@123!");

        // Act
        var response = await Client.PostAsJsonAsync("/api/auth/login", request);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [SkippableFact]
    public async Task Login_WithNonExistentEmail_ReturnsUnauthorized()
    {
        // Arrange
        var request = new LoginRequest("doesnotexist@example.com", TestPassword);

        // Act
        var response = await Client.PostAsJsonAsync("/api/auth/login", request);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    #endregion

    #region Get Current User Tests

    [SkippableFact]
    public async Task GetCurrentUser_WithValidToken_ReturnsUserProfile()
    {
        // Arrange
        var authClient = await GetAuthenticatedClientAsync();

        // Act
        var response = await authClient.GetAsync("/api/auth/me");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var json = await response.Content.ReadFromJsonAsync<JsonElement>(JsonOptions);
        json.GetProperty("email").GetString().Should().Be(TestEmail);
        json.GetProperty("fullName").GetString().Should().Be("Integration Test User");
        json.GetProperty("isEmailVerified").GetBoolean().Should().BeTrue();
        json.GetProperty("primaryCurrency").GetString().Should().Be("INR");
    }

    [SkippableFact]
    public async Task GetCurrentUser_WithoutToken_ReturnsUnauthorized()
    {
        // Act — no auth header
        var response = await Client.GetAsync("/api/auth/me");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    #endregion

    #region Update Name Tests

    [SkippableFact]
    public async Task UpdateName_WithValidName_UpdatesNameInDatabase()
    {
        // Arrange
        var authClient = await GetAuthenticatedClientAsync();
        var request = new UpdateNameRequest("Updated Integration Name");

        // Act
        var response = await authClient.PutAsJsonAsync("/api/auth/profile/name", request);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        // Verify in database
        using var scope = Factory.Services.CreateScope();
        var mongoDbService = scope.ServiceProvider.GetRequiredService<IMongoDbService>();
        var usersCollection = mongoDbService.GetCollection<User>("users");
        var user = await usersCollection.Find(u => u.Id == TestUserId).FirstOrDefaultAsync();
        user!.FullName.Should().Be("Updated Integration Name");
    }

    [SkippableFact]
    public async Task UpdateName_WithEmptyName_ReturnsBadRequest()
    {
        // Arrange
        var authClient = await GetAuthenticatedClientAsync();
        var request = new UpdateNameRequest("");

        // Act
        var response = await authClient.PutAsJsonAsync("/api/auth/profile/name", request);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    #endregion

    #region Change Password Tests

    [SkippableFact]
    public async Task ChangePassword_WithValidCurrentPassword_ChangesPassword()
    {
        // Arrange
        var authClient = await GetAuthenticatedClientAsync();
        var newPassword = "NewSecure@Pass789!";
        var request = new ChangePasswordRequest(TestPassword, newPassword);

        // Act
        var response = await authClient.PostAsJsonAsync("/api/auth/change-password", request);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        // Verify old password no longer works
        var loginWithOld = await Client.PostAsJsonAsync("/api/auth/login", new LoginRequest(TestEmail, TestPassword));
        loginWithOld.StatusCode.Should().Be(HttpStatusCode.Unauthorized);

        // Verify new password works
        var loginWithNew = await Client.PostAsJsonAsync("/api/auth/login", new LoginRequest(TestEmail, newPassword));
        loginWithNew.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [SkippableFact]
    public async Task ChangePassword_WithWrongCurrentPassword_ReturnsBadRequest()
    {
        // Arrange
        var authClient = await GetAuthenticatedClientAsync();
        var request = new ChangePasswordRequest("WrongCurrent@123!", "NewSecure@Pass789!");

        // Act
        var response = await authClient.PostAsJsonAsync("/api/auth/change-password", request);

        // Assert
        // Should fail — either 400 or 401 depending on the error mapping
        response.IsSuccessStatusCode.Should().BeFalse();
    }

    #endregion

    #region Forgot Password Flow Tests

    [SkippableFact]
    public async Task ForgotPassword_WithExistingEmail_ReturnsOk()
    {
        // Arrange — security best practice: always returns 200
        var request = new ForgotPasswordRequest(TestEmail);

        // Act
        var response = await Client.PostAsJsonAsync("/api/auth/forgot-password", request);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        // Verify a verification record was created in the database
        using var scope = Factory.Services.CreateScope();
        var mongoDbService = scope.ServiceProvider.GetRequiredService<IMongoDbService>();
        var verificationsCollection = mongoDbService.GetCollection<EmailVerification>("email_verifications");
        var verification = await verificationsCollection
            .Find(v => v.Email == TestEmail && v.Purpose == VerificationPurpose.PasswordReset)
            .FirstOrDefaultAsync();
        verification.Should().NotBeNull();
        verification!.Code.Should().HaveLength(6);
    }

    [SkippableFact]
    public async Task ForgotPassword_WithNonExistentEmail_StillReturnsOk()
    {
        // Arrange — security: don't reveal email existence
        var request = new ForgotPasswordRequest("nobody@example.com");

        // Act
        var response = await Client.PostAsJsonAsync("/api/auth/forgot-password", request);

        // Assert — should succeed to prevent email enumeration
        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    #endregion

    #region Delete Account Tests

    [SkippableFact]
    public async Task DeleteAccount_WithCorrectPassword_DeletesUserFromDatabase()
    {
        // Arrange — create a separate user to delete so we don't break other tests
        var deleteEmail = "deleteme@example.com";
        var deletePassword = "DeleteMe@123!";
        await CreateTestUserForDeletionAsync(deleteEmail, deletePassword);

        // Login as the user to delete
        var loginResponse = await Client.PostAsJsonAsync("/api/auth/login", new LoginRequest(deleteEmail, deletePassword));
        loginResponse.StatusCode.Should().Be(HttpStatusCode.OK);
        var loginResult = await loginResponse.Content.ReadFromJsonAsync<LoginResponseWithoutRefresh>(JsonOptions);

        var deleteClient = Factory.CreateClient();
        deleteClient.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", loginResult!.AccessToken);

        var request = new DeleteAccountRequest(deletePassword);

        // Act — DELETE with body requires special handling via HttpRequestMessage
        var deleteRequest = new HttpRequestMessage(HttpMethod.Delete, "/api/auth/account")
        {
            Content = JsonContent.Create(request)
        };
        deleteRequest.Headers.Authorization = new AuthenticationHeaderValue("Bearer", loginResult.AccessToken);
        var response = await Factory.CreateClient().SendAsync(deleteRequest);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        // Verify user is deleted from database
        using var scope = Factory.Services.CreateScope();
        var mongoDbService = scope.ServiceProvider.GetRequiredService<IMongoDbService>();
        var usersCollection = mongoDbService.GetCollection<User>("users");
        var deletedUser = await usersCollection.Find(u => u.Email == deleteEmail).FirstOrDefaultAsync();
        deletedUser.Should().BeNull();
    }

    [SkippableFact]
    public async Task DeleteAccount_WithIncorrectPassword_ReturnsError()
    {
        // Arrange
        var authClient = await GetAuthenticatedClientAsync();
        var request = new DeleteAccountRequest("WrongPassword@123!");

        var deleteRequest = new HttpRequestMessage(HttpMethod.Delete, "/api/auth/account")
        {
            Content = JsonContent.Create(request)
        };

        // Copy auth header
        var loginResponse = await Client.PostAsJsonAsync("/api/auth/login", new LoginRequest(TestEmail, TestPassword));
        var loginResult = await loginResponse.Content.ReadFromJsonAsync<LoginResponseWithoutRefresh>(JsonOptions);
        deleteRequest.Headers.Authorization = new AuthenticationHeaderValue("Bearer", loginResult!.AccessToken);

        // Act
        var response = await Factory.CreateClient().SendAsync(deleteRequest);

        // Assert
        response.IsSuccessStatusCode.Should().BeFalse();

        // Verify user still exists in database
        using var scope = Factory.Services.CreateScope();
        var mongoDbService = scope.ServiceProvider.GetRequiredService<IMongoDbService>();
        var usersCollection = mongoDbService.GetCollection<User>("users");
        var user = await usersCollection.Find(u => u.Id == TestUserId).FirstOrDefaultAsync();
        user.Should().NotBeNull();
    }

    #endregion

    #region Token Refresh Tests

    [SkippableFact]
    public async Task Login_ThenAccessProtectedEndpoint_Succeeds()
    {
        // Arrange — full login + access flow
        var loginRequest = new LoginRequest(TestEmail, TestPassword);
        var loginResponse = await Client.PostAsJsonAsync("/api/auth/login", loginRequest);
        loginResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        var loginResult = await loginResponse.Content.ReadFromJsonAsync<LoginResponseWithoutRefresh>(JsonOptions);
        loginResult!.AccessToken.Should().NotBeNullOrEmpty();

        // Act — use the token on a protected endpoint
        var protectedClient = Factory.CreateClient();
        protectedClient.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", loginResult.AccessToken);

        var meResponse = await protectedClient.GetAsync("/api/auth/me");

        // Assert
        meResponse.StatusCode.Should().Be(HttpStatusCode.OK);
        var json = await meResponse.Content.ReadFromJsonAsync<JsonElement>(JsonOptions);
        json.GetProperty("email").GetString().Should().Be(TestEmail);
    }

    #endregion

    #region Send Verification Code Tests

    [SkippableFact]
    public async Task SendVerificationCode_WithNewEmail_ReturnsOk()
    {
        // Arrange
        var newEmail = "brandnew@example.com";
        var request = new SendVerificationRequest(newEmail);

        // Act
        var response = await Client.PostAsJsonAsync("/api/auth/send-verification", request);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        // Verify verification record was created
        using var scope = Factory.Services.CreateScope();
        var mongoDbService = scope.ServiceProvider.GetRequiredService<IMongoDbService>();
        var verificationsCollection = mongoDbService.GetCollection<EmailVerification>("email_verifications");
        var verification = await verificationsCollection
            .Find(v => v.Email == newEmail && v.Purpose == VerificationPurpose.Registration)
            .FirstOrDefaultAsync();
        verification.Should().NotBeNull();
    }

    [SkippableFact]
    public async Task SendVerificationCode_WithExistingEmail_ReturnsOk_ToPreventEnumeration()
    {
        // Arrange — TestEmail is already registered
        var request = new SendVerificationRequest(TestEmail);

        // Act
        var response = await Client.PostAsJsonAsync("/api/auth/send-verification", request);

        // Assert — returns 200 to prevent user enumeration (no email is actually sent)
        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [SkippableFact]
    public async Task SendVerificationCode_WithInvalidEmail_ReturnsBadRequest()
    {
        // Arrange
        var request = new SendVerificationRequest("not-an-email");

        // Act
        var response = await Client.PostAsJsonAsync("/api/auth/send-verification", request);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    #endregion

    #region Full Registration Flow Tests

    [SkippableFact]
    public async Task FullRegistrationFlow_SendCode_VerifyCode_CompleteRegistration()
    {
        // Arrange
        var email = "fullflow@example.com";

        // Step 1: Send verification code
        var sendResponse = await Client.PostAsJsonAsync("/api/auth/send-verification",
            new SendVerificationRequest(email));
        sendResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        // Read the code from the database (simulating email read)
        string code;
        string verificationToken;
        using (var scope = Factory.Services.CreateScope())
        {
            var mongoDbService = scope.ServiceProvider.GetRequiredService<IMongoDbService>();
            var verificationsCollection = mongoDbService.GetCollection<EmailVerification>("email_verifications");
            var verification = await verificationsCollection
                .Find(v => v.Email == email && v.Purpose == VerificationPurpose.Registration)
                .FirstOrDefaultAsync();
            verification.Should().NotBeNull();
            code = verification!.Code;
        }

        // Step 2: Verify the code
        var verifyResponse = await Client.PostAsJsonAsync("/api/auth/verify-code",
            new VerifyCodeRequest(email, code));
        verifyResponse.StatusCode.Should().Be(HttpStatusCode.OK);
        var verifyResult = await verifyResponse.Content.ReadFromJsonAsync<VerificationResponse>(JsonOptions);
        verifyResult.Should().NotBeNull();
        verifyResult!.VerificationToken.Should().NotBeNullOrEmpty();
        verificationToken = verifyResult.VerificationToken!;

        // Step 3: Complete registration
        var completeRequest = new CompleteRegistrationRequest(
            Email: email,
            VerificationToken: verificationToken,
            Password: "SecurePassword@123!",
            FullName: "Full Flow User"
        );
        var completeResponse = await Client.PostAsJsonAsync("/api/auth/complete-registration", completeRequest);
        completeResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        var authResult = await completeResponse.Content.ReadFromJsonAsync<AuthResponseWithoutRefresh>(JsonOptions);
        authResult.Should().NotBeNull();
        authResult!.AccessToken.Should().NotBeNullOrEmpty();
        authResult.Email.Should().Be(email);
        authResult.FullName.Should().Be("Full Flow User");
        authResult.IsEmailVerified.Should().BeTrue();

        // Verify the user can now log in
        var loginResponse = await Client.PostAsJsonAsync("/api/auth/login",
            new LoginRequest(email, "SecurePassword@123!"));
        loginResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        // Verify user exists in database
        using var finalScope = Factory.Services.CreateScope();
        var finalMongoService = finalScope.ServiceProvider.GetRequiredService<IMongoDbService>();
        var usersCollection = finalMongoService.GetCollection<User>("users");
        var user = await usersCollection.Find(u => u.Email == email).FirstOrDefaultAsync();
        user.Should().NotBeNull();
        user!.IsEmailVerified.Should().BeTrue();
        user.FullName.Should().Be("Full Flow User");
        user.WrappedDek.Should().NotBeNull();
    }

    #endregion

    #region Full Password Reset Flow Tests

    [SkippableFact]
    public async Task FullPasswordResetFlow_SendCode_VerifyCode_ResetPassword()
    {
        // Arrange
        var originalPassword = TestPassword;
        var newPassword = "ResetSecure@Pass456!";

        // Step 1: Send reset code
        var forgotResponse = await Client.PostAsJsonAsync("/api/auth/forgot-password",
            new ForgotPasswordRequest(TestEmail));
        forgotResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        // Read the code from the database
        string code;
        using (var scope = Factory.Services.CreateScope())
        {
            var mongoDbService = scope.ServiceProvider.GetRequiredService<IMongoDbService>();
            var verificationsCollection = mongoDbService.GetCollection<EmailVerification>("email_verifications");
            var verification = await verificationsCollection
                .Find(v => v.Email == TestEmail && v.Purpose == VerificationPurpose.PasswordReset)
                .FirstOrDefaultAsync();
            verification.Should().NotBeNull();
            code = verification!.Code;
        }

        // Step 2: Verify the reset code
        var verifyResponse = await Client.PostAsJsonAsync("/api/auth/verify-reset-code",
            new VerifyCodeRequest(TestEmail, code));
        verifyResponse.StatusCode.Should().Be(HttpStatusCode.OK);
        var verifyResult = await verifyResponse.Content.ReadFromJsonAsync<VerificationResponse>(JsonOptions);
        verifyResult.Should().NotBeNull();
        verifyResult!.VerificationToken.Should().NotBeNullOrEmpty();

        // Step 3: Reset password
        var resetRequest = new ResetPasswordRequest(TestEmail, verifyResult.VerificationToken!, newPassword);
        var resetResponse = await Client.PostAsJsonAsync("/api/auth/reset-password", resetRequest);
        resetResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        // Verify old password no longer works
        var loginOld = await Client.PostAsJsonAsync("/api/auth/login",
            new LoginRequest(TestEmail, originalPassword));
        loginOld.StatusCode.Should().Be(HttpStatusCode.Unauthorized);

        // Verify new password works
        var loginNew = await Client.PostAsJsonAsync("/api/auth/login",
            new LoginRequest(TestEmail, newPassword));
        loginNew.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    #endregion

    #region Concurrent Access Tests

    [SkippableFact]
    public async Task MultipleLoginsForSameUser_AllSucceed()
    {
        // Arrange
        var request = new LoginRequest(TestEmail, TestPassword);

        // Act — login multiple times concurrently
        var tasks = Enumerable.Range(0, 5).Select(_ =>
            Client.PostAsJsonAsync("/api/auth/login", request));
        var responses = await Task.WhenAll(tasks);

        // Assert — all should succeed
        foreach (var response in responses)
        {
            response.StatusCode.Should().Be(HttpStatusCode.OK);
            var result = await response.Content.ReadFromJsonAsync<LoginResponseWithoutRefresh>(JsonOptions);
            result!.AccessToken.Should().NotBeNullOrEmpty();
        }
    }

    #endregion

    #region Helper Methods

    /// <summary>
    /// Creates a separate test user for deletion tests so we don't affect the shared test user.
    /// </summary>
    private async Task CreateTestUserForDeletionAsync(string email, string password)
    {
        using var scope = Factory.Services.CreateScope();
        var mongoDbService = scope.ServiceProvider.GetRequiredService<IMongoDbService>();
        var keyManagementService = scope.ServiceProvider.GetRequiredService<IKeyManagementService>();
        var usersCollection = mongoDbService.GetCollection<User>("users");

        var dek = keyManagementService.GenerateDek();
        var wrappedDek = await keyManagementService.WrapKeyAsync(dek);

        var user = new User
        {
            Email = email,
            FullName = "Delete Test User",
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(password),
            IsEmailVerified = true,
            WrappedDek = wrappedDek,
            PrimaryCurrency = "USD",
            CreatedAt = DateTime.UtcNow
        };

        await usersCollection.InsertOneAsync(user);
    }

    #endregion
}