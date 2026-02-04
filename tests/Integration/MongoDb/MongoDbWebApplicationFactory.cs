using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using DigiTransac.Api.Services;
using DigiTransac.Api.Settings;
using MongoDB.Driver;

namespace DigiTransac.Tests.Integration.MongoDb;

/// <summary>
/// WebApplicationFactory configured with real MongoDB via TestContainers.
/// This allows true integration tests with actual database operations.
/// </summary>
public class MongoDbWebApplicationFactory : WebApplicationFactory<Program>
{
    private readonly string _connectionString;
    private readonly string _databaseName;

    private static readonly string TestJwtKey = "ThisIsAVeryLongTestSecretKeyForIntegrationTestingThatIsAtLeast64Characters!";
    private static readonly string TestJwtIssuer = "DigiTransac.IntegrationTests";
    private static readonly string TestJwtAudience = "DigiTransac.IntegrationTests";
    private static readonly string TestEncryptionKey = Convert.ToBase64String(new byte[32]);

    static MongoDbWebApplicationFactory()
    {
        // Set required environment variables BEFORE any WebApplicationFactory initialization
        // These must be set statically to ensure they're available when Program.cs runs
        Environment.SetEnvironmentVariable("ENCRYPTION_KEY", TestEncryptionKey);
        Environment.SetEnvironmentVariable("ENCRYPTION_KEK", TestEncryptionKey);
        Environment.SetEnvironmentVariable("JWT_SECRET_KEY", TestJwtKey);
    }

    public MongoDbWebApplicationFactory(string connectionString, string databaseName = "DigiTransac_IntegrationTest")
    {
        _connectionString = connectionString;
        _databaseName = databaseName;

        // Also set MongoDB environment variables with instance-specific values
        Environment.SetEnvironmentVariable("MONGODB_CONNECTION_STRING", connectionString);
        Environment.SetEnvironmentVariable("MONGODB_DATABASE_NAME", databaseName);
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        // Add test configuration that takes precedence
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
                ["MongoDb:ConnectionString"] = _connectionString,
                ["MongoDb:DatabaseName"] = _databaseName,
                ["Encryption:Key"] = TestEncryptionKey,
                ["Encryption:Kek"] = TestEncryptionKey,
                ["Encryption:Provider"] = "Local"
            });
        });

        builder.ConfigureServices(services =>
        {
            // Remove existing settings and service registrations that we need to override
            var descriptorsToRemove = services
                .Where(d => d.ServiceType == typeof(IMongoDbService) ||
                           d.ServiceType == typeof(MongoDbService) ||
                           d.ServiceType == typeof(IConfigureOptions<MongoDbSettings>) ||
                           d.ServiceType == typeof(IOptions<MongoDbSettings>) ||
                           d.ServiceType == typeof(IConfigureOptions<EncryptionSettings>) ||
                           d.ServiceType == typeof(IOptions<EncryptionSettings>) ||
                           d.ServiceType == typeof(IConfigureOptions<JwtSettings>) ||
                           d.ServiceType == typeof(IOptions<JwtSettings>))
                .ToList();

            foreach (var descriptor in descriptorsToRemove)
            {
                services.Remove(descriptor);
            }

            // Configure MongoDB settings with TestContainer connection string
            services.Configure<MongoDbSettings>(options =>
            {
                options.ConnectionString = _connectionString;
                options.DatabaseName = _databaseName;
            });

            // Configure Encryption settings with a test KEK (32 bytes = 256 bits, Base64 encoded)
            services.Configure<EncryptionSettings>(options =>
            {
                options.Kek = TestEncryptionKey;
                options.Provider = "Local";
            });

            // Configure JWT settings with a valid test key
            services.Configure<JwtSettings>(options =>
            {
                options.Key = TestJwtKey;
                options.Issuer = TestJwtIssuer;
                options.Audience = TestJwtAudience;
                options.AccessTokenExpireMinutes = 60;
                options.RefreshTokenExpireDays = 7;
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

            // Register the MongoDbService with the test configuration
            services.AddSingleton<IMongoDbService, MongoDbService>();
        });

        // Use Development environment to bypass strict validation in Program.cs
        builder.UseEnvironment("Development");
    }
}