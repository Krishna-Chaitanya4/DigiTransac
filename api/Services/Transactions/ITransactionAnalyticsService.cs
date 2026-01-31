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
}