using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.IdentityModel.Tokens;
using DigiTransac.Api.Repositories;
using DigiTransac.Api.Services;
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

    private static readonly string TestJwtKey = "ThisIsAVeryLongTestSecretKeyForIntegrationTestingThatIsAtLeast64Characters!";
    private static readonly string TestJwtIssuer = "DigiTransac.IntegrationTests";
    private static readonly string TestJwtAudience = "DigiTransac.IntegrationTests";

    static DigiTransacWebApplicationFactory()
    {
        // Set required environment variables BEFORE any WebApplicationFactory initialization
        // These must be set statically to ensure they're available when Program.cs runs
        var testKey = Convert.ToBase64String(new byte[32]); // 32-byte key for AES-256
        Environment.SetEnvironmentVariable("ENCRYPTION_KEY", testKey);
        Environment.SetEnvironmentVariable("ENCRYPTION_KEK", testKey);
        Environment.SetEnvironmentVariable("JWT_SECRET_KEY", TestJwtKey);
        Environment.SetEnvironmentVariable("MONGODB_CONNECTION_STRING", "mongodb://localhost:27017");
        Environment.SetEnvironmentVariable("MONGODB_DATABASE_NAME", "DigiTransac_Test");
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
                ["Encryption:Key"] = Convert.ToBase64String(new byte[32]),
                ["Encryption:Kek"] = Convert.ToBase64String(new byte[32]),
                ["Encryption:Provider"] = "Local"
            });
        });

        builder.ConfigureServices(services =>
        {
            // Remove the real repository and service registrations
            var descriptorsToRemove = services
                .Where(d => d.ServiceType == typeof(IUserRepository) ||
                           d.ServiceType == typeof(IEmailVerificationRepository) ||
                           d.ServiceType == typeof(IEmailService) ||
                           d.ServiceType == typeof(IAccountRepository) ||
                           d.ServiceType == typeof(IAccountService) ||
                           d.ServiceType == typeof(IKeyManagementService) ||
                           d.ServiceType == typeof(IDekCacheService))
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

            // Add mock implementations
            services.AddSingleton(UserRepositoryMock.Object);
            services.AddSingleton(EmailVerificationRepositoryMock.Object);
            services.AddSingleton(EmailServiceMock.Object);
            services.AddSingleton(AccountRepositoryMock.Object);
            services.AddSingleton(AccountServiceMock.Object);
            services.AddSingleton(KeyManagementServiceMock.Object);
            services.AddSingleton(DekCacheServiceMock.Object);

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
