using System.Security.Claims;
using DigiTransac.Api.Common;
using DigiTransac.Api.Extensions;
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
        // no-cache: always revalidate with server; ETag provides 304 when data unchanged
        group.MapGet("/analytics", async (
            DateTime? startDate,
            DateTime? endDate,
            string? accountId,
            ClaimsPrincipal user,
            HttpContext httpContext,
            ITransactionService transactionService,
            CancellationToken ct) =>
        {
            if (!user.TryGetUserId(out var userId))
                return Results.Unauthorized();

            var analytics = await transactionService.GetAnalyticsAsync(userId, startDate, endDate, accountId, ct);
            
            return ETagHelper.OkWithETag(httpContext, analytics, cacheMaxAgeSeconds: 0);
        })
        .WithName("GetTransactionAnalytics")
        .WithSummary("Get transaction analytics")
        .WithDescription("Returns comprehensive analytics including income/expense breakdown, category spending, monthly trends, and top payees. Uses ETag-based caching with 304 Not Modified.")
        .Produces<TransactionAnalyticsResponse>(200);

        // Get top counterparties (payees) spending breakdown
        group.MapGet("/analytics/counterparties", async (
            DateTime? startDate,
            DateTime? endDate,
            int? page,
            int? pageSize,
            ClaimsPrincipal user,
            HttpContext httpContext,
            ITransactionAnalyticsService analyticsService,
            CancellationToken ct) =>
        {
            if (!user.TryGetUserId(out var userId))
                return Results.Unauthorized();

            var result = await analyticsService.GetTopCounterpartiesAsync(userId, startDate, endDate, page ?? 1, pageSize ?? 10, ct);
            
            return ETagHelper.OkWithETag(httpContext, result, cacheMaxAgeSeconds: 0);
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
            ITransactionAnalyticsService analyticsService,
            CancellationToken ct) =>
        {
            if (!user.TryGetUserId(out var userId))
                return Results.Unauthorized();

            var result = await analyticsService.GetSpendingByAccountAsync(userId, startDate, endDate, page ?? 1, Math.Min(pageSize ?? 50, 200), ct);
            
            return ETagHelper.OkWithETag(httpContext, result, cacheMaxAgeSeconds: 0);
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
            ITransactionAnalyticsService analyticsService,
            CancellationToken ct) =>
        {
            if (!user.TryGetUserId(out var userId))
                return Results.Unauthorized();

            var result = await analyticsService.GetSpendingPatternsAsync(userId, startDate, endDate, ct);
            
            return ETagHelper.OkWithETag(httpContext, result, cacheMaxAgeSeconds: 0);
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
            ITransactionAnalyticsService analyticsService,
            CancellationToken ct) =>
        {
            if (!user.TryGetUserId(out var userId))
                return Results.Unauthorized();

            var result = await analyticsService.GetSpendingAnomaliesAsync(userId, startDate, endDate, page ?? 1, pageSize ?? 10, ct);
            
            return ETagHelper.OkWithETag(httpContext, result, cacheMaxAgeSeconds: 0);
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
            ITransactionAnalyticsService analyticsService,
            CancellationToken ct) =>
        {
            if (!user.TryGetUserId(out var userId))
                return Results.Unauthorized();

            var result = await analyticsService.GetLocationInsightsAsync(
                userId,
                startDate,
                endDate,
                latitude,
                longitude,
                radiusKm ?? 1.0,
                ct);
            
            return ETagHelper.OkWithETag(httpContext, result, cacheMaxAgeSeconds: 0);
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
            ITransactionAnalyticsService analyticsService,
            CancellationToken ct) =>
        {
            if (!user.TryGetUserId(out var userId))
                return Results.Unauthorized();

            var result = await analyticsService.GetTripGroupsAsync(
                userId,
                startDate,
                endDate,
                homeLatitude,
                homeLongitude,
                minTripDistanceKm ?? 50.0,
                ct);
            
            return ETagHelper.OkWithETag(httpContext, result, cacheMaxAgeSeconds: 0);
        })
        .WithName("GetTripGroups")
        .WithSummary("Get trip groups")
        .WithDescription("Groups transactions into detected trips based on geographic distance from home location. Identifies travel spending patterns.")
        .Produces<TripGroupsResponse>(200);

        return group;
    }
}