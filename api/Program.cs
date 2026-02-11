using DigiTransac.Api.Extensions;
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

    // Configuration: Azure Key Vault, env var overrides, validation
    builder.AddAppConfiguration();

    // Services: settings, HttpClient, caching, encryption, transactions, SignalR, etc.
    builder.AddApplicationServices();

    // MongoDB: service, repositories, health checks
    builder.AddMongoDbServices();

    // Authentication: JWT Bearer, authorization, CORS
    builder.AddAuthenticationServices();

    // Rate limiting: global, auth, sensitive, per-user, transaction-create, export
    builder.AddRateLimitingPolicies();

    // Caching, compression, API versioning
    builder.AddCachingAndCompression();

    // Swagger/OpenAPI documentation
    builder.AddSwaggerDocumentation();

    var app = builder.Build();

    // HTTP pipeline: security, compression, auth, caching, health checks, endpoints
    app.UseApplicationPipeline();

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
