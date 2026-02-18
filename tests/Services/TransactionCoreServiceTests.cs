using DigiTransac.Api.Common;
using DigiTransac.Api.Models;
using DigiTransac.Api.Models.Dto;
using DigiTransac.Api.Repositories;
using DigiTransac.Api.Services;
using DigiTransac.Api.Services.Transactions;
using DigiTransac.Api.Services.UnitOfWork;
using FluentAssertions;
using MediatR;
using Moq;

namespace DigiTransac.Tests.Services;

public class TransactionCoreServiceTests
{
    private readonly Mock<ITransactionRepository> _transactionRepoMock;
    private readonly Mock<IAccountRepository> _accountRepoMock;
    private readonly Mock<ILabelRepository> _labelRepoMock;
    private readonly Mock<ITagRepository> _tagRepoMock;
    private readonly Mock<IUserRepository> _userRepoMock;
    private readonly Mock<IChatMessageRepository> _chatMessageRepoMock;
    private readonly Mock<ITransferService> _transferServiceMock;
    private readonly Mock<IP2PTransactionService> _p2pServiceMock;
    private readonly Mock<IRecurringTransactionService> _recurringServiceMock;
    private readonly Mock<IAccountBalanceService> _accountBalanceServiceMock;
    private readonly Mock<ITransactionMapperService> _mapperServiceMock;
    private readonly Mock<IMongoDbService> _mongoDbServiceMock;
    private readonly Mock<IPublisher> _publisherMock;
    private readonly TransactionCoreService _sut;
    private const string UserId = "user-123";
    private const string AccountId = "account-1";
    private const string LabelId = "label-1";

    public TransactionCoreServiceTests()
    {
        _transactionRepoMock = new Mock<ITransactionRepository>();
        _accountRepoMock = new Mock<IAccountRepository>();
        _labelRepoMock = new Mock<ILabelRepository>();
        _tagRepoMock = new Mock<ITagRepository>();
        _userRepoMock = new Mock<IUserRepository>();
        _chatMessageRepoMock = new Mock<IChatMessageRepository>();
        _transferServiceMock = new Mock<ITransferService>();
        _p2pServiceMock = new Mock<IP2PTransactionService>();
        _recurringServiceMock = new Mock<IRecurringTransactionService>();
        _accountBalanceServiceMock = new Mock<IAccountBalanceService>();
        _mapperServiceMock = new Mock<ITransactionMapperService>();
        _mongoDbServiceMock = new Mock<IMongoDbService>();
        _publisherMock = new Mock<IPublisher>();

        // Default setups
        _labelRepoMock.Setup(x => x.GetByUserIdAsync(UserId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<Label> { new() { Id = LabelId, UserId = UserId, Name = "Food" } });
        _tagRepoMock.Setup(x => x.GetByUserIdAsync(UserId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<Tag>());
        _mapperServiceMock.Setup(x => x.GetUserDekAsync(UserId))
            .ReturnsAsync(new byte[] { 1, 2, 3 });

        _sut = new TransactionCoreService(
            _transactionRepoMock.Object,
            _accountRepoMock.Object,
            _labelRepoMock.Object,
            _tagRepoMock.Object,
            _userRepoMock.Object,
            _chatMessageRepoMock.Object,
            _transferServiceMock.Object,
            _p2pServiceMock.Object,
            _recurringServiceMock.Object,
            _accountBalanceServiceMock.Object,
            _mapperServiceMock.Object,
            _mongoDbServiceMock.Object,
            _publisherMock.Object);
    }

    private static CreateTransactionRequest ValidRequest(
        string accountId = AccountId,
        string type = "Send",
        decimal amount = 100m,
        List<TransactionSplitRequest>? splits = null,
        string? transferToAccountId = null,
        string? counterpartyEmail = null) =>
        new(accountId, type, amount, DateTime.UtcNow, "Lunch", "Cafe", null,
            splits ?? new List<TransactionSplitRequest> { new(LabelId, amount, null) },
            null, null, transferToAccountId, null, counterpartyEmail, null);

    // ========================================================================
    // CreateAsync — Validation Tests
    // ========================================================================

    [Fact]
    public async Task CreateAsync_AccountNotFound_ReturnsNotFoundError()
    {
        _accountRepoMock.Setup(x => x.GetByIdAndUserIdAsync(AccountId, UserId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((Account?)null);

        var result = await _sut.CreateAsync(UserId, ValidRequest());

        result.IsFailure.Should().BeTrue();
        result.Error.Code.Should().Be("NotFound");
    }

    [Fact]
    public async Task CreateAsync_InvalidType_ReturnsValidationError()
    {
        SetupValidAccount();

        var result = await _sut.CreateAsync(UserId, ValidRequest(type: "InvalidType"));

        result.IsFailure.Should().BeTrue();
        result.Error.Code.Should().Be("Validation");
    }

    [Fact]
    public async Task CreateAsync_ZeroAmount_ReturnsError()
    {
        SetupValidAccount();

        var request = ValidRequest(amount: 0,
            splits: new List<TransactionSplitRequest> { new(LabelId, 0, null) });

        var result = await _sut.CreateAsync(UserId, request);

        result.IsFailure.Should().BeTrue();
    }

    [Fact]
    public async Task CreateAsync_NegativeAmount_ReturnsError()
    {
        SetupValidAccount();

        var request = ValidRequest(amount: -50,
            splits: new List<TransactionSplitRequest> { new(LabelId, -50, null) });

        var result = await _sut.CreateAsync(UserId, request);

        result.IsFailure.Should().BeTrue();
    }

    [Fact]
    public async Task CreateAsync_EmptySplits_ReturnsError()
    {
        SetupValidAccount();

        var request = ValidRequest(
            splits: new List<TransactionSplitRequest>());

        var result = await _sut.CreateAsync(UserId, request);

        result.IsFailure.Should().BeTrue();
        result.Error.Message.Should().Contain("split");
    }

    [Fact]
    public async Task CreateAsync_SplitSumMismatch_ReturnsError()
    {
        SetupValidAccount();

        var request = ValidRequest(
            splits: new List<TransactionSplitRequest>
            {
                new(LabelId, 60, null),
                new(LabelId, 30, null)  // Sum = 90, not 100
            });

        var result = await _sut.CreateAsync(UserId, request);

        result.IsFailure.Should().BeTrue();
    }

    [Fact]
    public async Task CreateAsync_SplitWithZeroAmount_ReturnsError()
    {
        SetupValidAccount();

        var request = ValidRequest(
            splits: new List<TransactionSplitRequest> { new(LabelId, 0, null) });

        var result = await _sut.CreateAsync(UserId, request);

        result.IsFailure.Should().BeTrue();
    }

    [Fact]
    public async Task CreateAsync_InvalidLabelId_ReturnsError()
    {
        SetupValidAccount();

        var request = ValidRequest(
            splits: new List<TransactionSplitRequest> { new("nonexistent-label", 100, null) });

        var result = await _sut.CreateAsync(UserId, request);

        result.IsFailure.Should().BeTrue();
        result.Error.Code.Should().Be("NotFound");
    }

    [Fact]
    public async Task CreateAsync_NullDek_ReturnsError()
    {
        SetupValidAccount();
        _mapperServiceMock.Setup(x => x.GetUserDekAsync(UserId))
            .ReturnsAsync((byte[]?)null);

        var result = await _sut.CreateAsync(UserId, ValidRequest());

        result.IsFailure.Should().BeTrue();
        result.Error.Code.Should().Be("InternalError");
    }

    [Fact]
    public async Task CreateAsync_TransferAndP2P_ReturnsConflictError()
    {
        SetupValidAccount();

        var request = ValidRequest(
            transferToAccountId: "transfer-account-id",
            counterpartyEmail: "someone@example.com");

        var result = await _sut.CreateAsync(UserId, request);

        result.IsFailure.Should().BeTrue();
        result.Error.Code.Should().Be("Validation");
    }

    [Fact]
    public async Task CreateAsync_TransferWithNonSendType_ReturnsError()
    {
        SetupValidAccount();

        var request = ValidRequest(type: "Receive",
            transferToAccountId: "transfer-account-id");

        var result = await _sut.CreateAsync(UserId, request);

        result.IsFailure.Should().BeTrue();
    }

    [Fact]
    public async Task CreateAsync_TransferToSameAccount_ReturnsError()
    {
        SetupValidAccount();
        _accountRepoMock.Setup(x => x.GetByIdAndUserIdAsync(AccountId, UserId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Account { Id = AccountId, UserId = UserId, Name = "Checking", Currency = "INR" });

        var request = ValidRequest(transferToAccountId: AccountId);

        var result = await _sut.CreateAsync(UserId, request);

        result.IsFailure.Should().BeTrue();
    }

    [Fact]
    public async Task CreateAsync_P2PToSelf_ReturnsError()
    {
        SetupValidAccount();
        _userRepoMock.Setup(x => x.GetByEmailAsync("self@test.com"))
            .ReturnsAsync(new User { Id = UserId, Email = "self@test.com" });

        var request = ValidRequest(counterpartyEmail: "self@test.com");

        var result = await _sut.CreateAsync(UserId, request);

        result.IsFailure.Should().BeTrue();
        result.Error.Code.Should().Be("Validation");
    }

    // ========================================================================
    // Helper
    // ========================================================================

    private void SetupValidAccount()
    {
        _accountRepoMock.Setup(x => x.GetByIdAndUserIdAsync(AccountId, UserId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Account { Id = AccountId, UserId = UserId, Name = "Checking", Currency = "INR" });
    }
}
