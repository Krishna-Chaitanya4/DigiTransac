using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using DigiTransac.Api.Common;
using DigiTransac.Api.Models;
using DigiTransac.Api.Models.Dto;
using FluentAssertions;
using Moq;

namespace DigiTransac.Tests.Integration;

[Trait("Category", "Integration")]
public class AccountEndpointsTests : IClassFixture<DigiTransacWebApplicationFactory>
{
    private readonly DigiTransacWebApplicationFactory _factory;
    private readonly HttpClient _client;
    private const string TestUserId = "test-user-123";
    private const string TestEmail = "test@example.com";
    private const string TestPassword = "Test@123!";

    public AccountEndpointsTests(DigiTransacWebApplicationFactory factory)
    {
        _factory = factory;
        _client = factory.CreateClient();
    }

    private async Task<HttpClient> GetAuthenticatedClientAsync()
    {
        // Set up user mock for authentication
        var user = new User
        {
            Id = TestUserId,
            Email = TestEmail,
            FullName = "Test User",
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(TestPassword),
            IsEmailVerified = true
        };

        _factory.UserRepositoryMock.Setup(x => x.GetByEmailAsync(user.Email))
            .ReturnsAsync(user);

        // Login to get token
        var loginRequest = new LoginRequest(TestEmail, TestPassword);
        var loginResponse = await _client.PostAsJsonAsync("/api/auth/login", loginRequest);
        
        // Ensure login was successful before trying to parse
        loginResponse.EnsureSuccessStatusCode();
        
        var authResponse = await loginResponse.Content.ReadFromJsonAsync<LoginResponseWithoutRefresh>();

        // Create authenticated client
        var authClient = _factory.CreateClient();
        authClient.DefaultRequestHeaders.Authorization = 
            new AuthenticationHeaderValue("Bearer", authResponse!.AccessToken);
        
        return authClient;
    }

    #region Get Accounts Tests

    [Fact]
    public async Task GetAccounts_WithValidToken_ReturnsAccounts()
    {
        // Arrange
        var authClient = await GetAuthenticatedClientAsync();
        
        var accounts = new List<AccountResponse>
        {
            new AccountResponse(
                Id: "1",
                Name: "Savings",
                Type: "Bank",
                Icon: "🏦",
                Color: "#3B82F6",
                Currency: "INR",
                InitialBalance: 10000,
                CurrentBalance: 15000,
                Institution: "HDFC",
                AccountNumber: "XXXX1234",
                Notes: null,
                IsArchived: false,
                IsDefault: false,
                IncludeInNetWorth: true,
                Order: 0,
                CanEditCurrency: false,
                CreatedAt: DateTime.UtcNow,
                UpdatedAt: DateTime.UtcNow
            )
        };

        _factory.AccountServiceMock.Setup(x => x.GetAllAsync(TestUserId, false, It.IsAny<CancellationToken>()))
            .ReturnsAsync(accounts);

        // Act
        var response = await authClient.GetAsync("/api/accounts");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var result = await response.Content.ReadFromJsonAsync<List<AccountResponse>>();
        result.Should().NotBeNull();
        result.Should().HaveCount(1);
        result![0].Name.Should().Be("Savings");
    }

    [Fact]
    public async Task GetAccounts_WithIncludeArchived_PassesParameterCorrectly()
    {
        // Arrange
        var authClient = await GetAuthenticatedClientAsync();
        
        _factory.AccountServiceMock.Setup(x => x.GetAllAsync(TestUserId, true, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<AccountResponse>());

        // Act
        var response = await authClient.GetAsync("/api/accounts?includeArchived=true");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        _factory.AccountServiceMock.Verify(x => x.GetAllAsync(TestUserId, true, It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task GetAccounts_WithoutToken_ReturnsUnauthorized()
    {
        // Arrange
        var unauthenticatedClient = _factory.CreateClient();

        // Act
        var response = await unauthenticatedClient.GetAsync("/api/accounts");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    #endregion

    #region Get Account Summary Tests

    [Fact]
    public async Task GetAccountSummary_WithValidToken_ReturnsSummary()
    {
        // Arrange
        var authClient = await GetAuthenticatedClientAsync();
        
        var summary = new AccountSummaryResponse(
            TotalAssets: 100000,
            TotalLiabilities: 20000,
            NetWorth: 80000,
            PrimaryCurrency: "INR",
            BalancesByType: new Dictionary<string, decimal>
            {
                { "Bank", 95000 },
                { "Cash", 5000 },
                { "CreditCard", 20000 }
            },
            BalancesByCurrency: new Dictionary<string, CurrencyBalances>
            {
                { "INR", new CurrencyBalances(100000, 20000, 80000, 100000, 20000, 80000) }
            },
            RatesLastUpdated: DateTime.UtcNow
        );

        _factory.AccountServiceMock.Setup(x => x.GetSummaryAsync(TestUserId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(summary);

        // Act
        var response = await authClient.GetAsync("/api/accounts/summary");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var result = await response.Content.ReadFromJsonAsync<AccountSummaryResponse>();
        result.Should().NotBeNull();
        result!.TotalAssets.Should().Be(100000);
        result.NetWorth.Should().Be(80000);
    }

    #endregion

    #region Get Single Account Tests

    [Fact]
    public async Task GetAccount_WithValidId_ReturnsAccount()
    {
        // Arrange
        var authClient = await GetAuthenticatedClientAsync();
        
        var account = new AccountResponse(
            Id: "1",
            Name: "Savings",
            Type: "Bank",
            Icon: "🏦",
            Color: "#3B82F6",
            Currency: "INR",
            InitialBalance: 10000,
            CurrentBalance: 15000,
            Institution: "HDFC",
            AccountNumber: null,
            Notes: null,
            IsArchived: false,
            IsDefault: false,
            IncludeInNetWorth: true,
            Order: 0,
            CanEditCurrency: false,
            CreatedAt: DateTime.UtcNow,
            UpdatedAt: DateTime.UtcNow
        );

        _factory.AccountServiceMock.Setup(x => x.GetByIdAsync("1", TestUserId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(account);

        // Act
        var response = await authClient.GetAsync("/api/accounts/1");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var result = await response.Content.ReadFromJsonAsync<AccountResponse>();
        result.Should().NotBeNull();
        result!.Id.Should().Be("1");
    }

    [Fact]
    public async Task GetAccount_WithInvalidId_ReturnsNotFound()
    {
        // Arrange
        var authClient = await GetAuthenticatedClientAsync();
        
        _factory.AccountServiceMock.Setup(x => x.GetByIdAsync("invalid", TestUserId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((AccountResponse?)null);

        // Act
        var response = await authClient.GetAsync("/api/accounts/invalid");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    #endregion

    #region Create Account Tests

    [Fact]
    public async Task CreateAccount_WithValidRequest_ReturnsCreated()
    {
        // Arrange
        var authClient = await GetAuthenticatedClientAsync();
        
        var request = new CreateAccountRequest(
            Name: "New Account",
            Type: "Bank",
            Icon: "🏦",
            Color: "#3B82F6",
            Currency: "INR",
            InitialBalance: 5000,
            Institution: "ICICI",
            AccountNumber: "XXXX5678",
            Notes: "Test account",
            IncludeInNetWorth: true
        );

        var createdAccount = new AccountResponse(
            Id: "new-id",
            Name: request.Name,
            Type: request.Type,
            Icon: request.Icon,
            Color: request.Color,
            Currency: request.Currency ?? "INR",
            InitialBalance: request.InitialBalance ?? 0,
            CurrentBalance: request.InitialBalance ?? 0,
            Institution: request.Institution,
            AccountNumber: request.AccountNumber,
            Notes: request.Notes,
            IsArchived: false,
            IsDefault: false,
            IncludeInNetWorth: true,
            Order: 0,
            CanEditCurrency: true,
            CreatedAt: DateTime.UtcNow,
            UpdatedAt: DateTime.UtcNow
        );

        _factory.AccountServiceMock.Setup(x => x.CreateAsync(TestUserId, It.IsAny<CreateAccountRequest>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Success<AccountResponse>(createdAccount));

        // Act
        var response = await authClient.PostAsJsonAsync("/api/accounts", request);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Created);
        var result = await response.Content.ReadFromJsonAsync<AccountResponse>();
        result.Should().NotBeNull();
        result!.Name.Should().Be("New Account");
    }

    [Fact]
    public async Task CreateAccount_WithInvalidRequest_ReturnsBadRequest()
    {
        // Arrange
        var authClient = await GetAuthenticatedClientAsync();
        
        var request = new CreateAccountRequest(
            Name: "",
            Type: "Bank",
            Icon: null,
            Color: null,
            Currency: null,
            InitialBalance: null,
            Institution: null,
            AccountNumber: null,
            Notes: null,
            IncludeInNetWorth: null
        );

        _factory.AccountServiceMock.Setup(x => x.CreateAsync(TestUserId, It.IsAny<CreateAccountRequest>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Failure<AccountResponse>(Error.Validation("Account name is required")));

        // Act
        var response = await authClient.PostAsJsonAsync("/api/accounts", request);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    #endregion

    #region Update Account Tests

    [Fact]
    public async Task UpdateAccount_WithValidRequest_ReturnsOk()
    {
        // Arrange
        var authClient = await GetAuthenticatedClientAsync();
        
        var request = new UpdateAccountRequest(
            Name: "Updated Name",
            Icon: "💰",
            Color: "#10B981",
            Currency: null,
            Institution: null,
            AccountNumber: null,
            Notes: null,
            IsArchived: null,
            IncludeInNetWorth: null,
            Order: null
        );

        var updatedAccount = new AccountResponse(
            Id: "1",
            Name: "Updated Name",
            Type: "Bank",
            Icon: "💰",
            Color: "#10B981",
            Currency: "INR",
            InitialBalance: 10000,
            CurrentBalance: 15000,
            Institution: "HDFC",
            AccountNumber: null,
            Notes: null,
            IsArchived: false,
            IsDefault: false,
            IncludeInNetWorth: true,
            Order: 0,
            CanEditCurrency: false,
            CreatedAt: DateTime.UtcNow,
            UpdatedAt: DateTime.UtcNow
        );

        _factory.AccountServiceMock.Setup(x => x.UpdateAsync("1", TestUserId, It.IsAny<UpdateAccountRequest>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Success<AccountResponse>(updatedAccount));

        // Act
        var response = await authClient.PutAsJsonAsync("/api/accounts/1", request);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var result = await response.Content.ReadFromJsonAsync<AccountResponse>();
        result.Should().NotBeNull();
        result!.Name.Should().Be("Updated Name");
    }

    [Fact]
    public async Task UpdateAccount_WithNonExistentId_ReturnsBadRequest()
    {
        // Arrange
        var authClient = await GetAuthenticatedClientAsync();
        
        var request = new UpdateAccountRequest(
            Name: "Updated",
            Icon: null,
            Color: null,
            Currency: null,
            Institution: null,
            AccountNumber: null,
            Notes: null,
            IsArchived: null,
            IncludeInNetWorth: null,
            Order: null
        );

        _factory.AccountServiceMock.Setup(x => x.UpdateAsync("invalid", TestUserId, It.IsAny<UpdateAccountRequest>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Failure<AccountResponse>(Error.Validation("Account not found")));

        // Act
        var response = await authClient.PutAsJsonAsync("/api/accounts/invalid", request);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    #endregion

    #region Adjust Balance Tests

    [Fact]
    public async Task AdjustBalance_WithValidRequest_ReturnsOk()
    {
        // Arrange
        var authClient = await GetAuthenticatedClientAsync();
        
        var request = new AdjustBalanceRequest(
            NewBalance: 25000,
            Notes: "Balance adjustment"
        );

        _factory.AccountServiceMock.Setup(x => x.AdjustBalanceAsync("1", TestUserId, It.IsAny<AdjustBalanceRequest>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Success());

        // Act
        var response = await authClient.PostAsJsonAsync("/api/accounts/1/adjust-balance", request);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task AdjustBalance_WithNonExistentAccount_ReturnsBadRequest()
    {
        // Arrange
        var authClient = await GetAuthenticatedClientAsync();
        
        var request = new AdjustBalanceRequest(
            NewBalance: 25000,
            Notes: null
        );

        _factory.AccountServiceMock.Setup(x => x.AdjustBalanceAsync("invalid", TestUserId, It.IsAny<AdjustBalanceRequest>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Failure(Error.Validation("Account not found")));

        // Act
        var response = await authClient.PostAsJsonAsync("/api/accounts/invalid/adjust-balance", request);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    #endregion

    #region Reorder Accounts Tests

    [Fact]
    public async Task ReorderAccounts_WithValidRequest_ReturnsOk()
    {
        // Arrange
        var authClient = await GetAuthenticatedClientAsync();
        
        var request = new ReorderAccountsRequest(new List<AccountOrderItem>
        {
            new("1", 2),
            new("2", 0),
            new("3", 1)
        });

        _factory.AccountServiceMock.Setup(x => x.ReorderAsync(TestUserId, It.IsAny<ReorderAccountsRequest>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Success());

        // Act
        var response = await authClient.PostAsJsonAsync("/api/accounts/reorder", request);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    #endregion

    #region Delete Account Tests

    [Fact]
    public async Task DeleteAccount_WithValidId_ReturnsOk()
    {
        // Arrange
        var authClient = await GetAuthenticatedClientAsync();
        
        _factory.AccountServiceMock.Setup(x => x.DeleteAsync("1", TestUserId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Success());

        // Act
        var response = await authClient.DeleteAsync("/api/accounts/1");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task DeleteAccount_WithNonExistentId_ReturnsNotFound()
    {
        // Arrange
        var authClient = await GetAuthenticatedClientAsync();
        
        _factory.AccountServiceMock.Setup(x => x.DeleteAsync("invalid", TestUserId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Failure(Error.NotFound("Account")));

        // Act
        var response = await authClient.DeleteAsync("/api/accounts/invalid");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task DeleteAccount_WithTransactions_ReturnsBadRequest()
    {
        // Arrange
        var authClient = await GetAuthenticatedClientAsync();
        
        _factory.AccountServiceMock.Setup(x => x.DeleteAsync("1", TestUserId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Failure(Error.Conflict("Cannot delete account with 5 transaction(s). Archive it instead to preserve your transaction history.")));

        // Act
        var response = await authClient.DeleteAsync("/api/accounts/1");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Conflict);
        var content = await response.Content.ReadAsStringAsync();
        content.Should().Contain("Cannot delete account");
    }

    #endregion
}
