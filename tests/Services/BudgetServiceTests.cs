using DigiTransac.Api.Common;
using DigiTransac.Api.Hubs;
using DigiTransac.Api.Models;
using DigiTransac.Api.Models.Dto;
using DigiTransac.Api.Repositories;
using DigiTransac.Api.Services;
using FluentAssertions;
using Microsoft.Extensions.Logging;
using Moq;

namespace DigiTransac.Tests.Services;

public class BudgetServiceTests
{
    private readonly Mock<IBudgetRepository> _budgetRepoMock;
    private readonly Mock<ITransactionRepository> _transactionRepoMock;
    private readonly Mock<ILabelRepository> _labelRepoMock;
    private readonly Mock<IAccountRepository> _accountRepoMock;
    private readonly Mock<IUserRepository> _userRepoMock;
    private readonly Mock<IExchangeRateService> _exchangeRateServiceMock;
    private readonly Mock<INotificationService> _notificationServiceMock;
    private readonly Mock<IAuditService> _auditServiceMock;
    private readonly Mock<ILogger<BudgetService>> _loggerMock;
    private readonly BudgetService _sut;
    private const string UserId = "user-123";

    public BudgetServiceTests()
    {
        _budgetRepoMock = new Mock<IBudgetRepository>();
        _transactionRepoMock = new Mock<ITransactionRepository>();
        _labelRepoMock = new Mock<ILabelRepository>();
        _accountRepoMock = new Mock<IAccountRepository>();
        _userRepoMock = new Mock<IUserRepository>();
        _exchangeRateServiceMock = new Mock<IExchangeRateService>();
        _notificationServiceMock = new Mock<INotificationService>();
        _auditServiceMock = new Mock<IAuditService>();
        _loggerMock = new Mock<ILogger<BudgetService>>();

        // Default setups for BuildBudgetResponseAsync dependencies
        _accountRepoMock.Setup(x => x.GetByUserIdAsync(It.IsAny<string>(), It.IsAny<bool>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<Account>());
        _labelRepoMock.Setup(x => x.GetByUserIdAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<Label>());
        _exchangeRateServiceMock.Setup(x => x.GetRatesAsync(It.IsAny<string?>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new ExchangeRateResponse("USD", new Dictionary<string, decimal>(), DateTime.UtcNow, "test"));
        _userRepoMock.Setup(x => x.GetByIdAsync(It.IsAny<string>()))
            .ReturnsAsync(new User { Id = UserId, PrimaryCurrency = "INR" });
        _transactionRepoMock.Setup(x => x.GetFilteredAsync(
                It.IsAny<string>(), It.IsAny<TransactionFilterRequest>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((new List<Transaction>(), 0));
        _exchangeRateServiceMock.Setup(x => x.Convert(
                It.IsAny<decimal>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<Dictionary<string, decimal>>()))
            .Returns((decimal amount, string from, string to, Dictionary<string, decimal> rates) => amount);

        _sut = new BudgetService(
            _budgetRepoMock.Object,
            _transactionRepoMock.Object,
            _labelRepoMock.Object,
            _accountRepoMock.Object,
            _userRepoMock.Object,
            _exchangeRateServiceMock.Object,
            _notificationServiceMock.Object,
            _auditServiceMock.Object,
            _loggerMock.Object);
    }

    private static CreateBudgetRequest ValidCreateRequest(
        string name = "Food Budget",
        decimal amount = 10000m,
        string currency = "INR",
        string period = "Monthly") =>
        new(name, null, amount, currency, period, null, null, null, null, null, null, null);

    // ========================================================================
    // CreateAsync
    // ========================================================================

    [Fact]
    public async Task CreateAsync_ValidRequest_ReturnsSuccess()
    {
        var request = ValidCreateRequest();

        var result = await _sut.CreateAsync(UserId, request);

        result.IsSuccess.Should().BeTrue();
        result.Value.Should().NotBeNull();
        result.Value.Name.Should().Be("Food Budget");
        result.Value.Amount.Should().Be(10000m);
    }

    [Fact]
    public async Task CreateAsync_ValidRequest_CallsRepository()
    {
        var request = ValidCreateRequest();

        await _sut.CreateAsync(UserId, request);

        _budgetRepoMock.Verify(x => x.CreateAsync(It.Is<Budget>(b =>
            b.UserId == UserId &&
            b.Name == "Food Budget" &&
            b.Amount == 10000m &&
            b.Currency == "INR" &&
            b.IsActive), It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task CreateAsync_ValidRequest_LogsAudit()
    {
        var request = ValidCreateRequest();

        await _sut.CreateAsync(UserId, request);

        _auditServiceMock.Verify(x => x.LogBudgetCreatedAsync(
            UserId, It.IsAny<string>(), "Food Budget", 10000m, "INR"), Times.Once);
    }

    [Fact]
    public async Task CreateAsync_InvalidPeriod_ReturnsValidationError()
    {
        var request = ValidCreateRequest(period: "Biweekly");

        var result = await _sut.CreateAsync(UserId, request);

        result.IsFailure.Should().BeTrue();
        result.Error.Code.Should().Be("Validation");
    }

    [Fact]
    public async Task CreateAsync_CustomPeriodWithoutEndDate_ReturnsValidationError()
    {
        var request = new CreateBudgetRequest(
            "Custom Budget", null, 5000m, "INR", "Custom",
            DateTime.UtcNow, null, null, null, null, null, null);

        var result = await _sut.CreateAsync(UserId, request);

        result.IsFailure.Should().BeTrue();
        result.Error.Code.Should().Be("Validation");
    }

    [Fact]
    public async Task CreateAsync_ZeroAmount_ReturnsValidationError()
    {
        var request = ValidCreateRequest(amount: 0);

        var result = await _sut.CreateAsync(UserId, request);

        result.IsFailure.Should().BeTrue();
    }

    [Fact]
    public async Task CreateAsync_NegativeAmount_ReturnsValidationError()
    {
        var request = ValidCreateRequest(amount: -100m);

        var result = await _sut.CreateAsync(UserId, request);

        result.IsFailure.Should().BeTrue();
    }

    [Fact]
    public async Task CreateAsync_TrimsName()
    {
        var request = ValidCreateRequest(name: "  Groceries  ");

        var result = await _sut.CreateAsync(UserId, request);

        result.IsSuccess.Should().BeTrue();
        _budgetRepoMock.Verify(x => x.CreateAsync(
            It.Is<Budget>(b => b.Name == "Groceries"), It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task CreateAsync_DefaultsToINRWhenCurrencyNull()
    {
        var request = new CreateBudgetRequest(
            "Budget", null, 1000m, null!, "Monthly",
            null, null, null, null, null, null, null);

        var result = await _sut.CreateAsync(UserId, request);

        result.IsSuccess.Should().BeTrue();
        _budgetRepoMock.Verify(x => x.CreateAsync(
            It.Is<Budget>(b => b.Currency == "INR"), It.IsAny<CancellationToken>()), Times.Once);
    }

    // ========================================================================
    // UpdateAsync
    // ========================================================================

    [Fact]
    public async Task UpdateAsync_BudgetNotFound_ReturnsNotFoundError()
    {
        _budgetRepoMock.Setup(x => x.GetByIdAndUserIdAsync("budget-1", UserId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((Budget?)null);

        var request = new UpdateBudgetRequest("New Name", null, null, null, null, null, null, null, null, null, null, null, null);
        var result = await _sut.UpdateAsync("budget-1", UserId, request);

        result.IsFailure.Should().BeTrue();
        result.Error.Code.Should().Be("NotFound");
    }

    [Fact]
    public async Task UpdateAsync_ValidRequest_UpdatesAndReturnsSuccess()
    {
        var budget = new Budget
        {
            Id = "budget-1",
            UserId = UserId,
            Name = "Old Name",
            Amount = 5000m,
            Currency = "INR",
            Period = BudgetPeriod.Monthly,
            IsActive = true,
            Alerts = new List<BudgetAlert>(),
            LabelIds = new List<string>(),
            AccountIds = new List<string>(),
            StartDate = DateTime.UtcNow.AddDays(-15)
        };
        _budgetRepoMock.Setup(x => x.GetByIdAndUserIdAsync("budget-1", UserId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(budget);

        var request = new UpdateBudgetRequest("Updated Name", null, 8000m, null, null, null, null, null, null, null, null, null, null);
        var result = await _sut.UpdateAsync("budget-1", UserId, request);

        result.IsSuccess.Should().BeTrue();
        _budgetRepoMock.Verify(x => x.UpdateAsync(It.Is<Budget>(b =>
            b.Name == "Updated Name" && b.Amount == 8000m), It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task UpdateAsync_OnlyUpdatesNonNullFields()
    {
        var budget = new Budget
        {
            Id = "budget-1", UserId = UserId, Name = "Original",
            Amount = 5000m, Currency = "INR", Period = BudgetPeriod.Monthly,
            IsActive = true, Color = "#FF0000", Icon = "🍔",
            Alerts = new List<BudgetAlert>(),
            LabelIds = new List<string>(),
            AccountIds = new List<string>(),
            StartDate = DateTime.UtcNow.AddDays(-10)
        };
        _budgetRepoMock.Setup(x => x.GetByIdAndUserIdAsync("budget-1", UserId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(budget);

        // Only updating amount, leaving everything else null
        var request = new UpdateBudgetRequest(null, null, 9000m, null, null, null, null, null, null, null, null, null, null);
        var result = await _sut.UpdateAsync("budget-1", UserId, request);

        result.IsSuccess.Should().BeTrue();
        _budgetRepoMock.Verify(x => x.UpdateAsync(It.Is<Budget>(b =>
            b.Name == "Original" && b.Amount == 9000m && b.Color == "#FF0000"), It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task UpdateAsync_LogsAudit()
    {
        var budget = new Budget
        {
            Id = "budget-1", UserId = UserId, Name = "Budget",
            Amount = 5000m, Currency = "INR", Period = BudgetPeriod.Monthly,
            IsActive = true, Alerts = new List<BudgetAlert>(),
            LabelIds = new List<string>(), AccountIds = new List<string>(),
            StartDate = DateTime.UtcNow.AddDays(-10)
        };
        _budgetRepoMock.Setup(x => x.GetByIdAndUserIdAsync("budget-1", UserId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(budget);

        var request = new UpdateBudgetRequest(null, null, null, null, null, null, null, null, null, null, null, null, null);
        await _sut.UpdateAsync("budget-1", UserId, request);

        _auditServiceMock.Verify(x => x.LogBudgetUpdatedAsync(
            UserId, "budget-1", "Budget", It.IsAny<Dictionary<string, object>>()), Times.Once);
    }

    // ========================================================================
    // DeleteAsync
    // ========================================================================

    [Fact]
    public async Task DeleteAsync_BudgetNotFound_ReturnsNotFoundError()
    {
        _budgetRepoMock.Setup(x => x.GetByIdAndUserIdAsync("budget-1", UserId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((Budget?)null);

        var result = await _sut.DeleteAsync("budget-1", UserId);

        result.IsFailure.Should().BeTrue();
        result.Error.Code.Should().Be("NotFound");
    }

    [Fact]
    public async Task DeleteAsync_ValidBudget_DeletesAndReturnsSuccess()
    {
        var budget = new Budget { Id = "budget-1", UserId = UserId, Name = "Budget" };
        _budgetRepoMock.Setup(x => x.GetByIdAndUserIdAsync("budget-1", UserId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(budget);

        var result = await _sut.DeleteAsync("budget-1", UserId);

        result.IsSuccess.Should().BeTrue();
        _budgetRepoMock.Verify(x => x.DeleteAsync("budget-1", It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task DeleteAsync_LogsAudit()
    {
        var budget = new Budget { Id = "budget-1", UserId = UserId, Name = "Groceries" };
        _budgetRepoMock.Setup(x => x.GetByIdAndUserIdAsync("budget-1", UserId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(budget);

        await _sut.DeleteAsync("budget-1", UserId);

        _auditServiceMock.Verify(x => x.LogBudgetDeletedAsync(
            UserId, "budget-1", "Groceries"), Times.Once);
    }

    // ========================================================================
    // GetByIdAsync
    // ========================================================================

    [Fact]
    public async Task GetByIdAsync_BudgetNotFound_ReturnsNull()
    {
        _budgetRepoMock.Setup(x => x.GetByIdAndUserIdAsync("budget-1", UserId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((Budget?)null);

        var result = await _sut.GetByIdAsync("budget-1", UserId);

        result.Should().BeNull();
    }

    [Fact]
    public async Task GetByIdAsync_BudgetExists_ReturnsResponse()
    {
        var budget = new Budget
        {
            Id = "budget-1", UserId = UserId, Name = "Food",
            Amount = 5000m, Currency = "INR", Period = BudgetPeriod.Monthly,
            IsActive = true, Alerts = new List<BudgetAlert>(),
            LabelIds = new List<string>(), AccountIds = new List<string>(),
            StartDate = DateTime.UtcNow.AddDays(-10)
        };
        _budgetRepoMock.Setup(x => x.GetByIdAndUserIdAsync("budget-1", UserId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(budget);

        var result = await _sut.GetByIdAsync("budget-1", UserId);

        result.Should().NotBeNull();
        result!.Name.Should().Be("Food");
        result.Amount.Should().Be(5000m);
    }

    // ========================================================================
    // MarkNotificationAsReadAsync / MarkAllNotificationsAsReadAsync
    // ========================================================================

    [Fact]
    public async Task MarkNotificationAsReadAsync_CallsRepository()
    {
        _budgetRepoMock.Setup(x => x.MarkNotificationAsReadAsync("notif-1", UserId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);

        var result = await _sut.MarkNotificationAsReadAsync("notif-1", UserId);

        result.Should().BeTrue();
        _budgetRepoMock.Verify(x => x.MarkNotificationAsReadAsync("notif-1", UserId, It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task MarkAllNotificationsAsReadAsync_CallsRepository()
    {
        _budgetRepoMock.Setup(x => x.MarkAllNotificationsAsReadAsync(UserId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);

        var result = await _sut.MarkAllNotificationsAsReadAsync(UserId);

        result.Should().BeTrue();
    }

    // ========================================================================
    // GetSummaryAsync
    // ========================================================================

    [Fact]
    public async Task GetSummaryAsync_NoBudgets_ReturnsEmptySummary()
    {
        _budgetRepoMock.Setup(x => x.GetByUserIdAsync(UserId, true, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<Budget>());

        var result = await _sut.GetSummaryAsync(UserId);

        result.TotalBudgets.Should().Be(0);
        result.Budgets.Should().BeEmpty();
        result.PrimaryCurrency.Should().Be("INR");
    }

    [Fact]
    public async Task GetSummaryAsync_WithBudgets_CalculatesTotals()
    {
        var budgets = new List<Budget>
        {
            new()
            {
                Id = "b1", UserId = UserId, Name = "Food", Amount = 5000m,
                Currency = "INR", Period = BudgetPeriod.Monthly, IsActive = true,
                Alerts = new List<BudgetAlert>(), LabelIds = new List<string>(),
                AccountIds = new List<string>(), StartDate = DateTime.UtcNow.AddDays(-15)
            },
            new()
            {
                Id = "b2", UserId = UserId, Name = "Transport", Amount = 3000m,
                Currency = "INR", Period = BudgetPeriod.Monthly, IsActive = true,
                Alerts = new List<BudgetAlert>(), LabelIds = new List<string>(),
                AccountIds = new List<string>(), StartDate = DateTime.UtcNow.AddDays(-15)
            }
        };
        _budgetRepoMock.Setup(x => x.GetByUserIdAsync(UserId, true, It.IsAny<CancellationToken>()))
            .ReturnsAsync(budgets);

        var result = await _sut.GetSummaryAsync(UserId);

        result.TotalBudgets.Should().Be(2);
        result.ActiveBudgets.Should().Be(2);
        result.Budgets.Should().HaveCount(2);
        result.TotalBudgetAmount.Should().Be(8000m);
    }
}
