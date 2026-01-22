using DigiTransac.Api.Models;
using DigiTransac.Api.Models.Dto;
using DigiTransac.Api.Repositories;
using DigiTransac.Api.Services;
using FluentAssertions;
using Moq;

namespace DigiTransac.Tests.Services;

public class AccountServiceTests
{
    private readonly Mock<IAccountRepository> _accountRepositoryMock;
    private readonly Mock<ITransactionRepository> _transactionRepositoryMock;
    private readonly Mock<IUserRepository> _userRepositoryMock;
    private readonly Mock<IExchangeRateService> _exchangeRateServiceMock;
    private readonly Mock<IKeyManagementService> _keyManagementServiceMock;
    private readonly Mock<IDekCacheService> _dekCacheServiceMock;
    private readonly Mock<IEncryptionService> _encryptionServiceMock;
    private readonly Mock<ILabelService> _labelServiceMock;
    private readonly AccountService _accountService;
    private const string TestUserId = "test-user-id";
    private readonly byte[] _testDek = new byte[32];

    public AccountServiceTests()
    {
        _accountRepositoryMock = new Mock<IAccountRepository>();
        _transactionRepositoryMock = new Mock<ITransactionRepository>();
        _userRepositoryMock = new Mock<IUserRepository>();
        _exchangeRateServiceMock = new Mock<IExchangeRateService>();
        _keyManagementServiceMock = new Mock<IKeyManagementService>();
        _dekCacheServiceMock = new Mock<IDekCacheService>();
        _encryptionServiceMock = new Mock<IEncryptionService>();
        _labelServiceMock = new Mock<ILabelService>();
        
        // Setup encryption service to pass through values (no-op for tests)
        _encryptionServiceMock.Setup(x => x.Encrypt(It.IsAny<string>(), It.IsAny<byte[]>()))
            .Returns((string plainText, byte[] dek) => plainText);
        _encryptionServiceMock.Setup(x => x.Decrypt(It.IsAny<string>(), It.IsAny<byte[]>()))
            .Returns((string cipherText, byte[] dek) => cipherText);
        
        // Setup DEK cache to return test DEK
        _dekCacheServiceMock.Setup(x => x.GetDek(TestUserId))
            .Returns(_testDek);
        
        // Setup default user with primary currency and wrapped DEK
        _userRepositoryMock.Setup(x => x.GetByIdAsync(TestUserId))
            .ReturnsAsync(new User { Id = TestUserId, PrimaryCurrency = "INR", WrappedDek = new byte[64] });
        
        // Setup key management to return test DEK when unwrapping
        _keyManagementServiceMock.Setup(x => x.UnwrapKeyAsync(It.IsAny<byte[]>()))
            .ReturnsAsync(_testDek);
        
        // Setup default exchange rates
        _exchangeRateServiceMock.Setup(x => x.GetRatesAsync(It.IsAny<string>()))
            .ReturnsAsync(new ExchangeRateResponse(
                BaseCurrency: "USD",
                Rates: new Dictionary<string, decimal> { { "INR", 83.0m }, { "USD", 1.0m } },
                LastUpdated: DateTime.UtcNow,
                Source: "mock"
            ));
        
        // Setup Convert to return same amount when converting INR to INR
        _exchangeRateServiceMock.Setup(x => x.Convert(It.IsAny<decimal>(), "INR", "INR", It.IsAny<Dictionary<string, decimal>>()))
            .Returns((decimal amount, string from, string to, Dictionary<string, decimal> rates) => amount);
        
        // Setup default transaction counts to return empty dictionary (no transactions)
        _transactionRepositoryMock.Setup(x => x.GetCountsByAccountIdsAsync(It.IsAny<IEnumerable<string>>(), It.IsAny<string>()))
            .ReturnsAsync(new Dictionary<string, int>());
        
        // Setup default GetCountByAccountIdAsync to return 0
        _transactionRepositoryMock.Setup(x => x.GetCountByAccountIdAsync(It.IsAny<string>(), It.IsAny<string>()))
            .ReturnsAsync(0);
        
        // Setup default adjustment category for balance adjustments
        _labelServiceMock.Setup(x => x.GetOrCreateAdjustmentsCategoryAsync(It.IsAny<string>()))
            .ReturnsAsync(new Label
            {
                Id = "adjustment-category-id",
                Name = "Balance Adjustment",
                Type = LabelType.Category,
                IsSystem = true
            });
        
        _accountService = new AccountService(
            _accountRepositoryMock.Object,
            _transactionRepositoryMock.Object,
            _userRepositoryMock.Object,
            _exchangeRateServiceMock.Object,
            _keyManagementServiceMock.Object,
            _dekCacheServiceMock.Object,
            _encryptionServiceMock.Object,
            _labelServiceMock.Object);
    }

    #region GetAllAsync Tests

    [Fact]
    public async Task GetAllAsync_ShouldReturnAllAccountsForUser()
    {
        // Arrange
        var accounts = new List<Account>
        {
            new() { Id = "1", UserId = TestUserId, Name = "Savings", Type = AccountType.Bank, Currency = "INR" },
            new() { Id = "2", UserId = TestUserId, Name = "Credit Card", Type = AccountType.CreditCard, Currency = "INR" }
        };
        _accountRepositoryMock.Setup(x => x.GetByUserIdAsync(TestUserId, false))
            .ReturnsAsync(accounts);

        // Act
        var result = await _accountService.GetAllAsync(TestUserId);

        // Assert
        result.Should().HaveCount(2);
        result[0].Name.Should().Be("Savings");
        result[1].Name.Should().Be("Credit Card");
    }

    [Fact]
    public async Task GetAllAsync_WithIncludeArchived_ShouldPassFlagToRepository()
    {
        // Arrange
        var accounts = new List<Account>
        {
            new() { Id = "1", UserId = TestUserId, Name = "Savings", Type = AccountType.Bank, Currency = "INR", IsArchived = true }
        };
        _accountRepositoryMock.Setup(x => x.GetByUserIdAsync(TestUserId, true))
            .ReturnsAsync(accounts);

        // Act
        var result = await _accountService.GetAllAsync(TestUserId, includeArchived: true);

        // Assert
        result.Should().HaveCount(1);
        _accountRepositoryMock.Verify(x => x.GetByUserIdAsync(TestUserId, true), Times.Once);
    }

    [Fact]
    public async Task GetAllAsync_WithNoAccounts_ShouldReturnEmptyList()
    {
        // Arrange
        _accountRepositoryMock.Setup(x => x.GetByUserIdAsync(TestUserId, false))
            .ReturnsAsync(new List<Account>());

        // Act
        var result = await _accountService.GetAllAsync(TestUserId);

        // Assert
        result.Should().BeEmpty();
    }

    #endregion

    #region GetByIdAsync Tests

    [Fact]
    public async Task GetByIdAsync_WithValidId_ShouldReturnAccount()
    {
        // Arrange
        var account = new Account
        {
            Id = "1",
            UserId = TestUserId,
            Name = "Savings",
            Type = AccountType.Bank,
            Currency = "INR",
            CurrentBalance = 5000
        };
        _accountRepositoryMock.Setup(x => x.GetByIdAndUserIdAsync("1", TestUserId))
            .ReturnsAsync(account);

        // Act
        var result = await _accountService.GetByIdAsync("1", TestUserId);

        // Assert
        result.Should().NotBeNull();
        result!.Name.Should().Be("Savings");
        result.CurrentBalance.Should().Be(5000);
    }

    [Fact]
    public async Task GetByIdAsync_WithInvalidId_ShouldReturnNull()
    {
        // Arrange
        _accountRepositoryMock.Setup(x => x.GetByIdAndUserIdAsync("invalid", TestUserId))
            .ReturnsAsync((Account?)null);

        // Act
        var result = await _accountService.GetByIdAsync("invalid", TestUserId);

        // Assert
        result.Should().BeNull();
    }

    #endregion

    #region GetSummaryAsync Tests

    [Fact]
    public async Task GetSummaryAsync_ShouldCalculateNetWorthCorrectly()
    {
        // Arrange
        var accounts = new List<Account>
        {
            new() { Id = "1", UserId = TestUserId, Name = "Savings", Type = AccountType.Bank, Currency = "INR", CurrentBalance = 50000, IncludeInNetWorth = true },
            new() { Id = "2", UserId = TestUserId, Name = "Cash", Type = AccountType.Cash, Currency = "INR", CurrentBalance = 5000, IncludeInNetWorth = true },
            new() { Id = "3", UserId = TestUserId, Name = "Credit Card", Type = AccountType.CreditCard, Currency = "INR", CurrentBalance = 10000, IncludeInNetWorth = true }
        };
        _accountRepositoryMock.Setup(x => x.GetByUserIdAsync(TestUserId, false))
            .ReturnsAsync(accounts);

        // Act
        var result = await _accountService.GetSummaryAsync(TestUserId);

        // Assert
        result.TotalAssets.Should().Be(55000); // Bank + Cash
        result.TotalLiabilities.Should().Be(10000); // Credit Card (abs value)
        result.NetWorth.Should().Be(45000); // Assets - Liabilities
    }

    [Fact]
    public async Task GetSummaryAsync_ShouldExcludeAccountsNotIncludedInNetWorth()
    {
        // Arrange
        var accounts = new List<Account>
        {
            new() { Id = "1", UserId = TestUserId, Name = "Savings", Type = AccountType.Bank, Currency = "INR", CurrentBalance = 50000, IncludeInNetWorth = true },
            new() { Id = "2", UserId = TestUserId, Name = "Emergency Fund", Type = AccountType.Bank, Currency = "INR", CurrentBalance = 20000, IncludeInNetWorth = false }
        };
        _accountRepositoryMock.Setup(x => x.GetByUserIdAsync(TestUserId, false))
            .ReturnsAsync(accounts);

        // Act
        var result = await _accountService.GetSummaryAsync(TestUserId);

        // Assert
        result.TotalAssets.Should().Be(50000); // Only includes first account
        result.NetWorth.Should().Be(50000);
    }

    [Fact]
    public async Task GetSummaryAsync_ShouldCalculateBalancesByType()
    {
        // Arrange
        var accounts = new List<Account>
        {
            new() { Id = "1", UserId = TestUserId, Name = "Savings 1", Type = AccountType.Bank, Currency = "INR", CurrentBalance = 30000, IncludeInNetWorth = true },
            new() { Id = "2", UserId = TestUserId, Name = "Savings 2", Type = AccountType.Bank, Currency = "INR", CurrentBalance = 20000, IncludeInNetWorth = true },
            new() { Id = "3", UserId = TestUserId, Name = "Wallet", Type = AccountType.Cash, Currency = "INR", CurrentBalance = 5000, IncludeInNetWorth = true }
        };
        _accountRepositoryMock.Setup(x => x.GetByUserIdAsync(TestUserId, false))
            .ReturnsAsync(accounts);

        // Act
        var result = await _accountService.GetSummaryAsync(TestUserId);

        // Assert
        result.BalancesByType.Should().ContainKey("Bank");
        result.BalancesByType["Bank"].Should().Be(50000);
        result.BalancesByType.Should().ContainKey("Cash");
        result.BalancesByType["Cash"].Should().Be(5000);
    }

    [Fact]
    public async Task GetSummaryAsync_WithLoanAccount_ShouldTreatAsLiability()
    {
        // Arrange
        var accounts = new List<Account>
        {
            new() { Id = "1", UserId = TestUserId, Name = "Savings", Type = AccountType.Bank, Currency = "INR", CurrentBalance = 100000, IncludeInNetWorth = true },
            new() { Id = "2", UserId = TestUserId, Name = "Home Loan", Type = AccountType.Loan, Currency = "INR", CurrentBalance = 500000, IncludeInNetWorth = true }
        };
        _accountRepositoryMock.Setup(x => x.GetByUserIdAsync(TestUserId, false))
            .ReturnsAsync(accounts);

        // Act
        var result = await _accountService.GetSummaryAsync(TestUserId);

        // Assert
        result.TotalAssets.Should().Be(100000);
        result.TotalLiabilities.Should().Be(500000);
        result.NetWorth.Should().Be(-400000); // Negative net worth
    }

    [Fact]
    public async Task GetSummaryAsync_WithDigitalWalletAndInvestment_ShouldTreatAsAssets()
    {
        // Arrange
        var accounts = new List<Account>
        {
            new() { Id = "1", UserId = TestUserId, Name = "PayTM", Type = AccountType.DigitalWallet, Currency = "INR", CurrentBalance = 2000, IncludeInNetWorth = true },
            new() { Id = "2", UserId = TestUserId, Name = "Stocks", Type = AccountType.Investment, Currency = "INR", CurrentBalance = 100000, IncludeInNetWorth = true }
        };
        _accountRepositoryMock.Setup(x => x.GetByUserIdAsync(TestUserId, false))
            .ReturnsAsync(accounts);

        // Act
        var result = await _accountService.GetSummaryAsync(TestUserId);

        // Assert
        result.TotalAssets.Should().Be(102000);
        result.TotalLiabilities.Should().Be(0);
        result.NetWorth.Should().Be(102000);
    }

    #endregion

    #region CreateAsync Tests

    [Fact]
    public async Task CreateAsync_WithValidRequest_ShouldCreateAccount()
    {
        // Arrange
        var request = new CreateAccountRequest(
            Name: "New Savings",
            Type: "Bank",
            Icon: "🏦",
            Color: "#3B82F6",
            Currency: "INR",
            InitialBalance: 10000,
            Institution: "HDFC Bank",
            AccountNumber: "XXXX1234",
            Notes: "Primary savings",
            IncludeInNetWorth: true
        );

        _accountRepositoryMock.Setup(x => x.GetCountByUserIdAsync(TestUserId))
            .ReturnsAsync(0);
        _accountRepositoryMock.Setup(x => x.CreateAsync(It.IsAny<Account>()))
            .ReturnsAsync((Account a) => a);

        // Act
        var result = await _accountService.CreateAsync(TestUserId, request);

        // Assert
        result.Success.Should().BeTrue();
        result.Account.Should().NotBeNull();
        result.Account!.Name.Should().Be("New Savings");
        result.Account.Type.Should().Be("Bank");
        result.Account.CurrentBalance.Should().Be(10000);
        _accountRepositoryMock.Verify(x => x.CreateAsync(It.IsAny<Account>()), Times.Once);
    }

    [Fact]
    public async Task CreateAsync_WithEmptyName_ShouldReturnError()
    {
        // Arrange
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

        // Act
        var result = await _accountService.CreateAsync(TestUserId, request);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().Contain("name is required");
        result.Account.Should().BeNull();
    }

    [Fact]
    public async Task CreateAsync_WithInvalidType_ShouldReturnError()
    {
        // Arrange
        var request = new CreateAccountRequest(
            Name: "Test Account",
            Type: "InvalidType",
            Icon: null,
            Color: null,
            Currency: null,
            InitialBalance: null,
            Institution: null,
            AccountNumber: null,
            Notes: null,
            IncludeInNetWorth: null
        );

        // Act
        var result = await _accountService.CreateAsync(TestUserId, request);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().Contain("Invalid account type");
    }

    [Fact]
    public async Task CreateAsync_WithDefaultValues_ShouldSetDefaults()
    {
        // Arrange
        var request = new CreateAccountRequest(
            Name: "Test Account",
            Type: "Cash",
            Icon: null,
            Color: null,
            Currency: null,
            InitialBalance: null,
            Institution: null,
            AccountNumber: null,
            Notes: null,
            IncludeInNetWorth: null
        );

        _accountRepositoryMock.Setup(x => x.GetCountByUserIdAsync(TestUserId))
            .ReturnsAsync(5);
        _accountRepositoryMock.Setup(x => x.CreateAsync(It.IsAny<Account>()))
            .ReturnsAsync((Account a) => a);

        // Act
        var result = await _accountService.CreateAsync(TestUserId, request);

        // Assert
        result.Success.Should().BeTrue();
        result.Account!.Currency.Should().Be("INR");
        result.Account.InitialBalance.Should().Be(0);
        result.Account.CurrentBalance.Should().Be(0);
        result.Account.IncludeInNetWorth.Should().BeTrue();
        result.Account.Order.Should().Be(5);
    }

    #endregion

    #region UpdateAsync Tests

    [Fact]
    public async Task UpdateAsync_WithValidRequest_ShouldUpdateAccount()
    {
        // Arrange
        var existingAccount = new Account
        {
            Id = "1",
            UserId = TestUserId,
            Name = "Old Name",
            Type = AccountType.Bank,
            Currency = "INR"
        };

        _accountRepositoryMock.Setup(x => x.GetByIdAndUserIdAsync("1", TestUserId))
            .ReturnsAsync(existingAccount);

        var request = new UpdateAccountRequest(
            Name: "New Name",
            Icon: "🏦",
            Color: "#10B981",
            Currency: null,
            Institution: "Updated Bank",
            AccountNumber: null,
            Notes: null,
            IsArchived: null,
            IncludeInNetWorth: null,
            Order: null
        );

        // Act
        var result = await _accountService.UpdateAsync("1", TestUserId, request);

        // Assert
        result.Success.Should().BeTrue();
        result.Account!.Name.Should().Be("New Name");
        result.Account.Icon.Should().Be("🏦");
        result.Account.Institution.Should().Be("Updated Bank");
        _accountRepositoryMock.Verify(x => x.UpdateAsync(It.IsAny<Account>()), Times.Once);
    }

    [Fact]
    public async Task UpdateAsync_WithNonExistentAccount_ShouldReturnError()
    {
        // Arrange
        _accountRepositoryMock.Setup(x => x.GetByIdAndUserIdAsync("invalid", TestUserId))
            .ReturnsAsync((Account?)null);

        var request = new UpdateAccountRequest(
            Name: "New Name",
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

        // Act
        var result = await _accountService.UpdateAsync("invalid", TestUserId, request);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().Contain("not found");
    }

    [Fact]
    public async Task UpdateAsync_WithEmptyName_ShouldReturnError()
    {
        // Arrange
        var existingAccount = new Account
        {
            Id = "1",
            UserId = TestUserId,
            Name = "Existing",
            Type = AccountType.Bank,
            Currency = "INR"
        };

        _accountRepositoryMock.Setup(x => x.GetByIdAndUserIdAsync("1", TestUserId))
            .ReturnsAsync(existingAccount);

        var request = new UpdateAccountRequest(
            Name: "   ",
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

        // Act
        var result = await _accountService.UpdateAsync("1", TestUserId, request);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().Contain("cannot be empty");
    }

    [Fact]
    public async Task UpdateAsync_ArchiveAccount_ShouldSetIsArchived()
    {
        // Arrange
        var existingAccount = new Account
        {
            Id = "1",
            UserId = TestUserId,
            Name = "Account",
            Type = AccountType.Bank,
            Currency = "INR",
            IsArchived = false
        };

        _accountRepositoryMock.Setup(x => x.GetByIdAndUserIdAsync("1", TestUserId))
            .ReturnsAsync(existingAccount);

        var request = new UpdateAccountRequest(
            Name: null,
            Icon: null,
            Color: null,
            Currency: null,
            Institution: null,
            AccountNumber: null,
            Notes: null,
            IsArchived: true,
            IncludeInNetWorth: null,
            Order: null
        );

        // Act
        var result = await _accountService.UpdateAsync("1", TestUserId, request);

        // Assert
        result.Success.Should().BeTrue();
        result.Account!.IsArchived.Should().BeTrue();
    }

    #endregion

    #region AdjustBalanceAsync Tests

    [Fact]
    public async Task AdjustBalanceAsync_WithValidRequest_ShouldCreateTransactionAndUpdateBalance()
    {
        // Arrange
        var existingAccount = new Account
        {
            Id = "1",
            UserId = TestUserId,
            Name = "Savings",
            Type = AccountType.Bank,
            Currency = "INR",
            CurrentBalance = 5000
        };

        _accountRepositoryMock.Setup(x => x.GetByIdAndUserIdAsync("1", TestUserId))
            .ReturnsAsync(existingAccount);
        _transactionRepositoryMock.Setup(x => x.CreateAsync(It.IsAny<Transaction>()))
            .ReturnsAsync((Transaction t) => t);

        var request = new AdjustBalanceRequest(NewBalance: 7500, Notes: "Adjustment note");

        // Act
        var result = await _accountService.AdjustBalanceAsync("1", TestUserId, request);

        // Assert
        result.Success.Should().BeTrue();
        existingAccount.CurrentBalance.Should().Be(7500);
        _accountRepositoryMock.Verify(x => x.UpdateAsync(existingAccount), Times.Once);
        
        // Verify transaction was created with correct values
        _transactionRepositoryMock.Verify(x => x.CreateAsync(It.Is<Transaction>(t =>
            t.UserId == TestUserId &&
            t.AccountId == "1" &&
            t.Type == TransactionType.Receive && // Positive adjustment = Credit
            t.Amount == 2500 && // Difference: 7500 - 5000
            t.Currency == "INR" &&
            t.Title == "Balance Adjustment" &&
            t.Splits != null &&
            t.Splits.Count == 1 &&
            t.Splits[0].LabelId == "adjustment-category-id" &&
            t.Splits[0].Amount == 2500
        )), Times.Once);
        
        // Verify label service was called to get the adjustment category
        _labelServiceMock.Verify(x => x.GetOrCreateAdjustmentsCategoryAsync(TestUserId), Times.Once);
    }

    [Fact]
    public async Task AdjustBalanceAsync_WithNegativeAdjustment_ShouldCreateDebitTransaction()
    {
        // Arrange
        var existingAccount = new Account
        {
            Id = "1",
            UserId = TestUserId,
            Name = "Savings",
            Type = AccountType.Bank,
            Currency = "INR",
            CurrentBalance = 5000
        };

        _accountRepositoryMock.Setup(x => x.GetByIdAndUserIdAsync("1", TestUserId))
            .ReturnsAsync(existingAccount);
        _transactionRepositoryMock.Setup(x => x.CreateAsync(It.IsAny<Transaction>()))
            .ReturnsAsync((Transaction t) => t);

        var request = new AdjustBalanceRequest(NewBalance: 3000, Notes: null);

        // Act
        var result = await _accountService.AdjustBalanceAsync("1", TestUserId, request);

        // Assert
        result.Success.Should().BeTrue();
        existingAccount.CurrentBalance.Should().Be(3000);
        
        // Verify transaction was created as Debit for negative adjustment with category
        _transactionRepositoryMock.Verify(x => x.CreateAsync(It.Is<Transaction>(t =>
            t.Type == TransactionType.Send &&
            t.Amount == 2000 && // Abs difference: |3000 - 5000|
            t.Splits != null &&
            t.Splits.Count == 1 &&
            t.Splits[0].LabelId == "adjustment-category-id"
        )), Times.Once);
    }

    [Fact]
    public async Task AdjustBalanceAsync_WithNoChange_ShouldNotCreateTransaction()
    {
        // Arrange
        var existingAccount = new Account
        {
            Id = "1",
            UserId = TestUserId,
            Name = "Savings",
            Type = AccountType.Bank,
            Currency = "INR",
            CurrentBalance = 5000
        };

        _accountRepositoryMock.Setup(x => x.GetByIdAndUserIdAsync("1", TestUserId))
            .ReturnsAsync(existingAccount);

        var request = new AdjustBalanceRequest(NewBalance: 5000, Notes: null);

        // Act
        var result = await _accountService.AdjustBalanceAsync("1", TestUserId, request);

        // Assert
        result.Success.Should().BeTrue();
        result.Message.Should().Contain("already");
        _transactionRepositoryMock.Verify(x => x.CreateAsync(It.IsAny<Transaction>()), Times.Never);
        _accountRepositoryMock.Verify(x => x.UpdateAsync(It.IsAny<Account>()), Times.Never);
    }

    [Fact]
    public async Task AdjustBalanceAsync_WithNonExistentAccount_ShouldReturnError()
    {
        // Arrange
        _accountRepositoryMock.Setup(x => x.GetByIdAndUserIdAsync("invalid", TestUserId))
            .ReturnsAsync((Account?)null);

        var request = new AdjustBalanceRequest(NewBalance: 1000, Notes: null);

        // Act
        var result = await _accountService.AdjustBalanceAsync("invalid", TestUserId, request);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().Contain("not found");
    }

    #endregion

    #region ReorderAsync Tests

    [Fact]
    public async Task ReorderAsync_WithValidRequest_ShouldReorderAccounts()
    {
        // Arrange
        var accounts = new Dictionary<string, Account>
        {
            ["1"] = new() { Id = "1", UserId = TestUserId, Name = "Account 1", Type = AccountType.Bank, Currency = "INR", Order = 0 },
            ["2"] = new() { Id = "2", UserId = TestUserId, Name = "Account 2", Type = AccountType.Bank, Currency = "INR", Order = 1 },
            ["3"] = new() { Id = "3", UserId = TestUserId, Name = "Account 3", Type = AccountType.Bank, Currency = "INR", Order = 2 }
        };

        _accountRepositoryMock.Setup(x => x.GetByIdAndUserIdAsync(It.IsAny<string>(), TestUserId))
            .ReturnsAsync((string id, string _) => accounts.GetValueOrDefault(id));

        var request = new ReorderAccountsRequest(new List<AccountOrderItem>
        {
            new("1", 2),
            new("2", 0),
            new("3", 1)
        });

        // Act
        var result = await _accountService.ReorderAsync(TestUserId, request);

        // Assert
        result.Success.Should().BeTrue();
        accounts["1"].Order.Should().Be(2);
        accounts["2"].Order.Should().Be(0);
        accounts["3"].Order.Should().Be(1);
    }

    [Fact]
    public async Task ReorderAsync_WithNonExistentAccount_ShouldSkipAndContinue()
    {
        // Arrange
        var account = new Account { Id = "1", UserId = TestUserId, Name = "Account 1", Type = AccountType.Bank, Currency = "INR", Order = 0 };

        _accountRepositoryMock.Setup(x => x.GetByIdAndUserIdAsync("1", TestUserId))
            .ReturnsAsync(account);
        _accountRepositoryMock.Setup(x => x.GetByIdAndUserIdAsync("invalid", TestUserId))
            .ReturnsAsync((Account?)null);

        var request = new ReorderAccountsRequest(new List<AccountOrderItem>
        {
            new("1", 1),
            new("invalid", 0)
        });

        // Act
        var result = await _accountService.ReorderAsync(TestUserId, request);

        // Assert
        result.Success.Should().BeTrue();
        account.Order.Should().Be(1);
    }

    #endregion

    #region DeleteAsync Tests

    [Fact]
    public async Task DeleteAsync_WithValidId_ShouldDeleteAccount()
    {
        // Arrange
        var account = new Account
        {
            Id = "1",
            UserId = TestUserId,
            Name = "To Delete",
            Type = AccountType.Bank,
            Currency = "INR"
        };

        _accountRepositoryMock.Setup(x => x.GetByIdAndUserIdAsync("1", TestUserId))
            .ReturnsAsync(account);
        _accountRepositoryMock.Setup(x => x.DeleteAsync("1", TestUserId))
            .ReturnsAsync(true);

        // Act
        var result = await _accountService.DeleteAsync("1", TestUserId);

        // Assert
        result.Success.Should().BeTrue();
        result.Message.Should().Contain("deleted successfully");
        _accountRepositoryMock.Verify(x => x.DeleteAsync("1", TestUserId), Times.Once);
    }

    [Fact]
    public async Task DeleteAsync_WithNonExistentAccount_ShouldReturnError()
    {
        // Arrange
        _accountRepositoryMock.Setup(x => x.GetByIdAndUserIdAsync("invalid", TestUserId))
            .ReturnsAsync((Account?)null);

        // Act
        var result = await _accountService.DeleteAsync("invalid", TestUserId);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().Contain("not found");
    }

    #endregion
}
