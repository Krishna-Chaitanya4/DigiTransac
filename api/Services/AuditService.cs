using DigiTransac.Api.Models;
using DigiTransac.Api.Repositories;
using Microsoft.AspNetCore.Http;

namespace DigiTransac.Api.Services;

/// <summary>
/// Service for logging audit events throughout the application.
/// Provides methods for common audit scenarios and extracting request context.
/// </summary>
public interface IAuditService
{
    /// <summary>
    /// Log a generic audit event
    /// </summary>
    Task LogAsync(
        AuditAction action,
        AuditCategory category,
        bool success,
        string description,
        string? userId = null,
        string? userEmail = null,
        Dictionary<string, object>? details = null,
        string? errorMessage = null);

    /// <summary>
    /// Log a successful login
    /// </summary>
    Task LogLoginSuccessAsync(string userId, string email);

    /// <summary>
    /// Log a failed login attempt
    /// </summary>
    Task LogLoginFailedAsync(string email, string reason);

    /// <summary>
    /// Log a logout event
    /// </summary>
    Task LogLogoutAsync(string userId, string email);

    /// <summary>
    /// Log user registration
    /// </summary>
    Task LogUserRegistrationAsync(string userId, string email, bool success, string? errorMessage = null);

    /// <summary>
    /// Log password change
    /// </summary>
    Task LogPasswordChangeAsync(string userId, string email, bool success, string? errorMessage = null);

    /// <summary>
    /// Log 2FA toggle
    /// </summary>
    Task LogTwoFactorToggleAsync(string userId, string email, bool enabled);

    /// <summary>
    /// Log 2FA verification attempt
    /// </summary>
    Task LogTwoFactorVerificationAsync(string userId, string email, bool success);

    /// <summary>
    /// Log transaction creation
    /// </summary>
    Task LogTransactionCreatedAsync(string userId, string transactionId, string type, decimal amount, string currency);

    /// <summary>
    /// Log transaction deletion
    /// </summary>
    Task LogTransactionDeletedAsync(string userId, string transactionId);

    /// <summary>
    /// Log account deletion
    /// </summary>
    Task LogAccountDeletedAsync(string userId, string email);

    /// <summary>
    /// Log data export
    /// </summary>
    Task LogDataExportAsync(string userId, string exportType, int recordCount);

    /// <summary>
    /// Log suspicious activity
    /// </summary>
    Task LogSuspiciousActivityAsync(string? userId, string description, Dictionary<string, object>? details = null);

    /// <summary>
    /// Get failed login count for an email in the specified time window
    /// </summary>
    Task<int> GetFailedLoginCountAsync(string email, TimeSpan window);
    
    /// <summary>
    /// Log budget creation
    /// </summary>
    Task LogBudgetCreatedAsync(string userId, string budgetId, string budgetName, decimal amount, string currency);
    
    /// <summary>
    /// Log budget update
    /// </summary>
    Task LogBudgetUpdatedAsync(string userId, string budgetId, string budgetName, Dictionary<string, object>? changes = null);
    
    /// <summary>
    /// Log budget deletion
    /// </summary>
    Task LogBudgetDeletedAsync(string userId, string budgetId, string budgetName);
    
    /// <summary>
    /// Log budget alert triggered
    /// </summary>
    Task LogBudgetAlertTriggeredAsync(string userId, string budgetId, string budgetName, decimal thresholdPercent, decimal actualPercent);
}

public class AuditService : IAuditService
{
    private readonly IAuditLogRepository _auditLogRepository;
    private readonly IHttpContextAccessor _httpContextAccessor;
    private readonly ILogger<AuditService> _logger;

    public AuditService(
        IAuditLogRepository auditLogRepository,
        IHttpContextAccessor httpContextAccessor,
        ILogger<AuditService> logger)
    {
        _auditLogRepository = auditLogRepository;
        _httpContextAccessor = httpContextAccessor;
        _logger = logger;
    }

    public async Task LogAsync(
        AuditAction action,
        AuditCategory category,
        bool success,
        string description,
        string? userId = null,
        string? userEmail = null,
        Dictionary<string, object>? details = null,
        string? errorMessage = null)
    {
        try
        {
            var context = _httpContextAccessor.HttpContext;
            
            var auditLog = new AuditLog
            {
                UserId = userId,
                UserEmail = userEmail?.ToLowerInvariant(),
                Action = action,
                Category = category,
                Success = success,
                Description = description,
                Details = details,
                ErrorMessage = errorMessage,
                IpAddress = GetClientIpAddress(context),
                UserAgent = GetUserAgent(context),
                RequestPath = context?.Request.Path.Value,
                HttpMethod = context?.Request.Method,
                CorrelationId = GetCorrelationId(context),
                Timestamp = DateTime.UtcNow
            };

            await _auditLogRepository.CreateAsync(auditLog);

            // Also log to structured logging for real-time monitoring
            if (success)
            {
                _logger.LogInformation(
                    "Audit: {Action} by {UserId} ({UserEmail}) - {Description}",
                    action, userId ?? "anonymous", userEmail ?? "unknown", description);
            }
            else
            {
                _logger.LogWarning(
                    "Audit: {Action} FAILED by {UserId} ({UserEmail}) - {Description}. Error: {ErrorMessage}",
                    action, userId ?? "anonymous", userEmail ?? "unknown", description, errorMessage);
            }
        }
        catch (Exception ex)
        {
            // Audit logging should never break the main flow
            _logger.LogError(ex, "Failed to create audit log for action {Action}", action);
        }
    }

    public Task LogLoginSuccessAsync(string userId, string email)
    {
        return LogAsync(
            AuditAction.LoginSuccess,
            AuditCategory.Authentication,
            success: true,
            description: $"User logged in successfully",
            userId: userId,
            userEmail: email);
    }

    public Task LogLoginFailedAsync(string email, string reason)
    {
        return LogAsync(
            AuditAction.LoginFailed,
            AuditCategory.Authentication,
            success: false,
            description: $"Login attempt failed",
            userEmail: email,
            errorMessage: reason);
    }

    public Task LogLogoutAsync(string userId, string email)
    {
        return LogAsync(
            AuditAction.Logout,
            AuditCategory.Authentication,
            success: true,
            description: "User logged out",
            userId: userId,
            userEmail: email);
    }

    public Task LogUserRegistrationAsync(string userId, string email, bool success, string? errorMessage = null)
    {
        return LogAsync(
            AuditAction.UserRegistration,
            AuditCategory.AccountManagement,
            success: success,
            description: success ? "User registered successfully" : "User registration failed",
            userId: userId,
            userEmail: email,
            errorMessage: errorMessage);
    }

    public Task LogPasswordChangeAsync(string userId, string email, bool success, string? errorMessage = null)
    {
        return LogAsync(
            AuditAction.PasswordChanged,
            AuditCategory.AccountManagement,
            success: success,
            description: success ? "Password changed successfully" : "Password change failed",
            userId: userId,
            userEmail: email,
            errorMessage: errorMessage);
    }

    public Task LogTwoFactorToggleAsync(string userId, string email, bool enabled)
    {
        return LogAsync(
            enabled ? AuditAction.TwoFactorEnabled : AuditAction.TwoFactorDisabled,
            AuditCategory.TwoFactor,
            success: true,
            description: enabled ? "Two-factor authentication enabled" : "Two-factor authentication disabled",
            userId: userId,
            userEmail: email);
    }

    public Task LogTwoFactorVerificationAsync(string userId, string email, bool success)
    {
        return LogAsync(
            success ? AuditAction.TwoFactorVerified : AuditAction.TwoFactorFailed,
            AuditCategory.TwoFactor,
            success: success,
            description: success ? "2FA verification successful" : "2FA verification failed",
            userId: userId,
            userEmail: email);
    }

    public Task LogTransactionCreatedAsync(string userId, string transactionId, string type, decimal amount, string currency)
    {
        return LogAsync(
            AuditAction.TransactionCreated,
            AuditCategory.FinancialOperation,
            success: true,
            description: $"Transaction created: {type} {amount} {currency}",
            userId: userId,
            details: new Dictionary<string, object>
            {
                { "transactionId", transactionId },
                { "type", type },
                { "amount", amount },
                { "currency", currency }
            });
    }

    public Task LogTransactionDeletedAsync(string userId, string transactionId)
    {
        return LogAsync(
            AuditAction.TransactionDeleted,
            AuditCategory.FinancialOperation,
            success: true,
            description: "Transaction deleted",
            userId: userId,
            details: new Dictionary<string, object>
            {
                { "transactionId", transactionId }
            });
    }

    public Task LogAccountDeletedAsync(string userId, string email)
    {
        return LogAsync(
            AuditAction.AccountDeleted,
            AuditCategory.AccountManagement,
            success: true,
            description: "User account deleted",
            userId: userId,
            userEmail: email);
    }

    public Task LogDataExportAsync(string userId, string exportType, int recordCount)
    {
        return LogAsync(
            AuditAction.DataExported,
            AuditCategory.DataAccess,
            success: true,
            description: $"Data exported: {exportType} ({recordCount} records)",
            userId: userId,
            details: new Dictionary<string, object>
            {
                { "exportType", exportType },
                { "recordCount", recordCount }
            });
    }

    public Task LogSuspiciousActivityAsync(string? userId, string description, Dictionary<string, object>? details = null)
    {
        return LogAsync(
            AuditAction.SuspiciousActivity,
            AuditCategory.Security,
            success: false,
            description: description,
            userId: userId,
            details: details);
    }
    
    public Task LogBudgetCreatedAsync(string userId, string budgetId, string budgetName, decimal amount, string currency)
    {
        return LogAsync(
            AuditAction.BudgetCreated,
            AuditCategory.FinancialOperation,
            success: true,
            description: $"Budget created: {budgetName} ({amount} {currency})",
            userId: userId,
            details: new Dictionary<string, object>
            {
                { "budgetId", budgetId },
                { "budgetName", budgetName },
                { "amount", amount },
                { "currency", currency }
            });
    }
    
    public Task LogBudgetUpdatedAsync(string userId, string budgetId, string budgetName, Dictionary<string, object>? changes = null)
    {
        return LogAsync(
            AuditAction.BudgetUpdated,
            AuditCategory.FinancialOperation,
            success: true,
            description: $"Budget updated: {budgetName}",
            userId: userId,
            details: new Dictionary<string, object>
            {
                { "budgetId", budgetId },
                { "budgetName", budgetName },
                { "changes", changes ?? new Dictionary<string, object>() }
            });
    }
    
    public Task LogBudgetDeletedAsync(string userId, string budgetId, string budgetName)
    {
        return LogAsync(
            AuditAction.BudgetDeleted,
            AuditCategory.FinancialOperation,
            success: true,
            description: $"Budget deleted: {budgetName}",
            userId: userId,
            details: new Dictionary<string, object>
            {
                { "budgetId", budgetId },
                { "budgetName", budgetName }
            });
    }
    
    public Task LogBudgetAlertTriggeredAsync(string userId, string budgetId, string budgetName, decimal thresholdPercent, decimal actualPercent)
    {
        return LogAsync(
            AuditAction.BudgetAlertTriggered,
            AuditCategory.FinancialOperation,
            success: true,
            description: $"Budget alert: {budgetName} at {actualPercent:F1}% (threshold: {thresholdPercent}%)",
            userId: userId,
            details: new Dictionary<string, object>
            {
                { "budgetId", budgetId },
                { "budgetName", budgetName },
                { "thresholdPercent", thresholdPercent },
                { "actualPercent", actualPercent }
            });
    }

    public Task<int> GetFailedLoginCountAsync(string email, TimeSpan window)
    {
        return _auditLogRepository.GetFailedLoginCountAsync(email, window);
    }

    private static string? GetClientIpAddress(HttpContext? context)
    {
        if (context == null) return null;

        // Check for forwarded IP (behind proxy/load balancer)
        var forwardedFor = context.Request.Headers["X-Forwarded-For"].FirstOrDefault();
        if (!string.IsNullOrEmpty(forwardedFor))
        {
            // Take the first IP if multiple are present
            return forwardedFor.Split(',').FirstOrDefault()?.Trim();
        }

        // Check X-Real-IP header
        var realIp = context.Request.Headers["X-Real-IP"].FirstOrDefault();
        if (!string.IsNullOrEmpty(realIp))
        {
            return realIp;
        }

        // Fall back to remote IP address
        return context.Connection.RemoteIpAddress?.ToString();
    }

    private static string? GetUserAgent(HttpContext? context)
    {
        return context?.Request.Headers.UserAgent.FirstOrDefault();
    }

    private static string? GetCorrelationId(HttpContext? context)
    {
        // Try to get correlation ID from various headers
        var correlationId = context?.Request.Headers["X-Correlation-ID"].FirstOrDefault()
            ?? context?.Request.Headers["X-Request-ID"].FirstOrDefault()
            ?? context?.TraceIdentifier;
        
        return correlationId;
    }
}