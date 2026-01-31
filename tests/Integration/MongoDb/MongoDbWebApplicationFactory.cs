using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
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

    public MongoDbWebApplicationFactory(string connectionString, string databaseName = "DigiTransac_IntegrationTest")
    {
        _connectionString = connectionString;
        _databaseName = databaseName;
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
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
            // This is a 32-byte key that produces 44 character Base64 (with padding)
            var testKek = Convert.ToBase64String(new byte[32]); // All zeros for testing
            services.Configure<EncryptionSettings>(options =>
            {
                options.Kek = testKek;
                options.Provider = "Local";
            });

            // Configure JWT settings with a valid test key (at least 32 bytes for HS256)
            // Using a 64+ character key to be extra safe (512+ bits)
            var testJwtKey = "ThisIsAVeryLongTestSecretKeyForIntegrationTestingThatIsAtLeast64Characters!";
            var testJwtIssuer = "DigiTransac.IntegrationTests";
            var testJwtAudience = "DigiTransac.IntegrationTests";
            
            services.Configure<JwtSettings>(options =>
            {
                options.Key = testJwtKey;
                options.Issuer = testJwtIssuer;
                options.Audience = testJwtAudience;
                options.AccessTokenExpireMinutes = 60;
                options.RefreshTokenExpireDays = 7;
            });

            // Override the JWT bearer options to use our test key for token validation
            // This is necessary because Program.cs reads JWT settings from Configuration
            // at startup, not from IOptions<JwtSettings>
            services.PostConfigure<JwtBearerOptions>(JwtBearerDefaults.AuthenticationScheme, options =>
            {
                options.TokenValidationParameters = new TokenValidationParameters
                {
                    ValidateIssuer = true,
                    ValidateAudience = true,
                    ValidateLifetime = true,
                    ValidateIssuerSigningKey = true,
                    ValidIssuer = testJwtIssuer,
                    ValidAudience = testJwtAudience,
                    IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(testJwtKey))
                };
            });

            // Register the MongoDbService with the test configuration
            services.AddSingleton<IMongoDbService, MongoDbService>();
        });

        builder.UseEnvironment("IntegrationTest");
    }
}