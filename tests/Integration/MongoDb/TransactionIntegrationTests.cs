using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
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
[Trait("Category", "Integration")]
public class TransactionIntegrationTests : MongoDbIntegrationTestBase
{
    // JSON options that match the API's serialization (enums as strings)
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        Converters = { new JsonStringEnumConverter() }
    };

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
        var account = await response.Content.ReadFromJsonAsync<AccountResponse>(JsonOptions);
        return account!.Id;
    }

    /// <summary>
    /// Creates a test category label and returns its ID.
    /// </summary>
    private async Task<string> CreateTestLabelAsync(HttpClient authClient, string name = "Test Category")
    {
        var labelRequest = new CreateLabelRequest(
            Name: name,
            ParentId: null,
            Type: "Category",
            Icon: "📦",
            Color: "#10B981"
        );
        
        var response = await authClient.PostAsJsonAsync("/api/labels", labelRequest);
        response.EnsureSuccessStatusCode();
        var label = await response.Content.ReadFromJsonAsync<LabelResponse>(JsonOptions);
        return label!.Id;
    }

    /// <summary>
    /// Helper to create a transaction split with the given label and amount.
    /// </summary>
    private static List<TransactionSplitRequest> CreateSplits(string labelId, decimal amount)
    {
        return new List<TransactionSplitRequest>
        {
            new TransactionSplitRequest(labelId, amount, null)
        };
    }

    #region Create Transaction Tests

    [SkippableFact]
    public async Task CreateTransaction_WithValidExpense_CreatesTransactionAndUpdatesBalance()
    {
        // Arrange
        var authClient = await GetAuthenticatedClientAsync();
        var accountId = await CreateTestAccountAsync(authClient, "Expense Test Account");
        var labelId = await CreateTestLabelAsync(authClient, "Groceries");
        
        var request = new CreateTransactionRequest(
            AccountId: accountId,
            Type: "Send",  // Expense is "Send" type
            Amount: 500,
            Date: DateTime.UtcNow,
            Title: "Grocery Shopping",
            Payee: "Local Store",
            Notes: "Weekly groceries",
            Splits: CreateSplits(labelId, 500),  // Valid split with label
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
        
        var transaction = await response.Content.ReadFromJsonAsync<TransactionResponse>(JsonOptions);
        transaction.Should().NotBeNull();
        transaction!.Title.Should().Be("Grocery Shopping");
        transaction.Amount.Should().Be(500);
        transaction.Type.Should().Be("Send");  // Type is "Send" (not "Expense")

        // Verify account balance was updated
        var accountResponse = await authClient.GetAsync($"/api/accounts/{accountId}");
        var account = await accountResponse.Content.ReadFromJsonAsync<AccountResponse>(JsonOptions);
        account!.CurrentBalance.Should().Be(9500); // 10000 - 500
    }

    [SkippableFact]
    public async Task CreateTransaction_WithValidIncome_IncreasesBalance()
    {
        // Arrange
        var authClient = await GetAuthenticatedClientAsync();
        var accountId = await CreateTestAccountAsync(authClient, "Income Test Account");
        var labelId = await CreateTestLabelAsync(authClient, "Salary Income");
        
        var request = new CreateTransactionRequest(
            AccountId: accountId,
            Type: "Receive",  // Income is "Receive" type
            Amount: 25000,
            Date: DateTime.UtcNow,
            Title: "Salary",
            Payee: "Employer Corp",
            Notes: "Monthly salary",
            Splits: CreateSplits(labelId, 25000),  // Valid split with label
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
        var account = await accountResponse.Content.ReadFromJsonAsync<AccountResponse>(JsonOptions);
        account!.CurrentBalance.Should().Be(35000); // 10000 + 25000
    }

    #endregion

    #region Get Transactions Tests

    [SkippableFact]
    public async Task GetTransactions_WithFilters_ReturnsFilteredResults()
    {
        // Arrange
        var authClient = await GetAuthenticatedClientAsync();
        var accountId = await CreateTestAccountAsync(authClient, "Filter Test Account");
        var labelId = await CreateTestLabelAsync(authClient, "Filter Category");
        
        // Create multiple transactions
        var oldRequest = new CreateTransactionRequest(
            accountId, "Send", 100, DateTime.UtcNow.AddDays(-5), "Old Transaction", null, null,
            CreateSplits(labelId, 100), null, null, null, null, null, null, "Manual");
        var oldResponse = await authClient.PostAsJsonAsync("/api/transactions", oldRequest);
        oldResponse.EnsureSuccessStatusCode();
        
        var recentRequest = new CreateTransactionRequest(
            accountId, "Send", 200, DateTime.UtcNow, "Recent Transaction", null, null,
            CreateSplits(labelId, 200), null, null, null, null, null, null, "Manual");
        var recentResponse = await authClient.PostAsJsonAsync("/api/transactions", recentRequest);
        recentResponse.EnsureSuccessStatusCode();

        // Act - Filter by date range
        var startDate = DateTime.UtcNow.AddDays(-2).ToString("yyyy-MM-dd");
        var response = await authClient.GetAsync($"/api/transactions?startDate={startDate}");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var result = await response.Content.ReadFromJsonAsync<TransactionListResponse>(JsonOptions);
        result.Should().NotBeNull();
        result!.Transactions.Should().Contain(t => t.Title == "Recent Transaction");
    }

    [SkippableFact]
    public async Task GetTransactions_WithPagination_ReturnsPagedResults()
    {
        // Arrange
        var authClient = await GetAuthenticatedClientAsync();
        var accountId = await CreateTestAccountAsync(authClient, "Pagination Test Account");
        var labelId = await CreateTestLabelAsync(authClient, "Pagination Category");
        
        // Create multiple transactions
        for (int i = 0; i < 15; i++)
        {
            var request = new CreateTransactionRequest(
                accountId, "Send", 100 + i, DateTime.UtcNow, $"Transaction {i}", null, null,
                CreateSplits(labelId, 100 + i), null, null, null, null, null, null, "Manual");
            var createResponse = await authClient.PostAsJsonAsync("/api/transactions", request);
            createResponse.EnsureSuccessStatusCode();
        }

        // Act - Get first page
        var response = await authClient.GetAsync("/api/transactions?page=1&pageSize=10");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var result = await response.Content.ReadFromJsonAsync<TransactionListResponse>(JsonOptions);
        result.Should().NotBeNull();
        result!.Transactions.Count.Should().Be(10);
        result.TotalCount.Should().BeGreaterThanOrEqualTo(15);
    }

    #endregion

    #region Get Single Transaction Tests

    [SkippableFact]
    public async Task GetTransaction_WithValidId_ReturnsTransaction()
    {
        // Arrange
        var authClient = await GetAuthenticatedClientAsync();
        var accountId = await CreateTestAccountAsync(authClient, "Get Transaction Test Account");
        var labelId = await CreateTestLabelAsync(authClient, "Get Transaction Category");
        
        var createRequest = new CreateTransactionRequest(
            accountId, "Send", 750, DateTime.UtcNow, "Single Transaction", null, null,
            CreateSplits(labelId, 750), null, null, null, null, null, null, "Manual");
        var createResponse = await authClient.PostAsJsonAsync("/api/transactions", createRequest);
        createResponse.EnsureSuccessStatusCode();
        var createdTransaction = await createResponse.Content.ReadFromJsonAsync<TransactionResponse>(JsonOptions);

        // Act
        var response = await authClient.GetAsync($"/api/transactions/{createdTransaction!.Id}");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var transaction = await response.Content.ReadFromJsonAsync<TransactionResponse>(JsonOptions);
        transaction.Should().NotBeNull();
        transaction!.Id.Should().Be(createdTransaction.Id);
        transaction.Title.Should().Be("Single Transaction");
    }

    #endregion

    #region Update Transaction Tests

    [SkippableFact]
    public async Task UpdateTransaction_WithValidData_UpdatesTransactionAndBalance()
    {
        // Arrange
        var authClient = await GetAuthenticatedClientAsync();
        var accountId = await CreateTestAccountAsync(authClient, "Update Transaction Test Account");
        var labelId = await CreateTestLabelAsync(authClient, "Update Transaction Category");
        
        var createRequest = new CreateTransactionRequest(
            accountId, "Send", 500, DateTime.UtcNow, "Original Title", null, null,
            CreateSplits(labelId, 500), null, null, null, null, null, null, "Manual");
        var createResponse = await authClient.PostAsJsonAsync("/api/transactions", createRequest);
        createResponse.EnsureSuccessStatusCode();
        var createdTransaction = await createResponse.Content.ReadFromJsonAsync<TransactionResponse>(JsonOptions);

        var updateRequest = new UpdateTransactionRequest(
            Type: null,
            Amount: 300, // Reduced amount
            Date: null,
            Title: "Updated Title",
            Payee: null,
            Notes: "Updated notes",
            Splits: CreateSplits(labelId, 300),  // Update splits to match new amount
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
        var updatedTransaction = await response.Content.ReadFromJsonAsync<TransactionResponse>(JsonOptions);
        updatedTransaction!.Title.Should().Be("Updated Title");
        updatedTransaction.Amount.Should().Be(300);

        // Verify balance was adjusted (10000 - 500 + 500 - 300 = 9700)
        var accountResponse = await authClient.GetAsync($"/api/accounts/{accountId}");
        var account = await accountResponse.Content.ReadFromJsonAsync<AccountResponse>(JsonOptions);
        account!.CurrentBalance.Should().Be(9700);
    }

    #endregion

    #region Delete Transaction Tests

    [SkippableFact]
    public async Task DeleteTransaction_WithValidId_DeletesAndRevertsBalance()
    {
        // Arrange
        var authClient = await GetAuthenticatedClientAsync();
        var accountId = await CreateTestAccountAsync(authClient, "Delete Transaction Test Account");
        var labelId = await CreateTestLabelAsync(authClient, "Delete Transaction Category");
        
        var createRequest = new CreateTransactionRequest(
            accountId, "Send", 1000, DateTime.UtcNow, "Transaction to Delete", null, null,
            CreateSplits(labelId, 1000), null, null, null, null, null, null, "Manual");
        var createResponse = await authClient.PostAsJsonAsync("/api/transactions", createRequest);
        createResponse.EnsureSuccessStatusCode();
        var createdTransaction = await createResponse.Content.ReadFromJsonAsync<TransactionResponse>(JsonOptions);

        // Verify initial balance (10000 - 1000 = 9000)
        var initialAccountResponse = await authClient.GetAsync($"/api/accounts/{accountId}");
        var initialAccount = await initialAccountResponse.Content.ReadFromJsonAsync<AccountResponse>(JsonOptions);
        initialAccount!.CurrentBalance.Should().Be(9000);

        // Act
        var response = await authClient.DeleteAsync($"/api/transactions/{createdTransaction!.Id}");

        // Assert - DELETE returns 204 NoContent
        response.StatusCode.Should().Be(HttpStatusCode.NoContent);

        // Verify balance was reverted (9000 + 1000 = 10000)
        var finalAccountResponse = await authClient.GetAsync($"/api/accounts/{accountId}");
        var finalAccount = await finalAccountResponse.Content.ReadFromJsonAsync<AccountResponse>(JsonOptions);
        finalAccount!.CurrentBalance.Should().Be(10000);

        // Verify transaction is deleted
        var getResponse = await authClient.GetAsync($"/api/transactions/{createdTransaction.Id}");
        getResponse.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    #endregion

    #region Transfer Transaction Tests

    [SkippableFact]
    public async Task CreateTransfer_BetweenAccounts_UpdatesBothBalances()
    {
        // Arrange
        var authClient = await GetAuthenticatedClientAsync();
        var sourceAccountId = await CreateTestAccountAsync(authClient, "Source Account");
        var targetAccountId = await CreateTestAccountAsync(authClient, "Target Account");
        var labelId = await CreateTestLabelAsync(authClient, "Transfer Category");
        
        // "Transfer" is a UI concept - the API uses "Send" with TransferToAccountId
        var request = new CreateTransactionRequest(
            AccountId: sourceAccountId,
            Type: "Send",  // Transfer uses "Send" type
            Amount: 2000,
            Date: DateTime.UtcNow,
            Title: "Transfer to Target",
            Payee: null,
            Notes: "Test transfer",
            Splits: CreateSplits(labelId, 2000),
            TagIds: null,
            Location: null,
            TransferToAccountId: targetAccountId,  // This makes it a transfer
            RecurringRule: null,
            CounterpartyEmail: null,
            CounterpartyAmount: null,
            Source: "Transfer"  // Mark source as Transfer
        );

        // Act
        var response = await authClient.PostAsJsonAsync("/api/transactions", request);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Created);

        // Verify source account balance (10000 - 2000 = 8000)
        var sourceResponse = await authClient.GetAsync($"/api/accounts/{sourceAccountId}");
        var sourceAccount = await sourceResponse.Content.ReadFromJsonAsync<AccountResponse>(JsonOptions);
        sourceAccount!.CurrentBalance.Should().Be(8000);

        // Verify target account balance (10000 + 2000 = 12000)
        var targetResponse = await authClient.GetAsync($"/api/accounts/{targetAccountId}");
        var targetAccount = await targetResponse.Content.ReadFromJsonAsync<AccountResponse>(JsonOptions);
        targetAccount!.CurrentBalance.Should().Be(12000);
    }

    #endregion

    #region Batch Operations Tests

    [SkippableFact]
    public async Task BatchDelete_WithValidIds_DeletesMultipleTransactions()
    {
        // Arrange
        var authClient = await GetAuthenticatedClientAsync();
        var accountId = await CreateTestAccountAsync(authClient, "Batch Delete Test Account");
        var labelId = await CreateTestLabelAsync(authClient, "Batch Delete Category");
        
        var ids = new List<string>();
        for (int i = 0; i < 3; i++)
        {
            var createRequest = new CreateTransactionRequest(
                accountId, "Send", 100, DateTime.UtcNow, $"Batch Transaction {i}", null, null,
                CreateSplits(labelId, 100), null, null, null, null, null, null, "Manual");
            var createResponse = await authClient.PostAsJsonAsync("/api/transactions", createRequest);
            createResponse.EnsureSuccessStatusCode();
            var transaction = await createResponse.Content.ReadFromJsonAsync<TransactionResponse>(JsonOptions);
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