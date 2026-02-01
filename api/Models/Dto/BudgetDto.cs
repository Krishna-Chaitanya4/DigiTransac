namespace DigiTransac.Api.Models.Dto;

// ===== Request DTOs =====

/// <summary>
/// Request to create a new budget
/// </summary>
public record CreateBudgetRequest(
    string Name,
    string? Description,
    decimal Amount,
    string Currency,
    string Period,              // Weekly, Monthly, Quarterly, Yearly, Custom
    DateTime? StartDate,        // Optional, defaults to current period start
    DateTime? EndDate,          // Required for Custom period
    List<string>? LabelIds,     // Categories to track (empty = all expenses)
    List<string>? AccountIds,   // Accounts to track (empty = all accounts)
    List<BudgetAlertRequest>? Alerts,  // Alert thresholds
    string? Color,
    string? Icon
);

/// <summary>
/// Request to update an existing budget
/// </summary>
public record UpdateBudgetRequest(
    string? Name,
    string? Description,
    decimal? Amount,
    string? Currency,
    string? Period,
    DateTime? StartDate,
    DateTime? EndDate,
    List<string>? LabelIds,
    List<string>? AccountIds,
    List<BudgetAlertRequest>? Alerts,
    bool? IsActive,
    string? Color,
    string? Icon
);

/// <summary>
/// Alert threshold configuration
/// </summary>
public record BudgetAlertRequest(
    int ThresholdPercent,       // 0-100
    bool NotifyEnabled = true
);

// ===== Response DTOs =====

/// <summary>
/// Budget alert configuration response
/// </summary>
public record BudgetAlertResponse(
    int ThresholdPercent,
    bool NotifyEnabled,
    bool Triggered,
    DateTime? LastTriggeredAt
);

/// <summary>
/// Budget response with current spending information
/// </summary>
public record BudgetResponse(
    string Id,
    string Name,
    string? Description,
    decimal Amount,
    string Currency,
    string Period,
    DateTime StartDate,
    DateTime? EndDate,
    List<string> LabelIds,
    List<LabelInfo> Labels,      // Label details for display
    List<string> AccountIds,
    List<AccountInfo> Accounts,  // Account details for display
    List<BudgetAlertResponse> Alerts,
    bool IsActive,
    string? Color,
    string? Icon,
    // Computed fields
    decimal AmountSpent,         // Total spent in current period
    decimal AmountRemaining,     // Amount remaining in budget
    decimal PercentUsed,         // Percentage of budget used (0-100+)
    DateTime PeriodStart,        // Current period start date
    DateTime PeriodEnd,          // Current period end date
    int DaysRemaining,           // Days left in current period
    bool IsOverBudget,           // True if spending exceeds budget
    DateTime CreatedAt,
    DateTime UpdatedAt
);

/// <summary>
/// Simplified label info for budget display
/// </summary>
public record LabelInfo(
    string Id,
    string Name,
    string? Color,
    string? Icon
);

/// <summary>
/// Simplified account info for budget display
/// </summary>
public record AccountInfo(
    string Id,
    string Name,
    string Currency
);

/// <summary>
/// Budget summary for dashboard/overview
/// </summary>
public record BudgetSummaryResponse(
    int TotalBudgets,
    int ActiveBudgets,
    int OverBudgetCount,
    int NearLimitCount,          // Within 80% of budget
    decimal TotalBudgetAmount,
    decimal TotalSpent,
    decimal TotalRemaining,
    string PrimaryCurrency,
    List<BudgetResponse> Budgets
);

/// <summary>
/// Budget notification response
/// </summary>
public record BudgetNotificationResponse(
    string Id,
    string BudgetId,
    string BudgetName,
    int ThresholdPercent,
    decimal ActualPercent,
    decimal AmountSpent,
    decimal BudgetAmount,
    string Currency,
    bool IsRead,
    DateTime PeriodStart,
    DateTime PeriodEnd,
    DateTime CreatedAt
);

/// <summary>
/// List of budget notifications
/// </summary>
public record BudgetNotificationListResponse(
    List<BudgetNotificationResponse> Notifications,
    int UnreadCount,
    int TotalCount
);

/// <summary>
/// Budget spending breakdown by category
/// </summary>
public record BudgetSpendingBreakdown(
    string BudgetId,
    string BudgetName,
    decimal BudgetAmount,
    decimal TotalSpent,
    decimal PercentUsed,
    string Currency,
    DateTime PeriodStart,
    DateTime PeriodEnd,
    List<CategorySpending> ByCategory,
    List<DailySpending> DailyTrend
);

/// <summary>
/// Spending by category
/// </summary>
public record CategorySpending(
    string? LabelId,
    string? LabelName,
    string? LabelColor,
    string? LabelIcon,
    decimal Amount,
    decimal Percentage,
    int TransactionCount
);

/// <summary>
/// Daily spending for trend charts
/// </summary>
public record DailySpending(
    DateTime Date,
    decimal Amount,
    decimal CumulativeAmount,
    decimal BudgetProrated    // Prorated budget amount for the day
);