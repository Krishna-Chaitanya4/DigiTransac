using DigiTransac.Api.Repositories;
using DigiTransac.Api.Services;
using DigiTransac.Api.Settings;
using Microsoft.Extensions.Diagnostics.HealthChecks;

namespace DigiTransac.Api.Extensions;

/// <summary>
/// Extension methods for registering MongoDB services, repositories, and health checks.
/// </summary>
public static class MongoDbServiceExtensions
{
    /// <summary>
    /// Adds MongoDB singleton service, all repositories, and database health checks.
    /// </summary>
    public static WebApplicationBuilder AddMongoDbServices(this WebApplicationBuilder builder)
    {
        // MongoDB singleton service (shared client for all repositories)
        builder.Services.AddSingleton<IMongoDbService, MongoDbService>();

        // Repositories
        builder.Services.AddSingleton<IUserRepository, UserRepository>();
        builder.Services.AddSingleton<IEmailVerificationRepository, EmailVerificationRepository>();
        builder.Services.AddSingleton<IRefreshTokenRepository, RefreshTokenRepository>();
        builder.Services.AddSingleton<ITwoFactorTokenRepository, TwoFactorTokenRepository>();
        builder.Services.AddSingleton<ILabelRepository, LabelRepository>();
        builder.Services.AddSingleton<ITagRepository, TagRepository>();
        builder.Services.AddSingleton<IAccountRepository, AccountRepository>();
        builder.Services.AddSingleton<IExchangeRateRepository, ExchangeRateRepository>();
        builder.Services.AddSingleton<ITransactionRepository, TransactionRepository>();
        builder.Services.AddSingleton<IChatMessageRepository, ChatMessageRepository>();
        builder.Services.AddSingleton<IAuditLogRepository, AuditLogRepository>();
        builder.Services.AddSingleton<IBudgetRepository, BudgetRepository>();
        builder.Services.AddSingleton<IPushSubscriptionRepository, PushSubscriptionRepository>();

        // Health checks
        var mongoSettings = builder.Configuration.GetSection("MongoDb").Get<MongoDbSettings>();
        var mongoConnectionStr = mongoSettings?.ConnectionString ?? "mongodb://localhost:27017";
        builder.Services.AddHealthChecks()
            .AddMongoDb(
                sp => new MongoDB.Driver.MongoClient(mongoConnectionStr),
                name: "mongodb",
                failureStatus: HealthStatus.Unhealthy,
                tags: new[] { "db", "mongodb" })
            .AddUrlGroup(
                new Uri("https://open.er-api.com/v6/latest/USD"),
                name: "exchange-rate-api",
                failureStatus: HealthStatus.Degraded,
                tags: new[] { "external", "api" });

        return builder;
    }
}