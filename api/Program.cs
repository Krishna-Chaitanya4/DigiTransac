using System.IO.Compression;
using System.Text;
using System.Threading.RateLimiting;
using DigiTransac.Api.Endpoints;
using DigiTransac.Api.Repositories;
using DigiTransac.Api.Services;
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

// Add HttpClient for external API calls
builder.Services.AddHttpClient("ExchangeRates", client =>
{
    client.Timeout = TimeSpan.FromSeconds(15);  // Standard timeout for user-facing requests
    client.DefaultRequestHeaders.Add("User-Agent", "DigiTransac/1.0");
})
.ConfigurePrimaryHttpMessageHandler(() => new HttpClientHandler
{
    AutomaticDecompression = System.Net.DecompressionMethods.All,
    ServerCertificateCustomValidationCallback = HttpClientHandler.DangerousAcceptAnyServerCertificateValidator
});

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
builder.Services.AddScoped<ITransactionService, TransactionService>();
builder.Services.AddScoped<IConversationService, ConversationService>();

// Background services
builder.Services.AddHostedService<RecurringTransactionBackgroundService>();

// Add FluentValidation validators
builder.Services.AddValidatorsFromAssemblyContaining<Program>();

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

// Add Swagger/OpenAPI
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.AddSecurityDefinition("Bearer", new Microsoft.OpenApi.OpenApiSecurityScheme
    {
        Description = "JWT Authorization header using the Bearer scheme. Enter 'Bearer' [space] and then your token.",
        Type = Microsoft.OpenApi.SecuritySchemeType.Http,
        Scheme = "bearer",
        BearerFormat = "JWT",
        In = Microsoft.OpenApi.ParameterLocation.Header
    });
    c.AddSecurityRequirement(document => new Microsoft.OpenApi.OpenApiSecurityRequirement
    {
        [new Microsoft.OpenApi.OpenApiSecuritySchemeReference("Bearer", document)] = []
    });
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
    app.UseSwagger();
    app.UseSwaggerUI();
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