using System.Net;
using System.Net.Http.Json;
using DigiTransac.Api.Models;
using DigiTransac.Api.Models.Dto;
using FluentAssertions;
using Microsoft.Extensions.DependencyInjection;
using MongoDB.Driver;

namespace DigiTransac.Tests.Integration.MongoDb;

/// <summary>
/// Integration tests for Transaction endpoints using real MongoDB via TestContainers.
/// </summary>
[Collection(MongoDbTestCollection.Name)]
public class TransactionIntegrationTests : MongoDbIntegrationTestBase
{
    public TransactionIntegrationTests(MongoDbContainerFixture mongoFixture) 
        : base(mongoFixture)
    {
    }

    /// <summary>
    /// Creates a test account and returns its ID for use in transaction tests.
    /// </summary>
    private async Task<string> CreateTestAccountAsync(HttpClient authClient, string name = "Test Account")
    {
        var accountRequest = new CreateAccountRequest(
            Name: name,
            Type: "Bank",
            Icon: "🏦",
            Color: "#3B82F6",
            Currency: "INR",
            InitialBalance: 10000,
            Institution: null,
            AccountNumber: null,
            Notes: null,
            IncludeInNetWorth: true
        );
        
        var response = await authClient.PostAsJsonAsync("/api/accounts", accountRequest);
        response.EnsureSuccessStatusCode();
        var account = await response.Content.ReadFromJsonAsync<AccountResponse>();
        return account!.Id;
    }

    #region Create Transaction Tests

    [Fact]
    public async Task CreateTransaction_WithValidExpense_CreatesTransactionAndUpdatesBalance()
    {
        // Arrange
        var authClient = await GetAuthenticatedClientAsync();
        var accountId = await CreateTestAccountAsync(authClient, "Expense Test Account");
        
        var request = new CreateTransactionRequest(
            AccountId: accountId,
            Type: "Send",  // Expense is "Send" type
            Amount: 500,
            Date: DateTime.UtcNow,
            Title: "Grocery Shopping",
            Payee: "Local Store",
            Notes: "Weekly groceries",
            Splits: new List<TransactionSplitRequest>(),
            TagIds: null,
            Location: null,
            TransferToAccountId: null,
            RecurringRule: null,
            CounterpartyEmail: null,
            CounterpartyAmount: null,
            Source: "Manual"
        );

        // Act
        var response = await authClient.PostAsJsonAsync("/api/transactions", request);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Created);
        
        var transaction = await response.Content.ReadFromJsonAsync<TransactionResponse>();
        transaction.Should().NotBeNull();
        transaction!.Title.Should().Be("Grocery Shopping");
        transaction.Amount.Should().Be(500);
        transaction.Type.Should().Be("Expense");

        // Verify account balance was updated
        var accountResponse = await authClient.GetAsync($"/api/accounts/{accountId}");
        var account = await accountResponse.Content.ReadFromJsonAsync<AccountResponse>();
        account!.CurrentBalance.Should().Be(9500); // 10000 - 500
    }

    [Fact]
    public async Task CreateTransaction_WithValidIncome_IncreasesBalance()
    {
        // Arrange
        var authClient = await GetAuthenticatedClientAsync();
        var accountId = await CreateTestAccountAsync(authClient, "Income Test Account");
        
        var request = new CreateTransactionRequest(
            AccountId: accountId,
            Type: "Receive",  // Income is "Receive" type
            Amount: 25000,
            Date: DateTime.UtcNow,
            Title: "Salary",
            Payee: "Employer Corp",
            Notes: "Monthly salary",
            Splits: new List<TransactionSplitRequest>(),
            TagIds: null,
            Location: null,
            TransferToAccountId: null,
            RecurringRule: null,
            CounterpartyEmail: null,
            CounterpartyAmount: null,
            Source: "Manual"
        );

        // Act
        var response = await authClient.PostAsJsonAsync("/api/transactions", request);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Created);
        
        // Verify account balance was updated
        var accountResponse = await authClient.GetAsync($"/api/accounts/{accountId}");
        var account = await accountResponse.Content.ReadFromJsonAsync<AccountResponse>();
        account!.CurrentBalance.Should().Be(35000); // 10000 + 25000
    }

    #endregion

    #region Get Transactions Tests

    [Fact]
    public async Task GetTransactions_WithFilters_ReturnsFilteredResults()
    {
        // Arrange
        var authClient = await GetAuthenticatedClientAsync();
        var accountId = await CreateTestAccountAsync(authClient, "Filter Test Account");
        
        // Create multiple transactions
        await authClient.PostAsJsonAsync("/api/transactions", new CreateTransactionRequest(
            accountId, "Send", 100, DateTime.UtcNow.AddDays(-5), "Old Transaction", null, null,
            new List<TransactionSplitRequest>(), null, null, null, null, null, null, "Manual"));
        
        await authClient.PostAsJsonAsync("/api/transactions", new CreateTransactionRequest(
            accountId, "Send", 200, DateTime.UtcNow, "Recent Transaction", null, null,
            new List<TransactionSplitRequest>(), null, null, null, null, null, null, "Manual"));

        // Act - Filter by date range
        var startDate = DateTime.UtcNow.AddDays(-2).ToString("yyyy-MM-dd");
        var response = await authClient.GetAsync($"/api/transactions?startDate={startDate}");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var result = await response.Content.ReadFromJsonAsync<TransactionListResponse>();
        result.Should().NotBeNull();
        result!.Transactions.Should().Contain(t => t.Title == "Recent Transaction");
    }

    [Fact]
    public async Task GetTransactions_WithPagination_ReturnsPagedResults()
    {
        // Arrange
        var authClient = await GetAuthenticatedClientAsync();
        var accountId = await CreateTestAccountAsync(authClient, "Pagination Test Account");
        
        // Create multiple transactions
        for (int i = 0; i < 15; i++)
        {
            await authClient.PostAsJsonAsync("/api/transactions", new CreateTransactionRequest(
                accountId, "Send", 100 + i, DateTime.UtcNow, $"Transaction {i}", null, null,
                new List<TransactionSplitRequest>(), null, null, null, null, null, null, "Manual"));
        }

        // Act - Get first page
        var response = await authClient.GetAsync("/api/transactions?page=1&pageSize=10");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var result = await response.Content.ReadFromJsonAsync<TransactionListResponse>();
        result.Should().NotBeNull();
        result!.Transactions.Count.Should().Be(10);
        result.TotalCount.Should().BeGreaterThanOrEqualTo(15);
    }

    #endregion

    #region Get Single Transaction Tests

    [Fact]
    public async Task GetTransaction_WithValidId_ReturnsTransaction()
    {
        // Arrange
        var authClient = await GetAuthenticatedClientAsync();
        var accountId = await CreateTestAccountAsync(authClient, "Get Transaction Test Account");
        
        var createResponse = await authClient.PostAsJsonAsync("/api/transactions", new CreateTransactionRequest(
            accountId, "Send", 750, DateTime.UtcNow, "Single Transaction", null, null,
            new List<TransactionSplitRequest>(), null, null, null, null, null, null, "Manual"));
        var createdTransaction = await createResponse.Content.ReadFromJsonAsync<TransactionResponse>();

        // Act
        var response = await authClient.GetAsync($"/api/transactions/{createdTransaction!.Id}");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var transaction = await response.Content.ReadFromJsonAsync<TransactionResponse>();
        transaction.Should().NotBeNull();
        transaction!.Id.Should().Be(createdTransaction.Id);
        transaction.Title.Should().Be("Single Transaction");
    }

    #endregion

    #region Update Transaction Tests

    [Fact]
    public async Task UpdateTransaction_WithValidData_UpdatesTransactionAndBalance()
    {
        // Arrange
        var authClient = await GetAuthenticatedClientAsync();
        var accountId = await CreateTestAccountAsync(authClient, "Update Transaction Test Account");
        
        var createResponse = await authClient.PostAsJsonAsync("/api/transactions", new CreateTransactionRequest(
            accountId, "Send", 500, DateTime.UtcNow, "Original Title", null, null,
            new List<TransactionSplitRequest>(), null, null, null, null, null, null, "Manual"));
        var createdTransaction = await createResponse.Content.ReadFromJsonAsync<TransactionResponse>();

        var updateRequest = new UpdateTransactionRequest(
            Type: null,
            Amount: 300, // Reduced amount
            Date: null,
            Title: "Updated Title",
            Payee: null,
            Notes: "Updated notes",
            Splits: null,
            TagIds: null,
            Location: null,
            Status: null,
            TransferToAccountId: null,
            AccountId: null
        );

        // Act
        var response = await authClient.PutAsJsonAsync($"/api/transactions/{createdTransaction!.Id}", updateRequest);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var updatedTransaction = await response.Content.ReadFromJsonAsync<TransactionResponse>();
        updatedTransaction!.Title.Should().Be("Updated Title");
        updatedTransaction.Amount.Should().Be(300);

        // Verify balance was adjusted (10000 - 500 + 500 - 300 = 9700)
        var accountResponse = await authClient.GetAsync($"/api/accounts/{accountId}");
        var account = await accountResponse.Content.ReadFromJsonAsync<AccountResponse>();
        account!.CurrentBalance.Should().Be(9700);
    }

    #endregion

    #region Delete Transaction Tests

    [Fact]
    public async Task DeleteTransaction_WithValidId_DeletesAndRevertsBalance()
    {
        // Arrange
        var authClient = await GetAuthenticatedClientAsync();
        var accountId = await CreateTestAccountAsync(authClient, "Delete Transaction Test Account");
        
        var createResponse = await authClient.PostAsJsonAsync("/api/transactions", new CreateTransactionRequest(
            accountId, "Send", 1000, DateTime.UtcNow, "Transaction to Delete", null, null,
            new List<TransactionSplitRequest>(), null, null, null, null, null, null, "Manual"));
        var createdTransaction = await createResponse.Content.ReadFromJsonAsync<TransactionResponse>();

        // Verify initial balance (10000 - 1000 = 9000)
        var initialAccountResponse = await authClient.GetAsync($"/api/accounts/{accountId}");
        var initialAccount = await initialAccountResponse.Content.ReadFromJsonAsync<AccountResponse>();
        initialAccount!.CurrentBalance.Should().Be(9000);

        // Act
        var response = await authClient.DeleteAsync($"/api/transactions/{createdTransaction!.Id}");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        // Verify balance was reverted (9000 + 1000 = 10000)
        var finalAccountResponse = await authClient.GetAsync($"/api/accounts/{accountId}");
        var finalAccount = await finalAccountResponse.Content.ReadFromJsonAsync<AccountResponse>();
        finalAccount!.CurrentBalance.Should().Be(10000);

        // Verify transaction is deleted
        var getResponse = await authClient.GetAsync($"/api/transactions/{createdTransaction.Id}");
        getResponse.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    #endregion

    #region Transfer Transaction Tests

    [Fact]
    public async Task CreateTransfer_BetweenAccounts_UpdatesBothBalances()
    {
        // Arrange
        var authClient = await GetAuthenticatedClientAsync();
        var sourceAccountId = await CreateTestAccountAsync(authClient, "Source Account");
        var targetAccountId = await CreateTestAccountAsync(authClient, "Target Account");
        
        var request = new CreateTransactionRequest(
            AccountId: sourceAccountId,
            Type: "Transfer",
            Amount: 2000,
            Date: DateTime.UtcNow,
            Title: "Transfer to Target",
            Payee: null,
            Notes: "Test transfer",
            Splits: new List<TransactionSplitRequest>(),
            TagIds: null,
            Location: null,
            TransferToAccountId: targetAccountId,
            RecurringRule: null,
            CounterpartyEmail: null,
            CounterpartyAmount: null,
            Source: "Manual"
        );

        // Act
        var response = await authClient.PostAsJsonAsync("/api/transactions", request);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Created);

        // Verify source account balance (10000 - 2000 = 8000)
        var sourceResponse = await authClient.GetAsync($"/api/accounts/{sourceAccountId}");
        var sourceAccount = await sourceResponse.Content.ReadFromJsonAsync<AccountResponse>();
        sourceAccount!.CurrentBalance.Should().Be(8000);

        // Verify target account balance (10000 + 2000 = 12000)
        var targetResponse = await authClient.GetAsync($"/api/accounts/{targetAccountId}");
        var targetAccount = await targetResponse.Content.ReadFromJsonAsync<AccountResponse>();
        targetAccount!.CurrentBalance.Should().Be(12000);
    }

    #endregion

    #region Batch Operations Tests

    [Fact]
    public async Task BatchDelete_WithValidIds_DeletesMultipleTransactions()
    {
        // Arrange
        var authClient = await GetAuthenticatedClientAsync();
        var accountId = await CreateTestAccountAsync(authClient, "Batch Delete Test Account");
        
        var ids = new List<string>();
        for (int i = 0; i < 3; i++)
        {
            var createResponse = await authClient.PostAsJsonAsync("/api/transactions", new CreateTransactionRequest(
                accountId, "Send", 100, DateTime.UtcNow, $"Batch Transaction {i}", null, null,
                new List<TransactionSplitRequest>(), null, null, null, null, null, null, "Manual"));
            var transaction = await createResponse.Content.ReadFromJsonAsync<TransactionResponse>();
            ids.Add(transaction!.Id);
        }

        var batchRequest = new BatchOperationRequest(ids, "delete", null);

        // Act
        var response = await authClient.PostAsJsonAsync("/api/transactions/batch", batchRequest);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        // Verify all transactions are deleted
        foreach (var id in ids)
        {
            var getResponse = await authClient.GetAsync($"/api/transactions/{id}");
            getResponse.StatusCode.Should().Be(HttpStatusCode.NotFound);
        }
    }

    #endregion
}