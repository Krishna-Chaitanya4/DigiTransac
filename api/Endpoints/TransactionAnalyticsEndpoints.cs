using System.Security.Claims;
using DigiTransac.Api.Common;
using DigiTransac.Api.Models.Dto;
using DigiTransac.Api.Services;
using DigiTransac.Api.Services.Transactions;

namespace DigiTransac.Api.Endpoints;

/// <summary>
/// Transaction analytics endpoints: spending breakdowns, patterns, anomalies, location insights, and trip analysis.
/// </summary>
public static class TransactionAnalyticsEndpoints
{
    public static RouteGroupBuilder MapTransactionAnalyticsEndpoints(this RouteGroupBuilder group)
    {
        // Get analytics
        // Cache analytics for 5 minutes to reduce load on expensive aggregate queries
        group.MapGet("/analytics", async (
            DateTime? startDate,
            DateTime? endDate,
            string? accountId,
            ClaimsPrincipal user,
            HttpContext httpContext,
            ITransactionService transactionService) =>
        {
            var userId = user.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userId))
                return Results.Unauthorized();

            var analytics = await transactionService.GetAnalyticsAsync(userId, startDate, endDate, accountId);
            
            return ETagHelper.OkWithETag(httpContext, analytics, cacheMaxAgeSeconds: 300);
        })
        .WithName("GetTransactionAnalytics")
        .WithSummary("Get transaction analytics")
        .WithDescription("Returns comprehensive analytics including income/expense breakdown, category spending, monthly trends, and top payees. Cached for 5 minutes with ETag support.")
        .Produces<TransactionAnalyticsResponse>(200);

        // Get top counterparties (payees) spending breakdown
        group.MapGet("/analytics/counterparties", async (
            DateTime? startDate,
            DateTime? endDate,
            int? page,
            int? pageSize,
            ClaimsPrincipal user,
            HttpContext httpContext,
            ITransactionAnalyticsService analyticsService) =>
        {
            var userId = user.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userId))
                return Results.Unauthorized();

            var result = await analyticsService.GetTopCounterpartiesAsync(userId, startDate, endDate, page ?? 1, pageSize ?? 10);
            
            return ETagHelper.OkWithETag(httpContext, result, cacheMaxAgeSeconds: 300);
        })
        .WithName("GetTopCounterparties")
        .WithSummary("Get top counterparties")
        .WithDescription("Returns paginated list of top payees/payers ranked by total spending amount within the date range.")
        .Produces<TopCounterpartiesResponse>(200);

        // Get spending breakdown by account
        group.MapGet("/analytics/by-account", async (
            DateTime? startDate,
            DateTime? endDate,
            int? page,
            int? pageSize,
            ClaimsPrincipal user,
            HttpContext httpContext,
            ITransactionAnalyticsService analyticsService) =>
        {
            var userId = user.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userId))
                return Results.Unauthorized();

            var result = await analyticsService.GetSpendingByAccountAsync(userId, startDate, endDate, page ?? 1, pageSize ?? 50);
            
            return ETagHelper.OkWithETag(httpContext, result, cacheMaxAgeSeconds: 300);
        })
        .WithName("GetSpendingByAccount")
        .WithSummary("Get spending by account")
        .WithDescription("Returns spending breakdown grouped by financial account, showing total income and expenses per account.")
        .Produces<SpendingByAccountResponse>(200);

        // Get spending patterns (by day of week and hour of day)
        group.MapGet("/analytics/patterns", async (
            DateTime? startDate,
            DateTime? endDate,
            ClaimsPrincipal user,
            HttpContext httpContext,
            ITransactionAnalyticsService analyticsService) =>
        {
            var userId = user.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userId))
                return Results.Unauthorized();

            var result = await analyticsService.GetSpendingPatternsAsync(userId, startDate, endDate);
            
            return ETagHelper.OkWithETag(httpContext, result, cacheMaxAgeSeconds: 300);
        })
        .WithName("GetSpendingPatterns")
        .WithSummary("Get spending patterns")
        .WithDescription("Returns spending patterns analyzed by day of week and hour of day, identifying peak spending times.")
        .Produces<SpendingPatternsResponse>(200);

        // Get spending anomalies and alerts
        group.MapGet("/analytics/anomalies", async (
            DateTime? startDate,
            DateTime? endDate,
            int? page,
            int? pageSize,
            ClaimsPrincipal user,
            HttpContext httpContext,
            ITransactionAnalyticsService analyticsService) =>
        {
            var userId = user.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userId))
                return Results.Unauthorized();

            var result = await analyticsService.GetSpendingAnomaliesAsync(userId, startDate, endDate, page ?? 1, pageSize ?? 10);
            
            return ETagHelper.OkWithETag(httpContext, result, cacheMaxAgeSeconds: 300);
        })
        .WithName("GetSpendingAnomalies")
        .WithSummary("Get spending anomalies")
        .WithDescription("Detects unusual spending patterns and anomalies such as transactions significantly above category averages.")
        .Produces<SpendingAnomaliesResponse>(200);

        // Get location-based spending insights
        group.MapGet("/analytics/locations", async (
            DateTime? startDate,
            DateTime? endDate,
            double? latitude,
            double? longitude,
            double? radiusKm,
            ClaimsPrincipal user,
            HttpContext httpContext,
            ITransactionAnalyticsService analyticsService) =>
        {
            var userId = user.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userId))
                return Results.Unauthorized();

            var result = await analyticsService.GetLocationInsightsAsync(
                userId,
                startDate,
                endDate,
                latitude,
                longitude,
                radiusKm ?? 1.0);
            
            return ETagHelper.OkWithETag(httpContext, result, cacheMaxAgeSeconds: 300);
        })
        .WithName("GetLocationInsights")
        .WithSummary("Get location-based insights")
        .WithDescription("Returns spending insights based on transaction locations. Optionally filter by proximity to a specific lat/long coordinate within a radius.")
        .Produces<LocationInsightsResponse>(200);

        // Get trip groups (travel spending analysis)
        group.MapGet("/analytics/trips", async (
            DateTime? startDate,
            DateTime? endDate,
            double? homeLatitude,
            double? homeLongitude,
            double? minTripDistanceKm,
            ClaimsPrincipal user,
            HttpContext httpContext,
            ITransactionAnalyticsService analyticsService) =>
        {
            var userId = user.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userId))
                return Results.Unauthorized();

            var result = await analyticsService.GetTripGroupsAsync(
                userId,
                startDate,
                endDate,
                homeLatitude,
                homeLongitude,
                minTripDistanceKm ?? 50.0);
            
            return ETagHelper.OkWithETag(httpContext, result, cacheMaxAgeSeconds: 300);
        })
        .WithName("GetTripGroups")
        .WithSummary("Get trip groups")
        .WithDescription("Groups transactions into detected trips based on geographic distance from home location. Identifies travel spending patterns.")
        .Produces<TripGroupsResponse>(200);

        return group;
    }
}