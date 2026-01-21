using DigiTransac.Api.Models;
using DigiTransac.Api.Models.Dto;
using DigiTransac.Api.Repositories;
using DigiTransac.Api.Services;
using FluentAssertions;
using Moq;

namespace DigiTransac.Tests.Services;

public class TransactionServiceTests
{
    private readonly Mock<ITransactionRepository> _transactionRepositoryMock;
    private readonly Mock<IAccountRepository> _accountRepositoryMock;
    private readonly Mock<ILabelRepository> _labelRepositoryMock;
    private readonly Mock<ITagRepository> _tagRepositoryMock;
    private readonly Mock<IUserRepository> _userRepositoryMock;
    private readonly Mock<IKeyManagementService> _keyManagementServiceMock;
    private readonly Mock<IDekCacheService> _dekCacheServiceMock;
    private readonly Mock<IEncryptionService> _encryptionServiceMock;
    private readonly TransactionService _transactionService;
    private const string TestUserId = "test-user-id";
    private const string TestAccountId = "test-account-id";
    private const string TestLabelId = "test-label-id";
    private readonly byte[] _testDek = new byte[32];

    public TransactionServiceTests()
    {
        _transactionRepositoryMock = new Mock<ITransactionRepository>();
        _accountRepositoryMock = new Mock<IAccountRepository>();
        _labelRepositoryMock = new Mock<ILabelRepository>();
        _tagRepositoryMock = new Mock<ITagRepository>();
        _userRepositoryMock = new Mock<IUserRepository>();
        _keyManagementServiceMock = new Mock<IKeyManagementService>();
        _dekCacheServiceMock = new Mock<IDekCacheService>();
        _encryptionServiceMock = new Mock<IEncryptionService>();

        // Setup encryption service pass-through
        _encryptionServiceMock.Setup(x => x.Encrypt(It.IsAny<string>(), It.IsAny<byte[]>()))
            .Returns((string plainText, byte[] dek) => plainText);
        _encryptionServiceMock.Setup(x => x.Decrypt(It.IsAny<string>(), It.IsAny<byte[]>()))
            .Returns((string cipherText, byte[] dek) => cipherText);

        // Setup DEK cache
        _dekCacheServiceMock.Setup(x => x.GetDek(TestUserId))
            .Returns(_testDek);

        // Setup default user
        _userRepositoryMock.Setup(x => x.GetByIdAsync(TestUserId))
            .ReturnsAsync(new User { Id = TestUserId, PrimaryCurrency = "USD", WrappedDek = new byte[64] });

        // Setup key management
        _keyManagementServiceMock.Setup(x => x.UnwrapKeyAsync(It.IsAny<byte[]>()))
            .ReturnsAsync(_testDek);

        // Setup default account
        _accountRepositoryMock.Setup(x => x.GetByIdAndUserIdAsync(TestAccountId, TestUserId))
            .ReturnsAsync(new Account { Id = TestAccountId, UserId = TestUserId, Name = "Test Account", Currency = "USD", CurrentBalance = 1000 });

        _accountRepositoryMock.Setup(x => x.GetByUserIdAsync(TestUserId, true))
            .ReturnsAsync(new List<Account>
            {
                new() { Id = TestAccountId, UserId = TestUserId, Name = "Test Account", Currency = "USD" }
            });

        // Setup default label
        _labelRepositoryMock.Setup(x => x.GetByUserIdAsync(TestUserId))
            .ReturnsAsync(new List<Label>
            {
                new() { Id = TestLabelId, UserId = TestUserId, Name = "Groceries", Type = LabelType.Category }
            });

        // Setup default tags
        _tagRepositoryMock.Setup(x => x.GetByUserIdAsync(TestUserId))
            .ReturnsAsync(new List<Tag>());

        _transactionService = new TransactionService(
            _transactionRepositoryMock.Object,
            _accountRepositoryMock.Object,
            _labelRepositoryMock.Object,
            _tagRepositoryMock.Object,
            _userRepositoryMock.Object,
            _keyManagementServiceMock.Object,
            _dekCacheServiceMock.Object,
            _encryptionServiceMock.Object);
    }

    #region CreateAsync Tests

    [Fact]
    public async Task CreateAsync_WithValidDebitTransaction_ShouldCreateAndUpdateBalance()
    {
        // Arrange
        var request = new CreateTransactionRequest(
            AccountId: TestAccountId,
            Type: "Debit",
            Amount: 100m,
            Date: DateTime.UtcNow,
            Title: "Grocery Shopping",
            Payee: "Supermarket",
            Notes: null,
            Splits: new List<TransactionSplitRequest>
            {
                new(TestLabelId, 100m, null)
            },
            TagIds: null,
            Location: null,
            TransferToAccountId: null,
            RecurringRule: null);

        _transactionRepositoryMock.Setup(x => x.CreateAsync(It.IsAny<Transaction>()))
            .ReturnsAsync((Transaction t) => { t.Id = "new-transaction-id"; return t; });

        // Act
        var (success, message, transaction) = await _transactionService.CreateAsync(TestUserId, request);

        // Assert
        success.Should().BeTrue();
        transaction.Should().NotBeNull();
        transaction!.Amount.Should().Be(100m);
        transaction.Type.Should().Be("Debit");

        _transactionRepositoryMock.Verify(x => x.CreateAsync(It.Is<Transaction>(t =>
            t.Amount == 100m &&
            t.Type == TransactionType.Debit &&
            t.Currency == "USD")), Times.Once);

        // Verify balance update
        _accountRepositoryMock.Verify(x => x.UpdateAsync(It.Is<Account>(a =>
            a.CurrentBalance == 900m)), Times.Once);
    }

    [Fact]
    public async Task CreateAsync_WithValidCreditTransaction_ShouldIncreaseBalance()
    {
        // Arrange
        var request = new CreateTransactionRequest(
            AccountId: TestAccountId,
            Type: "Credit",
            Amount: 500m,
            Date: DateTime.UtcNow,
            Title: "Salary",
            Payee: "Employer",
            Notes: null,
            Splits: new List<TransactionSplitRequest>
            {
                new(TestLabelId, 500m, null)
            },
            TagIds: null,
            Location: null,
            TransferToAccountId: null,
            RecurringRule: null);

        _transactionRepositoryMock.Setup(x => x.CreateAsync(It.IsAny<Transaction>()))
            .ReturnsAsync((Transaction t) => { t.Id = "new-transaction-id"; return t; });

        // Act
        var (success, message, transaction) = await _transactionService.CreateAsync(TestUserId, request);

        // Assert
        success.Should().BeTrue();
        transaction.Should().NotBeNull();
        transaction!.Type.Should().Be("Credit");

        // Verify balance increased
        _accountRepositoryMock.Verify(x => x.UpdateAsync(It.Is<Account>(a =>
            a.CurrentBalance == 1500m)), Times.Once);
    }

    [Fact]
    public async Task CreateAsync_WithInvalidAccountId_ShouldFail()
    {
        // Arrange
        _accountRepositoryMock.Setup(x => x.GetByIdAndUserIdAsync("invalid-account", TestUserId))
            .ReturnsAsync((Account?)null);

        var request = new CreateTransactionRequest(
            AccountId: "invalid-account",
            Type: "Debit",
            Amount: 100m,
            Date: DateTime.UtcNow,
            Title: null,
            Payee: null,
            Notes: null,
            Splits: new List<TransactionSplitRequest> { new(TestLabelId, 100m, null) },
            TagIds: null,
            Location: null,
            TransferToAccountId: null,
            RecurringRule: null);

        // Act
        var (success, message, _) = await _transactionService.CreateAsync(TestUserId, request);

        // Assert
        success.Should().BeFalse();
        message.Should().Contain("Account not found");
    }

    [Fact]
    public async Task CreateAsync_WithInvalidTransactionType_ShouldFail()
    {
        // Arrange
        var request = new CreateTransactionRequest(
            AccountId: TestAccountId,
            Type: "InvalidType",
            Amount: 100m,
            Date: DateTime.UtcNow,
            Title: null,
            Payee: null,
            Notes: null,
            Splits: new List<TransactionSplitRequest> { new(TestLabelId, 100m, null) },
            TagIds: null,
            Location: null,
            TransferToAccountId: null,
            RecurringRule: null);

        // Act
        var (success, message, _) = await _transactionService.CreateAsync(TestUserId, request);

        // Assert
        success.Should().BeFalse();
        message.Should().Contain("Invalid transaction type");
    }

    [Fact]
    public async Task CreateAsync_WithNegativeAmount_ShouldFail()
    {
        // Arrange
        var request = new CreateTransactionRequest(
            AccountId: TestAccountId,
            Type: "Debit",
            Amount: -50m,
            Date: DateTime.UtcNow,
            Title: null,
            Payee: null,
            Notes: null,
            Splits: new List<TransactionSplitRequest> { new(TestLabelId, -50m, null) },
            TagIds: null,
            Location: null,
            TransferToAccountId: null,
            RecurringRule: null);

        // Act
        var (success, message, _) = await _transactionService.CreateAsync(TestUserId, request);

        // Assert
        success.Should().BeFalse();
        message.Should().Contain("Amount must be positive");
    }

    [Fact]
    public async Task CreateAsync_WithNoSplits_ShouldFail()
    {
        // Arrange
        var request = new CreateTransactionRequest(
            AccountId: TestAccountId,
            Type: "Debit",
            Amount: 100m,
            Date: DateTime.UtcNow,
            Title: null,
            Payee: null,
            Notes: null,
            Splits: new List<TransactionSplitRequest>(),
            TagIds: null,
            Location: null,
            TransferToAccountId: null,
            RecurringRule: null);

        // Act
        var (success, message, _) = await _transactionService.CreateAsync(TestUserId, request);

        // Assert
        success.Should().BeFalse();
        message.Should().Contain("At least one split is required");
    }

    [Fact]
    public async Task CreateAsync_WithMismatchedSplitSum_ShouldFail()
    {
        // Arrange
        var request = new CreateTransactionRequest(
            AccountId: TestAccountId,
            Type: "Debit",
            Amount: 100m,
            Date: DateTime.UtcNow,
            Title: null,
            Payee: null,
            Notes: null,
            Splits: new List<TransactionSplitRequest>
            {
                new(TestLabelId, 50m, null),
                new(TestLabelId, 30m, null) // Sum = 80, not 100
            },
            TagIds: null,
            Location: null,
            TransferToAccountId: null,
            RecurringRule: null);

        // Act
        var (success, message, _) = await _transactionService.CreateAsync(TestUserId, request);

        // Assert
        success.Should().BeFalse();
        message.Should().Contain("Split amounts");
        message.Should().Contain("must equal transaction amount");
    }

    [Fact]
    public async Task CreateAsync_WithInvalidLabelId_ShouldFail()
    {
        // Arrange
        var request = new CreateTransactionRequest(
            AccountId: TestAccountId,
            Type: "Debit",
            Amount: 100m,
            Date: DateTime.UtcNow,
            Title: null,
            Payee: null,
            Notes: null,
            Splits: new List<TransactionSplitRequest>
            {
                new("invalid-label-id", 100m, null)
            },
            TagIds: null,
            Location: null,
            TransferToAccountId: null,
            RecurringRule: null);

        // Act
        var (success, message, _) = await _transactionService.CreateAsync(TestUserId, request);

        // Assert
        success.Should().BeFalse();
        message.Should().Contain("Label");
        message.Should().Contain("not found");
    }

    [Fact]
    public async Task CreateAsync_WithLocation_ShouldEncryptSensitiveFields()
    {
        // Arrange
        var request = new CreateTransactionRequest(
            AccountId: TestAccountId,
            Type: "Debit",
            Amount: 100m,
            Date: DateTime.UtcNow,
            Title: "Shopping",
            Payee: null,
            Notes: null,
            Splits: new List<TransactionSplitRequest> { new(TestLabelId, 100m, null) },
            TagIds: null,
            Location: new TransactionLocationRequest(40.7128, -74.0060, "Times Square", "New York", "USA"),
            TransferToAccountId: null,
            RecurringRule: null);

        Transaction? createdTransaction = null;
        _transactionRepositoryMock.Setup(x => x.CreateAsync(It.IsAny<Transaction>()))
            .ReturnsAsync((Transaction t) => { t.Id = "new-id"; createdTransaction = t; return t; });

        // Act
        var (success, _, _) = await _transactionService.CreateAsync(TestUserId, request);

        // Assert
        success.Should().BeTrue();
        createdTransaction.Should().NotBeNull();
        createdTransaction!.Location.Should().NotBeNull();
        createdTransaction.Location!.Latitude.Should().Be(40.7128);
        // Encrypted longitude (pass-through in test)
        createdTransaction.Location.EncryptedLongitude.Should().NotBeNull();
        createdTransaction.Location.EncryptedPlaceName.Should().NotBeNull();
        createdTransaction.Location.City.Should().Be("New York");
        createdTransaction.Location.Country.Should().Be("USA");
    }

    #endregion

    #region Transfer Tests

    [Fact]
    public async Task CreateAsync_WithTransfer_ShouldCreateLinkedTransactions()
    {
        // Arrange
        var toAccountId = "to-account-id";
        var toAccount = new Account { Id = toAccountId, UserId = TestUserId, Name = "Savings", Currency = "USD", CurrentBalance = 500 };
        
        _accountRepositoryMock.Setup(x => x.GetByIdAndUserIdAsync(toAccountId, TestUserId))
            .ReturnsAsync(toAccount);
        _accountRepositoryMock.Setup(x => x.GetByUserIdAsync(TestUserId, true))
            .ReturnsAsync(new List<Account>
            {
                new() { Id = TestAccountId, UserId = TestUserId, Name = "Checking", Currency = "USD" },
                toAccount
            });

        var request = new CreateTransactionRequest(
            AccountId: TestAccountId,
            Type: "Transfer",
            Amount: 200m,
            Date: DateTime.UtcNow,
            Title: "Transfer to Savings",
            Payee: null,
            Notes: null,
            Splits: new List<TransactionSplitRequest> { new(TestLabelId, 200m, null) },
            TagIds: null,
            Location: null,
            TransferToAccountId: toAccountId,
            RecurringRule: null);

        var createdTransactions = new List<Transaction>();
        _transactionRepositoryMock.Setup(x => x.CreateAsync(It.IsAny<Transaction>()))
            .ReturnsAsync((Transaction t) => { t.Id = Guid.NewGuid().ToString(); createdTransactions.Add(t); return t; });

        // Act
        var (success, message, transaction) = await _transactionService.CreateAsync(TestUserId, request);

        // Assert
        success.Should().BeTrue();
        createdTransactions.Should().HaveCount(2); // Source and destination
        
        // Verify source transaction is Debit from source account
        var sourceTransaction = createdTransactions.First(t => t.AccountId == TestAccountId);
        sourceTransaction.Type.Should().Be(TransactionType.Transfer);
        
        // Verify linked transaction is Credit to destination account
        var linkedTransaction = createdTransactions.First(t => t.AccountId == toAccountId);
        linkedTransaction.Type.Should().Be(TransactionType.Credit);
        linkedTransaction.LinkedTransactionId.Should().Be(sourceTransaction.Id);
    }

    [Fact]
    public async Task CreateAsync_WithTransferToSameAccount_ShouldFail()
    {
        // Arrange
        var request = new CreateTransactionRequest(
            AccountId: TestAccountId,
            Type: "Transfer",
            Amount: 100m,
            Date: DateTime.UtcNow,
            Title: null,
            Payee: null,
            Notes: null,
            Splits: new List<TransactionSplitRequest> { new(TestLabelId, 100m, null) },
            TagIds: null,
            Location: null,
            TransferToAccountId: TestAccountId, // Same as source
            RecurringRule: null);

        // Act
        var (success, message, _) = await _transactionService.CreateAsync(TestUserId, request);

        // Assert
        success.Should().BeFalse();
        message.Should().Contain("Cannot transfer to the same account");
    }

    [Fact]
    public async Task CreateAsync_WithTransferMissingDestination_ShouldFail()
    {
        // Arrange
        var request = new CreateTransactionRequest(
            AccountId: TestAccountId,
            Type: "Transfer",
            Amount: 100m,
            Date: DateTime.UtcNow,
            Title: null,
            Payee: null,
            Notes: null,
            Splits: new List<TransactionSplitRequest> { new(TestLabelId, 100m, null) },
            TagIds: null,
            Location: null,
            TransferToAccountId: null, // Missing!
            RecurringRule: null);

        // Act
        var (success, message, _) = await _transactionService.CreateAsync(TestUserId, request);

        // Assert
        success.Should().BeFalse();
        message.Should().Contain("Transfer requires a destination account");
    }

    #endregion

    #region Recurring Transaction Tests

    [Fact]
    public async Task CreateAsync_WithRecurringRule_ShouldCreateTemplate()
    {
        // Arrange
        var request = new CreateTransactionRequest(
            AccountId: TestAccountId,
            Type: "Debit",
            Amount: 50m,
            Date: DateTime.UtcNow.AddDays(1),
            Title: "Monthly Subscription",
            Payee: "Netflix",
            Notes: null,
            Splits: new List<TransactionSplitRequest> { new(TestLabelId, 50m, null) },
            TagIds: null,
            Location: null,
            TransferToAccountId: null,
            RecurringRule: new RecurringRuleRequest("Monthly", 1, null));

        Transaction? createdTransaction = null;
        _transactionRepositoryMock.Setup(x => x.CreateAsync(It.IsAny<Transaction>()))
            .ReturnsAsync((Transaction t) => { t.Id = "recurring-id"; createdTransaction = t; return t; });

        // Act
        var (success, _, transaction) = await _transactionService.CreateAsync(TestUserId, request);

        // Assert
        success.Should().BeTrue();
        createdTransaction.Should().NotBeNull();
        createdTransaction!.IsRecurringTemplate.Should().BeTrue();
        createdTransaction.RecurringRule.Should().NotBeNull();
        createdTransaction.RecurringRule!.Frequency.Should().Be(RecurrenceFrequency.Monthly);
        createdTransaction.RecurringRule.Interval.Should().Be(1);
        
        // Template should not update account balance
        _accountRepositoryMock.Verify(x => x.UpdateAsync(It.IsAny<Account>()), Times.Never);
    }

    [Fact]
    public async Task CreateAsync_WithInvalidRecurrenceFrequency_ShouldFail()
    {
        // Arrange
        var request = new CreateTransactionRequest(
            AccountId: TestAccountId,
            Type: "Debit",
            Amount: 50m,
            Date: DateTime.UtcNow,
            Title: null,
            Payee: null,
            Notes: null,
            Splits: new List<TransactionSplitRequest> { new(TestLabelId, 50m, null) },
            TagIds: null,
            Location: null,
            TransferToAccountId: null,
            RecurringRule: new RecurringRuleRequest("InvalidFrequency", 1, null));

        // Act
        var (success, message, _) = await _transactionService.CreateAsync(TestUserId, request);

        // Assert
        success.Should().BeFalse();
        message.Should().Contain("Invalid recurrence frequency");
    }

    #endregion

    #region GetAllAsync Tests

    [Fact]
    public async Task GetAllAsync_WithFilters_ShouldReturnFilteredTransactions()
    {
        // Arrange
        var transactions = new List<Transaction>
        {
            new()
            {
                Id = "1",
                UserId = TestUserId,
                AccountId = TestAccountId,
                Type = TransactionType.Debit,
                Amount = 100m,
                Currency = "USD",
                Date = DateTime.UtcNow,
                Splits = new List<TransactionSplit> { new() { LabelId = TestLabelId, Amount = 100m } },
                TagIds = new List<string>()
            }
        };

        _transactionRepositoryMock.Setup(x => x.GetFilteredAsync(TestUserId, It.IsAny<TransactionFilterRequest>()))
            .ReturnsAsync((transactions, 1));

        var filter = new TransactionFilterRequest(
            StartDate: DateTime.UtcNow.AddDays(-30),
            EndDate: DateTime.UtcNow,
            AccountIds: new List<string> { TestAccountId },
            Types: null,
            LabelIds: null,
            TagIds: null,
            MinAmount: null,
            MaxAmount: null,
            SearchText: null,
            IsCleared: null,
            IsRecurring: null,
            Page: 1,
            PageSize: 50);

        // Act
        var result = await _transactionService.GetAllAsync(TestUserId, filter);

        // Assert
        result.Transactions.Should().HaveCount(1);
        result.TotalCount.Should().Be(1);
        result.Page.Should().Be(1);
        result.PageSize.Should().Be(50);
    }

    [Fact]
    public async Task GetAllAsync_WithMultipleAccountIds_ShouldPassToRepository()
    {
        // Arrange
        var accountId1 = "account-1";
        var accountId2 = "account-2";
        var transactions = new List<Transaction>();

        _transactionRepositoryMock.Setup(x => x.GetFilteredAsync(TestUserId, It.IsAny<TransactionFilterRequest>()))
            .ReturnsAsync((transactions, 0));

        var filter = new TransactionFilterRequest(
            StartDate: null,
            EndDate: null,
            AccountIds: new List<string> { accountId1, accountId2 },
            Types: null,
            LabelIds: null,
            TagIds: null,
            MinAmount: null,
            MaxAmount: null,
            SearchText: null,
            IsCleared: null,
            IsRecurring: null,
            Page: 1,
            PageSize: 50);

        // Act
        await _transactionService.GetAllAsync(TestUserId, filter);

        // Assert
        _transactionRepositoryMock.Verify(x => x.GetFilteredAsync(
            TestUserId,
            It.Is<TransactionFilterRequest>(f => 
                f.AccountIds != null && 
                f.AccountIds.Count == 2 &&
                f.AccountIds.Contains(accountId1) &&
                f.AccountIds.Contains(accountId2))),
            Times.Once);
    }

    [Fact]
    public async Task GetAllAsync_WithMultipleTypes_ShouldPassToRepository()
    {
        // Arrange
        var transactions = new List<Transaction>();

        _transactionRepositoryMock.Setup(x => x.GetFilteredAsync(TestUserId, It.IsAny<TransactionFilterRequest>()))
            .ReturnsAsync((transactions, 0));

        var filter = new TransactionFilterRequest(
            StartDate: null,
            EndDate: null,
            AccountIds: null,
            Types: new List<string> { "Debit", "Credit" },
            LabelIds: null,
            TagIds: null,
            MinAmount: null,
            MaxAmount: null,
            SearchText: null,
            IsCleared: null,
            IsRecurring: null,
            Page: 1,
            PageSize: 50);

        // Act
        await _transactionService.GetAllAsync(TestUserId, filter);

        // Assert
        _transactionRepositoryMock.Verify(x => x.GetFilteredAsync(
            TestUserId,
            It.Is<TransactionFilterRequest>(f => 
                f.Types != null && 
                f.Types.Count == 2 &&
                f.Types.Contains("Debit") &&
                f.Types.Contains("Credit"))),
            Times.Once);
    }

    [Fact]
    public async Task GetAllAsync_WithMultipleLabelIds_ShouldPassToRepository()
    {
        // Arrange
        var labelId1 = "label-1";
        var labelId2 = "label-2";
        var transactions = new List<Transaction>();

        _transactionRepositoryMock.Setup(x => x.GetFilteredAsync(TestUserId, It.IsAny<TransactionFilterRequest>()))
            .ReturnsAsync((transactions, 0));

        var filter = new TransactionFilterRequest(
            StartDate: null,
            EndDate: null,
            AccountIds: null,
            Types: null,
            LabelIds: new List<string> { labelId1, labelId2 },
            TagIds: null,
            MinAmount: null,
            MaxAmount: null,
            SearchText: null,
            IsCleared: null,
            IsRecurring: null,
            Page: 1,
            PageSize: 50);

        // Act
        await _transactionService.GetAllAsync(TestUserId, filter);

        // Assert
        _transactionRepositoryMock.Verify(x => x.GetFilteredAsync(
            TestUserId,
            It.Is<TransactionFilterRequest>(f => 
                f.LabelIds != null && 
                f.LabelIds.Count == 2 &&
                f.LabelIds.Contains(labelId1) &&
                f.LabelIds.Contains(labelId2))),
            Times.Once);
    }

    [Fact]
    public async Task GetAllAsync_WithMultipleTagIds_ShouldPassToRepository()
    {
        // Arrange
        var tagId1 = "tag-1";
        var tagId2 = "tag-2";
        var transactions = new List<Transaction>();

        _transactionRepositoryMock.Setup(x => x.GetFilteredAsync(TestUserId, It.IsAny<TransactionFilterRequest>()))
            .ReturnsAsync((transactions, 0));

        var filter = new TransactionFilterRequest(
            StartDate: null,
            EndDate: null,
            AccountIds: null,
            Types: null,
            LabelIds: null,
            TagIds: new List<string> { tagId1, tagId2 },
            MinAmount: null,
            MaxAmount: null,
            SearchText: null,
            IsCleared: null,
            IsRecurring: null,
            Page: 1,
            PageSize: 50);

        // Act
        await _transactionService.GetAllAsync(TestUserId, filter);

        // Assert
        _transactionRepositoryMock.Verify(x => x.GetFilteredAsync(
            TestUserId,
            It.Is<TransactionFilterRequest>(f => 
                f.TagIds != null && 
                f.TagIds.Count == 2 &&
                f.TagIds.Contains(tagId1) &&
                f.TagIds.Contains(tagId2))),
            Times.Once);
    }

    [Fact]
    public async Task GetAllAsync_WithSearchText_ShouldFindMatchingLabelsAndTags()
    {
        // Arrange
        var transactions = new List<Transaction>();
        var matchingLabel = new Label { Id = "matching-label", UserId = TestUserId, Name = "Groceries", Type = LabelType.Category };
        var matchingTag = new Api.Models.Tag { Id = "matching-tag", UserId = TestUserId, Name = "Shopping" };

        _transactionRepositoryMock.Setup(x => x.GetFilteredAsync(TestUserId, It.IsAny<TransactionFilterRequest>()))
            .ReturnsAsync((transactions, 0));

        _labelRepositoryMock.Setup(x => x.GetByUserIdAsync(TestUserId))
            .ReturnsAsync(new List<Label> { matchingLabel });

        var filter = new TransactionFilterRequest(
            StartDate: null,
            EndDate: null,
            AccountIds: null,
            Types: null,
            LabelIds: null,
            TagIds: null,
            MinAmount: null,
            MaxAmount: null,
            SearchText: "groc",
            IsCleared: null,
            IsRecurring: null,
            Page: 1,
            PageSize: 50);

        // Act
        await _transactionService.GetAllAsync(TestUserId, filter);

        // Assert - verify search was passed with matching label IDs
        _transactionRepositoryMock.Verify(x => x.GetFilteredAsync(
            TestUserId,
            It.Is<TransactionFilterRequest>(f => 
                f.SearchText == "groc" &&
                f.SearchLabelIds != null &&
                f.SearchLabelIds.Contains("matching-label"))),
            Times.Once);
    }

    #endregion

    #region UpdateAsync Tests

    [Fact]
    public async Task UpdateAsync_WithValidData_ShouldUpdateTransaction()
    {
        // Arrange
        var existingTransaction = new Transaction
        {
            Id = "trans-1",
            UserId = TestUserId,
            AccountId = TestAccountId,
            Type = TransactionType.Debit,
            Amount = 100m,
            Currency = "USD",
            Date = DateTime.UtcNow,
            Title = "Old Title",
            Splits = new List<TransactionSplit> { new() { LabelId = TestLabelId, Amount = 100m } },
            TagIds = new List<string>()
        };

        _transactionRepositoryMock.Setup(x => x.GetByIdAndUserIdAsync("trans-1", TestUserId))
            .ReturnsAsync(existingTransaction);

        var updateRequest = new UpdateTransactionRequest(
            Type: null,
            Amount: null,
            Date: null,
            Title: "New Title",
            Payee: null,
            Notes: null,
            Splits: null,
            TagIds: null,
            Location: null,
            IsCleared: true,
            TransferToAccountId: null);

        // Act
        var (success, message, transaction) = await _transactionService.UpdateAsync("trans-1", TestUserId, updateRequest);

        // Assert
        success.Should().BeTrue();
        transaction.Should().NotBeNull();
        transaction!.Title.Should().Be("New Title");
        transaction.IsCleared.Should().BeTrue();

        _transactionRepositoryMock.Verify(x => x.UpdateAsync(It.Is<Transaction>(t =>
            t.Title == "New Title" && t.IsCleared)), Times.Once);
    }

    [Fact]
    public async Task UpdateAsync_WithNonExistentTransaction_ShouldFail()
    {
        // Arrange
        _transactionRepositoryMock.Setup(x => x.GetByIdAndUserIdAsync("invalid-id", TestUserId))
            .ReturnsAsync((Transaction?)null);

        var updateRequest = new UpdateTransactionRequest(
            Type: null, Amount: null, Date: null, Title: "New Title",
            Payee: null, Notes: null, Splits: null, TagIds: null,
            Location: null, IsCleared: null, TransferToAccountId: null);

        // Act
        var (success, message, _) = await _transactionService.UpdateAsync("invalid-id", TestUserId, updateRequest);

        // Assert
        success.Should().BeFalse();
        message.Should().Contain("Transaction not found");
    }

    [Fact]
    public async Task UpdateAsync_WithRecurringTemplate_ShouldFail()
    {
        // Arrange
        var template = new Transaction
        {
            Id = "template-1",
            UserId = TestUserId,
            AccountId = TestAccountId,
            IsRecurringTemplate = true,
            Type = TransactionType.Debit,
            Amount = 50m,
            Currency = "USD",
            Splits = new List<TransactionSplit> { new() { LabelId = TestLabelId, Amount = 50m } },
            TagIds = new List<string>(),
            RecurringRule = new RecurringRule { Frequency = RecurrenceFrequency.Monthly, Interval = 1, NextOccurrence = DateTime.UtcNow }
        };

        _transactionRepositoryMock.Setup(x => x.GetByIdAndUserIdAsync("template-1", TestUserId))
            .ReturnsAsync(template);

        var updateRequest = new UpdateTransactionRequest(
            Type: null, Amount: 100m, Date: null, Title: null,
            Payee: null, Notes: null, Splits: null, TagIds: null,
            Location: null, IsCleared: null, TransferToAccountId: null);

        // Act
        var (success, message, _) = await _transactionService.UpdateAsync("template-1", TestUserId, updateRequest);

        // Assert
        success.Should().BeFalse();
        message.Should().Contain("Cannot edit recurring template");
    }

    #endregion

    #region DeleteAsync Tests

    [Fact]
    public async Task DeleteAsync_WithValidTransaction_ShouldDeleteAndReverseBalance()
    {
        // Arrange
        var transaction = new Transaction
        {
            Id = "trans-1",
            UserId = TestUserId,
            AccountId = TestAccountId,
            Type = TransactionType.Debit,
            Amount = 100m,
            Currency = "USD",
            Date = DateTime.UtcNow,
            Splits = new List<TransactionSplit>(),
            TagIds = new List<string>()
        };

        _transactionRepositoryMock.Setup(x => x.GetByIdAndUserIdAsync("trans-1", TestUserId))
            .ReturnsAsync(transaction);
        _transactionRepositoryMock.Setup(x => x.DeleteAsync("trans-1", TestUserId))
            .ReturnsAsync(true);

        // Act
        var (success, message) = await _transactionService.DeleteAsync("trans-1", TestUserId);

        // Assert
        success.Should().BeTrue();
        
        // Verify balance was reversed (added back since it was a debit)
        _accountRepositoryMock.Verify(x => x.UpdateAsync(It.Is<Account>(a =>
            a.CurrentBalance == 1100m)), Times.Once);
    }

    [Fact]
    public async Task DeleteAsync_WithNonExistentTransaction_ShouldFail()
    {
        // Arrange
        _transactionRepositoryMock.Setup(x => x.GetByIdAndUserIdAsync("invalid-id", TestUserId))
            .ReturnsAsync((Transaction?)null);

        // Act
        var (success, message) = await _transactionService.DeleteAsync("invalid-id", TestUserId);

        // Assert
        success.Should().BeFalse();
        message.Should().Contain("Transaction not found");
    }

    #endregion

    #region GetSummaryAsync Tests

    [Fact]
    public async Task GetSummaryAsync_ShouldReturnCorrectTotals()
    {
        // Arrange
        var transactions = new List<Transaction>
        {
            new() { Id = "1", UserId = TestUserId, AccountId = TestAccountId, Type = TransactionType.Credit, Amount = 1000m, Currency = "USD", Splits = new(), TagIds = new() },
            new() { Id = "2", UserId = TestUserId, AccountId = TestAccountId, Type = TransactionType.Credit, Amount = 500m, Currency = "USD", Splits = new(), TagIds = new() },
            new() { Id = "3", UserId = TestUserId, AccountId = TestAccountId, Type = TransactionType.Debit, Amount = 300m, Currency = "USD", Splits = new(), TagIds = new() }
        };

        _transactionRepositoryMock.Setup(x => x.GetFilteredAsync(TestUserId, It.IsAny<TransactionFilterRequest>()))
            .ReturnsAsync((transactions, 3));
        _transactionRepositoryMock.Setup(x => x.GetSumByLabelAsync(TestUserId, It.IsAny<DateTime?>(), It.IsAny<DateTime?>()))
            .ReturnsAsync(new Dictionary<string, decimal> { { TestLabelId, 300m } });
        _transactionRepositoryMock.Setup(x => x.GetSumByTagAsync(TestUserId, It.IsAny<DateTime?>(), It.IsAny<DateTime?>()))
            .ReturnsAsync(new Dictionary<string, decimal>());

        // Act
        var filter = new TransactionFilterRequest(null, null, null, null, null, null, null, null, null, null, null, 1, int.MaxValue);
        var summary = await _transactionService.GetSummaryAsync(TestUserId, filter);

        // Assert
        summary.TotalCredits.Should().Be(1500m);
        summary.TotalDebits.Should().Be(300m);
        summary.NetChange.Should().Be(1200m);
        summary.TransactionCount.Should().Be(3);
    }

    #endregion
}
