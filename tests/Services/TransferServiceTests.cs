using DigiTransac.Api.Events;
using DigiTransac.Api.Models;
using DigiTransac.Api.Models.Dto;
using DigiTransac.Api.Repositories;
using DigiTransac.Api.Services;
using DigiTransac.Api.Services.Transactions;
using FluentAssertions;
using MediatR;
using MongoDB.Bson;
using MongoDB.Driver;
using Moq;
using Tag = DigiTransac.Api.Models.Tag;

namespace DigiTransac.Tests.Services;

public class TransferServiceTests
{
    private readonly Mock<ITransactionRepository> _transactionRepoMock;
    private readonly Mock<IAccountRepository> _accountRepoMock;
    private readonly Mock<ILabelRepository> _labelRepoMock;
    private readonly Mock<IChatMessageRepository> _chatMessageRepoMock;
    private readonly Mock<IExchangeRateService> _exchangeRateServiceMock;
    private readonly Mock<IAccountBalanceService> _accountBalanceServiceMock;
    private readonly Mock<ITransactionMapperService> _mapperServiceMock;
    private readonly Mock<IMongoDbService> _mongoDbServiceMock;
    private readonly Mock<IPublisher> _publisherMock;
    private readonly TransferService _sut;
    private const string UserId = "user-123";
    private const string SourceAccountId = "acc-src";
    private const string DestAccountId = "acc-dst";
    private const string LabelId = "label-1";
    private readonly byte[] _testDek = new byte[] { 1, 2, 3 };

    public TransferServiceTests()
    {
        _transactionRepoMock = new Mock<ITransactionRepository>();
        _accountRepoMock = new Mock<IAccountRepository>();
        _labelRepoMock = new Mock<ILabelRepository>();
        _chatMessageRepoMock = new Mock<IChatMessageRepository>();
        _exchangeRateServiceMock = new Mock<IExchangeRateService>();
        _accountBalanceServiceMock = new Mock<IAccountBalanceService>();
        _mapperServiceMock = new Mock<ITransactionMapperService>();
        _mongoDbServiceMock = new Mock<IMongoDbService>();
        _publisherMock = new Mock<IPublisher>();

        // Set up IMongoDbService.Client to support UnitOfWork
        var mockClient = new Mock<IMongoClient>();
        var mockSession = new Mock<IClientSessionHandle>();
        mockClient.Setup(x => x.StartSessionAsync(It.IsAny<ClientSessionOptions>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(mockSession.Object);
        _mongoDbServiceMock.Setup(x => x.Client).Returns(mockClient.Object);

        // Default setups
        _labelRepoMock.Setup(x => x.GetByUserIdAsync(UserId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<Label>
            {
                new() { Id = LabelId, Name = "Account Transfer", Type = LabelType.Category, UserId = UserId }
            });
        _mapperServiceMock.Setup(x => x.EncryptIfNotEmpty(It.IsAny<string?>(), It.IsAny<byte[]>()))
            .Returns((string? val, byte[] _) => val != null ? $"enc_{val}" : null);
        _accountRepoMock.Setup(x => x.GetByUserIdAsync(UserId, true, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<Account>
            {
                CreateAccount(SourceAccountId, "Savings", "INR"),
                CreateAccount(DestAccountId, "Checking", "INR")
            });

        _sut = new TransferService(
            _transactionRepoMock.Object,
            _accountRepoMock.Object,
            _labelRepoMock.Object,
            _chatMessageRepoMock.Object,
            _exchangeRateServiceMock.Object,
            _accountBalanceServiceMock.Object,
            _mapperServiceMock.Object,
            _mongoDbServiceMock.Object,
            _publisherMock.Object);
    }

    private static Account CreateAccount(string id, string name = "Account", string currency = "INR") => new()
    {
        Id = id,
        UserId = UserId,
        Name = name,
        Currency = currency,
        CurrentBalance = 10000m
    };

    private static CreateTransactionRequest CreateTransferRequest(
        decimal amount = 1000m,
        string? title = "Internal Transfer") =>
        new(SourceAccountId, "Transfer", amount, DateTime.UtcNow, title, null, null,
            new List<TransactionSplitRequest> { new(LabelId, amount, null) },
            null, null, DestAccountId, null, null, null);

    // ========================================================================
    // CreateTransferAsync
    // ========================================================================

    [Fact]
    public async Task CreateTransferAsync_SameCurrency_CreatesSourceAndDestination()
    {
        var request = CreateTransferRequest();
        var source = CreateAccount(SourceAccountId, "Savings");
        var dest = CreateAccount(DestAccountId, "Checking");

        SetupMapperForResponse();

        var result = await _sut.CreateTransferAsync(UserId, request, source, dest, _testDek);

        result.Success.Should().BeTrue();
        result.Message.Should().Contain("Transfer created successfully");

        // Two transactions created (source Send + dest Receive)
        _transactionRepoMock.Verify(x => x.CreateAsync(
            It.Is<Transaction>(t => t.Type == TransactionType.Send), It.IsAny<IClientSessionHandle?>(), It.IsAny<CancellationToken>()), Times.Once);
        _transactionRepoMock.Verify(x => x.CreateAsync(
            It.Is<Transaction>(t => t.Type == TransactionType.Receive), It.IsAny<IClientSessionHandle?>(), It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task CreateTransferAsync_SameCurrency_SameAmountBothSides()
    {
        var request = CreateTransferRequest(amount: 5000m);
        var source = CreateAccount(SourceAccountId, "Savings", "INR");
        var dest = CreateAccount(DestAccountId, "Checking", "INR");

        Transaction? sourceTxn = null;
        Transaction? destTxn = null;
        _transactionRepoMock.Setup(x => x.CreateAsync(It.IsAny<Transaction>(), It.IsAny<IClientSessionHandle?>(), It.IsAny<CancellationToken>()))
            .Callback<Transaction, IClientSessionHandle?, CancellationToken>((t, _, _2) =>
            {
                if (t.Type == TransactionType.Send) sourceTxn = t;
                else destTxn = t;
            })
            .ReturnsAsync((Transaction t, IClientSessionHandle? _, CancellationToken _2) => t);
        SetupMapperForResponse();

        await _sut.CreateTransferAsync(UserId, request, source, dest, _testDek);

        sourceTxn!.Amount.Should().Be(5000m);
        destTxn!.Amount.Should().Be(5000m); // Same currency = same amount
    }

    [Fact]
    public async Task CreateTransferAsync_DifferentCurrencies_ConvertsAmount()
    {
        var request = CreateTransferRequest(amount: 1000m);
        var source = CreateAccount(SourceAccountId, "Savings", "INR");
        var dest = CreateAccount(DestAccountId, "USD Account", "USD");

        var rates = new Dictionary<string, decimal> { { "INR", 83m }, { "USD", 1m } };
        _exchangeRateServiceMock.Setup(x => x.GetRatesAsync(It.IsAny<string?>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new ExchangeRateResponse("USD", rates, DateTime.UtcNow, "test"));
        _exchangeRateServiceMock.Setup(x => x.Convert(1000m, "INR", "USD", rates))
            .Returns(12.05m);

        Transaction? destTxn = null;
        _transactionRepoMock.Setup(x => x.CreateAsync(It.IsAny<Transaction>(), It.IsAny<IClientSessionHandle?>(), It.IsAny<CancellationToken>()))
            .Callback<Transaction, IClientSessionHandle?, CancellationToken>((t, _, _2) =>
            {
                if (t.Type == TransactionType.Receive) destTxn = t;
            })
            .ReturnsAsync((Transaction t, IClientSessionHandle? _, CancellationToken _2) => t);
        SetupMapperForResponse();

        await _sut.CreateTransferAsync(UserId, request, source, dest, _testDek);

        destTxn!.Amount.Should().Be(12.05m);
        destTxn.Currency.Should().Be("USD");
    }

    [Fact]
    public async Task CreateTransferAsync_UpdatesBalancesForBothAccounts()
    {
        var request = CreateTransferRequest(amount: 2000m);
        var source = CreateAccount(SourceAccountId, "Savings");
        var dest = CreateAccount(DestAccountId, "Checking");
        SetupMapperForResponse();

        await _sut.CreateTransferAsync(UserId, request, source, dest, _testDek);

        _accountBalanceServiceMock.Verify(x => x.UpdateBalanceAsync(
            It.Is<Account>(a => a.Id == SourceAccountId),
            TransactionType.Send, 2000m, true,
            It.IsAny<IClientSessionHandle?>()), Times.Once);

        _accountBalanceServiceMock.Verify(x => x.UpdateBalanceAsync(
            It.Is<Account>(a => a.Id == DestAccountId),
            TransactionType.Receive, 2000m, true,
            It.IsAny<IClientSessionHandle?>()), Times.Once);
    }

    [Fact]
    public async Task CreateTransferAsync_LinksBothTransactions()
    {
        var request = CreateTransferRequest();
        var source = CreateAccount(SourceAccountId, "Savings");
        var dest = CreateAccount(DestAccountId, "Checking");
        SetupMapperForResponse();

        // Simulate MongoDB assigning IDs on CreateAsync
        _transactionRepoMock.Setup(x => x.CreateAsync(It.IsAny<Transaction>(), It.IsAny<IClientSessionHandle?>(), It.IsAny<CancellationToken>()))
            .Callback<Transaction, IClientSessionHandle?, CancellationToken>((t, _, _2) =>
            {
                if (string.IsNullOrEmpty(t.Id))
                    t.Id = ObjectId.GenerateNewId().ToString();
            })
            .ReturnsAsync((Transaction t, IClientSessionHandle? _, CancellationToken _2) => t);

        // After creation, LinkedTransactionId should be set via UpdateAsync
        await _sut.CreateTransferAsync(UserId, request, source, dest, _testDek);

        // Source gets updated with linkedTransactionId pointing to dest (once inside UnitOfWork with session + once outside for ChatMessageId)
        _transactionRepoMock.Verify(x => x.UpdateAsync(
            It.Is<Transaction>(t => t.Type == TransactionType.Send && t.LinkedTransactionId != null),
            It.IsAny<IClientSessionHandle?>(),
            It.IsAny<CancellationToken>()), Times.AtLeastOnce);
    }

    [Fact]
    public async Task CreateTransferAsync_CreatesChatMessagesForBothSides()
    {
        var request = CreateTransferRequest();
        var source = CreateAccount(SourceAccountId, "Savings");
        var dest = CreateAccount(DestAccountId, "Checking");
        SetupMapperForResponse();

        await _sut.CreateTransferAsync(UserId, request, source, dest, _testDek);

        // Send chat message (user-initiated, not system generated)
        _chatMessageRepoMock.Verify(x => x.CreateAsync(
            It.Is<ChatMessage>(m =>
                m.Type == ChatMessageType.Transaction &&
                m.IsSystemGenerated == false &&
                m.SystemSource == SystemMessageSources.Transfer),
            It.IsAny<CancellationToken>()), Times.Once);

        // Receive chat message (system-generated)
        _chatMessageRepoMock.Verify(x => x.CreateAsync(
            It.Is<ChatMessage>(m =>
                m.Type == ChatMessageType.Transaction &&
                m.IsSystemGenerated == true &&
                m.SystemSource == SystemMessageSources.Transfer),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task CreateTransferAsync_PublishesTransferCompletedEvent()
    {
        var request = CreateTransferRequest();
        var source = CreateAccount(SourceAccountId, "Savings");
        var dest = CreateAccount(DestAccountId, "Checking");
        SetupMapperForResponse();

        await _sut.CreateTransferAsync(UserId, request, source, dest, _testDek);

        _publisherMock.Verify(x => x.Publish(
            It.IsAny<TransferCompletedEvent>(),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task CreateTransferAsync_SetsTransactionLinkId()
    {
        var request = CreateTransferRequest();
        var source = CreateAccount(SourceAccountId, "Savings");
        var dest = CreateAccount(DestAccountId, "Checking");

        Guid? sourceLinkId = null;
        Guid? destLinkId = null;
        _transactionRepoMock.Setup(x => x.CreateAsync(It.IsAny<Transaction>(), It.IsAny<IClientSessionHandle?>(), It.IsAny<CancellationToken>()))
            .Callback<Transaction, IClientSessionHandle?, CancellationToken>((t, _, _2) =>
            {
                if (t.Type == TransactionType.Send) sourceLinkId = t.TransactionLinkId;
                else destLinkId = t.TransactionLinkId;
            })
            .ReturnsAsync((Transaction t, IClientSessionHandle? _, CancellationToken _2) => t);
        SetupMapperForResponse();

        await _sut.CreateTransferAsync(UserId, request, source, dest, _testDek);

        sourceLinkId.Should().NotBeNull();
        destLinkId.Should().NotBeNull();
        sourceLinkId.Should().Be(destLinkId); // Both should share the same link ID
    }

    [Fact]
    public async Task CreateTransferAsync_UsesAccountTransferLabel()
    {
        var request = CreateTransferRequest();
        var source = CreateAccount(SourceAccountId, "Savings");
        var dest = CreateAccount(DestAccountId, "Checking");

        Transaction? sourceTxn = null;
        _transactionRepoMock.Setup(x => x.CreateAsync(It.IsAny<Transaction>(), It.IsAny<IClientSessionHandle?>(), It.IsAny<CancellationToken>()))
            .Callback<Transaction, IClientSessionHandle?, CancellationToken>((t, _, _2) =>
            {
                if (t.Type == TransactionType.Send) sourceTxn = t;
            })
            .ReturnsAsync((Transaction t, IClientSessionHandle? _, CancellationToken _2) => t);
        SetupMapperForResponse();

        await _sut.CreateTransferAsync(UserId, request, source, dest, _testDek);

        sourceTxn!.Splits.Should().HaveCount(1);
        sourceTxn.Splits[0].LabelId.Should().Be(LabelId);
    }

    // ========================================================================
    // SyncLinkedTransactionAsync
    // ========================================================================

    [Fact]
    public async Task SyncLinkedTransactionAsync_NoLinkedTransaction_ReturnsSuccess()
    {
        var transaction = new Transaction { Id = "txn-1", LinkedTransactionId = null };
        var request = new UpdateTransactionRequest(null, null, null, null, null, null, null, null, null, null, null, null);

        var result = await _sut.SyncLinkedTransactionAsync(transaction, request, UserId, _testDek);

        result.Success.Should().BeTrue();
        result.Message.Should().Contain("No linked transaction");
    }

    [Fact]
    public async Task SyncLinkedTransactionAsync_LinkedNotFound_ReturnsSuccess()
    {
        var transaction = new Transaction { Id = "txn-1", LinkedTransactionId = "txn-2" };
        var request = new UpdateTransactionRequest(null, null, null, null, null, null, null, null, null, null, null, null);
        _transactionRepoMock.Setup(x => x.GetByIdAndUserIdAsync("txn-2", UserId))
            .ReturnsAsync((Transaction?)null);

        var result = await _sut.SyncLinkedTransactionAsync(transaction, request, UserId, _testDek);

        result.Success.Should().BeTrue();
    }

    [Fact]
    public async Task SyncLinkedTransactionAsync_TitleChanged_SyncsTitle()
    {
        var transaction = new Transaction
        {
            Id = "txn-1", LinkedTransactionId = "txn-2",
            Title = "New Title", Type = TransactionType.Send, Currency = "INR", Amount = 100m
        };
        var linked = new Transaction
        {
            Id = "txn-2", LinkedTransactionId = "txn-1",
            Title = "Old Title", Type = TransactionType.Receive, Currency = "INR", Amount = 100m,
            Splits = new List<TransactionSplit>()
        };
        var request = new UpdateTransactionRequest(null, null, null, "New Title", null, null, null, null, null, null, null, null);

        _transactionRepoMock.Setup(x => x.GetByIdAndUserIdAsync("txn-2", UserId)).ReturnsAsync(linked);

        var result = await _sut.SyncLinkedTransactionAsync(transaction, request, UserId, _testDek);

        result.Success.Should().BeTrue();
        _transactionRepoMock.Verify(x => x.UpdateAsync(
            It.Is<Transaction>(t => t.Id == "txn-2" && t.Title == "New Title"),
            null,
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task SyncLinkedTransactionAsync_AmountChangedSameCurrency_SyncsAmount()
    {
        var transaction = new Transaction
        {
            Id = "txn-1", LinkedTransactionId = "txn-2",
            Amount = 200m, Type = TransactionType.Send, Currency = "INR",
            AccountId = SourceAccountId
        };
        var linked = new Transaction
        {
            Id = "txn-2", LinkedTransactionId = "txn-1",
            Amount = 100m, Type = TransactionType.Receive, Currency = "INR",
            AccountId = DestAccountId,
            Splits = new List<TransactionSplit> { new() { LabelId = LabelId, Amount = 100m } }
        };
        var request = new UpdateTransactionRequest(null, 200m, null, null, null, null, null, null, null, null, null, null);

        _transactionRepoMock.Setup(x => x.GetByIdAndUserIdAsync("txn-2", UserId)).ReturnsAsync(linked);
        _accountRepoMock.Setup(x => x.GetByIdAndUserIdAsync(DestAccountId, UserId))
            .ReturnsAsync(CreateAccount(DestAccountId, "Checking"));

        var result = await _sut.SyncLinkedTransactionAsync(transaction, request, UserId, _testDek);

        result.Success.Should().BeTrue();
        linked.Amount.Should().Be(200m);
    }

    [Fact]
    public async Task SyncLinkedTransactionAsync_AmountChangedDifferentCurrency_Converts()
    {
        var transaction = new Transaction
        {
            Id = "txn-1", LinkedTransactionId = "txn-2",
            Amount = 2000m, Type = TransactionType.Send, Currency = "INR",
            AccountId = SourceAccountId
        };
        var linked = new Transaction
        {
            Id = "txn-2", LinkedTransactionId = "txn-1",
            Amount = 12m, Type = TransactionType.Receive, Currency = "USD",
            AccountId = DestAccountId,
            Splits = new List<TransactionSplit> { new() { LabelId = LabelId, Amount = 12m } }
        };
        var request = new UpdateTransactionRequest(null, 2000m, null, null, null, null, null, null, null, null, null, null);

        _transactionRepoMock.Setup(x => x.GetByIdAndUserIdAsync("txn-2", UserId)).ReturnsAsync(linked);
        _accountRepoMock.Setup(x => x.GetByIdAndUserIdAsync(DestAccountId, UserId))
            .ReturnsAsync(CreateAccount(DestAccountId, "USD Account", "USD"));

        var rates = new Dictionary<string, decimal> { { "INR", 83m }, { "USD", 1m } };
        _exchangeRateServiceMock.Setup(x => x.GetRatesAsync(It.IsAny<string?>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new ExchangeRateResponse("USD", rates, DateTime.UtcNow, "test"));
        _exchangeRateServiceMock.Setup(x => x.Convert(2000m, "INR", "USD", rates)).Returns(24.10m);

        await _sut.SyncLinkedTransactionAsync(transaction, request, UserId, _testDek);

        linked.Amount.Should().Be(24.10m);
    }

    // ========================================================================
    // DeleteTransferAsync
    // ========================================================================

    [Fact]
    public async Task DeleteTransferAsync_NoLinkedTransaction_ReturnsSuccess()
    {
        var transaction = new Transaction { Id = "txn-1", LinkedTransactionId = null };

        var result = await _sut.DeleteTransferAsync(UserId, transaction);

        result.Success.Should().BeTrue();
        result.Message.Should().Contain("No linked transaction");
    }

    [Fact]
    public async Task DeleteTransferAsync_LinkedNotFound_ReturnsSuccess()
    {
        var transaction = new Transaction { Id = "txn-1", LinkedTransactionId = "txn-2" };
        _transactionRepoMock.Setup(x => x.GetByIdAndUserIdAsync("txn-2", UserId))
            .ReturnsAsync((Transaction?)null);

        var result = await _sut.DeleteTransferAsync(UserId, transaction);

        result.Success.Should().BeTrue();
    }

    [Fact]
    public async Task DeleteTransferAsync_WithLinked_DeletesLinkedAndReversesBalance()
    {
        var transaction = new Transaction { Id = "txn-1", LinkedTransactionId = "txn-2" };
        var linked = new Transaction
        {
            Id = "txn-2", AccountId = DestAccountId,
            Type = TransactionType.Receive, Amount = 1000m
        };

        _transactionRepoMock.Setup(x => x.GetByIdAndUserIdAsync("txn-2", UserId)).ReturnsAsync(linked);
        _accountRepoMock.Setup(x => x.GetByIdAndUserIdAsync(DestAccountId, UserId))
            .ReturnsAsync(CreateAccount(DestAccountId, "Checking"));

        var result = await _sut.DeleteTransferAsync(UserId, transaction);

        result.Success.Should().BeTrue();
        _accountBalanceServiceMock.Verify(x => x.UpdateBalanceAsync(
            It.Is<Account>(a => a.Id == DestAccountId),
            TransactionType.Receive, 1000m, false,
            It.IsAny<IClientSessionHandle?>()), Times.Once);
        _transactionRepoMock.Verify(x => x.SoftDeleteAsync("txn-2", UserId, It.IsAny<IClientSessionHandle?>()), Times.Once);
    }

    [Fact]
    public async Task DeleteTransferAsync_LinkedAccountNotFound_StillDeletes()
    {
        var transaction = new Transaction { Id = "txn-1", LinkedTransactionId = "txn-2" };
        var linked = new Transaction
        {
            Id = "txn-2", AccountId = "deleted-account",
            Type = TransactionType.Receive, Amount = 500m
        };

        _transactionRepoMock.Setup(x => x.GetByIdAndUserIdAsync("txn-2", UserId)).ReturnsAsync(linked);
        _accountRepoMock.Setup(x => x.GetByIdAndUserIdAsync("deleted-account", UserId))
            .ReturnsAsync((Account?)null);

        var result = await _sut.DeleteTransferAsync(UserId, transaction);

        result.Success.Should().BeTrue();
        // Should soft-delete without session since account not found
        _transactionRepoMock.Verify(x => x.SoftDeleteAsync("txn-2", UserId, null), Times.Once);
    }

    // ========================================================================
    // Helpers
    // ========================================================================

    private void SetupMapperForResponse()
    {
        _mapperServiceMock.Setup(x => x.MapToResponse(
                It.IsAny<Transaction>(), It.IsAny<byte[]?>(),
                It.IsAny<Dictionary<string, Account>>(), It.IsAny<Dictionary<string, Label>>(),
                It.IsAny<Dictionary<string, DigiTransac.Api.Models.Tag>>(), It.IsAny<Dictionary<string, User>?>()))
            .Returns(new TransactionResponse(
                "txn-1", SourceAccountId, "Savings", "Send", 1000m, "INR",
                DateTime.UtcNow, "Transfer", null, null,
                new List<TransactionSplitResponse>(), new List<string>(), new List<TagInfo>(),
                null, DestAccountId, "Checking", null, null, null, false, "Confirmed",
                DateTime.UtcNow, DateTime.UtcNow, null, null, null, null, null, null, false, null));
    }
}
