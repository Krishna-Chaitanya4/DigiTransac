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

    public async Task<LocationInsightsResponse> GetLocationInsightsAsync(
        string userId,
        DateTime? startDate,
        DateTime? endDate,
        double? latitude = null,
        double? longitude = null,
        double radiusKm = 1.0)
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

        // Get transactions for the period
        var filter = TransactionFilterRequest.Builder()
            .WithDateRange(startDate, endDate)
            .WithStatus("Confirmed")
            .WithPagination(1, int.MaxValue)
            .Build();

        var (transactions, totalCount) = await _transactionRepository.GetFilteredAsync(userId, filter);

        // Filter transactions with location data
        var transactionsWithLocation = transactions
            .Where(t => t.Location != null && !t.IsRecurringTemplate)
            .ToList();

        // Helper to get transaction currency
        string GetTransactionCurrency(Transaction t) =>
            !string.IsNullOrEmpty(t.AccountId) && accounts.TryGetValue(t.AccountId, out var acc)
                ? acc.Currency
                : primaryCurrency;

        // Helper to decrypt longitude
        double GetLongitude(TransactionLocation loc)
        {
            if (dek != null && !string.IsNullOrEmpty(loc.EncryptedLongitude))
            {
                var decrypted = _mapperService.DecryptIfNotEmpty(loc.EncryptedLongitude, dek);
                if (double.TryParse(decrypted, out var lon))
                    return lon;
            }
            return 0;
        }

        // Helper to decrypt place name
        string? GetPlaceName(TransactionLocation loc)
        {
            if (dek != null && !string.IsNullOrEmpty(loc.EncryptedPlaceName))
            {
                return _mapperService.DecryptIfNotEmpty(loc.EncryptedPlaceName, dek);
            }
            return null;
        }

        // Helper to calculate distance using Haversine formula
        double CalculateDistanceKm(double lat1, double lon1, double lat2, double lon2)
        {
            const double EarthRadiusKm = 6371.0;
            var dLat = ToRadians(lat2 - lat1);
            var dLon = ToRadians(lon2 - lon1);
            var a = Math.Sin(dLat / 2) * Math.Sin(dLat / 2) +
                    Math.Cos(ToRadians(lat1)) * Math.Cos(ToRadians(lat2)) *
                    Math.Sin(dLon / 2) * Math.Sin(dLon / 2);
            var c = 2 * Math.Atan2(Math.Sqrt(a), Math.Sqrt(1 - a));
            return EarthRadiusKm * c;
        }

        double ToRadians(double degrees) => degrees * Math.PI / 180.0;

        // Calculate total spending with location
        var totalSpendingWithLocation = transactionsWithLocation
            .Where(t => t.Type == TransactionType.Send)
            .Sum(t => _exchangeRateService.Convert(
                t.Amount, GetTransactionCurrency(t), primaryCurrency, rates));

        // Group transactions by location (cluster nearby transactions within 500m)
        var locationClusters = new List<(double Lat, double Lon, string Name, string? City, string? Country, List<Transaction> Transactions)>();
        
        foreach (var t in transactionsWithLocation)
        {
            var loc = t.Location!;
            var locLon = GetLongitude(loc);
            var locName = GetPlaceName(loc) ?? loc.City ?? "Unknown Location";
            
            var existingCluster = locationClusters.FirstOrDefault(c =>
                CalculateDistanceKm(c.Lat, c.Lon, loc.Latitude, locLon) < 0.5);

            if (existingCluster != default)
            {
                existingCluster.Transactions.Add(t);
            }
            else
            {
                locationClusters.Add((
                    loc.Latitude,
                    locLon,
                    locName,
                    loc.City,
                    loc.Country,
                    new List<Transaction> { t }
                ));
            }
        }

        // Build top locations
        var topLocations = locationClusters
            .Select(cluster => {
                var sendTransactions = cluster.Transactions
                    .Where(t => t.Type == TransactionType.Send)
                    .ToList();
                
                var totalAmount = sendTransactions.Sum(t => _exchangeRateService.Convert(
                    t.Amount, GetTransactionCurrency(t), primaryCurrency, rates));

                // Find top category at this location
                var categoryAmounts = sendTransactions
                    .SelectMany(t => t.Splits)
                    .GroupBy(s => s.LabelId)
                    .Select(g => new { LabelId = g.Key, Amount = g.Sum(s => s.Amount) })
                    .OrderByDescending(x => x.Amount)
                    .FirstOrDefault();

                var topCategoryName = categoryAmounts?.LabelId != null &&
                    labels.TryGetValue(categoryAmounts.LabelId, out var label)
                    ? label.Name : null;
                var topCategoryColor = categoryAmounts?.LabelId != null &&
                    labels.TryGetValue(categoryAmounts.LabelId, out var labelForColor)
                    ? labelForColor.Color : null;

                return new LocationSpendingCluster(
                    cluster.Name,
                    cluster.Lat,
                    cluster.Lon,
                    cluster.City,
                    cluster.Country,
                    totalAmount,
                    cluster.Transactions.Count,
                    totalSpendingWithLocation > 0
                        ? Math.Round(totalAmount / totalSpendingWithLocation * 100, 1)
                        : 0,
                    topCategoryName,
                    topCategoryColor,
                    cluster.Transactions.Count > 0
                        ? Math.Round(totalAmount / cluster.Transactions.Count, 2)
                        : 0,
                    cluster.Transactions.Min(t => t.Date),
                    cluster.Transactions.Max(t => t.Date)
                );
            })
            .OrderByDescending(c => c.TotalAmount)
            .Take(10)
            .ToList();

        // Calculate nearby spending if coordinates provided
        LocationSpendingCluster? nearbySpending = null;
        if (latitude.HasValue && longitude.HasValue)
        {
            var nearbyTransactions = transactionsWithLocation
                .Where(t => {
                    var locLon = GetLongitude(t.Location!);
                    return CalculateDistanceKm(
                        latitude.Value, longitude.Value,
                        t.Location!.Latitude, locLon) <= radiusKm;
                })
                .ToList();

            if (nearbyTransactions.Any())
            {
                var sendNearby = nearbyTransactions.Where(t => t.Type == TransactionType.Send).ToList();
                var nearbyTotal = sendNearby.Sum(t => _exchangeRateService.Convert(
                    t.Amount, GetTransactionCurrency(t), primaryCurrency, rates));

                // Get the most common location name
                var locationName = nearbyTransactions
                    .GroupBy(t => GetPlaceName(t.Location!) ?? t.Location!.City ?? "This Area")
                    .OrderByDescending(g => g.Count())
                    .First().Key;

                // Find top category nearby
                var nearbyCategoryAmounts = sendNearby
                    .SelectMany(t => t.Splits)
                    .GroupBy(s => s.LabelId)
                    .Select(g => new { LabelId = g.Key, Amount = g.Sum(s => s.Amount) })
                    .OrderByDescending(x => x.Amount)
                    .FirstOrDefault();

                var nearbyTopCategory = nearbyCategoryAmounts?.LabelId != null &&
                    labels.TryGetValue(nearbyCategoryAmounts.LabelId, out var nearbyLabel)
                    ? nearbyLabel.Name : null;
                var nearbyTopCategoryColor = nearbyCategoryAmounts?.LabelId != null &&
                    labels.TryGetValue(nearbyCategoryAmounts.LabelId, out var nearbyLabelColor)
                    ? nearbyLabelColor.Color : null;

                var nearbyCity = nearbyTransactions
                    .Where(t => !string.IsNullOrEmpty(t.Location!.City))
                    .GroupBy(t => t.Location!.City)
                    .OrderByDescending(g => g.Count())
                    .FirstOrDefault()?.Key;

                var nearbyCountry = nearbyTransactions
                    .Where(t => !string.IsNullOrEmpty(t.Location!.Country))
                    .GroupBy(t => t.Location!.Country)
                    .OrderByDescending(g => g.Count())
                    .FirstOrDefault()?.Key;

                nearbySpending = new LocationSpendingCluster(
                    locationName,
                    latitude.Value,
                    longitude.Value,
                    nearbyCity,
                    nearbyCountry,
                    nearbyTotal,
                    nearbyTransactions.Count,
                    totalSpendingWithLocation > 0
                        ? Math.Round(nearbyTotal / totalSpendingWithLocation * 100, 1)
                        : 0,
                    nearbyTopCategory,
                    nearbyTopCategoryColor,
                    nearbyTransactions.Count > 0
                        ? Math.Round(nearbyTotal / nearbyTransactions.Count, 2)
                        : 0,
                    nearbyTransactions.Min(t => t.Date),
                    nearbyTransactions.Max(t => t.Date)
                );
            }
        }

        return new LocationInsightsResponse(
            topLocations,
            nearbySpending,
            totalSpendingWithLocation,
            transactionsWithLocation.Count,
            totalCount,
            primaryCurrency
        );
    }

    public async Task<TripGroupsResponse> GetTripGroupsAsync(
        string userId,
        DateTime? startDate,
        DateTime? endDate,
        double? homeLatitude = null,
        double? homeLongitude = null,
        double minTripDistanceKm = 50.0)
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

        // Get transactions for the period
        var filter = TransactionFilterRequest.Builder()
            .WithDateRange(startDate, endDate)
            .WithStatus("Confirmed")
            .WithPagination(1, int.MaxValue)
            .Build();

        var (transactions, _) = await _transactionRepository.GetFilteredAsync(userId, filter);

        // Filter transactions with location data (Send type only for spending analysis)
        var transactionsWithLocation = transactions
            .Where(t => t.Location != null && !t.IsRecurringTemplate && t.Type == TransactionType.Send)
            .OrderBy(t => t.Date)
            .ToList();

        if (!transactionsWithLocation.Any())
        {
            return new TripGroupsResponse(new List<TripGroup>(), 0, 0, primaryCurrency);
        }

        // Helper to get transaction currency
        string GetTransactionCurrency(Transaction t) =>
            !string.IsNullOrEmpty(t.AccountId) && accounts.TryGetValue(t.AccountId, out var acc)
                ? acc.Currency
                : primaryCurrency;

        // Helper to decrypt longitude
        double GetLongitude(TransactionLocation loc)
        {
            if (dek != null && !string.IsNullOrEmpty(loc.EncryptedLongitude))
            {
                var decrypted = _mapperService.DecryptIfNotEmpty(loc.EncryptedLongitude, dek);
                if (double.TryParse(decrypted, out var lon))
                    return lon;
            }
            return 0;
        }

        // Haversine distance calculation
        double CalculateDistanceKm(double lat1, double lon1, double lat2, double lon2)
        {
            const double EarthRadiusKm = 6371.0;
            var dLat = (lat2 - lat1) * Math.PI / 180.0;
            var dLon = (lon2 - lon1) * Math.PI / 180.0;
            var a = Math.Sin(dLat / 2) * Math.Sin(dLat / 2) +
                    Math.Cos(lat1 * Math.PI / 180.0) * Math.Cos(lat2 * Math.PI / 180.0) *
                    Math.Sin(dLon / 2) * Math.Sin(dLon / 2);
            var c = 2 * Math.Atan2(Math.Sqrt(a), Math.Sqrt(1 - a));
            return EarthRadiusKm * c;
        }

        // Group transactions by city/country to identify trip regions
        var regionGroups = new Dictionary<string, List<Transaction>>();
        
        foreach (var t in transactionsWithLocation)
        {
            var loc = t.Location!;
            var regionKey = !string.IsNullOrEmpty(loc.City)
                ? $"{loc.City}, {loc.Country ?? "Unknown"}"
                : loc.Country ?? "Unknown Region";
            
            if (!regionGroups.ContainsKey(regionKey))
            {
                regionGroups[regionKey] = new List<Transaction>();
            }
            regionGroups[regionKey].Add(t);
        }

        // Determine home base (most frequent location or user-provided)
        double homeBaseLat = homeLatitude ?? 0;
        double homeBaseLon = homeLongitude ?? 0;
        string? homeRegion = null;

        if (!homeLatitude.HasValue || !homeLongitude.HasValue)
        {
            // Find the region with most transactions - likely home base
            var mostFrequentRegion = regionGroups
                .OrderByDescending(g => g.Value.Count)
                .FirstOrDefault();
            
            if (mostFrequentRegion.Value?.Any() == true)
            {
                var firstTxInRegion = mostFrequentRegion.Value.First();
                homeBaseLat = firstTxInRegion.Location!.Latitude;
                homeBaseLon = GetLongitude(firstTxInRegion.Location!);
                homeRegion = mostFrequentRegion.Key;
            }
        }

        // Build trip groups - group consecutive transactions by region
        var tripGroups = new List<TripGroup>();
        var tripIdCounter = 1;

        foreach (var (regionKey, regionTransactions) in regionGroups.OrderBy(g => g.Value.Min(t => t.Date)))
        {
            if (regionTransactions.Count == 0) continue;

            var firstTx = regionTransactions.First();
            var centerLat = regionTransactions.Average(t => t.Location!.Latitude);
            var centerLon = regionTransactions.Average(t => GetLongitude(t.Location!));
            
            // Check if this is home base
            var distanceFromHome = CalculateDistanceKm(homeBaseLat, homeBaseLon, centerLat, centerLon);
            var isHomeBase = regionKey == homeRegion || distanceFromHome < minTripDistanceKm;

            // Get date range for this region
            var regionStartDate = regionTransactions.Min(t => t.Date);
            var regionEndDate = regionTransactions.Max(t => t.Date);
            var durationDays = Math.Max(1, (int)(regionEndDate - regionStartDate).TotalDays + 1);

            // Calculate total spending
            var totalAmount = regionTransactions.Sum(t => _exchangeRateService.Convert(
                t.Amount, GetTransactionCurrency(t), primaryCurrency, rates));

            // Calculate category breakdown
            var categoryTotals = regionTransactions
                .SelectMany(t => t.Splits.Select(s => new {
                    LabelId = s.LabelId,
                    Amount = _exchangeRateService.Convert(s.Amount, GetTransactionCurrency(t), primaryCurrency, rates)
                }))
                .GroupBy(x => x.LabelId)
                .Select(g => {
                    var totalCat = g.Sum(x => x.Amount);
                    labels.TryGetValue(g.Key, out var label);
                    return new TripCategoryBreakdown(
                        g.Key,
                        label?.Name ?? "Unknown",
                        label?.Color,
                        label?.Icon,
                        totalCat,
                        g.Count(),
                        totalAmount > 0 ? Math.Round(totalCat / totalAmount * 100, 1) : 0
                    );
                })
                .OrderByDescending(c => c.Amount)
                .ToList();

            // Calculate daily breakdown
            var dailyBreakdown = regionTransactions
                .GroupBy(t => t.DateLocal ?? t.Date.ToString("yyyy-MM-dd"))
                .OrderBy(g => g.Key)
                .Select(g => new TripDaySpending(
                    DateTime.TryParse(g.Key, out var d) ? d : g.First().Date,
                    g.Key,
                    g.Sum(t => _exchangeRateService.Convert(
                        t.Amount, GetTransactionCurrency(t), primaryCurrency, rates)),
                    g.Count()
                ))
                .ToList();

            // Generate trip name
            var tripName = isHomeBase
                ? $"Home ({regionKey})"
                : durationDays == 1
                    ? $"{regionKey} Trip"
                    : durationDays <= 3
                        ? $"{regionKey} Weekend"
                        : $"{regionKey} Trip ({durationDays} days)";

            var city = regionTransactions
                .Where(t => !string.IsNullOrEmpty(t.Location!.City))
                .Select(t => t.Location!.City)
                .GroupBy(c => c)
                .OrderByDescending(g => g.Count())
                .FirstOrDefault()?.Key;

            var country = regionTransactions
                .Where(t => !string.IsNullOrEmpty(t.Location!.Country))
                .Select(t => t.Location!.Country)
                .GroupBy(c => c)
                .OrderByDescending(g => g.Count())
                .FirstOrDefault()?.Key;

            tripGroups.Add(new TripGroup(
                $"trip-{tripIdCounter++}",
                tripName,
                city,
                country,
                centerLat,
                centerLon,
                regionStartDate,
                regionEndDate,
                durationDays,
                totalAmount,
                regionTransactions.Count,
                categoryTotals,
                dailyBreakdown,
                isHomeBase
            ));
        }

        // Sort trips: non-home trips by date descending, then home at the end
        var sortedTrips = tripGroups
            .Where(t => !t.IsHomeBase)
            .OrderByDescending(t => t.StartDate)
            .Concat(tripGroups.Where(t => t.IsHomeBase))
            .ToList();

        var totalTripSpending = sortedTrips.Where(t => !t.IsHomeBase).Sum(t => t.TotalAmount);
        var totalTripTransactions = sortedTrips.Where(t => !t.IsHomeBase).Sum(t => t.TransactionCount);

        return new TripGroupsResponse(
            sortedTrips,
            totalTripSpending,
            totalTripTransactions,
            primaryCurrency
        );
    }
}