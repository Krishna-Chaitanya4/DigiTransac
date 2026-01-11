using Azure.Identity;
using Azure.Security.KeyVault.Secrets;
using DigiTransac.Core.Configuration;
using DigiTransac.Infrastructure.Interfaces;
using DigiTransac.Infrastructure.Repositories;
using DigiTransac.Infrastructure.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using MongoDB.Driver;
using System.Text;

var builder = WebApplication.CreateBuilder(args);

// JWT settings
var jwtIssuer = builder.Configuration["Jwt:Issuer"]
    ?? Environment.GetEnvironmentVariable("JWT_ISSUER")
    ?? "DigiTransac";

var jwtAudience = builder.Configuration["Jwt:Audience"]
    ?? Environment.GetEnvironmentVariable("JWT_AUDIENCE")
    ?? "DigiTransac";

var jwtSigningKey = builder.Configuration["Jwt:SigningKey"]
    ?? Environment.GetEnvironmentVariable("JWT_SIGNING_KEY");

if (string.IsNullOrWhiteSpace(jwtSigningKey))
{
    if (builder.Environment.IsDevelopment())
    {
        jwtSigningKey = "DEV_ONLY_CHANGE_ME__DigiTransac_SigningKey_AtLeast_32_Chars";
        Console.WriteLine("⚠️  JWT_SIGNING_KEY not set; using development signing key (tokens will be valid only for this dev key).");
    }
    else
    {
        throw new InvalidOperationException("JWT_SIGNING_KEY is required in production.");
    }
}

builder.Services.AddSingleton(new JwtSettings(jwtIssuer, jwtAudience, jwtSigningKey));

// Configure Azure Key Vault and MongoDB connection
var keyVaultUrl = builder.Configuration["AZURE_KEY_VAULT_URL"] 
    ?? builder.Configuration["KEY_VAULT_URL"]
    ?? Environment.GetEnvironmentVariable("AZURE_KEY_VAULT_URL")
    ?? Environment.GetEnvironmentVariable("KEY_VAULT_URL");

string mongoConnectionString;

if (!string.IsNullOrEmpty(keyVaultUrl) && builder.Environment.IsProduction())
{
    // Production: fetch from Key Vault
    var credential = new DefaultAzureCredential();
    var secretClient = new SecretClient(new Uri(keyVaultUrl), credential);

    Console.WriteLine($"🔐 Key Vault client initialized: {keyVaultUrl}");
    Console.WriteLine($"   Auth method: Managed Identity");

    try
    {
        Console.WriteLine("🔐 Fetching MongoDB connection string from Key Vault...");
        var secret = await secretClient.GetSecretAsync("MongoDB-ConnectionString");
        mongoConnectionString = secret.Value.Value;
        Console.WriteLine("✅ MongoDB connection string retrieved from Key Vault");
    }
    catch (Exception ex)
    {
        Console.WriteLine($"❌ Failed to retrieve MongoDB connection string from Key Vault: {ex.Message}");
        throw;
    }
}
else if (builder.Environment.IsDevelopment())
{
    // Development: use environment variable or hardcoded default
    mongoConnectionString = builder.Configuration["MONGODB_CONNECTION_STRING"]
        ?? Environment.GetEnvironmentVariable("MONGODB_CONNECTION_STRING")
        ?? "mongodb://localhost:27017";
    Console.WriteLine($"🔐 Using MongoDB connection string from env/config (dev mode)");
}
else
{
    throw new InvalidOperationException("AZURE_KEY_VAULT_URL is required in production");
}

var mongoDatabaseName = builder.Configuration["MONGODB_DATABASE_NAME"] 
    ?? builder.Configuration["COSMOS_DATABASE_NAME"] 
    ?? Environment.GetEnvironmentVariable("MONGODB_DATABASE_NAME")
    ?? Environment.GetEnvironmentVariable("COSMOS_DATABASE_NAME")
    ?? "DigiTransacDB";

// Configure MongoDB with Azure Cosmos DB optimized settings
var mongoSettings = MongoClientSettings.FromConnectionString(mongoConnectionString);
mongoSettings.ServerApi = new ServerApi(ServerApiVersion.V1);
mongoSettings.MaxConnectionPoolSize = builder.Environment.IsDevelopment() ? 20 : 50;
mongoSettings.MinConnectionPoolSize = builder.Environment.IsDevelopment() ? 5 : 10;
mongoSettings.MaxConnectionIdleTime = TimeSpan.FromSeconds(30);
mongoSettings.ConnectTimeout = TimeSpan.FromSeconds(builder.Environment.IsDevelopment() ? 30 : 10);
mongoSettings.ServerSelectionTimeout = TimeSpan.FromSeconds(builder.Environment.IsDevelopment() ? 30 : 5);
mongoSettings.RetryReads = true;
mongoSettings.RetryWrites = true;

// MongoDB
builder.Services.AddSingleton<IMongoClient>(sp => new MongoClient(mongoSettings));

// Repositories  
builder.Services.AddScoped<ICategoryRepository, CategoryRepository>();
builder.Services.AddScoped<IUserRepository, UserRepository>();
builder.Services.AddScoped<IRefreshTokenRepository, RefreshTokenRepository>();

// Services
builder.Services.AddScoped<ITokenService>(sp => new TokenService(sp.GetRequiredService<JwtSettings>()));

Console.WriteLine($"📚 Database \"{mongoDatabaseName}\" will be used by repositories");

// CORS
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy.WithOrigins("http://localhost:5173", "http://localhost:3000")
              .AllowAnyMethod()
              .AllowAnyHeader();
    });
});

// Controllers
builder.Services.AddControllers();

// Auth
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = jwtIssuer,

            ValidateAudience = true,
            ValidAudience = jwtAudience,

            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSigningKey!)),

            ValidateLifetime = true,
            ClockSkew = TimeSpan.FromMinutes(2)
        };
    });

builder.Services.AddAuthorization();

// Swagger/OpenAPI
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

var app = builder.Build();

// Configure HTTP pipeline
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

// Removed HTTPS redirection for development (React uses HTTP)
// app.UseHttpsRedirection();
app.UseCors();
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

Console.WriteLine("🚀 DigiTransac.NET API is running!");
Console.WriteLine("   Swagger UI: http://localhost:5253/swagger");
Console.WriteLine("   Health check: http://localhost:5253/api/v1/auth/me");

app.Run();
