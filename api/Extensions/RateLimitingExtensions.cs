using System.Security.Claims;
using System.Threading.RateLimiting;
using DigiTransac.Api.Settings;
using Microsoft.AspNetCore.RateLimiting;

namespace DigiTransac.Api.Extensions;

/// <summary>
/// Extension methods for configuring rate limiting policies.
/// </summary>
public static class RateLimitingExtensions
{
    /// <summary>
    /// Adds rate limiting with global, auth, sensitive, per-user, transaction-create, and export policies.
    /// </summary>
    public static WebApplicationBuilder AddRateLimitingPolicies(this WebApplicationBuilder builder)
    {
        var rateLimitSettings = builder.Configuration.GetSection("RateLimit").Get<RateLimitSettings>() ?? new RateLimitSettings();

        builder.Services.AddRateLimiter(options =>
        {
            options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;

            options.GlobalLimiter = CreateGlobalLimiter(rateLimitSettings);

            AddAuthPolicy(options, rateLimitSettings);
            AddSensitivePolicy(options, rateLimitSettings);
            AddPerUserPolicy(options, rateLimitSettings);
            AddTransactionCreatePolicy(options, rateLimitSettings);
            AddExportPolicy(options);
        });

        return builder;
    }

    private static PartitionedRateLimiter<HttpContext> CreateGlobalLimiter(RateLimitSettings settings)
    {
        return PartitionedRateLimiter.Create<HttpContext, string>(httpContext =>
            RateLimitPartition.GetFixedWindowLimiter(
                partitionKey: httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown",
                factory: _ => new FixedWindowRateLimiterOptions
                {
                    PermitLimit = settings.PermitLimit,
                    Window = TimeSpan.FromSeconds(settings.WindowSeconds),
                    QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
                    QueueLimit = settings.QueueLimit
                }));
    }

    private static void AddAuthPolicy(RateLimiterOptions options, RateLimitSettings settings)
    {
        options.AddPolicy("auth", httpContext =>
            RateLimitPartition.GetFixedWindowLimiter(
                partitionKey: httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown",
                factory: _ => new FixedWindowRateLimiterOptions
                {
                    PermitLimit = settings.AuthPermitLimit ?? 10,
                    Window = TimeSpan.FromSeconds(settings.AuthWindowSeconds ?? 60),
                    QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
                    QueueLimit = 0
                }));
    }

    private static void AddSensitivePolicy(RateLimiterOptions options, RateLimitSettings settings)
    {
        options.AddPolicy("sensitive", httpContext =>
            RateLimitPartition.GetFixedWindowLimiter(
                partitionKey: httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown",
                factory: _ => new FixedWindowRateLimiterOptions
                {
                    PermitLimit = settings.SensitivePermitLimit ?? 5,
                    Window = TimeSpan.FromSeconds(settings.SensitiveWindowSeconds ?? 300),
                    QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
                    QueueLimit = 0
                }));
    }

    private static void AddPerUserPolicy(RateLimiterOptions options, RateLimitSettings settings)
    {
        options.AddPolicy("per-user", httpContext =>
        {
            var userId = GetUserIdentifier(httpContext);

            return RateLimitPartition.GetFixedWindowLimiter(
                partitionKey: $"user:{userId}",
                factory: _ => new FixedWindowRateLimiterOptions
                {
                    PermitLimit = settings.UserPermitLimit,
                    Window = TimeSpan.FromSeconds(settings.UserWindowSeconds),
                    QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
                    QueueLimit = 2
                });
        });
    }

    private static void AddTransactionCreatePolicy(RateLimiterOptions options, RateLimitSettings settings)
    {
        options.AddPolicy("transaction-create", httpContext =>
        {
            var userId = GetUserIdentifier(httpContext);

            return RateLimitPartition.GetTokenBucketLimiter(
                partitionKey: $"transaction:{userId}",
                factory: _ => new TokenBucketRateLimiterOptions
                {
                    TokenLimit = settings.TransactionPermitLimit,
                    QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
                    QueueLimit = 0,
                    ReplenishmentPeriod = TimeSpan.FromSeconds(settings.TransactionWindowSeconds),
                    TokensPerPeriod = settings.TransactionPermitLimit,
                    AutoReplenishment = true
                });
        });
    }

    private static void AddExportPolicy(RateLimiterOptions options)
    {
        options.AddPolicy("export", httpContext =>
        {
            var userId = GetUserIdentifier(httpContext);

            return RateLimitPartition.GetSlidingWindowLimiter(
                partitionKey: $"export:{userId}",
                factory: _ => new SlidingWindowRateLimiterOptions
                {
                    PermitLimit = 10,
                    Window = TimeSpan.FromMinutes(5),
                    SegmentsPerWindow = 5,
                    QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
                    QueueLimit = 1
                });
        });
    }

    private static string GetUserIdentifier(HttpContext httpContext)
    {
        return httpContext.User.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? httpContext.User.FindFirstValue("sub")
            ?? httpContext.Connection.RemoteIpAddress?.ToString()
            ?? "unknown";
    }
}