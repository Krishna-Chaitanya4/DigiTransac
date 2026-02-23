using System.Text;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.IdentityModel.Tokens;
using DigiTransac.Api.Models;
using DigiTransac.Api.Repositories;
using DigiTransac.Api.Services;
using DigiTransac.Api.Services.UnitOfWork;
using DigiTransac.Api.Settings;
using MongoDB.Driver;
using Moq;

namespace DigiTransac.Tests.Integration;

/// <summary>
/// Custom WebApplicationFactory for integration testing
/// Replaces real services with mocks for isolated testing
/// </summary>
public class DigiTransacWebApplicationFactory : WebApplicationFactory<Program>
{
    public Mock<IUserRepository> UserRepositoryMock { get; } = new();
    public Mock<IEmailVerificationRepository> EmailVerificationRepositoryMock { get; } = new();
    public Mock<IEmailService> EmailServiceMock { get; } = new();
    public Mock<IAccountRepository> AccountRepositoryMock { get; } = new();
    public Mock<IAccountService> AccountServiceMock { get; } = new();
    public Mock<IKeyManagementService> KeyManagementServiceMock { get; } = new();
    public Mock<IDekCacheService> DekCacheServiceMock { get; } = new();
    public Mock<IRefreshTokenRepository> RefreshTokenRepositoryMock { get; } = new();
    public Mock<IMongoDbService> MongoDbServiceMock { get; } = new();
    public Mock<ITwoFactorTokenRepository> TwoFactorTokenRepositoryMock { get; } = new();
    public Mock<IAuditLogRepository> AuditLogRepositoryMock { get; } = new();
    public Mock<ILabelRepository> LabelRepositoryMock { get; } = new();
    public Mock<ITagRepository> TagRepositoryMock { get; } = new();
    public Mock<ITransactionRepository> TransactionRepositoryMock { get; } = new();
    public Mock<IBudgetRepository> BudgetRepositoryMock { get; } = new();
    public Mock<IExchangeRateRepository> ExchangeRateRepositoryMock { get; } = new();
    public Mock<IChatMessageRepository> ChatMessageRepositoryMock { get; } = new();
    public Mock<IPushSubscriptionRepository> PushSubscriptionRepositoryMock { get; } = new();
    public Mock<IUnitOfWork> UnitOfWorkMock { get; } = new();
    public Mock<IAuditService> AuditServiceMock { get; } = new();

    private static readonly string TestJwtKey = "ThisIsAVeryLongTestSecretKeyForIntegrationTestingThatIsAtLeast64Characters!";
    private static readonly string TestJwtIssuer = "DigiTransac.IntegrationTests";
    private static readonly string TestJwtAudience = "DigiTransac.IntegrationTests";

    static DigiTransacWebApplicationFactory()
    {
        // Set required environment variables BEFORE any WebApplicationFactory initialization
        // These must be set statically to ensure they're available when Program.cs runs
        var testKey = Convert.ToBase64String(new byte[32]); // 32-byte key for AES-256
        Environment.SetEnvironmentVariable("ENCRYPTION_KEK", testKey);
        Environment.SetEnvironmentVariable("JWT_SECRET_KEY", TestJwtKey);
        Environment.SetEnvironmentVariable("MONGODB_CONNECTION_STRING", "mongodb://localhost:27017");
        Environment.SetEnvironmentVariable("MONGODB_DATABASE_NAME", "DigiTransac_Test");
        
        // Disable rate limiting for integration tests - must be set before Program.cs runs
        Environment.SetEnvironmentVariable("DISABLE_RATE_LIMITING", "true");
    }

    public DigiTransacWebApplicationFactory()
    {
        // Constructor runs after static constructor, env vars are already set
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        // Add test configuration
        builder.ConfigureAppConfiguration((context, config) =>
        {
            // Add in-memory configuration for test settings
            config.AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Jwt:Key"] = TestJwtKey,
                ["Jwt:Issuer"] = TestJwtIssuer,
                ["Jwt:Audience"] = TestJwtAudience,
                ["Jwt:AccessTokenExpireMinutes"] = "60",
                ["Jwt:RefreshTokenExpireDays"] = "7",
                ["MongoDb:ConnectionString"] = "mongodb://localhost:27017",
                ["MongoDb:DatabaseName"] = "DigiTransac_Test",
                ["Encryption:Kek"] = Convert.ToBase64String(new byte[32]),
                ["Encryption:Provider"] = "Local",
                // Disable rate limiting for integration tests by setting very high limits
                ["RateLimit:PermitLimit"] = "10000",
                ["RateLimit:WindowSeconds"] = "1",
                ["RateLimit:QueueLimit"] = "1000",
                ["RateLimit:AuthPermitLimit"] = "10000",
                ["RateLimit:AuthWindowSeconds"] = "1",
                ["RateLimit:SensitivePermitLimit"] = "10000",
                ["RateLimit:SensitiveWindowSeconds"] = "1",
                ["RateLimit:UserPermitLimit"] = "10000",
                ["RateLimit:UserWindowSeconds"] = "1",
                ["RateLimit:TransactionPermitLimit"] = "10000",
                ["RateLimit:TransactionWindowSeconds"] = "1",
                // Security settings for CookieService
                ["Security:UseHttps"] = "false",
                ["Security:UseSecureCookies"] = "false",
                ["Security:CookieDomain"] = ""
            });
        });

        builder.ConfigureServices(services =>
        {
            // Remove ALL MongoDB-related services and repositories to prevent any MongoDB connection attempts
            var typesToRemove = new[]
            {
                typeof(IMongoDbService),
                typeof(MongoDbService),
                typeof(IUserRepository),
                typeof(IEmailVerificationRepository),
                typeof(IEmailService),
                typeof(IAccountRepository),
                typeof(IAccountService),
                typeof(IKeyManagementService),
                typeof(IDekCacheService),
                typeof(IRefreshTokenRepository),
                typeof(ITwoFactorTokenRepository),
                typeof(IAuditLogRepository),
                typeof(ILabelRepository),
                typeof(ITagRepository),
                typeof(ITransactionRepository),
                typeof(IBudgetRepository),
                typeof(IExchangeRateRepository),
                typeof(IChatMessageRepository),
                typeof(IPushSubscriptionRepository),
                typeof(IUnitOfWork),
                typeof(IAuditService)
            };

            var descriptorsToRemove = services
                .Where(d => typesToRemove.Contains(d.ServiceType) ||
                           typesToRemove.Contains(d.ImplementationType))
                .ToList();

            foreach (var descriptor in descriptorsToRemove)
            {
                services.Remove(descriptor);
            }

            // Setup default mock behaviors for KeyManagementService
            var testDek = new byte[32];
            KeyManagementServiceMock.Setup(x => x.GenerateDek())
                .Returns(testDek);
            KeyManagementServiceMock.Setup(x => x.WrapKeyAsync(It.IsAny<byte[]>()))
                .ReturnsAsync(new byte[64]);
            KeyManagementServiceMock.Setup(x => x.UnwrapKeyAsync(It.IsAny<byte[]>()))
                .ReturnsAsync(testDek);

            // Setup default mock behaviors for DekCacheService
            DekCacheServiceMock.Setup(x => x.GetDek(It.IsAny<string>()))
                .Returns(testDek);

            // Setup default mock behaviors for RefreshTokenRepository
            RefreshTokenRepositoryMock.Setup(x => x.CreateAsync(It.IsAny<RefreshToken>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync((RefreshToken token, CancellationToken _) => token);
            RefreshTokenRepositoryMock.Setup(x => x.GetByTokenAsync(It.IsAny<string>()))
                .ReturnsAsync((RefreshToken?)null);
            RefreshTokenRepositoryMock.Setup(x => x.RevokeAllByUserIdAsync(It.IsAny<string>()))
                .Returns(Task.CompletedTask);

            // Setup UnitOfWork mock for transactional operations
            UnitOfWorkMock.Setup(x => x.StartTransactionAsync(It.IsAny<CancellationToken>()))
                .Returns(Task.CompletedTask);
            UnitOfWorkMock.Setup(x => x.CommitAsync(It.IsAny<CancellationToken>()))
                .Returns(Task.CompletedTask);
            UnitOfWorkMock.Setup(x => x.RollbackAsync(It.IsAny<CancellationToken>()))
                .Returns(Task.CompletedTask);
            UnitOfWorkMock.Setup(x => x.ExecuteInTransactionAsync(It.IsAny<Func<IClientSessionHandle?, Task>>(), It.IsAny<CancellationToken>()))
                .Returns((Func<IClientSessionHandle?, Task> action, CancellationToken _) => action(null));
            UnitOfWorkMock.Setup(x => x.TransactionsSupported).Returns(false);

            // Setup MongoDbService mock to return mock collections (won't be called since repos are mocked)
            var mockCollection = new Mock<IMongoCollection<object>>();
            MongoDbServiceMock.Setup(x => x.GetCollection<It.IsAnyType>(It.IsAny<string>()))
                .Returns((string name) => null!);

            // Add mock implementations - order matters, add singletons first
            services.AddSingleton(MongoDbServiceMock.Object);
            services.AddSingleton(UserRepositoryMock.Object);
            services.AddSingleton(EmailVerificationRepositoryMock.Object);
            services.AddSingleton(EmailServiceMock.Object);
            services.AddSingleton(AccountRepositoryMock.Object);
            services.AddSingleton(AccountServiceMock.Object);
            services.AddSingleton(KeyManagementServiceMock.Object);
            services.AddSingleton(DekCacheServiceMock.Object);
            services.AddSingleton(RefreshTokenRepositoryMock.Object);
            services.AddSingleton(TwoFactorTokenRepositoryMock.Object);
            services.AddSingleton(AuditLogRepositoryMock.Object);
            services.AddSingleton(LabelRepositoryMock.Object);
            services.AddSingleton(TagRepositoryMock.Object);
            services.AddSingleton(TransactionRepositoryMock.Object);
            services.AddSingleton(BudgetRepositoryMock.Object);
            services.AddSingleton(ExchangeRateRepositoryMock.Object);
            services.AddSingleton(ChatMessageRepositoryMock.Object);
            services.AddSingleton(PushSubscriptionRepositoryMock.Object);
            services.AddScoped<IUnitOfWork>(_ => UnitOfWorkMock.Object);
            services.AddScoped<IAuditService>(_ => AuditServiceMock.Object);

            // Disable rate limiting for integration tests by reconfiguring with very permissive limits
            services.Configure<RateLimiterOptions>(options =>
            {
                // Replace global limiter with a very permissive one
                options.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(httpContext =>
                    RateLimitPartition.GetNoLimiter("test"));
                
                // Clear all policies and replace with no-op limiters
                options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
            });

            // Override the JWT bearer options to use our test key for token validation
            services.PostConfigure<JwtBearerOptions>(JwtBearerDefaults.AuthenticationScheme, options =>
            {
                options.TokenValidationParameters = new TokenValidationParameters
                {
                    ValidateIssuer = true,
                    ValidateAudience = true,
                    ValidateLifetime = true,
                    ValidateIssuerSigningKey = true,
                    ValidIssuer = TestJwtIssuer,
                    ValidAudience = TestJwtAudience,
                    IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(TestJwtKey))
                };
            });
        });

        // Use Development environment to avoid strict validation failures
        builder.UseEnvironment("Development");
    }
}
