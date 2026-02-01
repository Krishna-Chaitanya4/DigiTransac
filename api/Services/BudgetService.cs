using DigiTransac.Api.Hubs;
using DigiTransac.Api.Models;
using DigiTransac.Api.Models.Dto;
using DigiTransac.Api.Repositories;

namespace DigiTransac.Api.Services;

/// <summary>
/// Service interface for budget management and spending alerts
/// </summary>
public interface IBudgetService
{
    Task<(bool Success, string Message, BudgetResponse? Budget)> CreateAsync(string userId, CreateBudgetRequest request);
    Task<(bool Success, string Message, BudgetResponse? Budget)> UpdateAsync(string budgetId, string userId, UpdateBudgetRequest request);
    Task<(bool Success, string Message)> DeleteAsync(string budgetId, string userId);
    Task<BudgetResponse?> GetByIdAsync(string budgetId, string userId);
    Task<BudgetSummaryResponse> GetSummaryAsync(string userId, bool? activeOnly = true);
    Task<BudgetSpendingBreakdown?> GetSpendingBreakdownAsync(string budgetId, string userId);
    Task<BudgetNotificationListResponse> GetNotificationsAsync(string userId, bool? unreadOnly = null);
    Task<bool> MarkNotificationAsReadAsync(string notificationId, string userId);
    Task<bool> MarkAllNotificationsAsReadAsync(string userId);
    
    // Called when transactions are created/updated/deleted to check budget alerts
    Task CheckBudgetAlertsAsync(string userId, string? accountId, List<string>? labelIds);
}

/// <summary>
/// Service for budget tracking and spending alerts
/// </summary>
public class BudgetService : IBudgetService
{
    private readonly IBudgetRepository _budgetRepository;
    private readonly ITransactionRepository _transactionRepository;
    private readonly ILabelRepository _labelRepository;
    private readonly IAccountRepository _accountRepository;
    private readonly IUserRepository _userRepository;
    private readonly IExchangeRateService _exchangeRateService;
    private readonly INotificationService _notificationService;
    private readonly ILogger<BudgetService> _logger;

    public BudgetService(
        IBudgetRepository budgetRepository,
        ITransactionRepository transactionRepository,
        ILabelRepository labelRepository,
        IAccountRepository accountRepository,
        IUserRepository userRepository,
        IExchangeRateService exchangeRateService,
        INotificationService notificationService,
        ILogger<BudgetService> logger)
    {
        _budgetRepository = budgetRepository;
        _transactionRepository = transactionRepository;
        _labelRepository = labelRepository;
        _accountRepository = accountRepository;
        _userRepository = userRepository;
        _exchangeRateService = exchangeRateService;
        _notificationService = notificationService;
        _logger = logger;
    }

    public async Task<(bool Success, string Message, BudgetResponse? Budget)> CreateAsync(string userId, CreateBudgetRequest request)
    {
        _logger.LogInformation("Creating budget '{Name}' for user {UserId}", request.Name, userId);

        // Validate period
        if (!Enum.TryParse<BudgetPeriod>(request.Period, true, out var period))
        {
            return (false, $"Invalid period: {request.Period}. Valid values: Weekly, Monthly, Quarterly, Yearly, Custom", null);
        }

        // Validate custom period has end date
        if (period == BudgetPeriod.Custom && !request.EndDate.HasValue)
        {
            return (false, "EndDate is required for Custom period", null);
        }

        // Validate amount
        if (request.Amount <= 0)
        {
            return (false, "Amount must be greater than 0", null);
        }

        // Calculate period dates
        var (periodStart, periodEnd) = CalculatePeriodDates(period, request.StartDate, request.EndDate);

        var budget = new Budget
        {
            UserId = userId,
            Name = request.Name.Trim(),
            Description = request.Description?.Trim(),
            Amount = request.Amount,
            Currency = request.Currency ?? "INR",
            Period = period,
            StartDate = periodStart,
            EndDate = period == BudgetPeriod.Custom ? request.EndDate : null,
            LabelIds = request.LabelIds ?? new List<string>(),
            AccountIds = request.AccountIds ?? new List<string>(),
            Alerts = MapAlerts(request.Alerts),
            Color = request.Color,
            Icon = request.Icon,
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        await _budgetRepository.CreateAsync(budget);

        var response = await BuildBudgetResponseAsync(budget, userId);
        return (true, "Budget created successfully", response);
    }

    public async Task<(bool Success, string Message, BudgetResponse? Budget)> UpdateAsync(string budgetId, string userId, UpdateBudgetRequest request)
    {
        var budget = await _budgetRepository.GetByIdAndUserIdAsync(budgetId, userId);
        if (budget == null)
        {
            return (false, "Budget not found", null);
        }

        // Update fields
        if (!string.IsNullOrWhiteSpace(request.Name))
            budget.Name = request.Name.Trim();
        if (request.Description != null)
            budget.Description = request.Description.Trim();
        if (request.Amount.HasValue && request.Amount.Value > 0)
            budget.Amount = request.Amount.Value;
        if (!string.IsNullOrWhiteSpace(request.Currency))
            budget.Currency = request.Currency;
        if (!string.IsNullOrWhiteSpace(request.Period) && Enum.TryParse<BudgetPeriod>(request.Period, true, out var period))
        {
            budget.Period = period;
            var (periodStart, periodEnd) = CalculatePeriodDates(period, request.StartDate ?? budget.StartDate, request.EndDate);
            budget.StartDate = periodStart;
            budget.EndDate = period == BudgetPeriod.Custom ? request.EndDate : null;
        }
        if (request.LabelIds != null)
            budget.LabelIds = request.LabelIds;
        if (request.AccountIds != null)
            budget.AccountIds = request.AccountIds;
        if (request.Alerts != null)
            budget.Alerts = MapAlerts(request.Alerts);
        if (request.IsActive.HasValue)
            budget.IsActive = request.IsActive.Value;
        if (request.Color != null)
            budget.Color = request.Color;
        if (request.Icon != null)
            budget.Icon = request.Icon;

        budget.UpdatedAt = DateTime.UtcNow;
        await _budgetRepository.UpdateAsync(budget);

        var response = await BuildBudgetResponseAsync(budget, userId);
        return (true, "Budget updated successfully", response);
    }

    public async Task<(bool Success, string Message)> DeleteAsync(string budgetId, string userId)
    {
        var budget = await _budgetRepository.GetByIdAndUserIdAsync(budgetId, userId);
        if (budget == null)
        {
            return (false, "Budget not found");
        }

        await _budgetRepository.DeleteAsync(budgetId);
        _logger.LogInformation("Deleted budget {BudgetId} for user {UserId}", budgetId, userId);
        return (true, "Budget deleted successfully");
    }

    public async Task<BudgetResponse?> GetByIdAsync(string budgetId, string userId)
    {
        var budget = await _budgetRepository.GetByIdAndUserIdAsync(budgetId, userId);
        if (budget == null) return null;

        return await BuildBudgetResponseAsync(budget, userId);
    }

    public async Task<BudgetSummaryResponse> GetSummaryAsync(string userId, bool? activeOnly = true)
    {
        var budgets = await _budgetRepository.GetByUserIdAsync(userId, activeOnly);
        var responses = new List<BudgetResponse>();
        
        // Get user's primary currency and exchange rates for conversion
        var user = await _userRepository.GetByIdAsync(userId);
        var primaryCurrency = user?.PrimaryCurrency ?? "USD";
        var ratesResponse = await _exchangeRateService.GetRatesAsync();
        var rates = ratesResponse?.Rates ?? new Dictionary<string, decimal>();
        
        decimal totalBudgetAmount = 0;
        decimal totalSpent = 0;
        int overBudgetCount = 0;
        int nearLimitCount = 0;

        foreach (var budget in budgets)
        {
            var response = await BuildBudgetResponseAsync(budget, userId);
            responses.Add(response);

            // Convert budget amounts to user's primary currency
            var convertedBudgetAmount = _exchangeRateService.Convert(
                budget.Amount, budget.Currency, primaryCurrency, rates);
            var convertedSpent = _exchangeRateService.Convert(
                response.AmountSpent, budget.Currency, primaryCurrency, rates);
            
            totalBudgetAmount += convertedBudgetAmount;
            totalSpent += convertedSpent;

            if (response.IsOverBudget)
                overBudgetCount++;
            else if (response.PercentUsed >= 80)
                nearLimitCount++;
        }

        return new BudgetSummaryResponse(
            TotalBudgets: budgets.Count,
            ActiveBudgets: budgets.Count(b => b.IsActive),
            OverBudgetCount: overBudgetCount,
            NearLimitCount: nearLimitCount,
            TotalBudgetAmount: totalBudgetAmount,
            TotalSpent: totalSpent,
            TotalRemaining: totalBudgetAmount - totalSpent,
            PrimaryCurrency: primaryCurrency,
            Budgets: responses
        );
    }

    public async Task<BudgetSpendingBreakdown?> GetSpendingBreakdownAsync(string budgetId, string userId)
    {
        var budget = await _budgetRepository.GetByIdAndUserIdAsync(budgetId, userId);
        if (budget == null) return null;

        var (periodStart, periodEnd) = GetCurrentPeriodDates(budget);
        var transactions = await GetBudgetTransactionsAsync(userId, budget, periodStart, periodEnd);

        // Group by category
        var byCategory = transactions
            .SelectMany(t => t.Splits.Select(s => new { t, s }))
            .GroupBy(x => x.s.LabelId)
            .Select(g =>
            {
                var label = g.First().t.Splits.FirstOrDefault(s => s.LabelId == g.Key);
                return new CategorySpending(
                    LabelId: g.Key,
                    LabelName: null, // Will be enriched
                    LabelColor: null,
                    LabelIcon: null,
                    Amount: g.Sum(x => x.s.Amount),
                    Percentage: 0, // Calculated below
                    TransactionCount: g.Select(x => x.t.Id).Distinct().Count()
                );
            })
            .ToList();

        // Calculate percentages and enrich with label info
        var totalSpent = byCategory.Sum(c => c.Amount);
        var labels = await _labelRepository.GetByUserIdAsync(userId);
        var labelDict = labels.ToDictionary(l => l.Id);

        byCategory = byCategory.Select(c =>
        {
            var label = c.LabelId != null && labelDict.TryGetValue(c.LabelId, out var l) ? l : null;
            return c with
            {
                LabelName = label?.Name ?? "Uncategorized",
                LabelColor = label?.Color,
                LabelIcon = label?.Icon,
                Percentage = totalSpent > 0 ? Math.Round((c.Amount / totalSpent) * 100, 1) : 0
            };
        })
        .OrderByDescending(c => c.Amount)
        .ToList();

        // Daily trend
        var dailySpending = transactions
            .GroupBy(t => t.Date.Date)
            .OrderBy(g => g.Key)
            .Select(g => new
            {
                Date = g.Key,
                Amount = g.Sum(t => t.Amount)
            })
            .ToList();

        decimal cumulative = 0;
        var daysInPeriod = (periodEnd - periodStart).Days + 1;
        var dailyBudget = budget.Amount / daysInPeriod;

        var dailyTrend = new List<DailySpending>();
        foreach (var day in dailySpending)
        {
            cumulative += day.Amount;
            var dayNumber = (day.Date - periodStart).Days + 1;
            dailyTrend.Add(new DailySpending(
                Date: day.Date,
                Amount: day.Amount,
                CumulativeAmount: cumulative,
                BudgetProrated: dailyBudget * dayNumber
            ));
        }

        return new BudgetSpendingBreakdown(
            BudgetId: budget.Id,
            BudgetName: budget.Name,
            BudgetAmount: budget.Amount,
            TotalSpent: totalSpent,
            PercentUsed: budget.Amount > 0 ? Math.Round((totalSpent / budget.Amount) * 100, 1) : 0,
            Currency: budget.Currency,
            PeriodStart: periodStart,
            PeriodEnd: periodEnd,
            ByCategory: byCategory,
            DailyTrend: dailyTrend
        );
    }

    public async Task<BudgetNotificationListResponse> GetNotificationsAsync(string userId, bool? unreadOnly = null)
    {
        var notifications = await _budgetRepository.GetNotificationsByUserIdAsync(userId, unreadOnly);
        var unreadCount = await _budgetRepository.GetUnreadNotificationCountAsync(userId);

        var responses = notifications.Select(n => new BudgetNotificationResponse(
            Id: n.Id,
            BudgetId: n.BudgetId,
            BudgetName: n.BudgetName,
            ThresholdPercent: n.ThresholdPercent,
            ActualPercent: n.ActualPercent,
            AmountSpent: n.AmountSpent,
            BudgetAmount: n.BudgetAmount,
            Currency: n.Currency,
            IsRead: n.IsRead,
            PeriodStart: n.PeriodStart,
            PeriodEnd: n.PeriodEnd,
            CreatedAt: n.CreatedAt
        )).ToList();

        return new BudgetNotificationListResponse(
            Notifications: responses,
            UnreadCount: unreadCount,
            TotalCount: notifications.Count
        );
    }

    public async Task<bool> MarkNotificationAsReadAsync(string notificationId, string userId)
    {
        return await _budgetRepository.MarkNotificationAsReadAsync(notificationId, userId);
    }

    public async Task<bool> MarkAllNotificationsAsReadAsync(string userId)
    {
        return await _budgetRepository.MarkAllNotificationsAsReadAsync(userId);
    }

    public async Task CheckBudgetAlertsAsync(string userId, string? accountId, List<string>? labelIds)
    {
        try
        {
            // Get all active budgets for the user
            var budgets = await _budgetRepository.GetByUserIdAsync(userId, isActive: true);
            
            foreach (var budget in budgets)
            {
                // Check if this budget is relevant to the transaction
                bool isRelevant = true;
                if (budget.AccountIds.Any() && accountId != null && !budget.AccountIds.Contains(accountId))
                    isRelevant = false;
                
                // For label checking, expand budget label IDs to include all child categories
                if (budget.LabelIds.Any() && labelIds != null)
                {
                    var expandedBudgetLabelIds = await ExpandLabelIdsAsync(userId, budget.LabelIds);
                    if (!expandedBudgetLabelIds.Intersect(labelIds).Any())
                        isRelevant = false;
                }

                if (!isRelevant) continue;

                // Calculate current spending
                var (periodStart, periodEnd) = GetCurrentPeriodDates(budget);
                var transactions = await GetBudgetTransactionsAsync(userId, budget, periodStart, periodEnd);
                var amountSpent = transactions.Sum(t => t.Amount);
                var percentUsed = budget.Amount > 0 ? (amountSpent / budget.Amount) * 100 : 0;

                // Check each alert threshold
                foreach (var alert in budget.Alerts.Where(a => a.NotifyEnabled && !a.Triggered))
                {
                    if (percentUsed >= alert.ThresholdPercent)
                    {
                        // Trigger alert
                        alert.Triggered = true;
                        alert.LastTriggeredAt = DateTime.UtcNow;

                        // Create notification
                        var notification = new BudgetNotification
                        {
                            UserId = userId,
                            BudgetId = budget.Id,
                            BudgetName = budget.Name,
                            ThresholdPercent = alert.ThresholdPercent,
                            ActualPercent = Math.Round(percentUsed, 1),
                            AmountSpent = amountSpent,
                            BudgetAmount = budget.Amount,
                            Currency = budget.Currency,
                            PeriodStart = periodStart,
                            PeriodEnd = periodEnd,
                            CreatedAt = DateTime.UtcNow
                        };

                        await _budgetRepository.CreateNotificationAsync(notification);
                        
                        // Send real-time notification
                        await _notificationService.SendBudgetAlertAsync(
                            userId,
                            budget.Id,
                            budget.Name,
                            alert.ThresholdPercent,
                            percentUsed,
                            amountSpent,
                            budget.Amount,
                            budget.Currency);

                        _logger.LogInformation(
                            "Budget alert triggered: {BudgetName} at {Percent}% (threshold: {Threshold}%)",
                            budget.Name, Math.Round(percentUsed, 1), alert.ThresholdPercent);
                    }
                }

                // Update budget with triggered alerts
                await _budgetRepository.UpdateAsync(budget);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error checking budget alerts for user {UserId}", userId);
        }
    }

    // ===== Private Helper Methods =====

    private async Task<BudgetResponse> BuildBudgetResponseAsync(Budget budget, string userId)
    {
        var (periodStart, periodEnd) = GetCurrentPeriodDates(budget);
        var transactions = await GetBudgetTransactionsAsync(userId, budget, periodStart, periodEnd);
        
        // Get accounts to determine transaction currencies
        var accounts = await _accountRepository.GetByUserIdAsync(userId);
        var accountDict = accounts.ToDictionary(a => a.Id);
        
        // Get exchange rates for currency conversion
        var ratesResponse = await _exchangeRateService.GetRatesAsync();
        var rates = ratesResponse?.Rates ?? new Dictionary<string, decimal>();
        
        // Get user's primary currency for display
        var user = await _userRepository.GetByIdAsync(userId);
        var primaryCurrency = user?.PrimaryCurrency ?? "USD";
        
        // Group transactions by account currency and calculate spending
        var spendingByCurrency = new Dictionary<string, BudgetCurrencyBreakdown>();
        decimal totalSpentInBudgetCurrency = 0;
        
        foreach (var transaction in transactions)
        {
            // Get the account's currency for this transaction
            var transactionCurrency = !string.IsNullOrEmpty(transaction.AccountId)
                && accountDict.TryGetValue(transaction.AccountId, out var account)
                ? account.Currency
                : budget.Currency;
            
            // Convert transaction amount to budget currency
            var amountInBudgetCurrency = _exchangeRateService.Convert(
                transaction.Amount, transactionCurrency, budget.Currency, rates);
            
            totalSpentInBudgetCurrency += amountInBudgetCurrency;
            
            // Track by currency
            if (spendingByCurrency.TryGetValue(transactionCurrency, out var existing))
            {
                spendingByCurrency[transactionCurrency] = existing with
                {
                    OriginalAmount = existing.OriginalAmount + transaction.Amount,
                    ConvertedAmount = existing.ConvertedAmount + amountInBudgetCurrency,
                    TransactionCount = existing.TransactionCount + 1
                };
            }
            else
            {
                spendingByCurrency[transactionCurrency] = new BudgetCurrencyBreakdown(
                    OriginalAmount: transaction.Amount,
                    ConvertedAmount: amountInBudgetCurrency,
                    TransactionCount: 1
                );
            }
        }
        
        var amountRemaining = budget.Amount - totalSpentInBudgetCurrency;
        var percentUsed = budget.Amount > 0 ? Math.Round((totalSpentInBudgetCurrency / budget.Amount) * 100, 1) : 0;
        var daysRemaining = Math.Max(0, (periodEnd.Date - DateTime.UtcNow.Date).Days);

        // Get label and account info for display
        var labels = await _labelRepository.GetByUserIdAsync(userId);
        var labelInfos = labels
            .Where(l => budget.LabelIds.Contains(l.Id))
            .Select(l => new LabelInfo(l.Id, l.Name, l.Color, l.Icon))
            .ToList();

        var accountInfos = accounts
            .Where(a => budget.AccountIds.Contains(a.Id))
            .Select(a => new AccountInfo(a.Id, a.Name, a.Currency))
            .ToList();
        
        // Only include currency breakdown if there are multiple currencies
        var currencyBreakdown = spendingByCurrency.Count > 1 ? spendingByCurrency : null;

        return new BudgetResponse(
            Id: budget.Id,
            Name: budget.Name,
            Description: budget.Description,
            Amount: budget.Amount,
            Currency: budget.Currency,
            Period: budget.Period.ToString(),
            StartDate: budget.StartDate,
            EndDate: budget.EndDate,
            LabelIds: budget.LabelIds,
            Labels: labelInfos,
            AccountIds: budget.AccountIds,
            Accounts: accountInfos,
            Alerts: budget.Alerts.Select(a => new BudgetAlertResponse(
                a.ThresholdPercent, a.NotifyEnabled, a.Triggered, a.LastTriggeredAt)).ToList(),
            IsActive: budget.IsActive,
            Color: budget.Color,
            Icon: budget.Icon,
            AmountSpent: totalSpentInBudgetCurrency,
            AmountRemaining: amountRemaining,
            PercentUsed: percentUsed,
            PeriodStart: periodStart,
            PeriodEnd: periodEnd,
            DaysRemaining: daysRemaining,
            IsOverBudget: totalSpentInBudgetCurrency > budget.Amount,
            SpendingByCurrency: currencyBreakdown,
            PrimaryCurrency: primaryCurrency,
            CreatedAt: budget.CreatedAt,
            UpdatedAt: budget.UpdatedAt
        );
    }

    private async Task<List<Transaction>> GetBudgetTransactionsAsync(
        string userId, Budget budget, DateTime periodStart, DateTime periodEnd)
    {
        // Expand label IDs to include all child categories (if folders are selected)
        List<string>? expandedLabelIds = null;
        if (budget.LabelIds.Any())
        {
            expandedLabelIds = await ExpandLabelIdsAsync(userId, budget.LabelIds);
        }
        
        // Build filter for expenses (Send transactions only)
        var filter = new TransactionFilterRequest(
            StartDate: periodStart,
            EndDate: periodEnd,
            AccountIds: budget.AccountIds.Any() ? budget.AccountIds : null,
            Types: new List<string> { "Send" },  // Only expenses
            LabelIds: expandedLabelIds,
            TagIds: null,
            MinAmount: null,
            MaxAmount: null,
            SearchText: null,
            Status: "Confirmed",  // Only confirmed transactions
            IsRecurring: null,
            Page: 1,
            PageSize: 10000  // Get all for calculation
        );

        var (transactions, _) = await _transactionRepository.GetFilteredAsync(userId, filter);
        return transactions;
    }
    
    /// <summary>
    /// Expands a list of label IDs to include all child category IDs.
    /// If a folder is in the list, all categories underneath it (recursively) are included.
    /// </summary>
    private async Task<List<string>> ExpandLabelIdsAsync(string userId, List<string> labelIds)
    {
        var allLabels = await _labelRepository.GetByUserIdAsync(userId);
        var labelDict = allLabels.ToDictionary(l => l.Id);
        var expandedIds = new HashSet<string>(labelIds);
        
        // For each label ID, if it's a folder, add all child categories
        foreach (var labelId in labelIds)
        {
            if (labelDict.TryGetValue(labelId, out var label) && label.Type == LabelType.Folder)
            {
                CollectChildCategoryIds(labelId, allLabels, expandedIds);
            }
        }
        
        return expandedIds.ToList();
    }
    
    /// <summary>
    /// Recursively collects all category IDs under a folder
    /// </summary>
    private void CollectChildCategoryIds(string parentId, List<Label> allLabels, HashSet<string> result)
    {
        var children = allLabels.Where(l => l.ParentId == parentId);
        foreach (var child in children)
        {
            if (child.Type == LabelType.Category)
            {
                result.Add(child.Id);
            }
            // Always recurse into folders to find nested categories
            if (child.Type == LabelType.Folder)
            {
                CollectChildCategoryIds(child.Id, allLabels, result);
            }
        }
    }

    private (DateTime Start, DateTime End) GetCurrentPeriodDates(Budget budget)
    {
        return CalculatePeriodDates(budget.Period, budget.StartDate, budget.EndDate);
    }

    private (DateTime Start, DateTime End) CalculatePeriodDates(BudgetPeriod period, DateTime? startDate, DateTime? endDate)
    {
        var now = DateTime.UtcNow;
        
        return period switch
        {
            BudgetPeriod.Weekly => GetWeekBounds(now),
            BudgetPeriod.Monthly => GetMonthBounds(now),
            BudgetPeriod.Quarterly => GetQuarterBounds(now),
            BudgetPeriod.Yearly => GetYearBounds(now),
            BudgetPeriod.Custom when startDate.HasValue && endDate.HasValue => 
                (startDate.Value.Date, endDate.Value.Date.AddDays(1).AddSeconds(-1)),
            _ => GetMonthBounds(now)
        };
    }

    private (DateTime Start, DateTime End) GetWeekBounds(DateTime date)
    {
        var diff = (7 + (date.DayOfWeek - DayOfWeek.Monday)) % 7;
        var start = date.Date.AddDays(-diff);
        var end = start.AddDays(7).AddSeconds(-1);
        return (start, end);
    }

    private (DateTime Start, DateTime End) GetMonthBounds(DateTime date)
    {
        var start = new DateTime(date.Year, date.Month, 1, 0, 0, 0, DateTimeKind.Utc);
        var end = start.AddMonths(1).AddSeconds(-1);
        return (start, end);
    }

    private (DateTime Start, DateTime End) GetQuarterBounds(DateTime date)
    {
        var quarter = (date.Month - 1) / 3;
        var start = new DateTime(date.Year, quarter * 3 + 1, 1, 0, 0, 0, DateTimeKind.Utc);
        var end = start.AddMonths(3).AddSeconds(-1);
        return (start, end);
    }

    private (DateTime Start, DateTime End) GetYearBounds(DateTime date)
    {
        var start = new DateTime(date.Year, 1, 1, 0, 0, 0, DateTimeKind.Utc);
        var end = start.AddYears(1).AddSeconds(-1);
        return (start, end);
    }

    private List<BudgetAlert> MapAlerts(List<BudgetAlertRequest>? alerts)
    {
        if (alerts == null || !alerts.Any())
        {
            // Default alerts
            return new List<BudgetAlert>
            {
                new() { ThresholdPercent = 50, NotifyEnabled = false },
                new() { ThresholdPercent = 80, NotifyEnabled = true },
                new() { ThresholdPercent = 100, NotifyEnabled = true }
            };
        }

        return alerts.Select(a => new BudgetAlert
        {
            ThresholdPercent = Math.Clamp(a.ThresholdPercent, 0, 200),
            NotifyEnabled = a.NotifyEnabled
        })
        .OrderBy(a => a.ThresholdPercent)
        .ToList();
    }
}