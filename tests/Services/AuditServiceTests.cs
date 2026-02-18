using DigiTransac.Api.Models;
using DigiTransac.Api.Repositories;
using DigiTransac.Api.Services;
using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;
using Moq;

namespace DigiTransac.Tests.Services;

public class AuditServiceTests
{
    private readonly Mock<IAuditLogRepository> _auditLogRepoMock;
    private readonly Mock<IHttpContextAccessor> _httpContextAccessorMock;
    private readonly Mock<ILogger<AuditService>> _loggerMock;
    private readonly AuditService _sut;
    private const string UserId = "user-123";
    private const string UserEmail = "Test@Example.com";

    public AuditServiceTests()
    {
        _auditLogRepoMock = new Mock<IAuditLogRepository>();
        _httpContextAccessorMock = new Mock<IHttpContextAccessor>();
        _loggerMock = new Mock<ILogger<AuditService>>();

        // Set up a default HttpContext
        var httpContext = new DefaultHttpContext();
        httpContext.Request.Path = "/api/test";
        httpContext.Request.Method = "POST";
        httpContext.Request.Headers["User-Agent"] = "TestAgent/1.0";
        httpContext.Connection.RemoteIpAddress = System.Net.IPAddress.Parse("192.168.1.1");
        _httpContextAccessorMock.Setup(x => x.HttpContext).Returns(httpContext);

        _sut = new AuditService(
            _auditLogRepoMock.Object,
            _httpContextAccessorMock.Object,
            _loggerMock.Object);
    }

    // ========================================================================
    // LogAsync
    // ========================================================================

    [Fact]
    public async Task LogAsync_Success_CreatesAuditLogWithCorrectFields()
    {
        AuditLog? capturedLog = null;
        _auditLogRepoMock.Setup(x => x.CreateAsync(It.IsAny<AuditLog>(), It.IsAny<CancellationToken>()))
            .Callback<AuditLog, CancellationToken>((log, _) => capturedLog = log)
            .ReturnsAsync((AuditLog log, CancellationToken _) => log);

        await _sut.LogAsync(
            AuditAction.LoginSuccess,
            AuditCategory.Authentication,
            success: true,
            description: "User logged in",
            userId: UserId,
            userEmail: UserEmail);

        capturedLog.Should().NotBeNull();
        capturedLog!.UserId.Should().Be(UserId);
        capturedLog.UserEmail.Should().Be("test@example.com"); // lowercased
        capturedLog.Action.Should().Be(AuditAction.LoginSuccess);
        capturedLog.Category.Should().Be(AuditCategory.Authentication);
        capturedLog.Success.Should().BeTrue();
        capturedLog.Description.Should().Be("User logged in");
        capturedLog.IpAddress.Should().Be("192.168.1.1");
        capturedLog.UserAgent.Should().Be("TestAgent/1.0");
        capturedLog.RequestPath.Should().Be("/api/test");
        capturedLog.HttpMethod.Should().Be("POST");
    }

    [Fact]
    public async Task LogAsync_Failure_SetsErrorMessage()
    {
        AuditLog? capturedLog = null;
        _auditLogRepoMock.Setup(x => x.CreateAsync(It.IsAny<AuditLog>(), It.IsAny<CancellationToken>()))
            .Callback<AuditLog, CancellationToken>((log, _) => capturedLog = log)
            .ReturnsAsync((AuditLog log, CancellationToken _) => log);

        await _sut.LogAsync(
            AuditAction.LoginFailed,
            AuditCategory.Authentication,
            success: false,
            description: "Login failed",
            errorMessage: "Invalid password");

        capturedLog.Should().NotBeNull();
        capturedLog!.Success.Should().BeFalse();
        capturedLog.ErrorMessage.Should().Be("Invalid password");
    }

    [Fact]
    public async Task LogAsync_WithDetails_StoresDetails()
    {
        AuditLog? capturedLog = null;
        _auditLogRepoMock.Setup(x => x.CreateAsync(It.IsAny<AuditLog>(), It.IsAny<CancellationToken>()))
            .Callback<AuditLog, CancellationToken>((log, _) => capturedLog = log)
            .ReturnsAsync((AuditLog log, CancellationToken _) => log);

        var details = new Dictionary<string, object> { { "key", "value" } };

        await _sut.LogAsync(
            AuditAction.TransactionCreated,
            AuditCategory.FinancialOperation,
            success: true,
            description: "Transaction created",
            details: details);

        capturedLog!.Details.Should().ContainKey("key");
        capturedLog.Details!["key"].Should().Be("value");
    }

    [Fact]
    public async Task LogAsync_NullUserEmail_StoresNull()
    {
        AuditLog? capturedLog = null;
        _auditLogRepoMock.Setup(x => x.CreateAsync(It.IsAny<AuditLog>(), It.IsAny<CancellationToken>()))
            .Callback<AuditLog, CancellationToken>((log, _) => capturedLog = log)
            .ReturnsAsync((AuditLog log, CancellationToken _) => log);

        await _sut.LogAsync(
            AuditAction.SuspiciousActivity,
            AuditCategory.Security,
            success: false,
            description: "Suspicious",
            userEmail: null);

        capturedLog!.UserEmail.Should().BeNull();
    }

    [Fact]
    public async Task LogAsync_RepositoryThrows_DoesNotRethrow()
    {
        _auditLogRepoMock.Setup(x => x.CreateAsync(It.IsAny<AuditLog>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new Exception("DB connection failed"));

        // Should not throw - audit logging must never break the main flow
        var act = () => _sut.LogAsync(
            AuditAction.LoginSuccess,
            AuditCategory.Authentication,
            success: true,
            description: "Login");

        await act.Should().NotThrowAsync();
    }

    [Fact]
    public async Task LogAsync_NullHttpContext_SetsNullForContextFields()
    {
        _httpContextAccessorMock.Setup(x => x.HttpContext).Returns((HttpContext?)null);

        AuditLog? capturedLog = null;
        _auditLogRepoMock.Setup(x => x.CreateAsync(It.IsAny<AuditLog>(), It.IsAny<CancellationToken>()))
            .Callback<AuditLog, CancellationToken>((log, _) => capturedLog = log)
            .ReturnsAsync((AuditLog log, CancellationToken _) => log);

        await _sut.LogAsync(
            AuditAction.LoginSuccess,
            AuditCategory.Authentication,
            success: true,
            description: "Login");

        capturedLog!.IpAddress.Should().BeNull();
        capturedLog.UserAgent.Should().BeNull();
        capturedLog.RequestPath.Should().BeNull();
        capturedLog.HttpMethod.Should().BeNull();
        capturedLog.CorrelationId.Should().BeNull();
    }

    // ========================================================================
    // IP Address Extraction
    // ========================================================================

    [Fact]
    public async Task LogAsync_WithXForwardedFor_UsesFirstIp()
    {
        var httpContext = new DefaultHttpContext();
        httpContext.Request.Headers["X-Forwarded-For"] = "10.0.0.1, 10.0.0.2, 10.0.0.3";
        _httpContextAccessorMock.Setup(x => x.HttpContext).Returns(httpContext);

        AuditLog? capturedLog = null;
        _auditLogRepoMock.Setup(x => x.CreateAsync(It.IsAny<AuditLog>(), It.IsAny<CancellationToken>()))
            .Callback<AuditLog, CancellationToken>((log, _) => capturedLog = log)
            .ReturnsAsync((AuditLog log, CancellationToken _) => log);

        await _sut.LogAsync(AuditAction.LoginSuccess, AuditCategory.Authentication, true, "Login");

        capturedLog!.IpAddress.Should().Be("10.0.0.1");
    }

    [Fact]
    public async Task LogAsync_WithXRealIp_UsesRealIp()
    {
        var httpContext = new DefaultHttpContext();
        httpContext.Request.Headers["X-Real-IP"] = "172.16.0.1";
        _httpContextAccessorMock.Setup(x => x.HttpContext).Returns(httpContext);

        AuditLog? capturedLog = null;
        _auditLogRepoMock.Setup(x => x.CreateAsync(It.IsAny<AuditLog>(), It.IsAny<CancellationToken>()))
            .Callback<AuditLog, CancellationToken>((log, _) => capturedLog = log)
            .ReturnsAsync((AuditLog log, CancellationToken _) => log);

        await _sut.LogAsync(AuditAction.LoginSuccess, AuditCategory.Authentication, true, "Login");

        capturedLog!.IpAddress.Should().Be("172.16.0.1");
    }

    [Fact]
    public async Task LogAsync_WithCorrelationId_StoresCorrelationId()
    {
        var httpContext = new DefaultHttpContext();
        httpContext.Request.Headers["X-Correlation-ID"] = "corr-123";
        _httpContextAccessorMock.Setup(x => x.HttpContext).Returns(httpContext);

        AuditLog? capturedLog = null;
        _auditLogRepoMock.Setup(x => x.CreateAsync(It.IsAny<AuditLog>(), It.IsAny<CancellationToken>()))
            .Callback<AuditLog, CancellationToken>((log, _) => capturedLog = log)
            .ReturnsAsync((AuditLog log, CancellationToken _) => log);

        await _sut.LogAsync(AuditAction.LoginSuccess, AuditCategory.Authentication, true, "Login");

        capturedLog!.CorrelationId.Should().Be("corr-123");
    }

    // ========================================================================
    // Specific Log Methods
    // ========================================================================

    [Fact]
    public async Task LogLoginSuccessAsync_CallsLogWithCorrectParams()
    {
        _auditLogRepoMock.Setup(x => x.CreateAsync(It.IsAny<AuditLog>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((AuditLog log, CancellationToken _) => log);

        await _sut.LogLoginSuccessAsync(UserId, UserEmail);

        _auditLogRepoMock.Verify(x => x.CreateAsync(
            It.Is<AuditLog>(l =>
                l.Action == AuditAction.LoginSuccess &&
                l.Category == AuditCategory.Authentication &&
                l.Success == true &&
                l.UserId == UserId &&
                l.UserEmail == "test@example.com"),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task LogLoginFailedAsync_SetsFailureWithReason()
    {
        _auditLogRepoMock.Setup(x => x.CreateAsync(It.IsAny<AuditLog>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((AuditLog log, CancellationToken _) => log);

        await _sut.LogLoginFailedAsync(UserEmail, "Invalid credentials");

        _auditLogRepoMock.Verify(x => x.CreateAsync(
            It.Is<AuditLog>(l =>
                l.Action == AuditAction.LoginFailed &&
                l.Success == false &&
                l.ErrorMessage == "Invalid credentials"),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task LogLogoutAsync_CallsLogWithCorrectParams()
    {
        _auditLogRepoMock.Setup(x => x.CreateAsync(It.IsAny<AuditLog>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((AuditLog log, CancellationToken _) => log);

        await _sut.LogLogoutAsync(UserId, UserEmail);

        _auditLogRepoMock.Verify(x => x.CreateAsync(
            It.Is<AuditLog>(l =>
                l.Action == AuditAction.Logout &&
                l.Category == AuditCategory.Authentication &&
                l.Success == true),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task LogUserRegistrationAsync_Success_SetsCorrectAction()
    {
        _auditLogRepoMock.Setup(x => x.CreateAsync(It.IsAny<AuditLog>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((AuditLog log, CancellationToken _) => log);

        await _sut.LogUserRegistrationAsync(UserId, UserEmail, true);

        _auditLogRepoMock.Verify(x => x.CreateAsync(
            It.Is<AuditLog>(l =>
                l.Action == AuditAction.UserRegistration &&
                l.Category == AuditCategory.AccountManagement &&
                l.Success == true),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task LogUserRegistrationAsync_Failure_SetsErrorMessage()
    {
        _auditLogRepoMock.Setup(x => x.CreateAsync(It.IsAny<AuditLog>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((AuditLog log, CancellationToken _) => log);

        await _sut.LogUserRegistrationAsync(UserId, UserEmail, false, "Email taken");

        _auditLogRepoMock.Verify(x => x.CreateAsync(
            It.Is<AuditLog>(l =>
                l.Success == false &&
                l.ErrorMessage == "Email taken"),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task LogPasswordChangeAsync_Success_SetsCorrectAction()
    {
        _auditLogRepoMock.Setup(x => x.CreateAsync(It.IsAny<AuditLog>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((AuditLog log, CancellationToken _) => log);

        await _sut.LogPasswordChangeAsync(UserId, UserEmail, true);

        _auditLogRepoMock.Verify(x => x.CreateAsync(
            It.Is<AuditLog>(l =>
                l.Action == AuditAction.PasswordChanged &&
                l.Category == AuditCategory.AccountManagement &&
                l.Success == true),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task LogTwoFactorToggleAsync_Enabled_SetsTwoFactorEnabled()
    {
        _auditLogRepoMock.Setup(x => x.CreateAsync(It.IsAny<AuditLog>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((AuditLog log, CancellationToken _) => log);

        await _sut.LogTwoFactorToggleAsync(UserId, UserEmail, enabled: true);

        _auditLogRepoMock.Verify(x => x.CreateAsync(
            It.Is<AuditLog>(l =>
                l.Action == AuditAction.TwoFactorEnabled &&
                l.Category == AuditCategory.TwoFactor),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task LogTwoFactorToggleAsync_Disabled_SetsTwoFactorDisabled()
    {
        _auditLogRepoMock.Setup(x => x.CreateAsync(It.IsAny<AuditLog>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((AuditLog log, CancellationToken _) => log);

        await _sut.LogTwoFactorToggleAsync(UserId, UserEmail, enabled: false);

        _auditLogRepoMock.Verify(x => x.CreateAsync(
            It.Is<AuditLog>(l =>
                l.Action == AuditAction.TwoFactorDisabled),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task LogTwoFactorVerificationAsync_Success_SetsVerified()
    {
        _auditLogRepoMock.Setup(x => x.CreateAsync(It.IsAny<AuditLog>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((AuditLog log, CancellationToken _) => log);

        await _sut.LogTwoFactorVerificationAsync(UserId, UserEmail, true);

        _auditLogRepoMock.Verify(x => x.CreateAsync(
            It.Is<AuditLog>(l =>
                l.Action == AuditAction.TwoFactorVerified &&
                l.Success == true),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task LogTwoFactorVerificationAsync_Failure_SetsFailed()
    {
        _auditLogRepoMock.Setup(x => x.CreateAsync(It.IsAny<AuditLog>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((AuditLog log, CancellationToken _) => log);

        await _sut.LogTwoFactorVerificationAsync(UserId, UserEmail, false);

        _auditLogRepoMock.Verify(x => x.CreateAsync(
            It.Is<AuditLog>(l =>
                l.Action == AuditAction.TwoFactorFailed &&
                l.Success == false),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task LogTransactionCreatedAsync_StoresTransactionDetails()
    {
        AuditLog? capturedLog = null;
        _auditLogRepoMock.Setup(x => x.CreateAsync(It.IsAny<AuditLog>(), It.IsAny<CancellationToken>()))
            .Callback<AuditLog, CancellationToken>((log, _) => capturedLog = log)
            .ReturnsAsync((AuditLog log, CancellationToken _) => log);

        await _sut.LogTransactionCreatedAsync(UserId, "txn-1", "Send", 100.50m, "USD");

        capturedLog!.Action.Should().Be(AuditAction.TransactionCreated);
        capturedLog.Category.Should().Be(AuditCategory.FinancialOperation);
        capturedLog.Details.Should().ContainKey("transactionId");
        capturedLog.Details!["transactionId"].Should().Be("txn-1");
        capturedLog.Details["type"].Should().Be("Send");
        capturedLog.Details["amount"].Should().Be(100.50m);
        capturedLog.Details["currency"].Should().Be("USD");
    }

    [Fact]
    public async Task LogTransactionDeletedAsync_StoresTransactionId()
    {
        AuditLog? capturedLog = null;
        _auditLogRepoMock.Setup(x => x.CreateAsync(It.IsAny<AuditLog>(), It.IsAny<CancellationToken>()))
            .Callback<AuditLog, CancellationToken>((log, _) => capturedLog = log)
            .ReturnsAsync((AuditLog log, CancellationToken _) => log);

        await _sut.LogTransactionDeletedAsync(UserId, "txn-1");

        capturedLog!.Action.Should().Be(AuditAction.TransactionDeleted);
        capturedLog.Details!["transactionId"].Should().Be("txn-1");
    }

    [Fact]
    public async Task LogAccountDeletedAsync_SetsCorrectFields()
    {
        _auditLogRepoMock.Setup(x => x.CreateAsync(It.IsAny<AuditLog>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((AuditLog log, CancellationToken _) => log);

        await _sut.LogAccountDeletedAsync(UserId, UserEmail);

        _auditLogRepoMock.Verify(x => x.CreateAsync(
            It.Is<AuditLog>(l =>
                l.Action == AuditAction.AccountDeleted &&
                l.Category == AuditCategory.AccountManagement &&
                l.UserId == UserId),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task LogDataExportAsync_StoresExportDetails()
    {
        AuditLog? capturedLog = null;
        _auditLogRepoMock.Setup(x => x.CreateAsync(It.IsAny<AuditLog>(), It.IsAny<CancellationToken>()))
            .Callback<AuditLog, CancellationToken>((log, _) => capturedLog = log)
            .ReturnsAsync((AuditLog log, CancellationToken _) => log);

        await _sut.LogDataExportAsync(UserId, "CSV", 150);

        capturedLog!.Action.Should().Be(AuditAction.DataExported);
        capturedLog.Category.Should().Be(AuditCategory.DataAccess);
        capturedLog.Details!["exportType"].Should().Be("CSV");
        capturedLog.Details["recordCount"].Should().Be(150);
    }

    [Fact]
    public async Task LogSuspiciousActivityAsync_SetsSecurityCategory()
    {
        _auditLogRepoMock.Setup(x => x.CreateAsync(It.IsAny<AuditLog>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((AuditLog log, CancellationToken _) => log);

        await _sut.LogSuspiciousActivityAsync(UserId, "Multiple failed logins");

        _auditLogRepoMock.Verify(x => x.CreateAsync(
            It.Is<AuditLog>(l =>
                l.Action == AuditAction.SuspiciousActivity &&
                l.Category == AuditCategory.Security &&
                l.Success == false),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    // ========================================================================
    // Budget Audit Methods
    // ========================================================================

    [Fact]
    public async Task LogBudgetCreatedAsync_StoresBudgetDetails()
    {
        AuditLog? capturedLog = null;
        _auditLogRepoMock.Setup(x => x.CreateAsync(It.IsAny<AuditLog>(), It.IsAny<CancellationToken>()))
            .Callback<AuditLog, CancellationToken>((log, _) => capturedLog = log)
            .ReturnsAsync((AuditLog log, CancellationToken _) => log);

        await _sut.LogBudgetCreatedAsync(UserId, "budget-1", "Food", 5000m, "INR");

        capturedLog!.Action.Should().Be(AuditAction.BudgetCreated);
        capturedLog.Category.Should().Be(AuditCategory.FinancialOperation);
        capturedLog.Details!["budgetId"].Should().Be("budget-1");
        capturedLog.Details["budgetName"].Should().Be("Food");
        capturedLog.Details["amount"].Should().Be(5000m);
        capturedLog.Details["currency"].Should().Be("INR");
    }

    [Fact]
    public async Task LogBudgetUpdatedAsync_StoresChanges()
    {
        AuditLog? capturedLog = null;
        _auditLogRepoMock.Setup(x => x.CreateAsync(It.IsAny<AuditLog>(), It.IsAny<CancellationToken>()))
            .Callback<AuditLog, CancellationToken>((log, _) => capturedLog = log)
            .ReturnsAsync((AuditLog log, CancellationToken _) => log);

        var changes = new Dictionary<string, object> { { "amount", 6000m } };
        await _sut.LogBudgetUpdatedAsync(UserId, "budget-1", "Food", changes);

        capturedLog!.Action.Should().Be(AuditAction.BudgetUpdated);
        capturedLog.Details!["budgetId"].Should().Be("budget-1");
        capturedLog.Details["changes"].Should().Be(changes);
    }

    [Fact]
    public async Task LogBudgetDeletedAsync_StoresBudgetInfo()
    {
        AuditLog? capturedLog = null;
        _auditLogRepoMock.Setup(x => x.CreateAsync(It.IsAny<AuditLog>(), It.IsAny<CancellationToken>()))
            .Callback<AuditLog, CancellationToken>((log, _) => capturedLog = log)
            .ReturnsAsync((AuditLog log, CancellationToken _) => log);

        await _sut.LogBudgetDeletedAsync(UserId, "budget-1", "Food");

        capturedLog!.Action.Should().Be(AuditAction.BudgetDeleted);
        capturedLog.Details!["budgetId"].Should().Be("budget-1");
        capturedLog.Details["budgetName"].Should().Be("Food");
    }

    [Fact]
    public async Task LogBudgetAlertTriggeredAsync_StoresThresholds()
    {
        AuditLog? capturedLog = null;
        _auditLogRepoMock.Setup(x => x.CreateAsync(It.IsAny<AuditLog>(), It.IsAny<CancellationToken>()))
            .Callback<AuditLog, CancellationToken>((log, _) => capturedLog = log)
            .ReturnsAsync((AuditLog log, CancellationToken _) => log);

        await _sut.LogBudgetAlertTriggeredAsync(UserId, "budget-1", "Food", 80m, 85.5m);

        capturedLog!.Action.Should().Be(AuditAction.BudgetAlertTriggered);
        capturedLog.Details!["thresholdPercent"].Should().Be(80m);
        capturedLog.Details["actualPercent"].Should().Be(85.5m);
    }

    // ========================================================================
    // GetFailedLoginCountAsync
    // ========================================================================

    [Fact]
    public async Task GetFailedLoginCountAsync_DelegatesToRepository()
    {
        _auditLogRepoMock.Setup(x => x.GetFailedLoginCountAsync("test@example.com", TimeSpan.FromMinutes(15), It.IsAny<CancellationToken>()))
            .ReturnsAsync(3);

        var result = await _sut.GetFailedLoginCountAsync("test@example.com", TimeSpan.FromMinutes(15));

        result.Should().Be(3);
    }

    [Fact]
    public async Task GetFailedLoginCountAsync_NoFailures_ReturnsZero()
    {
        _auditLogRepoMock.Setup(x => x.GetFailedLoginCountAsync(It.IsAny<string>(), It.IsAny<TimeSpan>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(0);

        var result = await _sut.GetFailedLoginCountAsync("clean@example.com", TimeSpan.FromHours(1));

        result.Should().Be(0);
    }
}
