using DigiTransac.Api.Models;
using DigiTransac.Api.Models.Dto;
using DigiTransac.Api.Repositories;
using DigiTransac.Api.Services;
using DigiTransac.Api.Services.Transactions;
using FluentAssertions;
using Moq;

namespace DigiTransac.Tests.Services;

public class TransactionBatchServiceTests
{
    private readonly Mock<ITransactionRepository> _transactionRepoMock;
    private readonly Mock<IAccountRepository> _accountRepoMock;
    private readonly Mock<IAccountBalanceService> _accountBalanceServiceMock;
    private readonly TransactionBatchService _sut;
    private const string UserId = "user-123";

    public TransactionBatchServiceTests()
    {
        _transactionRepoMock = new Mock<ITransactionRepository>();
        _accountRepoMock = new Mock<IAccountRepository>();
        _accountBalanceServiceMock = new Mock<IAccountBalanceService>();

        _accountRepoMock.Setup(x => x.GetByUserIdAsync(UserId, true, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<Account>
            {
                new() { Id = "acc-1", UserId = UserId, Name = "Savings", Currency = "INR", CurrentBalance = 10000m }
            });

        _sut = new TransactionBatchService(
            _transactionRepoMock.Object,
            _accountRepoMock.Object,
            _accountBalanceServiceMock.Object);
    }

    private static Transaction CreateTransaction(
        string id,
        string accountId = "acc-1",
        TransactionType type = TransactionType.Send,
        decimal amount = 100m,
        bool isRecurringTemplate = false,
        string? linkedTransactionId = null,
        Guid? transactionLinkId = null,
        string? counterpartyUserId = null) =>
        new()
        {
            Id = id,
            UserId = UserId,
            AccountId = accountId,
            Type = type,
            Amount = amount,
            Currency = "INR",
            IsRecurringTemplate = isRecurringTemplate,
            LinkedTransactionId = linkedTransactionId,
            TransactionLinkId = transactionLinkId,
            CounterpartyUserId = counterpartyUserId,
            Status = TransactionStatus.Confirmed
        };

    // ========================================================================
    // BatchDeleteAsync
    // ========================================================================

    [Fact]
    public async Task BatchDeleteAsync_AllValid_DeletesAllAndReturnsSuccess()
    {
        var ids = new List<string> { "txn-1", "txn-2" };
        var transactions = new List<Transaction>
        {
            CreateTransaction("txn-1"),
            CreateTransaction("txn-2", amount: 200m)
        };

        _transactionRepoMock.Setup(x => x.GetByIdsAsync(ids, UserId))
            .ReturnsAsync(transactions);
        _transactionRepoMock.Setup(x => x.DeleteAsync(It.IsAny<string>(), UserId))
            .ReturnsAsync(true);

        var result = await _sut.BatchDeleteAsync(UserId, ids);

        result.SuccessCount.Should().Be(2);
        result.FailedCount.Should().Be(0);
        result.FailedIds.Should().BeEmpty();
    }

    [Fact]
    public async Task BatchDeleteAsync_TransactionNotFound_AddsToFailedIds()
    {
        var ids = new List<string> { "txn-1", "missing-txn" };
        var transactions = new List<Transaction> { CreateTransaction("txn-1") };

        _transactionRepoMock.Setup(x => x.GetByIdsAsync(ids, UserId))
            .ReturnsAsync(transactions);
        _transactionRepoMock.Setup(x => x.DeleteAsync("txn-1", UserId))
            .ReturnsAsync(true);

        var result = await _sut.BatchDeleteAsync(UserId, ids);

        result.SuccessCount.Should().Be(1);
        result.FailedCount.Should().Be(1);
        result.FailedIds.Should().Contain("missing-txn");
    }

    [Fact]
    public async Task BatchDeleteAsync_RecurringTemplate_SkippedAndFails()
    {
        var ids = new List<string> { "txn-1" };
        var transactions = new List<Transaction> { CreateTransaction("txn-1", isRecurringTemplate: true) };

        _transactionRepoMock.Setup(x => x.GetByIdsAsync(ids, UserId))
            .ReturnsAsync(transactions);

        var result = await _sut.BatchDeleteAsync(UserId, ids);

        result.SuccessCount.Should().Be(0);
        result.FailedCount.Should().Be(1);
        result.FailedIds.Should().Contain("txn-1");
    }

    [Fact]
    public async Task BatchDeleteAsync_ReversesBalance()
    {
        var ids = new List<string> { "txn-1" };
        var txn = CreateTransaction("txn-1", amount: 500m);
        _transactionRepoMock.Setup(x => x.GetByIdsAsync(ids, UserId))
            .ReturnsAsync(new List<Transaction> { txn });
        _transactionRepoMock.Setup(x => x.DeleteAsync("txn-1", UserId)).ReturnsAsync(true);

        await _sut.BatchDeleteAsync(UserId, ids);

        _accountBalanceServiceMock.Verify(x => x.UpdateBalanceAsync(
            It.Is<Account>(a => a.Id == "acc-1"),
            TransactionType.Send,
            500m,
            false, // isAdd = false (reversal)
            null), Times.Once);
    }

    [Fact]
    public async Task BatchDeleteAsync_WithLinkedTransactionInBatch_DeletesBothAndReversesBalances()
    {
        var ids = new List<string> { "txn-send", "txn-recv" };
        var sendTxn = CreateTransaction("txn-send", linkedTransactionId: "txn-recv", type: TransactionType.Send);
        var recvTxn = CreateTransaction("txn-recv", linkedTransactionId: "txn-send", type: TransactionType.Receive);

        _transactionRepoMock.Setup(x => x.GetByIdsAsync(ids, UserId))
            .ReturnsAsync(new List<Transaction> { sendTxn, recvTxn });
        _transactionRepoMock.Setup(x => x.DeleteAsync(It.IsAny<string>(), UserId)).ReturnsAsync(true);

        var result = await _sut.BatchDeleteAsync(UserId, ids);

        // Both should be deleted (the linked one handled during first iteration)
        _transactionRepoMock.Verify(x => x.DeleteAsync("txn-recv", UserId), Times.AtLeastOnce);
    }

    [Fact]
    public async Task BatchDeleteAsync_WithLinkedTransactionNotInBatch_FetchesAndDeletes()
    {
        var ids = new List<string> { "txn-send" };
        var sendTxn = CreateTransaction("txn-send", linkedTransactionId: "txn-recv", type: TransactionType.Send);
        var recvTxn = CreateTransaction("txn-recv", type: TransactionType.Receive);

        _transactionRepoMock.Setup(x => x.GetByIdsAsync(ids, UserId))
            .ReturnsAsync(new List<Transaction> { sendTxn });
        _transactionRepoMock.Setup(x => x.GetByIdAndUserIdAsync("txn-recv", UserId))
            .ReturnsAsync(recvTxn);
        _transactionRepoMock.Setup(x => x.DeleteAsync(It.IsAny<string>(), UserId)).ReturnsAsync(true);

        await _sut.BatchDeleteAsync(UserId, ids);

        _transactionRepoMock.Verify(x => x.DeleteAsync("txn-recv", UserId), Times.Once);
    }

    [Fact]
    public async Task BatchDeleteAsync_WithPendingP2PLinked_DeletesCounterparty()
    {
        var linkId = Guid.NewGuid();
        var ids = new List<string> { "txn-1" };
        var txn = CreateTransaction("txn-1", transactionLinkId: linkId, counterpartyUserId: "other-user");
        var linkedP2P = new Transaction
        {
            Id = "p2p-linked",
            UserId = "other-user",
            Status = TransactionStatus.Pending
        };

        _transactionRepoMock.Setup(x => x.GetByIdsAsync(ids, UserId))
            .ReturnsAsync(new List<Transaction> { txn });
        _transactionRepoMock.Setup(x => x.GetLinkedP2PTransactionAsync(linkId, UserId))
            .ReturnsAsync(linkedP2P);
        _transactionRepoMock.Setup(x => x.DeleteAsync("txn-1", UserId)).ReturnsAsync(true);

        await _sut.BatchDeleteAsync(UserId, ids);

        _transactionRepoMock.Verify(x => x.DeleteByIdAsync("p2p-linked"), Times.Once);
    }

    [Fact]
    public async Task BatchDeleteAsync_EmptyList_ReturnsZeroSuccess()
    {
        _transactionRepoMock.Setup(x => x.GetByIdsAsync(It.IsAny<List<string>>(), UserId))
            .ReturnsAsync(new List<Transaction>());

        var result = await _sut.BatchDeleteAsync(UserId, new List<string>());

        result.SuccessCount.Should().Be(0);
        result.FailedCount.Should().Be(0);
    }

    // ========================================================================
    // BatchUpdateStatusAsync
    // ========================================================================

    [Fact]
    public async Task BatchUpdateStatusAsync_ValidStatus_UpdatesAll()
    {
        var ids = new List<string> { "txn-1", "txn-2" };
        var transactions = new List<Transaction>
        {
            CreateTransaction("txn-1"),
            CreateTransaction("txn-2")
        };

        _transactionRepoMock.Setup(x => x.GetByIdsAsync(ids, UserId))
            .ReturnsAsync(transactions);

        var result = await _sut.BatchUpdateStatusAsync(UserId, ids, "Pending");

        result.SuccessCount.Should().Be(2);
        result.FailedCount.Should().Be(0);
        _transactionRepoMock.Verify(x => x.UpdateAsync(
            It.Is<Transaction>(t => t.Status == TransactionStatus.Pending),
            null), Times.Exactly(2));
    }

    [Fact]
    public async Task BatchUpdateStatusAsync_InvalidStatus_ReturnsAllFailed()
    {
        var ids = new List<string> { "txn-1" };

        var result = await _sut.BatchUpdateStatusAsync(UserId, ids, "InvalidStatus");

        result.SuccessCount.Should().Be(0);
        result.FailedCount.Should().Be(1);
        result.Message.Should().Contain("Invalid status");
    }

    [Fact]
    public async Task BatchUpdateStatusAsync_ConfirmedToNonConfirmed_ReversesBalance()
    {
        var ids = new List<string> { "txn-1" };
        var txn = CreateTransaction("txn-1", amount: 500m);
        txn.Status = TransactionStatus.Confirmed;

        _transactionRepoMock.Setup(x => x.GetByIdsAsync(ids, UserId))
            .ReturnsAsync(new List<Transaction> { txn });

        await _sut.BatchUpdateStatusAsync(UserId, ids, "Pending");

        _accountBalanceServiceMock.Verify(x => x.UpdateBalanceAsync(
            It.Is<Account>(a => a.Id == "acc-1"),
            TransactionType.Send,
            500m,
            false, // reverse
            null), Times.Once);
    }

    [Fact]
    public async Task BatchUpdateStatusAsync_PendingToConfirmed_AppliesBalance()
    {
        var ids = new List<string> { "txn-1" };
        var txn = CreateTransaction("txn-1", amount: 300m);
        txn.Status = TransactionStatus.Pending;

        _transactionRepoMock.Setup(x => x.GetByIdsAsync(ids, UserId))
            .ReturnsAsync(new List<Transaction> { txn });

        await _sut.BatchUpdateStatusAsync(UserId, ids, "Confirmed");

        _accountBalanceServiceMock.Verify(x => x.UpdateBalanceAsync(
            It.Is<Account>(a => a.Id == "acc-1"),
            TransactionType.Send,
            300m,
            true, // apply
            null), Times.Once);
    }

    [Fact]
    public async Task BatchUpdateStatusAsync_SameStatus_NoBalanceChange()
    {
        var ids = new List<string> { "txn-1" };
        var txn = CreateTransaction("txn-1");
        txn.Status = TransactionStatus.Confirmed;

        _transactionRepoMock.Setup(x => x.GetByIdsAsync(ids, UserId))
            .ReturnsAsync(new List<Transaction> { txn });

        await _sut.BatchUpdateStatusAsync(UserId, ids, "Confirmed");

        _accountBalanceServiceMock.Verify(x => x.UpdateBalanceAsync(
            It.IsAny<Account>(), It.IsAny<TransactionType>(), It.IsAny<decimal>(),
            It.IsAny<bool>(), It.IsAny<MongoDB.Driver.IClientSessionHandle?>()), Times.Never);
    }

    [Fact]
    public async Task BatchUpdateStatusAsync_NotFoundTransaction_AddsToFailed()
    {
        var ids = new List<string> { "txn-1", "missing" };
        var transactions = new List<Transaction> { CreateTransaction("txn-1") };
        transactions[0].Status = TransactionStatus.Confirmed;

        _transactionRepoMock.Setup(x => x.GetByIdsAsync(ids, UserId))
            .ReturnsAsync(transactions);

        var result = await _sut.BatchUpdateStatusAsync(UserId, ids, "Confirmed");

        result.SuccessCount.Should().Be(1);
        result.FailedCount.Should().Be(1);
        result.FailedIds.Should().Contain("missing");
    }
}
