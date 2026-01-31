using DigiTransac.Api.Events;
using DigiTransac.Api.Models;
using DigiTransac.Api.Models.Dto;
using DigiTransac.Api.Repositories;
using DigiTransac.Api.Services;
using DigiTransac.Api.Services.Transactions;
using FluentAssertions;
using MediatR;
using Moq;

namespace DigiTransac.Tests.Services;

/// <summary>
/// Comprehensive tests for P2P (Peer-to-Peer) transaction functionality.
/// Tests cover:
/// - Creating P2P transactions with counterparty
/// - Syncing changes while transaction is pending
/// - Accepting/Rejecting P2P transactions
/// - Deleting P2P transactions with proper cascade behavior
/// - Getting counterparties list
/// </summary>
public class P2PTransactionServiceTests
{
    private readonly Mock<ITransactionRepository> _transactionRepositoryMock;
    private readonly Mock<IAccountRepository> _accountRepositoryMock;
    private readonly Mock<ILabelRepository> _labelRepositoryMock;
    private readonly Mock<ITagRepository> _tagRepositoryMock;
    private readonly Mock<IUserRepository> _userRepositoryMock;
    private readonly Mock<IAccountBalanceService> _accountBalanceServiceMock;
    private readonly Mock<ITransactionMapperService> _mapperServiceMock;
    private readonly Mock<IPublisher> _publisherMock;
    private readonly P2PTransactionService _p2pService;

    private const string SenderUserId = "sender-user-id";
    private const string ReceiverUserId = "receiver-user-id";
    private readonly byte[] _testDek = new byte[32];

    public P2PTransactionServiceTests()
    {
        _transactionRepositoryMock = new Mock<ITransactionRepository>();
        _accountRepositoryMock = new Mock<IAccountRepository>();
        _labelRepositoryMock = new Mock<ILabelRepository>();
        _tagRepositoryMock = new Mock<ITagRepository>();
        _userRepositoryMock = new Mock<IUserRepository>();
        _accountBalanceServiceMock = new Mock<IAccountBalanceService>();
        _mapperServiceMock = new Mock<ITransactionMapperService>();
        _publisherMock = new Mock<IPublisher>();

        // Setup mapper service defaults
        _mapperServiceMock.Setup(x => x.GetUserDekAsync(It.IsAny<string>()))
            .ReturnsAsync(_testDek);
        _mapperServiceMock.Setup(x => x.EncryptIfNotEmpty(It.IsAny<string>(), It.IsAny<byte[]>()))
            .Returns((string? text, byte[] dek) => text);

        // Setup default labels and tags
        _labelRepositoryMock.Setup(x => x.GetByUserIdAsync(It.IsAny<string>()))
            .ReturnsAsync(new List<Label>
            {
                new() { Id = "label-1", UserId = ReceiverUserId, Name = "P2P Transfer", Type = LabelType.Category }
            });
        _tagRepositoryMock.Setup(x => x.GetByUserIdAsync(It.IsAny<string>()))
            .ReturnsAsync(new List<Tag>());

        _p2pService = new P2PTransactionService(
            _transactionRepositoryMock.Object,
            _accountRepositoryMock.Object,
            _labelRepositoryMock.Object,
            _tagRepositoryMock.Object,
            _userRepositoryMock.Object,
            _accountBalanceServiceMock.Object,
            _mapperServiceMock.Object,
            _publisherMock.Object);
    }

    #region CreateP2PTransactionAsync Tests

    [Fact]
    public async Task CreateP2PTransactionAsync_ShouldCreatePendingTransactionForCounterparty()
    {
        // Arrange
        var transactionLinkId = Guid.NewGuid();
        var senderAccount = CreateTestAccount(SenderUserId, "Sender Savings");
        var counterparty = CreateTestUser(ReceiverUserId, "receiver@example.com", "Receiver");

        var request = new CreateTransactionRequest(
            AccountId: senderAccount.Id,
            Type: "Send",
            Amount: 500m,
            Date: DateTime.UtcNow,
            Title: "Dinner payment",
            Payee: null,
            Notes: "For last night's dinner",
            Splits: new List<TransactionSplitRequest> { new("label-1", 500m, null) },
            TagIds: null,
            Location: null,
            TransferToAccountId: null,
            RecurringRule: null,
            CounterpartyEmail: "receiver@example.com",
            CounterpartyAmount: null,
            Source: null
        );

        Transaction? capturedTransaction = null;
        _transactionRepositoryMock.Setup(x => x.CreateAsync(It.IsAny<Transaction>(), null))
            .Callback<Transaction, MongoDB.Driver.IClientSessionHandle?>((t, _) => capturedTransaction = t)
            .ReturnsAsync((Transaction t, MongoDB.Driver.IClientSessionHandle? _) => t);

        // Act
        var result = await _p2pService.CreateP2PTransactionAsync(
            SenderUserId, request, senderAccount, counterparty, transactionLinkId, _testDek);

        // Assert
        result.Success.Should().BeTrue();
        result.Transaction.Should().NotBeNull();

        capturedTransaction.Should().NotBeNull();
        capturedTransaction!.UserId.Should().Be(ReceiverUserId);
        capturedTransaction.AccountId.Should().BeNull(); // Pending - no account assigned yet
        capturedTransaction.Type.Should().Be(TransactionType.Receive); // Opposite of sender's Send
        capturedTransaction.Amount.Should().Be(500m);
        capturedTransaction.Status.Should().Be(TransactionStatus.Pending);
        capturedTransaction.TransactionLinkId.Should().Be(transactionLinkId);
        capturedTransaction.CounterpartyUserId.Should().Be(SenderUserId);
        capturedTransaction.Splits.Should().BeEmpty(); // Counterparty will add their own categories
        capturedTransaction.EncryptedNotes.Should().BeNull(); // Private - counterparty adds their own
    }

    [Fact]
    public async Task CreateP2PTransactionAsync_WhenSenderReceives_ShouldCreateSendForCounterparty()
    {
        // Arrange
        var transactionLinkId = Guid.NewGuid();
        var senderAccount = CreateTestAccount(SenderUserId, "Sender Savings");
        var counterparty = CreateTestUser(ReceiverUserId, "payer@example.com", "Payer");

        var request = new CreateTransactionRequest(
            AccountId: senderAccount.Id,
            Type: "Receive", // User A is receiving from B
            Amount: 1000m,
            Date: DateTime.UtcNow,
            Title: "Payment from Payer",
            Payee: null,
            Notes: null,
            Splits: new List<TransactionSplitRequest> { new("label-1", 1000m, null) },
            TagIds: null,
            Location: null,
            TransferToAccountId: null,
            RecurringRule: null,
            CounterpartyEmail: "payer@example.com",
            CounterpartyAmount: null,
            Source: null
        );

        Transaction? capturedTransaction = null;
        _transactionRepositoryMock.Setup(x => x.CreateAsync(It.IsAny<Transaction>(), null))
            .Callback<Transaction, MongoDB.Driver.IClientSessionHandle?>((t, _) => capturedTransaction = t)
            .ReturnsAsync((Transaction t, MongoDB.Driver.IClientSessionHandle? _) => t);

        // Act
        var result = await _p2pService.CreateP2PTransactionAsync(
            SenderUserId, request, senderAccount, counterparty, transactionLinkId, _testDek);

        // Assert
        result.Success.Should().BeTrue();
        capturedTransaction!.Type.Should().Be(TransactionType.Send); // Opposite of Receive
        capturedTransaction.Amount.Should().Be(1000m);
    }

    [Fact]
    public async Task CreateP2PTransactionAsync_WithCounterpartyAmount_ShouldUseDifferentAmount()
    {
        // Arrange - Sender sends USD, receiver records in INR
        var transactionLinkId = Guid.NewGuid();
        var senderAccount = CreateTestAccount(SenderUserId, "USD Account", "USD");
        var counterparty = CreateTestUser(ReceiverUserId, "receiver@example.com", "Receiver");

        var request = new CreateTransactionRequest(
            AccountId: senderAccount.Id,
            Type: "Send",
            Amount: 100m, // 100 USD
            Date: DateTime.UtcNow,
            Title: "International payment",
            Payee: null,
            Notes: null,
            Splits: new List<TransactionSplitRequest> { new("label-1", 100m, null) },
            TagIds: null,
            Location: null,
            TransferToAccountId: null,
            RecurringRule: null,
            CounterpartyEmail: "receiver@example.com",
            CounterpartyAmount: 8300m, // 8300 INR equivalent
            Source: null
        );

        Transaction? capturedTransaction = null;
        _transactionRepositoryMock.Setup(x => x.CreateAsync(It.IsAny<Transaction>(), null))
            .Callback<Transaction, MongoDB.Driver.IClientSessionHandle?>((t, _) => capturedTransaction = t)
            .ReturnsAsync((Transaction t, MongoDB.Driver.IClientSessionHandle? _) => t);

        // Act
        var result = await _p2pService.CreateP2PTransactionAsync(
            SenderUserId, request, senderAccount, counterparty, transactionLinkId, _testDek);

        // Assert
        result.Success.Should().BeTrue();
        capturedTransaction!.Amount.Should().Be(8300m); // Uses counterparty amount
    }

    [Fact]
    public async Task CreateP2PTransactionAsync_WithChatSource_ShouldSetSourceCorrectly()
    {
        // Arrange
        var transactionLinkId = Guid.NewGuid();
        var senderAccount = CreateTestAccount(SenderUserId, "Savings");
        var counterparty = CreateTestUser(ReceiverUserId, "receiver@example.com", "Receiver");

        var request = new CreateTransactionRequest(
            AccountId: senderAccount.Id,
            Type: "Send",
            Amount: 250m,
            Date: DateTime.UtcNow,
            Title: "Quick payment",
            Payee: null,
            Notes: null,
            Splits: new List<TransactionSplitRequest> { new("label-1", 250m, null) },
            TagIds: null,
            Location: null,
            TransferToAccountId: null,
            RecurringRule: null,
            CounterpartyEmail: "receiver@example.com",
            CounterpartyAmount: null,
            Source: "Chat" // Created via chat
        );

        Transaction? capturedTransaction = null;
        _transactionRepositoryMock.Setup(x => x.CreateAsync(It.IsAny<Transaction>(), null))
            .Callback<Transaction, MongoDB.Driver.IClientSessionHandle?>((t, _) => capturedTransaction = t)
            .ReturnsAsync((Transaction t, MongoDB.Driver.IClientSessionHandle? _) => t);

        // Act
        var result = await _p2pService.CreateP2PTransactionAsync(
            SenderUserId, request, senderAccount, counterparty, transactionLinkId, _testDek);

        // Assert
        result.Success.Should().BeTrue();
        capturedTransaction!.Source.Should().Be(TransactionSource.Chat);
    }

    #endregion

    #region SyncP2PTransactionAsync Tests

    [Fact]
    public async Task SyncP2PTransactionAsync_WhenCounterpartyPending_ShouldSyncChanges()
    {
        // Arrange
        var transactionLinkId = Guid.NewGuid();
        var senderTransaction = CreateTestTransaction(SenderUserId, TransactionType.Send, 500m);
        senderTransaction.TransactionLinkId = transactionLinkId;
        senderTransaction.CounterpartyUserId = ReceiverUserId;

        var receiverPendingTransaction = CreateTestTransaction(ReceiverUserId, TransactionType.Receive, 500m);
        receiverPendingTransaction.TransactionLinkId = transactionLinkId;
        receiverPendingTransaction.CounterpartyUserId = SenderUserId;
        receiverPendingTransaction.Status = TransactionStatus.Pending;
        receiverPendingTransaction.AccountId = null;

        _transactionRepositoryMock.Setup(x => x.GetLinkedP2PTransactionAsync(transactionLinkId, SenderUserId))
            .ReturnsAsync(receiverPendingTransaction);

        var updateRequest = new UpdateTransactionRequest(
            Type: null,
            Amount: 600m, // Changed amount
            Date: DateTime.UtcNow.AddDays(1), // Changed date
            Title: "Updated title", // Changed title
            Payee: null,
            Notes: null,
            Splits: null,
            TagIds: null,
            Location: null,
            Status: null,
            TransferToAccountId: null,
            AccountId: null
        );

        // Update sender transaction with new values
        senderTransaction.Amount = 600m;
        senderTransaction.Date = DateTime.UtcNow.AddDays(1);
        senderTransaction.Title = "Updated title";

        // Act
        await _p2pService.SyncP2PTransactionAsync(senderTransaction, updateRequest);

        // Assert
        receiverPendingTransaction.Amount.Should().Be(600m);
        receiverPendingTransaction.Title.Should().Be("Updated title");
        receiverPendingTransaction.LastSyncedAt.Should().NotBeNull();
        _transactionRepositoryMock.Verify(x => x.UpdateAsync(receiverPendingTransaction, null), Times.Once);
    }

    [Fact]
    public async Task SyncP2PTransactionAsync_WhenCounterpartyConfirmed_ShouldNotSync()
    {
        // Arrange
        var transactionLinkId = Guid.NewGuid();
        var senderTransaction = CreateTestTransaction(SenderUserId, TransactionType.Send, 500m);
        senderTransaction.TransactionLinkId = transactionLinkId;
        senderTransaction.CounterpartyUserId = ReceiverUserId;

        var receiverConfirmedTransaction = CreateTestTransaction(ReceiverUserId, TransactionType.Receive, 500m);
        receiverConfirmedTransaction.TransactionLinkId = transactionLinkId;
        receiverConfirmedTransaction.CounterpartyUserId = SenderUserId;
        receiverConfirmedTransaction.Status = TransactionStatus.Confirmed; // Already confirmed

        _transactionRepositoryMock.Setup(x => x.GetLinkedP2PTransactionAsync(transactionLinkId, SenderUserId))
            .ReturnsAsync(receiverConfirmedTransaction);

        var updateRequest = new UpdateTransactionRequest(
            Type: null,
            Amount: 999m, // Try to change amount
            Date: null,
            Title: null,
            Payee: null,
            Notes: null,
            Splits: null,
            TagIds: null,
            Location: null,
            Status: null,
            TransferToAccountId: null,
            AccountId: null
        );

        senderTransaction.Amount = 999m;

        // Act
        await _p2pService.SyncP2PTransactionAsync(senderTransaction, updateRequest);

        // Assert - No update should happen
        receiverConfirmedTransaction.Amount.Should().Be(500m); // Unchanged
        _transactionRepositoryMock.Verify(x => x.UpdateAsync(It.IsAny<Transaction>(), null), Times.Never);
    }

    [Fact]
    public async Task SyncP2PTransactionAsync_WhenNoLinkId_ShouldDoNothing()
    {
        // Arrange
        var senderTransaction = CreateTestTransaction(SenderUserId, TransactionType.Send, 500m);
        senderTransaction.TransactionLinkId = null; // No P2P link

        var updateRequest = new UpdateTransactionRequest(
            Type: null,
            Amount: 600m,
            Date: null,
            Title: null,
            Payee: null,
            Notes: null,
            Splits: null,
            TagIds: null,
            Location: null,
            Status: null,
            TransferToAccountId: null,
            AccountId: null
        );

        // Act
        await _p2pService.SyncP2PTransactionAsync(senderTransaction, updateRequest);

        // Assert
        _transactionRepositoryMock.Verify(x => x.GetLinkedP2PTransactionAsync(It.IsAny<Guid>(), It.IsAny<string>()), Times.Never);
    }

    [Fact]
    public async Task SyncP2PTransactionAsync_WhenTypeChanged_ShouldSyncOppositeType()
    {
        // Arrange
        var transactionLinkId = Guid.NewGuid();
        var senderTransaction = CreateTestTransaction(SenderUserId, TransactionType.Receive, 500m);
        senderTransaction.TransactionLinkId = transactionLinkId;
        senderTransaction.CounterpartyUserId = ReceiverUserId;

        var receiverPendingTransaction = CreateTestTransaction(ReceiverUserId, TransactionType.Send, 500m);
        receiverPendingTransaction.TransactionLinkId = transactionLinkId;
        receiverPendingTransaction.Status = TransactionStatus.Pending;

        _transactionRepositoryMock.Setup(x => x.GetLinkedP2PTransactionAsync(transactionLinkId, SenderUserId))
            .ReturnsAsync(receiverPendingTransaction);

        var updateRequest = new UpdateTransactionRequest(
            Type: "Send", // Changed from Receive to Send
            Amount: null,
            Date: null,
            Title: null,
            Payee: null,
            Notes: null,
            Splits: null,
            TagIds: null,
            Location: null,
            Status: null,
            TransferToAccountId: null,
            AccountId: null
        );

        senderTransaction.Type = TransactionType.Send;

        // Act
        await _p2pService.SyncP2PTransactionAsync(senderTransaction, updateRequest);

        // Assert
        receiverPendingTransaction.Type.Should().Be(TransactionType.Receive); // Opposite
    }

    #endregion

    #region DeleteP2PTransactionAsync Tests

    [Fact]
    public async Task DeleteP2PTransactionAsync_WhenCounterpartyPending_ShouldDeleteBoth()
    {
        // Arrange
        var transactionLinkId = Guid.NewGuid();
        var senderTransaction = CreateTestTransaction(SenderUserId, TransactionType.Send, 500m);
        senderTransaction.TransactionLinkId = transactionLinkId;
        senderTransaction.CounterpartyUserId = ReceiverUserId;

        var receiverPendingTransaction = CreateTestTransaction(ReceiverUserId, TransactionType.Receive, 500m);
        receiverPendingTransaction.Id = "receiver-tx-id";
        receiverPendingTransaction.TransactionLinkId = transactionLinkId;
        receiverPendingTransaction.Status = TransactionStatus.Pending;

        _transactionRepositoryMock.Setup(x => x.GetLinkedP2PTransactionAsync(transactionLinkId, SenderUserId))
            .ReturnsAsync(receiverPendingTransaction);
        _transactionRepositoryMock.Setup(x => x.DeleteByIdAsync("receiver-tx-id", null))
            .ReturnsAsync(true);

        // Act
        var result = await _p2pService.DeleteP2PTransactionAsync(SenderUserId, senderTransaction);

        // Assert
        result.Success.Should().BeTrue();
        _transactionRepositoryMock.Verify(x => x.DeleteByIdAsync("receiver-tx-id", null), Times.Once);
    }

    [Fact]
    public async Task DeleteP2PTransactionAsync_WhenCounterpartyConfirmed_ShouldNotDeleteCounterparty()
    {
        // Arrange
        var transactionLinkId = Guid.NewGuid();
        var senderTransaction = CreateTestTransaction(SenderUserId, TransactionType.Send, 500m);
        senderTransaction.TransactionLinkId = transactionLinkId;
        senderTransaction.CounterpartyUserId = ReceiverUserId;

        var receiverConfirmedTransaction = CreateTestTransaction(ReceiverUserId, TransactionType.Receive, 500m);
        receiverConfirmedTransaction.Id = "receiver-tx-id";
        receiverConfirmedTransaction.TransactionLinkId = transactionLinkId;
        receiverConfirmedTransaction.Status = TransactionStatus.Confirmed; // Already confirmed

        _transactionRepositoryMock.Setup(x => x.GetLinkedP2PTransactionAsync(transactionLinkId, SenderUserId))
            .ReturnsAsync(receiverConfirmedTransaction);

        // Act
        var result = await _p2pService.DeleteP2PTransactionAsync(SenderUserId, senderTransaction);

        // Assert
        result.Success.Should().BeTrue();
        _transactionRepositoryMock.Verify(x => x.DeleteByIdAsync(It.IsAny<string>(), null), Times.Never);
    }

    [Fact]
    public async Task DeleteP2PTransactionAsync_WhenNoLink_ShouldSucceedWithNoAction()
    {
        // Arrange
        var transaction = CreateTestTransaction(SenderUserId, TransactionType.Send, 500m);
        transaction.TransactionLinkId = null;
        transaction.CounterpartyUserId = null;

        // Act
        var result = await _p2pService.DeleteP2PTransactionAsync(SenderUserId, transaction);

        // Assert
        result.Success.Should().BeTrue();
        result.Message.Should().Contain("No P2P link");
    }

    #endregion

    #region AcceptP2PTransactionAsync Tests

    [Fact]
    public async Task AcceptP2PTransactionAsync_WithValidRequest_ShouldConfirmAndAssignAccount()
    {
        // Arrange
        var receiverTransaction = CreateTestTransaction(ReceiverUserId, TransactionType.Receive, 500m);
        receiverTransaction.Id = "pending-tx-id";
        receiverTransaction.Status = TransactionStatus.Pending;
        receiverTransaction.AccountId = null;
        receiverTransaction.CounterpartyUserId = SenderUserId;

        var receiverAccount = CreateTestAccount(ReceiverUserId, "Receiver Savings");

        _transactionRepositoryMock.Setup(x => x.GetByIdAndUserIdAsync("pending-tx-id", ReceiverUserId))
            .ReturnsAsync(receiverTransaction);
        _accountRepositoryMock.Setup(x => x.GetByIdAndUserIdAsync(receiverAccount.Id, ReceiverUserId))
            .ReturnsAsync(receiverAccount);
        _accountRepositoryMock.Setup(x => x.GetByUserIdAsync(ReceiverUserId, true))
            .ReturnsAsync(new List<Account> { receiverAccount });

        _userRepositoryMock.Setup(x => x.GetByIdsAsync(It.IsAny<IEnumerable<string>>()))
            .ReturnsAsync(new Dictionary<string, User>
            {
                [SenderUserId] = CreateTestUser(SenderUserId, "sender@example.com", "Sender")
            });

        _mapperServiceMock.Setup(x => x.MapToResponse(
            It.IsAny<Transaction>(),
            It.IsAny<byte[]?>(),
            It.IsAny<Dictionary<string, Account>>(),
            It.IsAny<Dictionary<string, Label>>(),
            It.IsAny<Dictionary<string, Tag>>(),
            It.IsAny<Dictionary<string, User>?>()))
            .Returns(CreateTestTransactionResponse("pending-tx-id", receiverAccount.Id, receiverAccount.Name));

        // Act
        var result = await _p2pService.AcceptP2PTransactionAsync("pending-tx-id", ReceiverUserId, receiverAccount.Id);

        // Assert
        result.Success.Should().BeTrue();
        result.Transaction.Should().NotBeNull();
        receiverTransaction.Status.Should().Be(TransactionStatus.Confirmed);
        receiverTransaction.AccountId.Should().Be(receiverAccount.Id);
        receiverTransaction.Currency.Should().Be(receiverAccount.Currency);
        
        _accountBalanceServiceMock.Verify(x => x.UpdateBalanceAsync(
            receiverAccount, TransactionType.Receive, 500m, true, null), Times.Once);
        
        _publisherMock.Verify(x => x.Publish(
            It.Is<P2PTransactionAcceptedEvent>(e =>
                e.TransactionId == "pending-tx-id" &&
                e.RecipientId == ReceiverUserId),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task AcceptP2PTransactionAsync_WhenNotPending_ShouldReturnError()
    {
        // Arrange
        var confirmedTransaction = CreateTestTransaction(ReceiverUserId, TransactionType.Receive, 500m);
        confirmedTransaction.Id = "confirmed-tx-id";
        confirmedTransaction.Status = TransactionStatus.Confirmed; // Already confirmed

        _transactionRepositoryMock.Setup(x => x.GetByIdAndUserIdAsync("confirmed-tx-id", ReceiverUserId))
            .ReturnsAsync(confirmedTransaction);

        // Act
        var result = await _p2pService.AcceptP2PTransactionAsync("confirmed-tx-id", ReceiverUserId, "any-account");

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().Contain("not pending");
    }

    [Fact]
    public async Task AcceptP2PTransactionAsync_WhenAccountNotFound_ShouldReturnError()
    {
        // Arrange
        var pendingTransaction = CreateTestTransaction(ReceiverUserId, TransactionType.Receive, 500m);
        pendingTransaction.Status = TransactionStatus.Pending;

        _transactionRepositoryMock.Setup(x => x.GetByIdAndUserIdAsync(It.IsAny<string>(), ReceiverUserId))
            .ReturnsAsync(pendingTransaction);
        _accountRepositoryMock.Setup(x => x.GetByIdAndUserIdAsync("invalid-account", ReceiverUserId))
            .ReturnsAsync((Account?)null);

        // Act
        var result = await _p2pService.AcceptP2PTransactionAsync("tx-id", ReceiverUserId, "invalid-account");

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().Contain("Account not found");
    }

    [Fact]
    public async Task AcceptP2PTransactionAsync_WhenAccountArchived_ShouldReturnError()
    {
        // Arrange
        var pendingTransaction = CreateTestTransaction(ReceiverUserId, TransactionType.Receive, 500m);
        pendingTransaction.Status = TransactionStatus.Pending;

        var archivedAccount = CreateTestAccount(ReceiverUserId, "Archived");
        archivedAccount.IsArchived = true;

        _transactionRepositoryMock.Setup(x => x.GetByIdAndUserIdAsync(It.IsAny<string>(), ReceiverUserId))
            .ReturnsAsync(pendingTransaction);
        _accountRepositoryMock.Setup(x => x.GetByIdAndUserIdAsync(archivedAccount.Id, ReceiverUserId))
            .ReturnsAsync(archivedAccount);

        // Act
        var result = await _p2pService.AcceptP2PTransactionAsync("tx-id", ReceiverUserId, archivedAccount.Id);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().Contain("archived");
    }

    [Fact]
    public async Task AcceptP2PTransactionAsync_ShouldAddDefaultSplitIfEmpty()
    {
        // Arrange
        var pendingTransaction = CreateTestTransaction(ReceiverUserId, TransactionType.Receive, 500m);
        pendingTransaction.Status = TransactionStatus.Pending;
        pendingTransaction.Splits = new List<TransactionSplit>(); // Empty splits

        var receiverAccount = CreateTestAccount(ReceiverUserId, "Savings");

        _transactionRepositoryMock.Setup(x => x.GetByIdAndUserIdAsync(It.IsAny<string>(), ReceiverUserId))
            .ReturnsAsync(pendingTransaction);
        _accountRepositoryMock.Setup(x => x.GetByIdAndUserIdAsync(receiverAccount.Id, ReceiverUserId))
            .ReturnsAsync(receiverAccount);
        _accountRepositoryMock.Setup(x => x.GetByUserIdAsync(ReceiverUserId, true))
            .ReturnsAsync(new List<Account> { receiverAccount });
        _userRepositoryMock.Setup(x => x.GetByIdsAsync(It.IsAny<IEnumerable<string>>()))
            .ReturnsAsync(new Dictionary<string, User>());

        _mapperServiceMock.Setup(x => x.MapToResponse(
            It.IsAny<Transaction>(),
            It.IsAny<byte[]?>(),
            It.IsAny<Dictionary<string, Account>>(),
            It.IsAny<Dictionary<string, Label>>(),
            It.IsAny<Dictionary<string, Tag>>(),
            It.IsAny<Dictionary<string, User>?>()))
            .Returns(CreateTestTransactionResponse());

        // Act
        await _p2pService.AcceptP2PTransactionAsync("tx-id", ReceiverUserId, receiverAccount.Id);

        // Assert
        pendingTransaction.Splits.Should().HaveCount(1);
        pendingTransaction.Splits[0].Amount.Should().Be(500m);
    }

    #endregion

    #region RejectP2PTransactionAsync Tests

    [Fact]
    public async Task RejectP2PTransactionAsync_WithValidRequest_ShouldSetStatusToDeclined()
    {
        // Arrange
        var pendingTransaction = CreateTestTransaction(ReceiverUserId, TransactionType.Receive, 500m);
        pendingTransaction.Id = "pending-tx-id";
        pendingTransaction.Status = TransactionStatus.Pending;
        pendingTransaction.CounterpartyUserId = SenderUserId;

        _transactionRepositoryMock.Setup(x => x.GetByIdAndUserIdAsync("pending-tx-id", ReceiverUserId))
            .ReturnsAsync(pendingTransaction);

        // Act
        var result = await _p2pService.RejectP2PTransactionAsync("pending-tx-id", ReceiverUserId, "Don't recognize this");

        // Assert
        result.Success.Should().BeTrue();
        pendingTransaction.Status.Should().Be(TransactionStatus.Declined);
        
        _transactionRepositoryMock.Verify(x => x.UpdateAsync(pendingTransaction, null), Times.Once);
        
        _publisherMock.Verify(x => x.Publish(
            It.Is<P2PTransactionRejectedEvent>(e =>
                e.TransactionId == "pending-tx-id" &&
                e.RecipientId == ReceiverUserId &&
                e.Reason == "Don't recognize this"),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task RejectP2PTransactionAsync_WhenNotPending_ShouldReturnError()
    {
        // Arrange
        var confirmedTransaction = CreateTestTransaction(ReceiverUserId, TransactionType.Receive, 500m);
        confirmedTransaction.Status = TransactionStatus.Confirmed;

        _transactionRepositoryMock.Setup(x => x.GetByIdAndUserIdAsync(It.IsAny<string>(), ReceiverUserId))
            .ReturnsAsync(confirmedTransaction);

        // Act
        var result = await _p2pService.RejectP2PTransactionAsync("tx-id", ReceiverUserId, null);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().Contain("not pending");
    }

    [Fact]
    public async Task RejectP2PTransactionAsync_WhenNotFound_ShouldReturnError()
    {
        // Arrange
        _transactionRepositoryMock.Setup(x => x.GetByIdAndUserIdAsync("invalid-id", ReceiverUserId))
            .ReturnsAsync((Transaction?)null);

        // Act
        var result = await _p2pService.RejectP2PTransactionAsync("invalid-id", ReceiverUserId, null);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().Contain("not found");
    }

    [Fact]
    public async Task RejectP2PTransactionAsync_WithReason_ShouldStoreInNotes()
    {
        // Arrange
        var pendingTransaction = CreateTestTransaction(ReceiverUserId, TransactionType.Receive, 500m);
        pendingTransaction.Status = TransactionStatus.Pending;
        pendingTransaction.CounterpartyUserId = SenderUserId;

        _transactionRepositoryMock.Setup(x => x.GetByIdAndUserIdAsync(It.IsAny<string>(), ReceiverUserId))
            .ReturnsAsync(pendingTransaction);
        _mapperServiceMock.Setup(x => x.EncryptIfNotEmpty(It.IsAny<string>(), It.IsAny<byte[]>()))
            .Returns((string text, byte[] _) => $"encrypted:{text}");

        // Act
        await _p2pService.RejectP2PTransactionAsync("tx-id", ReceiverUserId, "Wrong amount");

        // Assert
        pendingTransaction.EncryptedNotes.Should().Contain("Wrong amount");
    }

    #endregion

    #region GetCounterpartiesAsync Tests

    [Fact]
    public async Task GetCounterpartiesAsync_ShouldReturnAllUniqueCounterparties()
    {
        // Arrange
        var p2pTransactions = new List<Transaction>
        {
            CreateP2PTransaction(SenderUserId, ReceiverUserId, TransactionType.Send, 100m),
            CreateP2PTransaction(SenderUserId, ReceiverUserId, TransactionType.Send, 200m),
            CreateP2PTransaction(SenderUserId, "another-user-id", TransactionType.Receive, 150m),
        };

        _transactionRepositoryMock.Setup(x => x.GetP2PTransactionsAsync(SenderUserId))
            .ReturnsAsync(p2pTransactions);

        var users = new Dictionary<string, User>
        {
            [ReceiverUserId] = CreateTestUser(ReceiverUserId, "receiver@example.com", "Receiver"),
            ["another-user-id"] = CreateTestUser("another-user-id", "another@example.com", "Another User")
        };
        _userRepositoryMock.Setup(x => x.GetByIdsAsync(It.IsAny<IEnumerable<string>>()))
            .ReturnsAsync(users);

        // Act
        var result = await _p2pService.GetCounterpartiesAsync(SenderUserId);

        // Assert
        result.Should().HaveCount(2);
        result.Should().Contain(c => c.UserId == ReceiverUserId && c.TransactionCount == 2);
        result.Should().Contain(c => c.UserId == "another-user-id" && c.TransactionCount == 1);
    }

    [Fact]
    public async Task GetCounterpartiesAsync_ShouldOrderByTransactionCountDescending()
    {
        // Arrange
        var p2pTransactions = new List<Transaction>
        {
            CreateP2PTransaction(SenderUserId, "user-a", TransactionType.Send, 100m),
            CreateP2PTransaction(SenderUserId, "user-b", TransactionType.Send, 200m),
            CreateP2PTransaction(SenderUserId, "user-b", TransactionType.Receive, 150m),
            CreateP2PTransaction(SenderUserId, "user-b", TransactionType.Send, 50m),
        };

        _transactionRepositoryMock.Setup(x => x.GetP2PTransactionsAsync(SenderUserId))
            .ReturnsAsync(p2pTransactions);

        var users = new Dictionary<string, User>
        {
            ["user-a"] = CreateTestUser("user-a", "a@example.com", "User A"),
            ["user-b"] = CreateTestUser("user-b", "b@example.com", "User B")
        };
        _userRepositoryMock.Setup(x => x.GetByIdsAsync(It.IsAny<IEnumerable<string>>()))
            .ReturnsAsync(users);

        // Act
        var result = await _p2pService.GetCounterpartiesAsync(SenderUserId);

        // Assert
        result[0].UserId.Should().Be("user-b"); // 3 transactions
        result[0].TransactionCount.Should().Be(3);
        result[1].UserId.Should().Be("user-a"); // 1 transaction
        result[1].TransactionCount.Should().Be(1);
    }

    [Fact]
    public async Task GetCounterpartiesAsync_WithNoP2PTransactions_ShouldReturnEmptyList()
    {
        // Arrange
        _transactionRepositoryMock.Setup(x => x.GetP2PTransactionsAsync(SenderUserId))
            .ReturnsAsync(new List<Transaction>());

        // Act
        var result = await _p2pService.GetCounterpartiesAsync(SenderUserId);

        // Assert
        result.Should().BeEmpty();
    }

    #endregion

    #region Helper Methods

    private static Account CreateTestAccount(string userId, string name, string currency = "INR")
    {
        return new Account
        {
            Id = $"account-{Guid.NewGuid():N}",
            UserId = userId,
            Name = name,
            Type = AccountType.Bank,
            Currency = currency,
            CurrentBalance = 10000m,
            IsArchived = false
        };
    }

    private static User CreateTestUser(string userId, string email, string fullName)
    {
        return new User
        {
            Id = userId,
            Email = email,
            FullName = fullName,
            PasswordHash = "hash",
            IsEmailVerified = true,
            WrappedDek = new byte[64]
        };
    }

    private static Transaction CreateTestTransaction(string userId, TransactionType type, decimal amount)
    {
        return new Transaction
        {
            Id = $"tx-{Guid.NewGuid():N}",
            UserId = userId,
            AccountId = $"account-{userId}",
            Type = type,
            Amount = amount,
            Currency = "INR",
            Date = DateTime.UtcNow,
            Status = TransactionStatus.Confirmed,
            Splits = new List<TransactionSplit>
            {
                new() { LabelId = "label-1", Amount = amount }
            },
            TagIds = new List<string>(),
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
    }

    private static Transaction CreateP2PTransaction(string userId, string counterpartyUserId, TransactionType type, decimal amount)
    {
        var tx = CreateTestTransaction(userId, type, amount);
        tx.CounterpartyUserId = counterpartyUserId;
        tx.TransactionLinkId = Guid.NewGuid();
        return tx;
    }

    private static TransactionResponse CreateTestTransactionResponse(
        string id = "test-id",
        string? accountId = "account-id",
        string? accountName = "Test Account")
    {
        return new TransactionResponse(
            Id: id,
            AccountId: accountId,
            AccountName: accountName,
            Type: "Receive",
            Amount: 500m,
            Currency: "INR",
            Date: DateTime.UtcNow,
            Title: null,
            Payee: null,
            Notes: null,
            Splits: new List<TransactionSplitResponse>(),
            TagIds: new List<string>(),
            Tags: new List<TagInfo>(),
            Location: null,
            TransferToAccountId: null,
            TransferToAccountName: null,
            LinkedTransactionId: null,
            RecurringRule: null,
            ParentTransactionId: null,
            IsRecurringTemplate: false,
            Status: "Confirmed",
            CreatedAt: DateTime.UtcNow,
            UpdatedAt: DateTime.UtcNow,
            TransactionLinkId: null,
            CounterpartyEmail: null,
            CounterpartyUserId: null,
            Role: null,
            LastSyncedAt: null,
            ChatMessageId: null,
            DateLocal: null,      // Timezone-aware date field
            DateTimezone: null    // Timezone-aware date field
        );
    }

    #endregion
}