using System.Text;
using System.Threading.RateLimiting;
using DigiTransac.Api.Endpoints;
using DigiTransac.Api.Repositories;
using DigiTransac.Api.Services;
using DigiTransac.Api.Settings;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.IdentityModel.Tokens;

var builder = WebApplication.CreateBuilder(args);

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

// Add repositories
builder.Services.AddSingleton<IUserRepository, UserRepository>();
builder.Services.AddSingleton<IEmailVerificationRepository, EmailVerificationRepository>();
builder.Services.AddSingleton<IRefreshTokenRepository, RefreshTokenRepository>();
builder.Services.AddSingleton<ITwoFactorTokenRepository, TwoFactorTokenRepository>();
builder.Services.AddSingleton<ILabelRepository, LabelRepository>();
builder.Services.AddSingleton<ITagRepository, TagRepository>();
builder.Services.AddSingleton<IAccountRepository, AccountRepository>();
builder.Services.AddSingleton<IExchangeRateRepository, ExchangeRateRepository>();

// Add HttpClient for external API calls
builder.Services.AddHttpClient();

// Add memory cache for DEK caching
builder.Services.AddMemoryCache(options =>
{
    options.SizeLimit = 10000; // Limit cache size (number of entries)
});

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
                PermitLimit = 10,         // 10 attempts
                Window = TimeSpan.FromMinutes(1),  // per minute
                QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
                QueueLimit = 0
            }));
    
    // Even stricter for password reset and 2FA
    options.AddPolicy("sensitive", httpContext =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 5,          // 5 attempts
                Window = TimeSpan.FromMinutes(5),  // per 5 minutes
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
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend", policy =>
    {
        policy.WithOrigins("http://localhost:5173") // Vite default port
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
});

// Add Swagger/OpenAPI
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.AddSecurityDefinition("Bearer", new Microsoft.OpenApi.Models.OpenApiSecurityScheme
    {
        Description = "JWT Authorization header using the Bearer scheme. Enter 'Bearer' [space] and then your token.",
        Name = "Authorization",
        In = Microsoft.OpenApi.Models.ParameterLocation.Header,
        Type = Microsoft.OpenApi.Models.SecuritySchemeType.ApiKey,
        Scheme = "Bearer"
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

// Map endpoints
app.MapGet("/api/health", () => Results.Ok(new { Status = "Healthy", Timestamp = DateTime.UtcNow }))
   .WithName("Health")
   .WithTags("Health");

app.MapAuthEndpoints();
app.MapTwoFactorEndpoints();
app.MapLabelEndpoints();
app.MapTagEndpoints();
app.MapAccountEndpoints();
app.MapCurrencyEndpoints();

app.Run();
