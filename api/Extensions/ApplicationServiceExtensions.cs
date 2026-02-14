using System.Reflection;
using DigiTransac.Api.Services;
using DigiTransac.Api.Hubs;
using DigiTransac.Api.Services.Caching;
using DigiTransac.Api.Services.Transactions;
using DigiTransac.Api.Services.UnitOfWork;
using DigiTransac.Api.Settings;
using FluentValidation;
using Serilog;

namespace DigiTransac.Api.Extensions;

/// <summary>
/// Extension methods for registering application services, HttpClient, SignalR, background services, and validators.
/// </summary>
public static class ApplicationServiceExtensions
{
    /// <summary>
    /// Adds all application services including HttpClient, caching, encryption, transactions, SignalR, and background services.
    /// </summary>
    public static WebApplicationBuilder AddApplicationServices(this WebApplicationBuilder builder)
    {
        AddSettings(builder);
        AddHttpClients(builder);
        AddCachingServices(builder);
        AddCoreServices(builder);
        AddTransactionServices(builder);
        AddSignalRServices(builder);
        AddBackgroundServices(builder);
        AddValidatorsAndMediatR(builder);

        return builder;
    }

    private static void AddSettings(WebApplicationBuilder builder)
    {
        builder.Services.Configure<MongoDbSettings>(builder.Configuration.GetSection("MongoDb"));
        builder.Services.Configure<JwtSettings>(builder.Configuration.GetSection("Jwt"));
        builder.Services.Configure<EncryptionSettings>(builder.Configuration.GetSection("Encryption"));
        builder.Services.Configure<SecuritySettings>(builder.Configuration.GetSection("Security"));
        builder.Services.Configure<RateLimitSettings>(builder.Configuration.GetSection("RateLimit"));
        builder.Services.Configure<WebPushSettings>(builder.Configuration.GetSection("WebPush"));

        var emailSettings = builder.Configuration.GetSection("Email").Get<EmailSettings>()!;
        builder.Services.AddSingleton(emailSettings);
    }

    private static void AddHttpClients(WebApplicationBuilder builder)
    {
        var loggerFactory = LoggerFactory.Create(logging => logging.AddSerilog());
        var httpClientLogger = loggerFactory.CreateLogger("HttpClient.Resilience");

        builder.Services.AddHttpClient("ExchangeRates", client =>
        {
            client.Timeout = TimeSpan.FromSeconds(30);
            client.DefaultRequestHeaders.Add("User-Agent", "DigiTransac/1.0");
        })
        .ConfigurePrimaryHttpMessageHandler((sp) =>
        {
            var handler = new HttpClientHandler
            {
                AutomaticDecompression = System.Net.DecompressionMethods.All,
            };

            // Only bypass SSL validation in Development - never in production
            if (builder.Environment.IsDevelopment())
            {
                handler.ServerCertificateCustomValidationCallback = HttpClientHandler.DangerousAcceptAnyServerCertificateValidator;
                Log.Warning("SSL certificate validation is disabled for ExchangeRates HTTP client (Development only)");
            }

            return handler;
        })
        .AddResiliencePolicies(
            httpClientLogger,
            retryCount: 3,
            circuitBreakerThreshold: 5,
            circuitBreakerDurationSeconds: 30,
            timeoutSeconds: 15);

        builder.Services.AddHttpClient();
    }

    private static void AddCachingServices(WebApplicationBuilder builder)
    {
        var redisConnectionString = builder.Configuration.GetConnectionString("Redis")
            ?? builder.Configuration["Redis:ConnectionString"];

        if (!string.IsNullOrEmpty(redisConnectionString))
        {
            // Use Redis distributed cache when configured
            builder.Services.AddStackExchangeRedisCache(options =>
            {
                options.Configuration = redisConnectionString;
                options.InstanceName = "DigiTransac:";
            });
            builder.Services.AddSingleton<ICacheService, RedisCacheService>();
            Log.Information("Using Redis cache at {RedisConnection}", redisConnectionString.Split(',')[0]);
        }
        else
        {
            // Fall back to in-memory cache for development
            builder.Services.AddMemoryCache(options =>
            {
                options.SizeLimit = 10000;
            });
            builder.Services.AddSingleton<ICacheService, MemoryCacheService>();
            Log.Information("Using in-memory cache. Set Redis:ConnectionString for distributed caching.");
        }

        builder.Services.AddHttpContextAccessor();
    }

    private static void AddCoreServices(WebApplicationBuilder builder)
    {
        builder.Services.AddSingleton<IEmailService, GmailEmailService>();
        builder.Services.AddSingleton<IEncryptionService, EncryptionService>();

        // Register key management service based on configured provider
        var encryptionProvider = builder.Configuration["Encryption:Provider"] ?? "Local";
        if (string.Equals(encryptionProvider, "AzureKeyVault", StringComparison.OrdinalIgnoreCase))
        {
            builder.Services.AddSingleton<IKeyManagementService, AzureKeyVaultService>();
            Log.Information("Using Azure Key Vault for key management");
        }
        else
        {
            builder.Services.AddSingleton<IKeyManagementService, LocalKeyManagementService>();
            Log.Information("Using local key management (KEK from configuration)");
        }

        builder.Services.AddSingleton<IDekCacheService, DekCacheService>();
        builder.Services.AddSingleton<ICookieService, CookieService>();
        builder.Services.AddScoped<ITwoFactorService, TwoFactorService>();
        builder.Services.AddScoped<IAuthService, AuthService>();
        builder.Services.AddScoped<ILabelService, LabelService>();
        builder.Services.AddScoped<ITagService, TagService>();
        builder.Services.AddScoped<IAccountService, AccountService>();
        builder.Services.AddScoped<IExchangeRateService, ExchangeRateService>();
        builder.Services.AddScoped<IAuditService, AuditService>();
        builder.Services.AddScoped<IConversationService, ConversationService>();
        builder.Services.AddScoped<IBudgetService, BudgetService>();

        // Unit of Work for transactional operations (Scoped - one per request)
        builder.Services.AddScoped<IUnitOfWork, DigiTransac.Api.Services.UnitOfWork.UnitOfWork>();
    }

    private static void AddTransactionServices(WebApplicationBuilder builder)
    {
        builder.Services.AddScoped<ITransactionMapperService, TransactionMapperService>();
        builder.Services.AddScoped<IAccountBalanceService, AccountBalanceService>();
        builder.Services.AddScoped<ITransferService, TransferService>();
        builder.Services.AddScoped<IP2PTransactionService, P2PTransactionService>();
        builder.Services.AddScoped<IRecurringTransactionService, RecurringTransactionService>();
        builder.Services.AddScoped<ITransactionAnalyticsService, TransactionAnalyticsService>();
        builder.Services.AddScoped<ITransactionExportService, TransactionExportService>();
        builder.Services.AddScoped<ITransactionBatchService, TransactionBatchService>();
        builder.Services.AddScoped<ITransactionCoreService, TransactionCoreService>();
        builder.Services.AddScoped<ITransactionService, TransactionServiceFacade>();
        builder.Services.AddScoped<ITransactionImportService, TransactionImportService>();
    }

    private static void AddSignalRServices(WebApplicationBuilder builder)
    {
        builder.Services.AddSignalR(options =>
        {
            options.EnableDetailedErrors = builder.Environment.IsDevelopment();
            options.MaximumReceiveMessageSize = 32 * 1024; // 32 KB
            options.KeepAliveInterval = TimeSpan.FromSeconds(15);
            options.ClientTimeoutInterval = TimeSpan.FromSeconds(30);
        });

        builder.Services.AddSingleton<IWebPushService, WebPushService>();
        builder.Services.AddScoped<INotificationService, NotificationService>();
    }

    private static void AddBackgroundServices(WebApplicationBuilder builder)
    {
        builder.Services.AddHostedService<RecurringTransactionBackgroundService>();
        builder.Services.AddHostedService<DeletedMessageCleanupService>();
    }

    private static void AddValidatorsAndMediatR(WebApplicationBuilder builder)
    {
        builder.Services.AddValidatorsFromAssemblyContaining<Program>();

        builder.Services.AddMediatR(cfg =>
        {
            cfg.RegisterServicesFromAssembly(Assembly.GetExecutingAssembly());
        });

        builder.Services.AddOpenTelemetryTracing(builder.Configuration);
    }
}