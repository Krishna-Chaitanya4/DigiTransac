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
        }

        // Get sums by label (for the filtered date range) - also only for Confirmed
        var byCategory = await _transactionRepository.GetSumByLabelAsync(
            userId, filter.StartDate, filter.EndDate);
        var byTag = await _transactionRepository.GetSumByTagAsync(
            userId, filter.StartDate, filter.EndDate);

        return new TransactionSummaryResponse(
            totalCredits,
            totalDebits,
            totalCredits - totalDebits,
            transactions.Count,
            byCategory,
            byTag,
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
        var filter = new TransactionFilterRequest(
            startDate, endDate,
            accountId != null ? new List<string> { accountId } : null,
            null, null, null, null, null, null, null, null, null, null);

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
}