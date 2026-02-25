using DigiTransac.Api.Models;
using DigiTransac.Api.Models.Dto;
using DigiTransac.Api.Repositories;
using DigiTransac.Api.Services.Transactions;
using FluentAssertions;
using Moq;

namespace DigiTransac.Tests.Services;

public class TransactionExportServiceTests
{
    private readonly Mock<ITransactionRepository> _transactionRepoMock;
    private readonly Mock<IAccountRepository> _accountRepoMock;
    private readonly Mock<ILabelRepository> _labelRepoMock;
    private readonly Mock<ITagRepository> _tagRepoMock;
    private readonly Mock<IUserRepository> _userRepoMock;
    private readonly Mock<ITransactionMapperService> _mapperServiceMock;
    private readonly TransactionExportService _sut;
    private const string UserId = "user-123";

    public TransactionExportServiceTests()
    {
        _transactionRepoMock = new Mock<ITransactionRepository>();
        _accountRepoMock = new Mock<IAccountRepository>();
        _labelRepoMock = new Mock<ILabelRepository>();
        _tagRepoMock = new Mock<ITagRepository>();
        _userRepoMock = new Mock<IUserRepository>();
        _mapperServiceMock = new Mock<ITransactionMapperService>();

        _mapperServiceMock.Setup(x => x.GetUserDekAsync(UserId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new byte[] { 1, 2, 3 });
        _accountRepoMock.Setup(x => x.GetByUserIdAsync(UserId, true, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<Account>());
        _labelRepoMock.Setup(x => x.GetByUserIdAsync(UserId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<Label>());
        _tagRepoMock.Setup(x => x.GetByUserIdAsync(UserId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<Tag>());

        _sut = new TransactionExportService(
            _transactionRepoMock.Object,
            _accountRepoMock.Object,
            _labelRepoMock.Object,
            _tagRepoMock.Object,
            _userRepoMock.Object,
            _mapperServiceMock.Object);
    }

    private static TransactionFilterRequest DefaultFilter => new(
        null, null, null, null, null, null, null, null, null, null, null, 1, 50);

    // ========================================================================
    // GetAllForExportAsync
    // ========================================================================

    [Fact]
    public async Task GetAllForExportAsync_ReturnsTransactionsExcludingTemplates()
    {
        var transactions = new List<Transaction>
        {
            new() { Id = "txn-1", UserId = UserId, IsRecurringTemplate = false, Splits = new(), TagIds = new() },
            new() { Id = "template-1", UserId = UserId, IsRecurringTemplate = true, Splits = new(), TagIds = new() }
        };

        _transactionRepoMock.Setup(x => x.GetFilteredAsync(UserId, It.IsAny<TransactionFilterRequest>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((transactions, transactions.Count));
        _userRepoMock.Setup(x => x.GetByIdsAsync(It.IsAny<IEnumerable<string>>()))
            .ReturnsAsync(new Dictionary<string, User>());

        // Mock MapToResponse for the non-template transaction only
        _mapperServiceMock.Setup(x => x.MapToResponse(
                It.Is<Transaction>(t => t.Id == "txn-1"),
                It.IsAny<byte[]?>(),
                It.IsAny<Dictionary<string, Account>>(),
                It.IsAny<Dictionary<string, Label>>(),
                It.IsAny<Dictionary<string, Tag>>(),
                It.IsAny<Dictionary<string, User>?>()))
            .Returns(CreateResponse("txn-1"));

        var result = await _sut.GetAllForExportAsync(UserId, DefaultFilter);

        result.Should().HaveCount(1);
        result[0].Id.Should().Be("txn-1");
    }

    [Fact]
    public async Task GetAllForExportAsync_RemovesPagination()
    {
        var filter = new TransactionFilterRequest(null, null, null, null, null, null, null, null, null, null, null, 2, 25);

        _transactionRepoMock.Setup(x => x.GetFilteredAsync(UserId,
                It.Is<TransactionFilterRequest>(f => f.Page == null && f.PageSize == null),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync((new List<Transaction>(), 0));
        _userRepoMock.Setup(x => x.GetByIdsAsync(It.IsAny<IEnumerable<string>>()))
            .ReturnsAsync(new Dictionary<string, User>());

        await _sut.GetAllForExportAsync(UserId, filter);

        _transactionRepoMock.Verify(x => x.GetFilteredAsync(UserId,
            It.Is<TransactionFilterRequest>(f => f.Page == null && f.PageSize == null),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task GetAllForExportAsync_FetchesCounterpartyUsers()
    {
        var transactions = new List<Transaction>
        {
            new() { Id = "txn-1", UserId = UserId, CounterpartyUserId = "other-user", IsRecurringTemplate = false, Splits = new(), TagIds = new() }
        };

        _transactionRepoMock.Setup(x => x.GetFilteredAsync(UserId, It.IsAny<TransactionFilterRequest>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((transactions, 1));
        _userRepoMock.Setup(x => x.GetByIdsAsync(It.Is<IEnumerable<string>>(ids => ids.Contains("other-user"))))
            .ReturnsAsync(new Dictionary<string, User> { { "other-user", new User { Id = "other-user", Email = "other@test.com" } } });
        _mapperServiceMock.Setup(x => x.MapToResponse(
                It.IsAny<Transaction>(), It.IsAny<byte[]?>(),
                It.IsAny<Dictionary<string, Account>>(), It.IsAny<Dictionary<string, Label>>(),
                It.IsAny<Dictionary<string, Tag>>(), It.IsAny<Dictionary<string, User>?>()))
            .Returns(CreateResponse("txn-1"));

        await _sut.GetAllForExportAsync(UserId, DefaultFilter);

        _userRepoMock.Verify(x => x.GetByIdsAsync(
            It.Is<IEnumerable<string>>(ids => ids.Contains("other-user"))), Times.Once);
    }

    // ========================================================================
    // ExportToCsvAsync
    // ========================================================================

    [Fact]
    public async Task ExportToCsvAsync_IncludesHeader()
    {
        _transactionRepoMock.Setup(x => x.GetFilteredAsync(UserId, It.IsAny<TransactionFilterRequest>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((new List<Transaction>(), 0));
        _userRepoMock.Setup(x => x.GetByIdsAsync(It.IsAny<IEnumerable<string>>()))
            .ReturnsAsync(new Dictionary<string, User>());

        var csv = await _sut.ExportToCsvAsync(UserId, DefaultFilter);

        csv.Should().StartWith("Date,Type,Amount,Currency,Title,Payee,Account,Category,Tags,Status,Notes");
    }

    [Fact]
    public async Task ExportToCsvAsync_FormatsTransactionRows()
    {
        var transactions = new List<Transaction>
        {
            new() { Id = "txn-1", UserId = UserId, IsRecurringTemplate = false, Splits = new(), TagIds = new() }
        };

        _transactionRepoMock.Setup(x => x.GetFilteredAsync(UserId, It.IsAny<TransactionFilterRequest>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((transactions, 1));
        _userRepoMock.Setup(x => x.GetByIdsAsync(It.IsAny<IEnumerable<string>>()))
            .ReturnsAsync(new Dictionary<string, User>());

        var response = CreateResponse("txn-1", title: "Lunch", payee: "Cafe", amount: 150m);
        _mapperServiceMock.Setup(x => x.MapToResponse(
                It.IsAny<Transaction>(), It.IsAny<byte[]?>(),
                It.IsAny<Dictionary<string, Account>>(), It.IsAny<Dictionary<string, Label>>(),
                It.IsAny<Dictionary<string, Tag>>(), It.IsAny<Dictionary<string, User>?>()))
            .Returns(response);

        var csv = await _sut.ExportToCsvAsync(UserId, DefaultFilter);

        var lines = csv.Split(Environment.NewLine, StringSplitOptions.RemoveEmptyEntries);
        lines.Should().HaveCount(2); // header + 1 data row
        lines[1].Should().Contain("\"Lunch\"");
        lines[1].Should().Contain("\"Cafe\"");
        lines[1].Should().Contain("150");
    }

    [Fact]
    public async Task ExportToCsvAsync_SanitizesFormulaInjection()
    {
        var transactions = new List<Transaction>
        {
            new() { Id = "txn-1", UserId = UserId, IsRecurringTemplate = false, Splits = new(), TagIds = new() }
        };

        _transactionRepoMock.Setup(x => x.GetFilteredAsync(UserId, It.IsAny<TransactionFilterRequest>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((transactions, 1));
        _userRepoMock.Setup(x => x.GetByIdsAsync(It.IsAny<IEnumerable<string>>()))
            .ReturnsAsync(new Dictionary<string, User>());

        // Title starting with = should be prefixed with ' for CSV injection prevention
        var response = CreateResponse("txn-1", title: "=SUM(A1:A10)", notes: "+cmd|'/C calc'!A0");
        _mapperServiceMock.Setup(x => x.MapToResponse(
                It.IsAny<Transaction>(), It.IsAny<byte[]?>(),
                It.IsAny<Dictionary<string, Account>>(), It.IsAny<Dictionary<string, Label>>(),
                It.IsAny<Dictionary<string, Tag>>(), It.IsAny<Dictionary<string, User>?>()))
            .Returns(response);

        var csv = await _sut.ExportToCsvAsync(UserId, DefaultFilter);

        csv.Should().Contain("'=SUM(A1:A10)");
        csv.Should().Contain("'+cmd|'/C calc'!A0");
    }

    [Fact]
    public async Task ExportToCsvAsync_EscapesDoubleQuotes()
    {
        var transactions = new List<Transaction>
        {
            new() { Id = "txn-1", UserId = UserId, IsRecurringTemplate = false, Splits = new(), TagIds = new() }
        };

        _transactionRepoMock.Setup(x => x.GetFilteredAsync(UserId, It.IsAny<TransactionFilterRequest>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((transactions, 1));
        _userRepoMock.Setup(x => x.GetByIdsAsync(It.IsAny<IEnumerable<string>>()))
            .ReturnsAsync(new Dictionary<string, User>());

        var response = CreateResponse("txn-1", title: "He said \"hello\"");
        _mapperServiceMock.Setup(x => x.MapToResponse(
                It.IsAny<Transaction>(), It.IsAny<byte[]?>(),
                It.IsAny<Dictionary<string, Account>>(), It.IsAny<Dictionary<string, Label>>(),
                It.IsAny<Dictionary<string, Tag>>(), It.IsAny<Dictionary<string, User>?>()))
            .Returns(response);

        var csv = await _sut.ExportToCsvAsync(UserId, DefaultFilter);

        csv.Should().Contain("He said \"\"hello\"\"");
    }

    [Fact]
    public async Task ExportToCsvAsync_EmptyTransactions_ReturnsHeaderOnly()
    {
        _transactionRepoMock.Setup(x => x.GetFilteredAsync(UserId, It.IsAny<TransactionFilterRequest>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((new List<Transaction>(), 0));
        _userRepoMock.Setup(x => x.GetByIdsAsync(It.IsAny<IEnumerable<string>>()))
            .ReturnsAsync(new Dictionary<string, User>());

        var csv = await _sut.ExportToCsvAsync(UserId, DefaultFilter);

        var lines = csv.Split(Environment.NewLine, StringSplitOptions.RemoveEmptyEntries);
        lines.Should().HaveCount(1); // header only
    }

    // ========================================================================
    // Helpers
    // ========================================================================

    private static TransactionResponse CreateResponse(
        string id,
        string? title = "Test",
        string? payee = null,
        string? notes = null,
        decimal amount = 100m,
        string type = "Send",
        string? accountName = "Savings") =>
        new(id, "acc-1", accountName, type, amount, "INR", DateTime.UtcNow, title, payee, notes,
            new List<TransactionSplitResponse> { new("label-1", "Food", "#ff0000", "icon", amount, null) },
            new List<string>(),
            new List<TagInfo>(),
            null, null, null, null, null, null, false, "Confirmed",
            DateTime.UtcNow, DateTime.UtcNow, null, null, null, null, null, null, false, null);
}
