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
/// Endpoint-level integration tests focusing on HTTP pipeline behavior:
/// Result pattern error mapping, ETag/304 responses, error response format,
/// and authentication/authorization enforcement.
/// </summary>
[Collection(MongoDbTestCollection.Name)]
[Trait("Category", "Integration")]
public class AuthEndpointFlowTests : MongoDbIntegrationTestBase
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true
    };

    public AuthEndpointFlowTests(MongoDbContainerFixture mongoFixture)
        : base(mongoFixture)
    {
    }

    #region Result Pattern Error Mapping Tests

    [SkippableFact]
    public async Task SendVerification_WithExistingEmail_ReturnsBadRequestWithErrorResponse()
    {
        // Arrange — TestEmail exists in database
        var request = new SendVerificationRequest(TestEmail);

        // Act
        var response = await Client.PostAsJsonAsync("/api/auth/send-verification", request);

        // Assert — Result pattern should map to proper HTTP error (Conflict for duplicate resource)
        response.StatusCode.Should().Be(HttpStatusCode.Conflict);
        var body = await response.Content.ReadAsStringAsync();
        body.Should().Contain("already registered");
    }

    [SkippableFact]
    public async Task UpdateName_Unauthorized_Returns401()
    {
        // Arrange — no auth token
        var request = new UpdateNameRequest("New Name");

        // Act
        var response = await Client.PutAsJsonAsync("/api/auth/profile/name", request);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [SkippableFact]
    public async Task ChangePassword_Unauthorized_Returns401()
    {
        // Arrange — no auth token
        var request = new ChangePasswordRequest("old", "new");

        // Act
        var response = await Client.PostAsJsonAsync("/api/auth/change-password", request);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    #endregion

    #region Validation Error Tests

    [SkippableTheory]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("notanemail")]
    public async Task SendVerification_WithInvalidEmail_ReturnsBadRequest(string email)
    {
        // Arrange
        var request = new SendVerificationRequest(email);

        // Act
        var response = await Client.PostAsJsonAsync("/api/auth/send-verification", request);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [SkippableFact]
    public async Task Login_WithEmptyEmail_ReturnsBadRequest()
    {
        // Arrange
        var request = new LoginRequest("", "password");

        // Act
        var response = await Client.PostAsJsonAsync("/api/auth/login", request);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [SkippableFact]
    public async Task Login_WithEmptyPassword_ReturnsBadRequest()
    {
        // Arrange
        var request = new LoginRequest("test@example.com", "");

        // Act
        var response = await Client.PostAsJsonAsync("/api/auth/login", request);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    #endregion

    #region ETag / Conditional Response Tests

    [SkippableFact]
    public async Task GetAccounts_ReturnsETagHeader()
    {
        // Arrange
        var authClient = await GetAuthenticatedClientAsync();

        // Act
        var response = await authClient.GetAsync("/api/accounts");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        response.Headers.ETag.Should().NotBeNull();
        response.Headers.ETag!.Tag.Should().NotBeNullOrEmpty();
    }

    [SkippableFact]
    public async Task GetAccounts_WithMatchingETag_Returns304NotModified()
    {
        // Arrange
        var authClient = await GetAuthenticatedClientAsync();

        // First request to get ETag
        var firstResponse = await authClient.GetAsync("/api/accounts");
        firstResponse.StatusCode.Should().Be(HttpStatusCode.OK);
        var etag = firstResponse.Headers.ETag;
        etag.Should().NotBeNull();

        // Act — second request with If-None-Match
        var request = new HttpRequestMessage(HttpMethod.Get, "/api/accounts");
        request.Headers.IfNoneMatch.Add(etag!);
        var secondResponse = await authClient.SendAsync(request);

        // Assert
        secondResponse.StatusCode.Should().Be(HttpStatusCode.NotModified);
    }

    [SkippableFact]
    public async Task GetAccounts_WithDifferentETag_Returns200WithData()
    {
        // Arrange
        var authClient = await GetAuthenticatedClientAsync();

        // Act — send a bogus ETag
        var request = new HttpRequestMessage(HttpMethod.Get, "/api/accounts");
        request.Headers.IfNoneMatch.Add(new EntityTagHeaderValue("\"bogus-etag\""));
        var response = await authClient.SendAsync(request);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        response.Headers.ETag.Should().NotBeNull();
    }

    #endregion

    #region Cookie-Based Refresh Token Tests

    [SkippableFact]
    public async Task Login_SetsRefreshTokenCookie()
    {
        // Arrange
        var request = new LoginRequest(TestEmail, TestPassword);

        // Act
        var response = await Client.PostAsJsonAsync("/api/auth/login", request);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        response.Headers.TryGetValues("Set-Cookie", out var cookies).Should().BeTrue();
        var cookieList = cookies!.ToList();
        cookieList.Should().Contain(c => c.Contains("digitransac_refresh_token"));
        // Verify cookie attributes (ASP.NET Core TestServer serializes attributes in lowercase)
        var refreshCookie = cookieList.First(c => c.Contains("digitransac_refresh_token"));
        refreshCookie.ToLowerInvariant().Should().Contain("httponly");
        refreshCookie.ToLowerInvariant().Should().Contain("samesite=strict");
    }

    [SkippableFact]
    public async Task Login_ResponseBody_DoesNotContainRefreshToken()
    {
        // Arrange
        var request = new LoginRequest(TestEmail, TestPassword);

        // Act
        var response = await Client.PostAsJsonAsync("/api/auth/login", request);

        // Assert — refresh token should NOT be in the response body (only in cookie)
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await response.Content.ReadAsStringAsync();
        body.Should().NotContain("refreshToken");
        // But access token should be in the body
        body.Should().Contain("accessToken");
    }

    #endregion

    #region Protected Endpoint Authorization Tests

    [SkippableFact]
    public async Task AllProtectedEndpoints_WithoutAuth_Return401()
    {
        // These endpoints require authorization
        var protectedEndpoints = new[]
        {
            ("GET", "/api/auth/me"),
            ("PUT", "/api/auth/profile/name"),
            ("POST", "/api/auth/profile/email/send-code"),
            ("POST", "/api/auth/profile/email/verify"),
            ("POST", "/api/auth/change-password"),
            ("POST", "/api/auth/revoke-token"),
            ("POST", "/api/auth/revoke-all-tokens"),
        };

        foreach (var (method, url) in protectedEndpoints)
        {
            var request = new HttpRequestMessage(new HttpMethod(method), url);
            
            // Add dummy body for POST/PUT methods to avoid 400 from missing body
            if (method is "POST" or "PUT")
            {
                request.Content = JsonContent.Create(new { });
            }

            var response = await Client.SendAsync(request);
            
            response.StatusCode.Should().Be(HttpStatusCode.Unauthorized,
                because: $"{method} {url} should require authentication");
        }
    }

    #endregion

    #region Content-Type Tests

    [SkippableFact]
    public async Task Login_ResponseHasJsonContentType()
    {
        // Arrange
        var request = new LoginRequest(TestEmail, TestPassword);

        // Act
        var response = await Client.PostAsJsonAsync("/api/auth/login", request);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        response.Content.Headers.ContentType?.MediaType.Should().Be("application/json");
    }

    [SkippableFact]
    public async Task SendVerification_Error_ResponseHasJsonContentType()
    {
        // Arrange — invalid email
        var request = new SendVerificationRequest("bad");

        // Act
        var response = await Client.PostAsJsonAsync("/api/auth/send-verification", request);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        response.Content.Headers.ContentType?.MediaType.Should().BeOneOf("application/json", "application/problem+json");
    }

    #endregion
}