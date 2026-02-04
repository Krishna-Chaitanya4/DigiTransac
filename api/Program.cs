using System.IO.Compression;
using System.Security.Claims;
using System.Text;
using System.Threading.RateLimiting;
using Asp.Versioning;
using DigiTransac.Api.Endpoints;
using DigiTransac.Api.Extensions;
using DigiTransac.Api.Hubs;
using DigiTransac.Api.Repositories;
using DigiTransac.Api.Services;
using DigiTransac.Api.Services.Caching;
using DigiTransac.Api.Services.Transactions;
using DigiTransac.Api.Settings;
using DigiTransac.Api.Validators;
using FluentValidation;
using HealthChecks.MongoDb;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.AspNetCore.ResponseCompression;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using Microsoft.IdentityModel.Tokens;
using Serilog;
using Swashbuckle.AspNetCore.SwaggerGen;
using System.Reflection;

// Configure Serilog
Log.Logger = new LoggerConfiguration()
    .MinimumLevel.Information()
    .MinimumLevel.Override("Microsoft", Serilog.Events.LogEventLevel.Warning)
    .MinimumLevel.Override("Microsoft.AspNetCore", Serilog.Events.LogEventLevel.Warning)
    .Enrich.FromLogContext()
    .Enrich.WithProperty("Application", "DigiTransac")
    .WriteTo.Console(outputTemplate: "[{Timestamp:HH:mm:ss} {Level:u3}] {Message:lj} {Properties:j}{NewLine}{Exception}")
    .WriteTo.File("logs/digitransac-.log", 
        rollingInterval: RollingInterval.Day, 
        retainedFileCountLimit: 30,
        outputTemplate: "{Timestamp:yyyy-MM-dd HH:mm:ss.fff zzz} [{Level:u3}] {Message:lj} {Properties:j}{NewLine}{Exception}")
    .CreateLogger();

try
{

var builder = WebApplication.CreateBuilder(args);
builder.Host.UseSerilog();

// Add environment variables as configuration source (highest priority)
builder.Configuration.AddEnvironmentVariables();

// Override settings with environment variables where applicable
var jwtKey = Environment.GetEnvironmentVariable("JWT_SECRET_KEY");
if (!string.IsNullOrEmpty(jwtKey))
{
    builder.Configuration["Jwt:Key"] = jwtKey;
}

var encryptionKey = Environment.GetEnvironmentVariable("ENCRYPTION_KEY");
if (!string.IsNullOrEmpty(encryptionKey))
{
    builder.Configuration["Encryption:Key"] = encryptionKey;
}

var encryptionKek = Environment.GetEnvironmentVariable("ENCRYPTION_KEK");
if (!string.IsNullOrEmpty(encryptionKek))
{
    builder.Configuration["Encryption:Kek"] = encryptionKek;
}

var emailSender = Environment.GetEnvironmentVariable("EMAIL_SENDER");
if (!string.IsNullOrEmpty(emailSender))
{
    builder.Configuration["Email:SenderEmail"] = emailSender;
}

var emailPassword = Environment.GetEnvironmentVariable("EMAIL_APP_PASSWORD");
if (!string.IsNullOrEmpty(emailPassword))
{
    builder.Configuration["Email:AppPassword"] = emailPassword;
}

var mongoConnectionString = Environment.GetEnvironmentVariable("MONGODB_CONNECTION_STRING");
if (!string.IsNullOrEmpty(mongoConnectionString))
{
    builder.Configuration["MongoDb:ConnectionString"] = mongoConnectionString;
}

var mongoDbName = Environment.GetEnvironmentVariable("MONGODB_DATABASE_NAME");
if (!string.IsNullOrEmpty(mongoDbName))
{
    builder.Configuration["MongoDb:DatabaseName"] = mongoDbName;
}

// =============================================================================
// Environment Variable Validation
// =============================================================================
// Validate required configuration at startup to fail fast
var validationErrors = new List<string>();
var validationWarnings = new List<string>();

// Required: JWT Secret Key (must be at least 32 characters for HS256)
var jwtKeyValue = builder.Configuration["Jwt:Key"];
if (string.IsNullOrWhiteSpace(jwtKeyValue))
{
    validationErrors.Add("JWT_SECRET_KEY or Jwt:Key is required");
}
else if (jwtKeyValue.Length < 32)
{
    validationErrors.Add($"JWT_SECRET_KEY must be at least 32 characters (currently {jwtKeyValue.Length})");
}

// Required: MongoDB Connection String
var mongoConnStr = builder.Configuration["MongoDb:ConnectionString"];
if (string.IsNullOrWhiteSpace(mongoConnStr))
{
    validationErrors.Add("MONGODB_CONNECTION_STRING or MongoDb:ConnectionString is required");
}

// Required: MongoDB Database Name
var mongoDbNameValue = builder.Configuration["MongoDb:DatabaseName"];
if (string.IsNullOrWhiteSpace(mongoDbNameValue))
{
    validationErrors.Add("MONGODB_DATABASE_NAME or MongoDb:DatabaseName is required");
}

// Required for encryption: Encryption Key (must be valid base64, 32 bytes for AES-256)
var encKeyValue = builder.Configuration["Encryption:Key"];
if (string.IsNullOrWhiteSpace(encKeyValue))
{
    validationErrors.Add("ENCRYPTION_KEY or Encryption:Key is required");
}
else
{
    try
    {
        var keyBytes = Convert.FromBase64String(encKeyValue);
        if (keyBytes.Length != 32)
        {
            validationErrors.Add($"ENCRYPTION_KEY must be 32 bytes (256 bits) when decoded, got {keyBytes.Length} bytes");
        }
    }
    catch (FormatException)
    {
        validationErrors.Add("ENCRYPTION_KEY must be valid base64 encoded");
    }
}

// Required for encryption: Key Encryption Key (KEK)
var kekValue = builder.Configuration["Encryption:Kek"];
if (string.IsNullOrWhiteSpace(kekValue))
{
    validationErrors.Add("ENCRYPTION_KEK or Encryption:Kek is required");
}
else
{
    try
    {
        var kekBytes = Convert.FromBase64String(kekValue);
        if (kekBytes.Length != 32)
        {
            validationErrors.Add($"ENCRYPTION_KEK must be 32 bytes (256 bits) when decoded, got {kekBytes.Length} bytes");
        }
    }
    catch (FormatException)
    {
        validationErrors.Add("ENCRYPTION_KEK must be valid base64 encoded");
    }
}

// Optional: Email settings (warn if not configured)
var emailSenderValue = builder.Configuration["Email:SenderEmail"];
var emailPasswordValue = builder.Configuration["Email:AppPassword"];
if (string.IsNullOrWhiteSpace(emailSenderValue) || string.IsNullOrWhiteSpace(emailPasswordValue))
{
    validationWarnings.Add("Email settings not configured - email functionality will be disabled");
}
else if (!emailSenderValue.Contains('@'))
{
    validationWarnings.Add("EMAIL_SENDER does not appear to be a valid email address");
}

// Optional: JWT Issuer and Audience (warn if using defaults)
var jwtIssuer = builder.Configuration["Jwt:Issuer"];
var jwtAudience = builder.Configuration["Jwt:Audience"];
if (string.IsNullOrWhiteSpace(jwtIssuer) || jwtIssuer == "DigiTransac")
{
    validationWarnings.Add("Using default JWT Issuer - consider setting a custom value in production");
}
if (string.IsNullOrWhiteSpace(jwtAudience) || jwtAudience == "DigiTransac")
{
    validationWarnings.Add("Using default JWT Audience - consider setting a custom value in production");
}

// Optional: CORS origins (warn if using localhost in production)
var corsOriginsValue = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>();
if (!builder.Environment.IsDevelopment() && corsOriginsValue != null)
{
    if (corsOriginsValue.Any(o => o.Contains("localhost")))
    {
        validationWarnings.Add("CORS allows localhost origins in non-development environment");
    }
}

// Log warnings
foreach (var warning in validationWarnings)
{
    Log.Warning("Configuration Warning: {Warning}", warning);
}

// Fail fast on validation errors
if (validationErrors.Count > 0)
{
    foreach (var error in validationErrors)
    {
        Log.Error("Configuration Error: {Error}", error);
    }
    
    // In development, allow the app to start with warnings instead of failing
    if (!builder.Environment.IsDevelopment())
    {
        throw new InvalidOperationException(
            $"Application startup failed due to configuration errors:\n" +
            string.Join("\n", validationErrors.Select(e => $"  - {e}")));
    }
    else
    {
        Log.Warning("Running in Development mode - proceeding despite configuration errors");
    }
}

Log.Information("Environment validation completed: {ErrorCount} errors, {WarningCount} warnings",
    validationErrors.Count, validationWarnings.Count);

// Add settings
builder.Services.Configure<MongoDbSettings>(builder.Configuration.GetSection("MongoDb"));
builder.Services.Configure<JwtSettings>(builder.Configuration.GetSection("Jwt"));
builder.Services.Configure<EncryptionSettings>(builder.Configuration.GetSection("Encryption"));
builder.Services.Configure<SecuritySettings>(builder.Configuration.GetSection("Security"));
builder.Services.Configure<RateLimitSettings>(builder.Configuration.GetSection("RateLimit"));

// Add email settings
var emailSettings = builder.Configuration.GetSection("Email").Get<EmailSettings>()!;
builder.Services.AddSingleton(emailSettings);

// Add MongoDB singleton service (shared client for all repositories)
builder.Services.AddSingleton<IMongoDbService, MongoDbService>();

// Add repositories
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

// Add HttpClient for external API calls with resilience policies (Circuit Breaker + Retry)
// Create a logger factory for Polly to use
var loggerFactory = LoggerFactory.Create(logging =>
{
    logging.AddSerilog();
});
var httpClientLogger = loggerFactory.CreateLogger("HttpClient.Resilience");

builder.Services.AddHttpClient("ExchangeRates", client =>
{
    client.Timeout = TimeSpan.FromSeconds(30);  // Overall timeout (Polly handles per-request timeout)
    client.DefaultRequestHeaders.Add("User-Agent", "DigiTransac/1.0");
})
.ConfigurePrimaryHttpMessageHandler(() => new HttpClientHandler
{
    AutomaticDecompression = System.Net.DecompressionMethods.All,
    ServerCertificateCustomValidationCallback = HttpClientHandler.DangerousAcceptAnyServerCertificateValidator
})
// Add Polly resilience policies: Retry with exponential backoff + Circuit Breaker
.AddResiliencePolicies(
    httpClientLogger,
    retryCount: 3,                      // Retry up to 3 times
    circuitBreakerThreshold: 5,         // Open circuit after 5 consecutive failures
    circuitBreakerDurationSeconds: 30,  // Keep circuit open for 30 seconds
    timeoutSeconds: 15);                // Timeout each request after 15 seconds

// Also add default HttpClient
builder.Services.AddHttpClient();

// Add memory cache for DEK caching
builder.Services.AddMemoryCache(options =>
{
    options.SizeLimit = 10000; // Limit cache size (number of entries)
});

// Add health checks
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

// Add caching service
builder.Services.AddSingleton<ICacheService, MemoryCacheService>();

// Add HttpContextAccessor for audit service
builder.Services.AddHttpContextAccessor();

// Add services
builder.Services.AddSingleton<IEmailService, GmailEmailService>();
builder.Services.AddSingleton<IEncryptionService, EncryptionService>();
builder.Services.AddSingleton<IKeyManagementService, LocalKeyManagementService>();
builder.Services.AddSingleton<IDekCacheService, DekCacheService>();
builder.Services.AddSingleton<ICookieService, CookieService>();
builder.Services.AddScoped<ITwoFactorService, TwoFactorService>();
builder.Services.AddScoped<IAuthService, AuthService>();
builder.Services.AddScoped<ILabelService, LabelService>();
builder.Services.AddScoped<ITagService, TagService>();
builder.Services.AddScoped<IAccountService, AccountService>();
builder.Services.AddScoped<IExchangeRateService, ExchangeRateService>();

// Add audit service for security logging
builder.Services.AddScoped<IAuditService, AuditService>();

// Transaction services - split into focused services for better maintainability
builder.Services.AddScoped<ITransactionMapperService, TransactionMapperService>();
builder.Services.AddScoped<IAccountBalanceService, AccountBalanceService>();
builder.Services.AddScoped<ITransferService, TransferService>();
builder.Services.AddScoped<IP2PTransactionService, P2PTransactionService>();
builder.Services.AddScoped<IRecurringTransactionService, RecurringTransactionService>();
builder.Services.AddScoped<ITransactionAnalyticsService, TransactionAnalyticsService>();
builder.Services.AddScoped<ITransactionExportService, TransactionExportService>();
builder.Services.AddScoped<ITransactionBatchService, TransactionBatchService>();
builder.Services.AddScoped<ITransactionCoreService, TransactionCoreService>();
// Facade for backward compatibility with existing endpoints
builder.Services.AddScoped<ITransactionService, TransactionServiceFacade>();
// Transaction import service for CSV/Excel bulk imports
builder.Services.AddScoped<ITransactionImportService, TransactionImportService>();

builder.Services.AddScoped<IConversationService, ConversationService>();

// Budget tracking and spending alerts
builder.Services.AddScoped<IBudgetService, BudgetService>();

// Add SignalR for real-time notifications
builder.Services.AddSignalR(options =>
{
    options.EnableDetailedErrors = builder.Environment.IsDevelopment();
    options.MaximumReceiveMessageSize = 32 * 1024; // 32 KB
    options.KeepAliveInterval = TimeSpan.FromSeconds(15);
    options.ClientTimeoutInterval = TimeSpan.FromSeconds(30);
});

// Add notification service for SignalR
builder.Services.AddScoped<INotificationService, NotificationService>();

// Background services
builder.Services.AddHostedService<RecurringTransactionBackgroundService>();

// Add FluentValidation validators
builder.Services.AddValidatorsFromAssemblyContaining<Program>();

// Add MediatR for domain events
builder.Services.AddMediatR(cfg => {
    cfg.RegisterServicesFromAssembly(Assembly.GetExecutingAssembly());
});

// Add OpenTelemetry tracing
builder.Services.AddOpenTelemetryTracing(builder.Configuration);

// Add API Versioning
builder.Services.AddApiVersioning(options =>
{
    options.DefaultApiVersion = new ApiVersion(1, 0);
    options.AssumeDefaultVersionWhenUnspecified = true;
    options.ReportApiVersions = true;
    options.ApiVersionReader = ApiVersionReader.Combine(
        new UrlSegmentApiVersionReader(),
        new HeaderApiVersionReader("X-API-Version"),
        new QueryStringApiVersionReader("api-version")
    );
})
.AddApiExplorer(options =>
{
    options.GroupNameFormat = "'v'VVV";
    options.SubstituteApiVersionInUrl = true;
});

// Add Rate Limiting
var rateLimitSettings = builder.Configuration.GetSection("RateLimit").Get<RateLimitSettings>() ?? new RateLimitSettings();
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    
    // Global rate limiter - general API protection
    options.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(httpContext =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = rateLimitSettings.PermitLimit,
                Window = TimeSpan.FromSeconds(rateLimitSettings.WindowSeconds),
                QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
                QueueLimit = rateLimitSettings.QueueLimit
            }));
    
    // Stricter rate limiter for auth endpoints (login, register)
    options.AddPolicy("auth", httpContext =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = rateLimitSettings.AuthPermitLimit ?? 10,         // 10 attempts default
                Window = TimeSpan.FromSeconds(rateLimitSettings.AuthWindowSeconds ?? 60),  // per minute default
                QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
                QueueLimit = 0
            }));
    
    // Even stricter for password reset and 2FA
    options.AddPolicy("sensitive", httpContext =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = rateLimitSettings.SensitivePermitLimit ?? 5,          // 5 attempts default
                Window = TimeSpan.FromSeconds(rateLimitSettings.SensitiveWindowSeconds ?? 300),  // per 5 minutes default
                QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
                QueueLimit = 0
            }));
    
    // Per-user rate limiter for authenticated endpoints
    // Uses user ID from JWT claims, falls back to IP if not authenticated
    options.AddPolicy("per-user", httpContext =>
    {
        var userId = httpContext.User.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? httpContext.User.FindFirstValue("sub")
            ?? httpContext.Connection.RemoteIpAddress?.ToString()
            ?? "unknown";
        
        return RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: $"user:{userId}",
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = rateLimitSettings.UserPermitLimit,
                Window = TimeSpan.FromSeconds(rateLimitSettings.UserWindowSeconds),
                QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
                QueueLimit = 2
            });
    });
    
    // Stricter per-user rate limiter for transaction creation
    // Prevents users from creating too many transactions too quickly
    options.AddPolicy("transaction-create", httpContext =>
    {
        var userId = httpContext.User.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? httpContext.User.FindFirstValue("sub")
            ?? httpContext.Connection.RemoteIpAddress?.ToString()
            ?? "unknown";
        
        return RateLimitPartition.GetTokenBucketLimiter(
            partitionKey: $"transaction:{userId}",
            factory: _ => new TokenBucketRateLimiterOptions
            {
                TokenLimit = rateLimitSettings.TransactionPermitLimit,
                QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
                QueueLimit = 0,
                ReplenishmentPeriod = TimeSpan.FromSeconds(rateLimitSettings.TransactionWindowSeconds),
                TokensPerPeriod = rateLimitSettings.TransactionPermitLimit,
                AutoReplenishment = true
            });
    });
    
    // Sliding window rate limiter for data export endpoints
    // More lenient but still protects against abuse
    options.AddPolicy("export", httpContext =>
    {
        var userId = httpContext.User.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? httpContext.User.FindFirstValue("sub")
            ?? httpContext.Connection.RemoteIpAddress?.ToString()
            ?? "unknown";
        
        return RateLimitPartition.GetSlidingWindowLimiter(
            partitionKey: $"export:{userId}",
            factory: _ => new SlidingWindowRateLimiterOptions
            {
                PermitLimit = 10,                    // 10 exports
                Window = TimeSpan.FromMinutes(5),   // per 5 minutes
                SegmentsPerWindow = 5,              // 5 segments for smooth limiting
                QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
                QueueLimit = 1
            });
    });
});

// Add JWT authentication
var jwtSettings = builder.Configuration.GetSection("Jwt").Get<JwtSettings>()!;
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = jwtSettings.Issuer,
            ValidAudience = jwtSettings.Audience,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSettings.Key))
        };
        
        // Allow SignalR to get the JWT from query string
        options.Events = new JwtBearerEvents
        {
            OnMessageReceived = context =>
            {
                var accessToken = context.Request.Query["access_token"];
                var path = context.HttpContext.Request.Path;
                
                // If the request is for the SignalR hub
                if (!string.IsNullOrEmpty(accessToken) && path.StartsWithSegments("/hubs"))
                {
                    context.Token = accessToken;
                }
                
                return Task.CompletedTask;
            }
        };
    });

builder.Services.AddAuthorization();

// Add CORS for frontend
var corsOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() 
    ?? new[] { "http://localhost:5173" };
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend", policy =>
    {
        policy.WithOrigins(corsOrigins)
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
});

// Add output caching for read-heavy endpoints
builder.Services.AddOutputCache(options =>
{
    // Default policy - short cache for general read endpoints
    options.AddPolicy("Default", builder => 
        builder.Expire(TimeSpan.FromSeconds(30)));
    
    // Currency/Exchange rate data - cache longer as it updates less frequently
    options.AddPolicy("ExchangeRates", builder => 
        builder.Expire(TimeSpan.FromMinutes(5))
               .Tag("exchange-rates"));
    
    // Account summary - user-specific, moderate cache
    options.AddPolicy("AccountSummary", builder =>
        builder.Expire(TimeSpan.FromSeconds(60))
               .SetVaryByHeader("Authorization")
               .Tag("accounts"));
    
    // Labels and tags - relatively static data
    options.AddPolicy("StaticData", builder =>
        builder.Expire(TimeSpan.FromMinutes(2))
               .SetVaryByHeader("Authorization")
               .Tag("static-data"));
});

// Add response compression (Brotli + Gzip)
builder.Services.AddResponseCompression(options =>
{
    options.EnableForHttps = true;
    options.Providers.Add<BrotliCompressionProvider>();
    options.Providers.Add<GzipCompressionProvider>();
    options.MimeTypes = ResponseCompressionDefaults.MimeTypes.Concat(new[] 
    { 
        "application/json",
        "text/json"
    });
});

builder.Services.Configure<BrotliCompressionProviderOptions>(options =>
{
    options.Level = CompressionLevel.Fastest;
});

builder.Services.Configure<GzipCompressionProviderOptions>(options =>
{
    options.Level = CompressionLevel.SmallestSize;
});

// Add Swagger/OpenAPI with comprehensive documentation
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    // API Information
    c.SwaggerDoc("v1", new Microsoft.OpenApi.Models.OpenApiInfo
    {
        Version = "v1",
        Title = "DigiTransac API",
        Description = @"
## DigiTransac - Personal Finance Management API

A comprehensive API for managing personal finances with WhatsApp-style P2P transaction tracking.

### Features
- **Authentication** - JWT-based auth with 2FA support
- **Accounts** - Multi-currency account management
- **Transactions** - Full CRUD with P2P, recurring, and bulk import
- **Labels & Tags** - Hierarchical categorization
- **Analytics** - Spending trends and insights
- **Real-time Updates** - SignalR notifications
- **Chat Integration** - Transaction messages with activity feed

### Authentication
All endpoints except `/api/auth/*` require JWT authentication.
Include the token in the Authorization header: `Bearer {token}`

### Rate Limits
- General API: 100 requests/minute
- Auth endpoints: 10 requests/minute
- Sensitive operations: 5 requests/5 minutes

### Response Codes
| Code | Description |
|------|-------------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request - validation error |
| 401 | Unauthorized - invalid/expired token |
| 403 | Forbidden - insufficient permissions |
| 404 | Not Found |
| 429 | Too Many Requests - rate limited |
| 500 | Internal Server Error |
",
        Contact = new Microsoft.OpenApi.Models.OpenApiContact
        {
            Name = "DigiTransac Support",
            Email = "support@digitransac.app",
            Url = new Uri("https://github.com/digitransac/api")
        },
        License = new Microsoft.OpenApi.Models.OpenApiLicense
        {
            Name = "MIT License",
            Url = new Uri("https://opensource.org/licenses/MIT")
        }
    });

    // Security scheme for JWT Bearer authentication
    c.AddSecurityDefinition("Bearer", new Microsoft.OpenApi.Models.OpenApiSecurityScheme
    {
        Name = "Authorization",
        Description = @"JWT Authorization header using the Bearer scheme.

Enter your token in the format: **Bearer {your_token}**

Example: `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`

To obtain a token:
1. Call `POST /api/auth/login` with valid credentials
2. Copy the `accessToken` from the response
3. Click the **Authorize** button and paste it",
        Type = Microsoft.OpenApi.Models.SecuritySchemeType.Http,
        Scheme = "bearer",
        BearerFormat = "JWT",
        In = Microsoft.OpenApi.Models.ParameterLocation.Header
    });
    
    c.AddSecurityRequirement(new Microsoft.OpenApi.Models.OpenApiSecurityRequirement
    {
        {
            new Microsoft.OpenApi.Models.OpenApiSecurityScheme
            {
                Reference = new Microsoft.OpenApi.Models.OpenApiReference
                {
                    Type = Microsoft.OpenApi.Models.ReferenceType.SecurityScheme,
                    Id = "Bearer"
                }
            },
            Array.Empty<string>()
        }
    });

    // Include XML comments for documentation
    var xmlFilename = $"{Assembly.GetExecutingAssembly().GetName().Name}.xml";
    var xmlPath = Path.Combine(AppContext.BaseDirectory, xmlFilename);
    if (File.Exists(xmlPath))
    {
        c.IncludeXmlComments(xmlPath);
    }

    // Tag descriptions for grouping endpoints
    c.TagActionsBy(api => new[] { api.GroupName ?? "Other" });
    
    // Order tags alphabetically
    c.OrderActionsBy(api => api.RelativePath);
    
    // Enable annotations for endpoint metadata
    c.EnableAnnotations();
});

var app = builder.Build();

// Configure the HTTP request pipeline
var securitySettings = builder.Configuration.GetSection("Security").Get<SecuritySettings>() ?? new SecuritySettings();

// HTTPS redirection for production
if (!app.Environment.IsDevelopment() && securitySettings.UseHttps)
{
    app.UseHttpsRedirection();
}

// Use HSTS in production for security
if (!app.Environment.IsDevelopment())
{
    app.UseHsts();
}

// Response compression should be early in the pipeline
app.UseResponseCompression();

// Global exception handler - prevents stack trace leakage
app.UseExceptionHandler(errorApp =>
{
    errorApp.Run(async context =>
    {
        var logger = context.RequestServices.GetRequiredService<ILogger<Program>>();
        var exceptionFeature = context.Features.Get<Microsoft.AspNetCore.Diagnostics.IExceptionHandlerFeature>();
        if (exceptionFeature?.Error != null)
        {
            logger.LogError(exceptionFeature.Error, "Unhandled exception occurred");
        }
        context.Response.StatusCode = StatusCodes.Status500InternalServerError;
        context.Response.ContentType = "application/json";
        await context.Response.WriteAsJsonAsync(new { message = "An unexpected error occurred. Please try again later." });
    });
});

if (app.Environment.IsDevelopment())
{
    app.UseSwagger(c =>
    {
        c.RouteTemplate = "api-docs/{documentName}/swagger.json";
    });
    
    app.UseSwaggerUI(c =>
    {
        c.SwaggerEndpoint("/api-docs/v1/swagger.json", "DigiTransac API v1");
        c.RoutePrefix = "api-docs";
        c.DocumentTitle = "DigiTransac API Documentation";
        c.DefaultModelsExpandDepth(2);
        c.DefaultModelRendering(Swashbuckle.AspNetCore.SwaggerUI.ModelRendering.Model);
        c.DocExpansion(Swashbuckle.AspNetCore.SwaggerUI.DocExpansion.List);
        c.EnableDeepLinking();
        c.DisplayOperationId();
        c.ShowExtensions();
        c.EnableFilter();
        c.EnableTryItOutByDefault();
    });
}

// Rate limiting middleware
app.UseRateLimiter();

app.UseCors("AllowFrontend");
app.UseAuthentication();
app.UseAuthorization();

// Output caching middleware (after auth so it can vary by authorization)
app.UseOutputCache();

// Map health check endpoints
app.MapHealthChecks("/api/health", new HealthCheckOptions
{
    ResponseWriter = async (context, report) =>
    {
        context.Response.ContentType = "application/json";
        var result = new
        {
            status = report.Status.ToString(),
            timestamp = DateTime.UtcNow,
            totalDuration = report.TotalDuration.TotalMilliseconds,
            checks = report.Entries.Select(e => new
            {
                name = e.Key,
                status = e.Value.Status.ToString(),
                duration = e.Value.Duration.TotalMilliseconds,
                description = e.Value.Description,
                tags = e.Value.Tags
            })
        };
        await context.Response.WriteAsJsonAsync(result);
    }
});

// Liveness probe (just checks if app is running)
app.MapHealthChecks("/api/health/live", new HealthCheckOptions
{
    Predicate = _ => false, // No checks, just confirms app is running
    ResponseWriter = async (context, _) =>
    {
        context.Response.ContentType = "application/json";
        await context.Response.WriteAsJsonAsync(new { status = "Healthy", timestamp = DateTime.UtcNow });
    }
});

// Readiness probe (checks if app can serve requests)
app.MapHealthChecks("/api/health/ready", new HealthCheckOptions
{
    Predicate = check => check.Tags.Contains("db"), // Only check database
    ResponseWriter = async (context, report) =>
    {
        context.Response.ContentType = "application/json";
        await context.Response.WriteAsJsonAsync(new 
        { 
            status = report.Status.ToString(), 
            timestamp = DateTime.UtcNow,
            database = report.Entries.FirstOrDefault().Value.Status.ToString()
        });
    }
});

app.MapAuthEndpoints();
app.MapTwoFactorEndpoints();
app.MapLabelEndpoints();
app.MapTagEndpoints();
app.MapAccountEndpoints();
app.MapCurrencyEndpoints();
app.MapTransactionEndpoints();
app.MapConversationEndpoints();
app.MapBudgetEndpoints();

// Map SignalR hub
app.MapHub<NotificationHub>("/hubs/notifications");

Log.Information("DigiTransac API starting...");
app.Run();

}
catch (Exception ex)
{
    Log.Fatal(ex, "Application terminated unexpectedly");
}
finally
{
    Log.CloseAndFlush();
}
// Make Program accessible to test project
public partial class Program { }
