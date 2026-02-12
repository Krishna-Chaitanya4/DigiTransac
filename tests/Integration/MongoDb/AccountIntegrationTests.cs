using System.Net;
using System.Net.Http.Json;
using DigiTransac.Api.Models;
using DigiTransac.Api.Models.Dto;
using FluentAssertions;
using Microsoft.Extensions.DependencyInjection;
using MongoDB.Driver;

namespace DigiTransac.Tests.Integration.MongoDb;

/// <summary>
/// Integration tests for Account endpoints using real MongoDB via TestContainers.
/// </summary>
[Collection(MongoDbTestCollection.Name)]
[Trait("Category", "Integration")]
public class AccountIntegrationTests : MongoDbIntegrationTestBase
{
    public AccountIntegrationTests(MongoDbContainerFixture mongoFixture) 
        : base(mongoFixture)
    {
    }

    #region Create Account Tests

    [Fact]
    public async Task CreateAccount_WithValidData_CreatesAccountInDatabase()
    {
        // Arrange
        var authClient = await GetAuthenticatedClientAsync();
        var request = new CreateAccountRequest(
            Name: "Integration Test Savings",
            Type: "Bank",
            Icon: "🏦",
            Color: "#3B82F6",
            Currency: "INR",
            InitialBalance: 10000,
            Institution: "HDFC Bank",
            AccountNumber: "XXXX1234",
            Notes: "Test savings account",
            IncludeInNetWorth: true
        );

        // Act
        var response = await authClient.PostAsJsonAsync("/api/accounts", request);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Created);
        
        var createdAccount = await response.Content.ReadFromJsonAsync<AccountResponse>();
        createdAccount.Should().NotBeNull();
        createdAccount!.Name.Should().Be("Integration Test Savings");
        createdAccount.Type.Should().Be("Bank");
        createdAccount.CurrentBalance.Should().Be(10000);

        // Verify in database
        using var scope = Factory.Services.CreateScope();
        var mongoDbService = scope.ServiceProvider.GetRequiredService<DigiTransac.Api.Services.IMongoDbService>();
        var accountsCollection = mongoDbService.GetCollection<Account>("accounts");
        var dbAccount = await accountsCollection.Find(a => a.Id == createdAccount.Id).FirstOrDefaultAsync();
        
        dbAccount.Should().NotBeNull();
        dbAccount!.Name.Should().Be("Integration Test Savings");
    }

    [Fact]
    public async Task CreateAccount_WithDuplicateName_ReturnsBadRequest()
    {
        // Arrange
        var authClient = await GetAuthenticatedClientAsync();
        var request = new CreateAccountRequest(
            Name: "Duplicate Account",
            Type: "Bank",
            Icon: "🏦",
            Color: "#3B82F6",
            Currency: "INR",
            InitialBalance: 5000,
            Institution: null,
            AccountNumber: null,
            Notes: null,
            IncludeInNetWorth: true
        );

        // Create first account
        await authClient.PostAsJsonAsync("/api/accounts", request);

        // Act - Try to create duplicate
        var response = await authClient.PostAsJsonAsync("/api/accounts", request);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Conflict);
    }

    #endregion

    #region Get Accounts Tests

    [Fact]
    public async Task GetAccounts_WithExistingAccounts_ReturnsAllAccounts()
    {
        // Arrange
        var authClient = await GetAuthenticatedClientAsync();
        
        // Create test accounts
        var request1 = new CreateAccountRequest("Account 1", "Bank", "🏦", "#3B82F6", "INR", 1000, null, null, null, true);
        var request2 = new CreateAccountRequest("Account 2", "Cash", "💵", "#10B981", "INR", 500, null, null, null, true);
        
        await authClient.PostAsJsonAsync("/api/accounts", request1);
        await authClient.PostAsJsonAsync("/api/accounts", request2);

        // Act
        var response = await authClient.GetAsync("/api/accounts");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var accounts = await response.Content.ReadFromJsonAsync<List<AccountResponse>>();
        accounts.Should().NotBeNull();
        accounts!.Count.Should().BeGreaterThanOrEqualTo(2);
    }

    [Fact]
    public async Task GetAccounts_WithArchivedFilter_ExcludesArchivedByDefault()
    {
        // Arrange
        var authClient = await GetAuthenticatedClientAsync();
        
        // Create and archive an account
        var createRequest = new CreateAccountRequest("Archived Account", "Bank", "🏦", "#3B82F6", "INR", 1000, null, null, null, true);
        var createResponse = await authClient.PostAsJsonAsync("/api/accounts", createRequest);
        var createdAccount = await createResponse.Content.ReadFromJsonAsync<AccountResponse>();
        
        // Archive the account
        var updateRequest = new UpdateAccountRequest(null, null, null, null, null, null, null, true, null, null);
        await authClient.PutAsJsonAsync($"/api/accounts/{createdAccount!.Id}", updateRequest);

        // Act - Get accounts without archived
        var response = await authClient.GetAsync("/api/accounts");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var accounts = await response.Content.ReadFromJsonAsync<List<AccountResponse>>();
        accounts!.Should().NotContain(a => a.Id == createdAccount.Id);
    }

    #endregion

    #region Get Single Account Tests

    [Fact]
    public async Task GetAccount_WithValidId_ReturnsAccount()
    {
        // Arrange
        var authClient = await GetAuthenticatedClientAsync();
        var createRequest = new CreateAccountRequest("Get Test Account", "Bank", "🏦", "#3B82F6", "INR", 2000, null, null, null, true);
        var createResponse = await authClient.PostAsJsonAsync("/api/accounts", createRequest);
        var createdAccount = await createResponse.Content.ReadFromJsonAsync<AccountResponse>();

        // Act
        var response = await authClient.GetAsync($"/api/accounts/{createdAccount!.Id}");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var account = await response.Content.ReadFromJsonAsync<AccountResponse>();
        account.Should().NotBeNull();
        account!.Id.Should().Be(createdAccount.Id);
        account.Name.Should().Be("Get Test Account");
    }

    [Fact]
    public async Task GetAccount_WithInvalidId_ReturnsNotFound()
    {
        // Arrange
        var authClient = await GetAuthenticatedClientAsync();

        // Act
        var response = await authClient.GetAsync("/api/accounts/507f1f77bcf86cd799439011");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    #endregion

    #region Update Account Tests

    [Fact]
    public async Task UpdateAccount_WithValidData_UpdatesAccountInDatabase()
    {
        // Arrange
        var authClient = await GetAuthenticatedClientAsync();
        var createRequest = new CreateAccountRequest("Update Test Account", "Bank", "🏦", "#3B82F6", "INR", 3000, null, null, null, true);
        var createResponse = await authClient.PostAsJsonAsync("/api/accounts", createRequest);
        var createdAccount = await createResponse.Content.ReadFromJsonAsync<AccountResponse>();

        var updateRequest = new UpdateAccountRequest(
            Name: "Updated Account Name",
            Icon: "💰",
            Color: "#10B981",
            Currency: null,
            Institution: "ICICI Bank",
            AccountNumber: null,
            Notes: "Updated notes",
            IsArchived: null,
            IncludeInNetWorth: null,
            Order: null
        );

        // Act
        var response = await authClient.PutAsJsonAsync($"/api/accounts/{createdAccount!.Id}", updateRequest);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var updatedAccount = await response.Content.ReadFromJsonAsync<AccountResponse>();
        updatedAccount!.Name.Should().Be("Updated Account Name");
        updatedAccount.Icon.Should().Be("💰");
        updatedAccount.Color.Should().Be("#10B981");
    }

    #endregion

    #region Delete Account Tests

    [Fact]
    public async Task DeleteAccount_WithNoTransactions_DeletesAccount()
    {
        // Arrange
        var authClient = await GetAuthenticatedClientAsync();
        var createRequest = new CreateAccountRequest("Delete Test Account", "Bank", "🏦", "#3B82F6", "INR", 100, null, null, null, true);
        var createResponse = await authClient.PostAsJsonAsync("/api/accounts", createRequest);
        var createdAccount = await createResponse.Content.ReadFromJsonAsync<AccountResponse>();

        // Act
        var response = await authClient.DeleteAsync($"/api/accounts/{createdAccount!.Id}");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        // Verify deletion in database
        using var scope = Factory.Services.CreateScope();
        var mongoDbService = scope.ServiceProvider.GetRequiredService<DigiTransac.Api.Services.IMongoDbService>();
        var accountsCollection = mongoDbService.GetCollection<Account>("accounts");
        var dbAccount = await accountsCollection.Find(a => a.Id == createdAccount.Id).FirstOrDefaultAsync();
        dbAccount.Should().BeNull();
    }

    #endregion

    #region Account Summary Tests

    [Fact]
    public async Task GetAccountSummary_WithMultipleAccounts_ReturnsCorrectTotals()
    {
        // Arrange
        var authClient = await GetAuthenticatedClientAsync();
        
        // Create multiple accounts
        await authClient.PostAsJsonAsync("/api/accounts", 
            new CreateAccountRequest("Savings", "Bank", "🏦", "#3B82F6", "INR", 50000, null, null, null, true));
        await authClient.PostAsJsonAsync("/api/accounts", 
            new CreateAccountRequest("Cash", "Cash", "💵", "#10B981", "INR", 5000, null, null, null, true));
        await authClient.PostAsJsonAsync("/api/accounts", 
            new CreateAccountRequest("Credit Card", "CreditCard", "💳", "#EF4444", "INR", -10000, null, null, null, true));

        // Act
        var response = await authClient.GetAsync("/api/accounts/summary");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var summary = await response.Content.ReadFromJsonAsync<AccountSummaryResponse>();
        summary.Should().NotBeNull();
        summary!.TotalAssets.Should().BeGreaterThan(0);
    }

    #endregion

    #region Adjust Balance Tests

    [Fact]
    public async Task AdjustBalance_WithValidAmount_UpdatesBalance()
    {
        // Arrange
        var authClient = await GetAuthenticatedClientAsync();
        var createRequest = new CreateAccountRequest("Balance Test Account", "Bank", "🏦", "#3B82F6", "INR", 1000, null, null, null, true);
        var createResponse = await authClient.PostAsJsonAsync("/api/accounts", createRequest);
        var createdAccount = await createResponse.Content.ReadFromJsonAsync<AccountResponse>();

        var adjustRequest = new AdjustBalanceRequest(2500, "Balance adjustment test");

        // Act
        var response = await authClient.PostAsJsonAsync($"/api/accounts/{createdAccount!.Id}/adjust-balance", adjustRequest);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        // Verify new balance
        var getResponse = await authClient.GetAsync($"/api/accounts/{createdAccount.Id}");
        var account = await getResponse.Content.ReadFromJsonAsync<AccountResponse>();
        account!.CurrentBalance.Should().Be(2500);
    }

    #endregion
}