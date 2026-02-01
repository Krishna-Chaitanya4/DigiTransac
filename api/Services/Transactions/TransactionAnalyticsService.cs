using DigiTransac.Api.Models;
using DigiTransac.Api.Models.Dto;
using DigiTransac.Api.Repositories;

namespace DigiTransac.Api.Services.Transactions;

/// <summary>
/// Handles analytics and summary calculations for transactions.
/// Provides spending trends, category breakdowns, and period summaries.
/// </summary>
public class TransactionAnalyticsService : ITransactionAnalyticsService
{
    private readonly ITransactionRepository _transactionRepository;
    private readonly IAccountRepository _accountRepository;
    private readonly ILabelRepository _labelRepository;
    private readonly IUserRepository _userRepository;
    private readonly IExchangeRateService _exchangeRateService;
    private readonly ITransactionMapperService _mapperService;

    public TransactionAnalyticsService(
        ITransactionRepository transactionRepository,
        IAccountRepository accountRepository,
        ILabelRepository labelRepository,
        IUserRepository userRepository,
        IExchangeRateService exchangeRateService,
        ITransactionMapperService mapperService)
    {
        _transactionRepository = transactionRepository;
        _accountRepository = accountRepository;
        _labelRepository = labelRepository;
        _userRepository = userRepository;
        _exchangeRateService = exchangeRateService;
        _mapperService = mapperService;
    }

    public async Task<TransactionSummaryResponse> GetSummaryAsync(
        string userId,
        TransactionFilterRequest filter)
    {
        // Summary reflects the current status filter for consistency with the list view
        // If no status filter is specified, default to Confirmed (main financial view)
        var summaryFilter = string.IsNullOrEmpty(filter.Status)
            ? filter with { Status = "Confirmed" }
            : filter;
        var (transactions, _) = await _transactionRepository.GetFilteredAsync(userId, summaryFilter);

        var user = await _userRepository.GetByIdAsync(userId);
        var primaryCurrency = user?.PrimaryCurrency ?? "USD";

        // Get accounts to know transaction currencies
        var accounts = await _accountRepository.GetByUserIdAsync(userId, includeArchived: true);
        var accountDict = accounts.ToDictionary(a => a.Id);

        // Get exchange rates for currency conversion
        var ratesResponse = await _exchangeRateService.GetRatesAsync();
        var rates = ratesResponse.Rates;

        // Convert all transaction amounts to user's primary currency before summing
        decimal totalCredits = 0;
        decimal totalDebits = 0;
        
        // Also track category sums with currency conversion
        var categoryTotals = new Dictionary<string, decimal>();
        var tagTotals = new Dictionary<string, decimal>();

        foreach (var t in transactions)
        {
            // Skip transactions without AccountId (shouldn't happen with Confirmed filter, but safety check)
            if (string.IsNullOrEmpty(t.AccountId))
                continue;

            var transactionCurrency = accountDict.TryGetValue(t.AccountId, out var account)
                ? account.Currency
                : primaryCurrency;

            var convertedAmount = _exchangeRateService.Convert(
                t.Amount, transactionCurrency, primaryCurrency, rates);

            if (t.Type == TransactionType.Receive)
                totalCredits += convertedAmount;
            else if (t.Type == TransactionType.Send)
                totalDebits += convertedAmount;
                
            // Accumulate category totals with currency conversion
            foreach (var split in t.Splits)
            {
                var convertedSplitAmount = _exchangeRateService.Convert(
                    split.Amount, transactionCurrency, primaryCurrency, rates);
                    
                if (!categoryTotals.ContainsKey(split.LabelId))
                    categoryTotals[split.LabelId] = 0;
                categoryTotals[split.LabelId] += convertedSplitAmount;
            }
            
            // Accumulate tag totals with currency conversion
            if (t.TagIds != null)
            {
                foreach (var tagId in t.TagIds)
                {
                    if (!tagTotals.ContainsKey(tagId))
                        tagTotals[tagId] = 0;
                    tagTotals[tagId] += convertedAmount;
                }
            }
        }

        return new TransactionSummaryResponse(
            totalCredits,
            totalDebits,
            totalCredits - totalDebits,
            transactions.Count,
            categoryTotals,
            tagTotals,
            primaryCurrency);
    }

    public async Task<TransactionAnalyticsResponse> GetAnalyticsAsync(
        string userId,
        DateTime? startDate,
        DateTime? endDate,
        string? accountId)
    {
        var dek = await _mapperService.GetUserDekAsync(userId);
        var accounts = (await _accountRepository.GetByUserIdAsync(userId, true))
            .ToDictionary(a => a.Id);
        var labels = (await _labelRepository.GetByUserIdAsync(userId))
            .ToDictionary(l => l.Id);

        // Get user's primary currency and exchange rates
        var user = await _userRepository.GetByIdAsync(userId);
        var primaryCurrency = user?.PrimaryCurrency ?? "USD";
        var ratesResponse = await _exchangeRateService.GetRatesAsync();
        var rates = ratesResponse.Rates;

        // Helper to get transaction currency
        string GetTransactionCurrency(Transaction t) =>
            !string.IsNullOrEmpty(t.AccountId) && accounts.TryGetValue(t.AccountId, out var acc)
                ? acc.Currency
                : primaryCurrency;

        // Get all transactions for the period
        var filter = TransactionFilterRequest.ForAnalytics(
            startDate ?? DateTime.MinValue,
            endDate ?? DateTime.MaxValue,
            accountId != null ? new List<string> { accountId } : null);

        var (transactions, _) = await _transactionRepository.GetFilteredAsync(userId, filter);

        // Calculate category breakdown with currency conversion
        var categoryTotals = new Dictionary<string, (decimal amount, int count)>();
        foreach (var t in transactions.Where(t => !t.IsRecurringTemplate))
        {
            var transactionCurrency = GetTransactionCurrency(t);
            foreach (var split in t.Splits)
            {
                if (!categoryTotals.ContainsKey(split.LabelId))
                {
                    categoryTotals[split.LabelId] = (0, 0);
                }
                var current = categoryTotals[split.LabelId];
                var convertedAmount = _exchangeRateService.Convert(
                    split.Amount, transactionCurrency, primaryCurrency, rates);
                categoryTotals[split.LabelId] = (current.amount + convertedAmount, current.count + 1);
            }
        }

        var totalSpending = categoryTotals.Values.Sum(v => v.amount);
        var topCategories = categoryTotals
            .OrderByDescending(kv => kv.Value.amount)
            .Take(10)
            .Select(kv =>
            {
                labels.TryGetValue(kv.Key, out var label);
                return new CategoryBreakdown(
                    kv.Key,
                    label?.Name ?? "Unknown",
                    label?.Icon,
                    label?.Color,
                    kv.Value.amount,
                    kv.Value.count,
                    totalSpending > 0 ? Math.Round(kv.Value.amount / totalSpending * 100, 1) : 0
                );
            })
            .ToList();

        // Calculate spending trends (by month) with currency conversion
        var trends = transactions
            .Where(t => !t.IsRecurringTemplate)
            .GroupBy(t => t.Date.ToString("yyyy-MM"))
            .OrderBy(g => g.Key)
            .Select(g => new SpendingTrend(
                g.Key,
                g.Where(t => t.Type == TransactionType.Receive)
                    .Sum(t => _exchangeRateService.Convert(
                        t.Amount, GetTransactionCurrency(t), primaryCurrency, rates)),
                g.Where(t => t.Type == TransactionType.Send)
                    .Sum(t => _exchangeRateService.Convert(
                        t.Amount, GetTransactionCurrency(t), primaryCurrency, rates)),
                g.Where(t => t.Type == TransactionType.Receive)
                    .Sum(t => _exchangeRateService.Convert(
                        t.Amount, GetTransactionCurrency(t), primaryCurrency, rates)) -
                g.Where(t => t.Type == TransactionType.Send)
                    .Sum(t => _exchangeRateService.Convert(
                        t.Amount, GetTransactionCurrency(t), primaryCurrency, rates)),
                g.Count()
            ))
            .ToList();

        // Calculate averages by type with currency conversion
        var actualTransactions = transactions.Where(t => !t.IsRecurringTemplate).ToList();
        var receives = actualTransactions.Where(t => t.Type == TransactionType.Receive).ToList();
        var sends = actualTransactions.Where(t => t.Type == TransactionType.Send).ToList();
        // Transfers are now Send+Receive, detect by LinkedTransactionId for reporting
        var transfers = actualTransactions.Where(t => !string.IsNullOrEmpty(t.LinkedTransactionId)).ToList();

        var averagesByType = new AveragesByType(
            receives.Any() ? Math.Round(receives.Average(t => _exchangeRateService.Convert(
                t.Amount, GetTransactionCurrency(t), primaryCurrency, rates)), 2) : 0,
            sends.Any() ? Math.Round(sends.Average(t => _exchangeRateService.Convert(
                t.Amount, GetTransactionCurrency(t), primaryCurrency, rates)), 2) : 0,
            transfers.Any() ? Math.Round(transfers.Average(t => _exchangeRateService.Convert(
                t.Amount, GetTransactionCurrency(t), primaryCurrency, rates)), 2) : 0
        );

        // Calculate daily and monthly averages with currency conversion
        var dateRange = (endDate ?? DateTime.UtcNow) - (startDate ?? actualTransactions.Min(t => t.Date));
        var days = Math.Max(1, dateRange.Days);
        var months = Math.Max(1, days / 30.0);
        var totalSends = sends.Sum(t => _exchangeRateService.Convert(
            t.Amount, GetTransactionCurrency(t), primaryCurrency, rates));

        return new TransactionAnalyticsResponse(
            topCategories,
            trends,
            averagesByType,
            Math.Round(totalSends / days, 2),
            Math.Round(totalSends / (decimal)months, 2)
        );
    }

    public async Task<TopCounterpartiesResponse> GetTopCounterpartiesAsync(
        string userId,
        DateTime? startDate,
        DateTime? endDate,
        int page = 1,
        int pageSize = 10)
    {
        var dek = await _mapperService.GetUserDekAsync(userId);
        var user = await _userRepository.GetByIdAsync(userId);
        var primaryCurrency = user?.PrimaryCurrency ?? "USD";
        var ratesResponse = await _exchangeRateService.GetRatesAsync();
        var rates = ratesResponse.Rates;

        var accounts = (await _accountRepository.GetByUserIdAsync(userId, true))
            .ToDictionary(a => a.Id);

        // Get counterparty users for P2P transactions
        var counterpartyUsers = new Dictionary<string, User>();

        // Get transactions for the period
        var filter = TransactionFilterRequest.Builder()
            .WithDateRange(startDate, endDate)
            .WithStatus("Confirmed")
            .WithPagination(1, int.MaxValue)
            .Build();

        var (transactions, _) = await _transactionRepository.GetFilteredAsync(userId, filter);

        // Filter only Send transactions (expenses)
        var sendTransactions = transactions
            .Where(t => t.Type == TransactionType.Send && !t.IsRecurringTemplate)
            .ToList();

        // Collect counterparty user IDs and fetch their info
        var counterpartyUserIds = sendTransactions
            .Where(t => !string.IsNullOrEmpty(t.CounterpartyUserId))
            .Select(t => t.CounterpartyUserId!)
            .Distinct()
            .ToList();

        if (counterpartyUserIds.Any())
        {
            counterpartyUsers = await _userRepository.GetByIdsAsync(counterpartyUserIds);
        }

        // Helper to get transaction currency
        string GetTransactionCurrency(Transaction t) =>
            !string.IsNullOrEmpty(t.AccountId) && accounts.TryGetValue(t.AccountId, out var acc)
                ? acc.Currency
                : primaryCurrency;

        // Helper to get decrypted payee
        string GetPayee(Transaction t) =>
            dek != null && !string.IsNullOrEmpty(t.EncryptedPayee)
                ? (_mapperService.DecryptIfNotEmpty(t.EncryptedPayee, dek) ?? "Unknown")
                : (t.Title ?? "Unknown");

        // Group by payee/counterparty
        var allCounterpartyGroups = sendTransactions
            .GroupBy(t => {
                // Use counterparty user for P2P, otherwise decrypted payee name
                if (!string.IsNullOrEmpty(t.CounterpartyUserId))
                {
                    var email = counterpartyUsers.TryGetValue(t.CounterpartyUserId, out var u) ? u.Email : "Unknown";
                    return ("P2P", email, t.CounterpartyUserId);
                }
                return ("Payee", GetPayee(t), (string?)null);
            })
            .Select(g => {
                var totalAmount = g.Sum(t => _exchangeRateService.Convert(
                    t.Amount, GetTransactionCurrency(t), primaryCurrency, rates));
                return new {
                    Type = g.Key.Item1,
                    Name = g.Key.Item2,
                    UserId = g.Key.Item3,
                    TotalAmount = totalAmount,
                    TransactionCount = g.Count()
                };
            })
            .OrderByDescending(x => x.TotalAmount)
            .ToList();

        var totalCount = allCounterpartyGroups.Count;
        
        // Apply pagination
        var paginatedGroups = allCounterpartyGroups
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToList();

        var totalSpending = allCounterpartyGroups.Sum(x => x.TotalAmount);

        var counterparties = paginatedGroups.Select(x => new CounterpartySpending(
            x.Name,
            x.UserId,
            x.Type == "P2P" ? x.Name : null,
            x.TotalAmount,
            x.TransactionCount,
            totalSpending > 0 ? Math.Round(x.TotalAmount / totalSpending * 100, 1) : 0,
            x.Type
        )).ToList();

        return new TopCounterpartiesResponse(counterparties, primaryCurrency, page, pageSize, totalCount);
    }

    public async Task<SpendingByAccountResponse> GetSpendingByAccountAsync(
        string userId,
        DateTime? startDate,
        DateTime? endDate,
        int page = 1,
        int pageSize = 50)
    {
        var user = await _userRepository.GetByIdAsync(userId);
        var primaryCurrency = user?.PrimaryCurrency ?? "USD";
        var ratesResponse = await _exchangeRateService.GetRatesAsync();
        var rates = ratesResponse.Rates;

        var accounts = await _accountRepository.GetByUserIdAsync(userId, true);
        var accountDict = accounts.ToDictionary(a => a.Id);

        // Get transactions for the period
        var filter = TransactionFilterRequest.Builder()
            .WithDateRange(startDate, endDate)
            .WithStatus("Confirmed")
            .WithPagination(1, int.MaxValue)
            .Build();

        var (transactions, _) = await _transactionRepository.GetFilteredAsync(userId, filter);

        var actualTransactions = transactions.Where(t => !t.IsRecurringTemplate).ToList();

        // Group by account
        var allAccountGroups = actualTransactions
            .Where(t => !string.IsNullOrEmpty(t.AccountId))
            .GroupBy(t => t.AccountId!)
            .Select(g => {
                var account = accountDict.TryGetValue(g.Key, out var acc) ? acc : null;
                var accountCurrency = account?.Currency ?? primaryCurrency;

                var debits = g.Where(t => t.Type == TransactionType.Send)
                    .Sum(t => _exchangeRateService.Convert(t.Amount, accountCurrency, primaryCurrency, rates));
                var credits = g.Where(t => t.Type == TransactionType.Receive)
                    .Sum(t => _exchangeRateService.Convert(t.Amount, accountCurrency, primaryCurrency, rates));

                return new {
                    AccountId = g.Key,
                    AccountName = account?.Name ?? "Unknown",
                    AccountCurrency = accountCurrency,
                    TotalDebits = debits,
                    TotalCredits = credits,
                    NetChange = credits - debits,
                    TransactionCount = g.Count()
                };
            })
            .OrderByDescending(x => x.TotalDebits)
            .ToList();

        var totalCount = allAccountGroups.Count;
        var totalDebits = allAccountGroups.Sum(x => x.TotalDebits);
        
        // Apply pagination
        var paginatedGroups = allAccountGroups
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToList();

        var accountSpending = paginatedGroups.Select(x => new AccountSpending(
            x.AccountId,
            x.AccountName,
            x.AccountCurrency,
            x.TotalDebits,
            x.TotalCredits,
            x.NetChange,
            x.TransactionCount,
            totalDebits > 0 ? Math.Round(x.TotalDebits / totalDebits * 100, 1) : 0
        )).ToList();

        return new SpendingByAccountResponse(accountSpending, primaryCurrency, page, pageSize, totalCount);
    }

    public async Task<SpendingPatternsResponse> GetSpendingPatternsAsync(
        string userId,
        DateTime? startDate,
        DateTime? endDate)
    {
        var user = await _userRepository.GetByIdAsync(userId);
        var primaryCurrency = user?.PrimaryCurrency ?? "USD";
        var ratesResponse = await _exchangeRateService.GetRatesAsync();
        var rates = ratesResponse.Rates;

        var accounts = (await _accountRepository.GetByUserIdAsync(userId, true))
            .ToDictionary(a => a.Id);

        // Get transactions for the period
        var filter = TransactionFilterRequest.Builder()
            .WithDateRange(startDate, endDate)
            .WithStatus("Confirmed")
            .WithPagination(1, int.MaxValue)
            .Build();

        var (transactions, _) = await _transactionRepository.GetFilteredAsync(userId, filter);

        // Filter only Send transactions (expenses)
        var sendTransactions = transactions
            .Where(t => t.Type == TransactionType.Send && !t.IsRecurringTemplate)
            .ToList();

        // Helper to get transaction currency
        string GetTransactionCurrency(Transaction t) =>
            !string.IsNullOrEmpty(t.AccountId) && accounts.TryGetValue(t.AccountId, out var acc)
                ? acc.Currency
                : primaryCurrency;

        var dayNames = new[] { "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday" };

        // Helper to get the hour from TimeLocal (format "HH:mm") or fall back to Date.Hour
        int GetTransactionHour(Transaction t) {
            if (!string.IsNullOrEmpty(t.TimeLocal) && t.TimeLocal.Length >= 2)
            {
                if (int.TryParse(t.TimeLocal.Substring(0, 2), out var hour) && hour >= 0 && hour < 24)
                    return hour;
            }
            // Fallback to Date.Hour for legacy transactions without TimeLocal
            return t.Date.Hour;
        }

        // Helper to get day of week from DateLocal or fall back to Date
        int GetTransactionDayOfWeek(Transaction t) {
            if (!string.IsNullOrEmpty(t.DateLocal) && DateTime.TryParse(t.DateLocal, out var localDate))
            {
                return (int)localDate.DayOfWeek;
            }
            return (int)t.Date.DayOfWeek;
        }

        // Group by day of week (using DateLocal for accuracy)
        var byDayOfWeek = sendTransactions
            .GroupBy(t => GetTransactionDayOfWeek(t))
            .Select(g => {
                var totalAmount = g.Sum(t => _exchangeRateService.Convert(
                    t.Amount, GetTransactionCurrency(t), primaryCurrency, rates));
                return new DayOfWeekSpending(
                    g.Key,
                    dayNames[g.Key],
                    totalAmount,
                    g.Count(),
                    g.Count() > 0 ? Math.Round(totalAmount / g.Count(), 2) : 0
                );
            })
            .OrderBy(x => x.DayOfWeek)
            .ToList();

        // Ensure all days are present
        for (int i = 0; i < 7; i++)
        {
            if (!byDayOfWeek.Any(x => x.DayOfWeek == i))
            {
                byDayOfWeek.Add(new DayOfWeekSpending(i, dayNames[i], 0, 0, 0));
            }
        }
        byDayOfWeek = byDayOfWeek.OrderBy(x => x.DayOfWeek).ToList();

        // Group by hour of day (using TimeLocal for accuracy)
        var byHourOfDay = sendTransactions
            .GroupBy(t => GetTransactionHour(t))
            .Select(g => {
                var totalAmount = g.Sum(t => _exchangeRateService.Convert(
                    t.Amount, GetTransactionCurrency(t), primaryCurrency, rates));
                var hourLabel = g.Key == 0 ? "12 AM" :
                               g.Key < 12 ? $"{g.Key} AM" :
                               g.Key == 12 ? "12 PM" :
                               $"{g.Key - 12} PM";
                return new HourOfDaySpending(
                    g.Key,
                    hourLabel,
                    totalAmount,
                    g.Count(),
                    g.Count() > 0 ? Math.Round(totalAmount / g.Count(), 2) : 0
                );
            })
            .OrderBy(x => x.Hour)
            .ToList();

        // Ensure all hours are present
        for (int i = 0; i < 24; i++)
        {
            if (!byHourOfDay.Any(x => x.Hour == i))
            {
                var hourLabel = i == 0 ? "12 AM" :
                               i < 12 ? $"{i} AM" :
                               i == 12 ? "12 PM" :
                               $"{i - 12} PM";
                byHourOfDay.Add(new HourOfDaySpending(i, hourLabel, 0, 0, 0));
            }
        }
        byHourOfDay = byHourOfDay.OrderBy(x => x.Hour).ToList();

        return new SpendingPatternsResponse(byDayOfWeek, byHourOfDay, primaryCurrency);
    }

    public async Task<SpendingAnomaliesResponse> GetSpendingAnomaliesAsync(
        string userId,
        DateTime? startDate,
        DateTime? endDate,
        int page = 1,
        int pageSize = 10)
    {
        var dek = await _mapperService.GetUserDekAsync(userId);
        var user = await _userRepository.GetByIdAsync(userId);
        var primaryCurrency = user?.PrimaryCurrency ?? "USD";
        var ratesResponse = await _exchangeRateService.GetRatesAsync();
        var rates = ratesResponse.Rates;

        var accounts = (await _accountRepository.GetByUserIdAsync(userId, true))
            .ToDictionary(a => a.Id);
        var labels = (await _labelRepository.GetByUserIdAsync(userId))
            .ToDictionary(l => l.Id);

        // Get transactions for the period (current period)
        var filter = TransactionFilterRequest.Builder()
            .WithDateRange(startDate, endDate)
            .WithStatus("Confirmed")
            .WithPagination(1, int.MaxValue)
            .Build();

        var (transactions, _) = await _transactionRepository.GetFilteredAsync(userId, filter);

        // Filter only Send transactions (expenses)
        var sendTransactions = transactions
            .Where(t => t.Type == TransactionType.Send && !t.IsRecurringTemplate)
            .ToList();

        // Helper to get transaction currency
        string GetTransactionCurrency(Transaction t) =>
            !string.IsNullOrEmpty(t.AccountId) && accounts.TryGetValue(t.AccountId, out var acc)
                ? acc.Currency
                : primaryCurrency;
        
        // Helper to get decrypted payee
        string? GetPayee(Transaction t) =>
            dek != null && !string.IsNullOrEmpty(t.EncryptedPayee)
                ? _mapperService.DecryptIfNotEmpty(t.EncryptedPayee, dek)
                : t.Title;

        var anomalies = new List<SpendingAnomaly>();

        if (sendTransactions.Count < 5)
        {
            // Not enough data for meaningful anomaly detection
            return new SpendingAnomaliesResponse(anomalies, primaryCurrency);
        }

        // Calculate statistics for anomaly detection
        var convertedAmounts = sendTransactions
            .Select(t => _exchangeRateService.Convert(t.Amount, GetTransactionCurrency(t), primaryCurrency, rates))
            .ToList();

        var average = convertedAmounts.Average();
        var stdDev = Math.Sqrt(convertedAmounts.Average(x => Math.Pow((double)(x - average), 2)));
        var threshold = average + (decimal)(2.5 * stdDev); // 2.5 standard deviations

        // 1. Detect high-value transactions (outliers)
        foreach (var t in sendTransactions)
        {
            var convertedAmount = _exchangeRateService.Convert(
                t.Amount, GetTransactionCurrency(t), primaryCurrency, rates);

            if (convertedAmount > threshold && convertedAmount > average * 2)
            {
                var severity = convertedAmount > average * 5 ? "High" :
                              convertedAmount > average * 3 ? "Medium" : "Low";

                anomalies.Add(new SpendingAnomaly(
                    "HighTransaction",
                    severity,
                    "Unusually Large Transaction",
                    $"Transaction of {convertedAmount:N2} {primaryCurrency} is {Math.Round(convertedAmount / average, 1)}x your average spending",
                    convertedAmount,
                    t.Id,
                    t.Splits.FirstOrDefault()?.LabelId is string labelId && labels.TryGetValue(labelId, out var label)
                        ? label.Name : null,
                    GetPayee(t),
                    t.CreatedAt
                ));
            }
        }

        // 2. Detect unusual category spending (categories with sudden spike)
        var categorySpending = sendTransactions
            .SelectMany(t => t.Splits.Select(s => new {
                LabelId = s.LabelId,
                Amount = _exchangeRateService.Convert(s.Amount, GetTransactionCurrency(t), primaryCurrency, rates)
            }))
            .GroupBy(x => x.LabelId)
            .ToDictionary(g => g.Key, g => g.Sum(x => x.Amount));

        // Get historical data for comparison (previous period of same length)
        var periodLength = (endDate ?? DateTime.UtcNow) - (startDate ?? DateTime.UtcNow.AddMonths(-1));
        var historicalStart = (startDate ?? DateTime.UtcNow.AddMonths(-1)) - periodLength;
        var historicalEnd = startDate ?? DateTime.UtcNow.AddMonths(-1);

        var historicalFilter = TransactionFilterRequest.Builder()
            .WithDateRange(historicalStart, historicalEnd)
            .WithStatus("Confirmed")
            .WithPagination(1, int.MaxValue)
            .Build();

        var (historicalTransactions, _) = await _transactionRepository.GetFilteredAsync(userId, historicalFilter);

        var historicalCategorySpending = historicalTransactions
            .Where(t => t.Type == TransactionType.Send && !t.IsRecurringTemplate)
            .SelectMany(t => t.Splits.Select(s => new {
                LabelId = s.LabelId,
                Amount = _exchangeRateService.Convert(
                    s.Amount, GetTransactionCurrency(t), primaryCurrency, rates)
            }))
            .GroupBy(x => x.LabelId)
            .ToDictionary(g => g.Key, g => g.Sum(x => x.Amount));

        foreach (var category in categorySpending)
        {
            var historicalAmount = historicalCategorySpending.TryGetValue(category.Key, out var hist) ? hist : 0;

            // Category spending more than 2x historical
            if (category.Value > historicalAmount * 2 && category.Value > average)
            {
                var categoryName = labels.TryGetValue(category.Key, out var label) ? label.Name : "Unknown";
                var increasePercent = historicalAmount > 0
                    ? Math.Round((category.Value - historicalAmount) / historicalAmount * 100, 0)
                    : 100;

                if (increasePercent >= 100)
                {
                    anomalies.Add(new SpendingAnomaly(
                        "UnusualCategory",
                        increasePercent > 300 ? "High" : increasePercent > 150 ? "Medium" : "Low",
                        $"Spending Spike in {categoryName}",
                        $"Spending in {categoryName} increased by {increasePercent}% compared to last period",
                        category.Value,
                        null,
                        categoryName,
                        null,
                        DateTime.UtcNow
                    ));
                }
            }
        }

        // 3. Detect new payees with significant spending
        var currentPayees = sendTransactions
            .Where(t => !string.IsNullOrEmpty(t.EncryptedPayee) || !string.IsNullOrEmpty(t.Title))
            .GroupBy(t => GetPayee(t) ?? "Unknown")
            .ToDictionary(g => g.Key, g => g.Sum(t => _exchangeRateService.Convert(
                t.Amount, GetTransactionCurrency(t), primaryCurrency, rates)));

        var historicalPayees = historicalTransactions
            .Where(t => t.Type == TransactionType.Send && (!string.IsNullOrEmpty(t.EncryptedPayee) || !string.IsNullOrEmpty(t.Title)))
            .Select(t => GetPayee(t) ?? "Unknown")
            .Distinct()
            .ToHashSet();

        foreach (var payee in currentPayees)
        {
            if (!historicalPayees.Contains(payee.Key) && payee.Value > average)
            {
                anomalies.Add(new SpendingAnomaly(
                    "NewPayee",
                    payee.Value > average * 3 ? "Medium" : "Low",
                    "New Significant Payee",
                    $"First time spending with {payee.Key}: {payee.Value:N2} {primaryCurrency}",
                    payee.Value,
                    null,
                    null,
                    payee.Key,
                    DateTime.UtcNow
                ));
            }
        }

        // Sort by severity
        var sortedAnomalies = anomalies
            .OrderByDescending(a => a.Severity == "High" ? 3 : a.Severity == "Medium" ? 2 : 1)
            .ThenByDescending(a => a.Amount ?? 0)
            .ToList();
        
        var totalCount = sortedAnomalies.Count;
        
        // Apply pagination
        var paginatedAnomalies = sortedAnomalies
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToList();

        return new SpendingAnomaliesResponse(paginatedAnomalies, primaryCurrency, page, pageSize, totalCount);
    }
}