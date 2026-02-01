using DigiTransac.Api.Models.Dto;

namespace DigiTransac.Api.Services.Transactions;

/// <summary>
/// Handles analytics and summary calculations for transactions.
/// Provides spending trends, category breakdowns, and period summaries.
/// </summary>
public interface ITransactionAnalyticsService
{
    /// <summary>
    /// Get transaction summary (totals, by category, by tag) for a filter
    /// </summary>
    Task<TransactionSummaryResponse> GetSummaryAsync(
        string userId,
        TransactionFilterRequest filter);
    
    /// <summary>
    /// Get detailed analytics (trends, averages, breakdowns)
    /// </summary>
    Task<TransactionAnalyticsResponse> GetAnalyticsAsync(
        string userId,
        DateTime? startDate,
        DateTime? endDate,
        string? accountId);
    
    /// <summary>
    /// Get top counterparties (payees) with spending breakdown
    /// </summary>
    Task<TopCounterpartiesResponse> GetTopCounterpartiesAsync(
        string userId,
        DateTime? startDate,
        DateTime? endDate,
        int limit = 10);
    
    /// <summary>
    /// Get spending breakdown by account
    /// </summary>
    Task<SpendingByAccountResponse> GetSpendingByAccountAsync(
        string userId,
        DateTime? startDate,
        DateTime? endDate);
    
    /// <summary>
    /// Get spending patterns by day of week and hour of day
    /// </summary>
    Task<SpendingPatternsResponse> GetSpendingPatternsAsync(
        string userId,
        DateTime? startDate,
        DateTime? endDate);
    
    /// <summary>
    /// Detect spending anomalies and generate alerts
    /// </summary>
    Task<SpendingAnomaliesResponse> GetSpendingAnomaliesAsync(
        string userId,
        DateTime? startDate,
        DateTime? endDate);
}