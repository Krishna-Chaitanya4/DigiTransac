using DigiTransac.Api.Events;
using DigiTransac.Api.Models;
using DigiTransac.Api.Models.Dto;
using DigiTransac.Api.Repositories;
using DigiTransac.Api.Services;
using DigiTransac.Api.Services.Transactions;
using FluentAssertions;
using MediatR;
using Microsoft.Extensions.Logging;
using Moq;

namespace DigiTransac.Tests.Services;

public class RecurringTransactionServiceTests
{
    private readonly Mock<ITransactionRepository> _transactionRepoMock;
    private readonly Mock<IAccountRepository> _accountRepoMock;
    private readonly Mock<ILabelRepository> _labelRepoMock;
    private readonly Mock<IChatMessageRepository> _chatMessageRepoMock;
    private readonly Mock<IAccountBalanceService> _accountBalanceServiceMock;
    private readonly Mock<ITransactionMapperService> _mapperServiceMock;
    private readonly Mock<IExchangeRateService> _exchangeRateServiceMock;
    private readonly Mock<IPublisher> _publisherMock;
    private readonly Mock<ILogger<RecurringTransactionService>> _loggerMock;
    private readonly RecurringTransactionService _sut;
    private const string UserId = "user-123";
    private const string AccountId = "acc-1";
    private const string LabelId = "label-1";
    private readonly byte[] _testDek = new byte[] { 1, 2, 3 };

    public RecurringTransactionServiceTests()
    {
        _transactionRepoMock = new Mock<ITransactionRepository>();
        _accountRepoMock = new Mock<IAccountRepository>();
        _labelRepoMock = new Mock<ILabelRepository>();
        _chatMessageRepoMock = new Mock<IChatMessageRepository>();
        _accountBalanceServiceMock = new Mock<IAccountBalanceService>();
        _mapperServiceMock = new Mock<ITransactionMapperService>();
        _exchangeRateServiceMock = new Mock<IExchangeRateService>();
        _publisherMock = new Mock<IPublisher>();
        _loggerMock = new Mock<ILogger<RecurringTransactionService>>();

        _mapperServiceMock.Setup(x => x.GetUserDekAsync(UserId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(_testDek);
        _mapperServiceMock.Setup(x => x.EncryptIfNotEmpty(It.IsAny<string?>(), It.IsAny<byte[]>()))
            .Returns((string? val, byte[] _) => val != null ? $"enc_{val}" : null);
        _accountRepoMock.Setup(x => x.GetByUserIdAsync(UserId, true, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<Account> { CreateAccount() });
        _labelRepoMock.Setup(x => x.GetByUserIdAsync(UserId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<Label> { new() { Id = LabelId, Name = "Food", UserId = UserId } });

        _sut = new RecurringTransactionService(
            _transactionRepoMock.Object,
            _accountRepoMock.Object,
            _labelRepoMock.Object,
            _chatMessageRepoMock.Object,
            _accountBalanceServiceMock.Object,
            _mapperServiceMock.Object,
            _exchangeRateServiceMock.Object,
            _publisherMock.Object,
            _loggerMock.Object);
    }

    private static Account CreateAccount(string id = AccountId, string currency = "INR") => new()
    {
        Id = id,
        UserId = UserId,
        Name = "Savings",
        Currency = currency,
        CurrentBalance = 10000m
    };

    private static CreateTransactionRequest CreateRecurringRequest(
        string frequency = "Monthly",
        int? interval = 1,
        string type = "Send",
        decimal amount = 500m) =>
        new(AccountId, type, amount, DateTime.UtcNow, "Rent", "Landlord", null,
            new List<TransactionSplitRequest> { new(LabelId, amount, null) },
            null, null, null,
            new RecurringRuleRequest(frequency, interval, null),
            null, null);

    // ========================================================================
    // CalculateNextOccurrence
    // ========================================================================

    [Fact]
    public void CalculateNextOccurrence_Daily_Interval1_AddsOneDay()
    {
        var rule = new RecurringRule
        {
            Frequency = RecurrenceFrequency.Daily,
            Interval = 1,
            NextOccurrence = new DateTime(2025, 1, 1)
        };

        var result = _sut.CalculateNextOccurrence(rule);

        result.Should().Be(new DateTime(2025, 1, 2));
    }

    [Fact]
    public void CalculateNextOccurrence_Daily_Interval3_AddsThreeDays()
    {
        var rule = new RecurringRule
        {
            Frequency = RecurrenceFrequency.Daily,
            Interval = 3,
            NextOccurrence = new DateTime(2025, 1, 1)
        };

        var result = _sut.CalculateNextOccurrence(rule);

        result.Should().Be(new DateTime(2025, 1, 4));
    }

    [Fact]
    public void CalculateNextOccurrence_Weekly_AddsSevenDays()
    {
        var rule = new RecurringRule
        {
            Frequency = RecurrenceFrequency.Weekly,
            Interval = 1,
            NextOccurrence = new DateTime(2025, 1, 1)
        };

        var result = _sut.CalculateNextOccurrence(rule);

        result.Should().Be(new DateTime(2025, 1, 8));
    }

    [Fact]
    public void CalculateNextOccurrence_Biweekly_AddsFourteenDays()
    {
        var rule = new RecurringRule
        {
            Frequency = RecurrenceFrequency.Biweekly,
            Interval = 1,
            NextOccurrence = new DateTime(2025, 1, 1)
        };

        var result = _sut.CalculateNextOccurrence(rule);

        result.Should().Be(new DateTime(2025, 1, 15));
    }

    [Fact]
    public void CalculateNextOccurrence_Monthly_AddsOneMonth()
    {
        var rule = new RecurringRule
        {
            Frequency = RecurrenceFrequency.Monthly,
            Interval = 1,
            NextOccurrence = new DateTime(2025, 1, 31)
        };

        var result = _sut.CalculateNextOccurrence(rule);

        result.Should().Be(new DateTime(2025, 2, 28)); // Month end handling
    }

    [Fact]
    public void CalculateNextOccurrence_Quarterly_AddsThreeMonths()
    {
        var rule = new RecurringRule
        {
            Frequency = RecurrenceFrequency.Quarterly,
            Interval = 1,
            NextOccurrence = new DateTime(2025, 1, 1)
        };

        var result = _sut.CalculateNextOccurrence(rule);

        result.Should().Be(new DateTime(2025, 4, 1));
    }

    [Fact]
    public void CalculateNextOccurrence_Yearly_AddsOneYear()
    {
        var rule = new RecurringRule
        {
            Frequency = RecurrenceFrequency.Yearly,
            Interval = 1,
            NextOccurrence = new DateTime(2025, 1, 1)
        };

        var result = _sut.CalculateNextOccurrence(rule);

        result.Should().Be(new DateTime(2026, 1, 1));
    }

    // ========================================================================
    // CreateRecurringTemplateAsync
    // ========================================================================

    [Fact]
    public async Task CreateRecurringTemplateAsync_NullRule_ReturnsFalse()
    {
        var request = new CreateTransactionRequest(
            AccountId, "Send", 500m, DateTime.UtcNow, "Rent", null, null,
            new List<TransactionSplitRequest> { new(LabelId, 500m, null) },
            null, null, null, null, null, null);

        var result = await _sut.CreateRecurringTemplateAsync(UserId, request, CreateAccount(), _testDek);

        result.Success.Should().BeFalse();
        result.Message.Should().Contain("Recurring rule is required");
    }

    [Fact]
    public async Task CreateRecurringTemplateAsync_InvalidFrequency_ReturnsFalse()
    {
        var request = new CreateTransactionRequest(
            AccountId, "Send", 500m, DateTime.UtcNow, "Rent", null, null,
            new List<TransactionSplitRequest> { new(LabelId, 500m, null) },
            null, null, null,
            new RecurringRuleRequest("InvalidFreq", 1, null),
            null, null);

        var result = await _sut.CreateRecurringTemplateAsync(UserId, request, CreateAccount(), _testDek);

        result.Success.Should().BeFalse();
        result.Message.Should().Contain("Invalid recurrence frequency");
    }

    [Fact]
    public async Task CreateRecurringTemplateAsync_InvalidType_ReturnsFalse()
    {
        var request = new CreateTransactionRequest(
            AccountId, "InvalidType", 500m, DateTime.UtcNow, "Rent", null, null,
            new List<TransactionSplitRequest> { new(LabelId, 500m, null) },
            null, null, null,
            new RecurringRuleRequest("Monthly", 1, null),
            null, null);

        var result = await _sut.CreateRecurringTemplateAsync(UserId, request, CreateAccount(), _testDek);

        result.Success.Should().BeFalse();
        result.Message.Should().Contain("Invalid transaction type");
    }

    [Fact]
    public async Task CreateRecurringTemplateAsync_Valid_CreatesTemplateAndFirstInstance()
    {
        var request = CreateRecurringRequest();

        var result = await _sut.CreateRecurringTemplateAsync(UserId, request, CreateAccount(), _testDek);

        result.Success.Should().BeTrue();
        result.Template.Should().NotBeNull();
        result.FirstInstance.Should().NotBeNull();
        result.Template!.IsRecurringTemplate.Should().BeTrue();
        result.FirstInstance!.IsRecurringTemplate.Should().BeFalse();

        // Verifies two transactions created (template + first instance)
        _transactionRepoMock.Verify(x => x.CreateAsync(
            It.IsAny<Transaction>(), null), Times.Exactly(2));
    }

    [Fact]
    public async Task CreateRecurringTemplateAsync_Valid_UpdatesBalance()
    {
        var request = CreateRecurringRequest(amount: 750m);

        await _sut.CreateRecurringTemplateAsync(UserId, request, CreateAccount(), _testDek);

        _accountBalanceServiceMock.Verify(x => x.UpdateBalanceAsync(
            It.IsAny<Account>(), TransactionType.Send, 750m, true, null), Times.Once);
    }

    [Fact]
    public async Task CreateRecurringTemplateAsync_Valid_CreatesChatMessage()
    {
        var request = CreateRecurringRequest();

        await _sut.CreateRecurringTemplateAsync(UserId, request, CreateAccount(), _testDek);

        _chatMessageRepoMock.Verify(x => x.CreateAsync(
            It.Is<ChatMessage>(m =>
                m.SenderUserId == UserId &&
                m.Type == ChatMessageType.Transaction),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task CreateRecurringTemplateAsync_Valid_PublishesEvent()
    {
        var request = CreateRecurringRequest();

        await _sut.CreateRecurringTemplateAsync(UserId, request, CreateAccount(), _testDek);

        _publisherMock.Verify(x => x.Publish(
            It.IsAny<RecurringTemplateCreatedEvent>(),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task CreateRecurringTemplateAsync_WithLocation_SetsLocationOnTemplate()
    {
        var request = new CreateTransactionRequest(
            AccountId, "Send", 500m, DateTime.UtcNow, "Rent", null, null,
            new List<TransactionSplitRequest> { new(LabelId, 500m, null) },
            null,
            new TransactionLocationRequest(12.97, 77.59, "MG Road", "Bangalore", "India"),
            null,
            new RecurringRuleRequest("Monthly", 1, null),
            null, null);

        var result = await _sut.CreateRecurringTemplateAsync(UserId, request, CreateAccount(), _testDek);

        result.Template!.Location.Should().NotBeNull();
        result.Template.Location!.Latitude.Should().Be(12.97);
        result.Template.Location.City.Should().Be("Bangalore");
    }

    // ========================================================================
    // DeleteRecurringAsync
    // ========================================================================

    [Fact]
    public async Task DeleteRecurringAsync_TemplateNotFound_ReturnsFalse()
    {
        _transactionRepoMock.Setup(x => x.GetByIdAndUserIdAsync("missing", UserId))
            .ReturnsAsync((Transaction?)null);

        var result = await _sut.DeleteRecurringAsync("missing", UserId, false);

        result.Success.Should().BeFalse();
        result.Message.Should().Contain("not found");
    }

    [Fact]
    public async Task DeleteRecurringAsync_NotATemplate_ReturnsFalse()
    {
        var nonTemplate = new Transaction { Id = "txn-1", UserId = UserId, IsRecurringTemplate = false };
        _transactionRepoMock.Setup(x => x.GetByIdAndUserIdAsync("txn-1", UserId))
            .ReturnsAsync(nonTemplate);

        var result = await _sut.DeleteRecurringAsync("txn-1", UserId, false);

        result.Success.Should().BeFalse();
    }

    [Fact]
    public async Task DeleteRecurringAsync_ValidTemplate_DeletesTemplate()
    {
        var template = new Transaction { Id = "tmpl-1", UserId = UserId, IsRecurringTemplate = true };
        _transactionRepoMock.Setup(x => x.GetByIdAndUserIdAsync("tmpl-1", UserId))
            .ReturnsAsync(template);

        var result = await _sut.DeleteRecurringAsync("tmpl-1", UserId, false);

        result.Success.Should().BeTrue();
        _transactionRepoMock.Verify(x => x.DeleteAsync("tmpl-1", UserId), Times.Once);
    }

    [Fact]
    public async Task DeleteRecurringAsync_WithFutureInstances_DeletesFutureInstances()
    {
        var template = new Transaction { Id = "tmpl-1", UserId = UserId, IsRecurringTemplate = true };
        _transactionRepoMock.Setup(x => x.GetByIdAndUserIdAsync("tmpl-1", UserId))
            .ReturnsAsync(template);

        var futureInstances = new List<Transaction>
        {
            new() { Id = "inst-1", UserId = UserId, ParentTransactionId = "tmpl-1", AccountId = AccountId, Type = TransactionType.Send, Amount = 500m },
            new() { Id = "inst-2", UserId = UserId, ParentTransactionId = "tmpl-1", AccountId = AccountId, Type = TransactionType.Send, Amount = 500m }
        };
        _transactionRepoMock.Setup(x => x.GetFilteredAsync(UserId, It.IsAny<TransactionFilterRequest>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((futureInstances, futureInstances.Count));

        var result = await _sut.DeleteRecurringAsync("tmpl-1", UserId, deleteFutureInstances: true);

        result.Success.Should().BeTrue();
        // Template + 2 future instances deleted
        _transactionRepoMock.Verify(x => x.DeleteAsync(It.IsAny<string>(), UserId), Times.Exactly(3));
    }

    [Fact]
    public async Task DeleteRecurringAsync_WithFutureInstances_ReversesBalances()
    {
        var template = new Transaction { Id = "tmpl-1", UserId = UserId, IsRecurringTemplate = true };
        _transactionRepoMock.Setup(x => x.GetByIdAndUserIdAsync("tmpl-1", UserId))
            .ReturnsAsync(template);

        var futureInstances = new List<Transaction>
        {
            new() { Id = "inst-1", UserId = UserId, ParentTransactionId = "tmpl-1", AccountId = AccountId, Type = TransactionType.Send, Amount = 500m }
        };
        _transactionRepoMock.Setup(x => x.GetFilteredAsync(UserId, It.IsAny<TransactionFilterRequest>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((futureInstances, 1));

        await _sut.DeleteRecurringAsync("tmpl-1", UserId, true);

        _accountBalanceServiceMock.Verify(x => x.UpdateBalanceAsync(
            It.IsAny<Account>(), TransactionType.Send, 500m, false, null), Times.Once);
    }

    // ========================================================================
    // GetRecurringAsync
    // ========================================================================

    [Fact]
    public async Task GetRecurringAsync_ReturnsTemplatesMappedToResponse()
    {
        var templates = new List<Transaction>
        {
            new()
            {
                Id = "tmpl-1", UserId = UserId, AccountId = AccountId,
                Type = TransactionType.Send, Amount = 500m, Currency = "INR",
                Title = "Rent", IsRecurringTemplate = true,
                RecurringRule = new RecurringRule { Frequency = RecurrenceFrequency.Monthly, Interval = 1, NextOccurrence = DateTime.UtcNow.AddDays(30) },
                Splits = new(),
                TagIds = new()
            }
        };

        _transactionRepoMock.Setup(x => x.GetRecurringTemplatesAsync(UserId))
            .ReturnsAsync(templates);

        var expectedResponse = new RecurringTransactionResponse(
            "tmpl-1", AccountId, "Savings", "Send", 500m, "INR", "Rent", null,
            new List<TransactionSplitResponse>(),
            new RecurringRuleResponse("Monthly", 1, null, DateTime.UtcNow.AddDays(30)),
            DateTime.UtcNow);

        _mapperServiceMock.Setup(x => x.MapToRecurringResponse(
                It.IsAny<Transaction>(), It.IsAny<byte[]?>(),
                It.IsAny<Dictionary<string, Account>>(), It.IsAny<Dictionary<string, Label>>()))
            .Returns(expectedResponse);

        var result = await _sut.GetRecurringAsync(UserId);

        result.Should().HaveCount(1);
        result[0].Id.Should().Be("tmpl-1");
    }

    // ========================================================================
    // ProcessRecurringTransactionsAsync
    // ========================================================================

    [Fact]
    public async Task ProcessRecurringTransactionsAsync_NoPending_DoesNothing()
    {
        _transactionRepoMock.Setup(x => x.GetPendingRecurringAsync(It.IsAny<DateTime>()))
            .ReturnsAsync(new List<Transaction>());

        await _sut.ProcessRecurringTransactionsAsync();

        _transactionRepoMock.Verify(x => x.CreateAsync(It.IsAny<Transaction>(), null), Times.Never);
    }

    [Fact]
    public async Task ProcessRecurringTransactionsAsync_WithPending_CreatesNewTransaction()
    {
        var template = new Transaction
        {
            Id = "tmpl-1",
            UserId = UserId,
            AccountId = AccountId,
            Type = TransactionType.Send,
            Amount = 500m,
            Currency = "INR",
            Title = "Rent",
            IsRecurringTemplate = true,
            RecurringRule = new RecurringRule
            {
                Frequency = RecurrenceFrequency.Monthly,
                Interval = 1,
                NextOccurrence = DateTime.UtcNow.Date,
                LastProcessed = DateTime.UtcNow.AddMonths(-1)
            },
            Splits = new List<TransactionSplit> { new() { LabelId = LabelId, Amount = 500m } },
            TagIds = new List<string>()
        };

        _transactionRepoMock.Setup(x => x.GetPendingRecurringAsync(It.IsAny<DateTime>()))
            .ReturnsAsync(new List<Transaction> { template });
        _accountRepoMock.Setup(x => x.GetByIdAsync(AccountId))
            .ReturnsAsync(CreateAccount());

        await _sut.ProcessRecurringTransactionsAsync();

        // New transaction + chat message link update + template update = at least one CreateAsync
        _transactionRepoMock.Verify(x => x.CreateAsync(
            It.Is<Transaction>(t =>
                t.ParentTransactionId == "tmpl-1" &&
                t.Source == TransactionSource.Recurring),
            null), Times.Once);
    }

    [Fact]
    public async Task ProcessRecurringTransactionsAsync_AccountNotFound_Skips()
    {
        var template = new Transaction
        {
            Id = "tmpl-1", UserId = UserId, AccountId = "deleted-acc",
            Type = TransactionType.Send, Amount = 500m,
            RecurringRule = new RecurringRule { Frequency = RecurrenceFrequency.Monthly, Interval = 1, NextOccurrence = DateTime.UtcNow },
            Splits = new(), TagIds = new()
        };

        _transactionRepoMock.Setup(x => x.GetPendingRecurringAsync(It.IsAny<DateTime>()))
            .ReturnsAsync(new List<Transaction> { template });
        _accountRepoMock.Setup(x => x.GetByIdAsync("deleted-acc"))
            .ReturnsAsync((Account?)null);

        await _sut.ProcessRecurringTransactionsAsync();

        _transactionRepoMock.Verify(x => x.CreateAsync(It.IsAny<Transaction>(), null), Times.Never);
    }

    [Fact]
    public async Task ProcessRecurringTransactionsAsync_ExceptionInOne_ContinuesOthers()
    {
        var template1 = new Transaction
        {
            Id = "tmpl-1", UserId = UserId, AccountId = "bad-acc",
            Type = TransactionType.Send, Amount = 500m,
            RecurringRule = new RecurringRule { Frequency = RecurrenceFrequency.Monthly, Interval = 1, NextOccurrence = DateTime.UtcNow },
            Splits = new(), TagIds = new()
        };
        var template2 = new Transaction
        {
            Id = "tmpl-2", UserId = UserId, AccountId = AccountId,
            Type = TransactionType.Send, Amount = 300m,
            RecurringRule = new RecurringRule { Frequency = RecurrenceFrequency.Monthly, Interval = 1, NextOccurrence = DateTime.UtcNow },
            Splits = new(), TagIds = new()
        };

        _transactionRepoMock.Setup(x => x.GetPendingRecurringAsync(It.IsAny<DateTime>()))
            .ReturnsAsync(new List<Transaction> { template1, template2 });
        _accountRepoMock.Setup(x => x.GetByIdAsync("bad-acc"))
            .ThrowsAsync(new Exception("DB error"));
        _accountRepoMock.Setup(x => x.GetByIdAsync(AccountId))
            .ReturnsAsync(CreateAccount());

        await _sut.ProcessRecurringTransactionsAsync();

        // Template2 should still be processed
        _transactionRepoMock.Verify(x => x.CreateAsync(
            It.Is<Transaction>(t => t.ParentTransactionId == "tmpl-2"), null), Times.Once);
    }

    [Fact]
    public async Task ProcessRecurringTransactionsAsync_WithTransfer_CreatesLinkedTransaction()
    {
        var template = new Transaction
        {
            Id = "tmpl-1", UserId = UserId, AccountId = AccountId,
            Type = TransactionType.Send, Amount = 500m, Currency = "INR",
            TransferToAccountId = "acc-2",
            RecurringRule = new RecurringRule { Frequency = RecurrenceFrequency.Monthly, Interval = 1, NextOccurrence = DateTime.UtcNow },
            Splits = new List<TransactionSplit> { new() { LabelId = LabelId, Amount = 500m } },
            TagIds = new()
        };

        _transactionRepoMock.Setup(x => x.GetPendingRecurringAsync(It.IsAny<DateTime>()))
            .ReturnsAsync(new List<Transaction> { template });
        _accountRepoMock.Setup(x => x.GetByIdAsync(AccountId)).ReturnsAsync(CreateAccount());
        _accountRepoMock.Setup(x => x.GetByIdAsync("acc-2")).ReturnsAsync(CreateAccount("acc-2"));

        await _sut.ProcessRecurringTransactionsAsync();

        // Both the main transaction and linked receive transaction should be created
        _transactionRepoMock.Verify(x => x.CreateAsync(It.IsAny<Transaction>(), null), Times.Exactly(2));
    }

    [Fact]
    public async Task ProcessRecurringTransactionsAsync_PublishesEvent()
    {
        var template = new Transaction
        {
            Id = "tmpl-1", UserId = UserId, AccountId = AccountId,
            Type = TransactionType.Send, Amount = 500m,
            RecurringRule = new RecurringRule { Frequency = RecurrenceFrequency.Monthly, Interval = 1, NextOccurrence = DateTime.UtcNow },
            Splits = new(), TagIds = new()
        };

        _transactionRepoMock.Setup(x => x.GetPendingRecurringAsync(It.IsAny<DateTime>()))
            .ReturnsAsync(new List<Transaction> { template });
        _accountRepoMock.Setup(x => x.GetByIdAsync(AccountId)).ReturnsAsync(CreateAccount());

        await _sut.ProcessRecurringTransactionsAsync();

        _publisherMock.Verify(x => x.Publish(
            It.IsAny<RecurringTransactionGeneratedEvent>(),
            It.IsAny<CancellationToken>()), Times.Once);
    }
}
