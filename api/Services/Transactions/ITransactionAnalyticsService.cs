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
        int page = 1,
        int pageSize = 10);
    
    /// <summary>
    /// Get spending breakdown by account
    /// </summary>
    Task<SpendingByAccountResponse> GetSpendingByAccountAsync(
        string userId,
        DateTime? startDate,
        DateTime? endDate,
        int page = 1,
        int pageSize = 50);
    
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
        DateTime? endDate,
        int page = 1,
        int pageSize = 10);
    
    /// <summary>
    /// Get location-based spending insights.
    /// If latitude/longitude provided, returns spending within radius of that point.
    /// Otherwise, returns top spending locations.
    /// </summary>
    Task<LocationInsightsResponse> GetLocationInsightsAsync(
        string userId,
        DateTime? startDate,
        DateTime? endDate,
        double? latitude = null,
        double? longitude = null,
        double radiusKm = 1.0);
    
    /// <summary>
    /// Detect trips based on geographic clustering of transactions.
    /// Groups transactions by city/country and identifies travel periods.
    /// </summary>
    /// <param name="homeLatitude">User's home latitude (optional, for excluding home location)</param>
    /// <param name="homeLongitude">User's home longitude (optional, for excluding home location)</param>
    /// <param name="minTripDistanceKm">Minimum distance from home to consider a trip (default 50km)</param>
    Task<TripGroupsResponse> GetTripGroupsAsync(
        string userId,
        DateTime? startDate,
        DateTime? endDate,
        double? homeLatitude = null,
        double? homeLongitude = null,
        double minTripDistanceKm = 50.0);
}