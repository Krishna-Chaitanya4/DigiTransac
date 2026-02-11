using Azure.Identity;
using Serilog;

namespace DigiTransac.Api.Extensions;

/// <summary>
/// Extension methods for application configuration: Azure Key Vault, environment variable overrides, and validation.
/// </summary>
public static class ConfigurationExtensions
{
    /// <summary>
    /// Adds Azure Key Vault configuration, environment variable overrides, and validates required settings.
    /// </summary>
    public static WebApplicationBuilder AddAppConfiguration(this WebApplicationBuilder builder)
    {
        builder.Configuration.AddEnvironmentVariables();

        AddAzureKeyVault(builder);
        AddEnvironmentVariableOverrides(builder);
        ValidateConfiguration(builder);

        return builder;
    }

    private static void AddAzureKeyVault(WebApplicationBuilder builder)
    {
        var keyVaultUrl = Environment.GetEnvironmentVariable("AZURE_KEY_VAULT_URL");
        if (!string.IsNullOrEmpty(keyVaultUrl))
        {
            try
            {
                Log.Information("Loading configuration from Azure Key Vault: {KeyVaultUrl}", keyVaultUrl);

                var credential = new DefaultAzureCredential(new DefaultAzureCredentialOptions
                {
                    ExcludeInteractiveBrowserCredential = true,
                    ExcludeVisualStudioCodeCredential = true,
                    ExcludeVisualStudioCredential = true,
                });

                builder.Configuration.AddAzureKeyVault(
                    new Uri(keyVaultUrl),
                    credential,
                    new Azure.Extensions.AspNetCore.Configuration.Secrets.AzureKeyVaultConfigurationOptions
                    {
                        ReloadInterval = TimeSpan.FromMinutes(5)
                    });

                Log.Information("Successfully connected to Azure Key Vault");
            }
            catch (Exception ex)
            {
                Log.Warning(ex, "Failed to connect to Azure Key Vault. Falling back to environment variables.");
            }
        }
        else
        {
            Log.Information("AZURE_KEY_VAULT_URL not set. Using environment variables for configuration.");
        }
    }

    private static void AddEnvironmentVariableOverrides(WebApplicationBuilder builder)
    {
        var overrides = new Dictionary<string, string>
        {
            ["JWT_SECRET_KEY"] = "Jwt:Key",
            ["ENCRYPTION_KEY"] = "Encryption:Key",
            ["ENCRYPTION_KEK"] = "Encryption:Kek",
            ["EMAIL_SENDER"] = "Email:SenderEmail",
            ["EMAIL_APP_PASSWORD"] = "Email:AppPassword",
            ["MONGODB_CONNECTION_STRING"] = "MongoDb:ConnectionString",
            ["MONGODB_DATABASE_NAME"] = "MongoDb:DatabaseName",
        };

        foreach (var (envVar, configKey) in overrides)
        {
            var value = Environment.GetEnvironmentVariable(envVar);
            if (!string.IsNullOrEmpty(value))
            {
                builder.Configuration[configKey] = value;
            }
        }
    }

    private static void ValidateConfiguration(WebApplicationBuilder builder)
    {
        var errors = new List<string>();
        var warnings = new List<string>();

        ValidateJwtSettings(builder, errors, warnings);
        ValidateMongoDbSettings(builder, errors);
        ValidateEncryptionSettings(builder, errors);
        ValidateEmailSettings(builder, warnings);
        ValidateCorsSettings(builder, warnings);

        foreach (var warning in warnings)
        {
            Log.Warning("Configuration Warning: {Warning}", warning);
        }

        if (errors.Count > 0)
        {
            foreach (var error in errors)
            {
                Log.Error("Configuration Error: {Error}", error);
            }

            if (!builder.Environment.IsDevelopment())
            {
                throw new InvalidOperationException(
                    $"Application startup failed due to configuration errors:\n" +
                    string.Join("\n", errors.Select(e => $"  - {e}")));
            }
            else
            {
                Log.Warning("Running in Development mode - proceeding despite configuration errors");
            }
        }

        Log.Information("Environment validation completed: {ErrorCount} errors, {WarningCount} warnings",
            errors.Count, warnings.Count);
    }

    private static void ValidateJwtSettings(WebApplicationBuilder builder, List<string> errors, List<string> warnings)
    {
        var jwtKeyValue = builder.Configuration["Jwt:Key"];
        if (string.IsNullOrWhiteSpace(jwtKeyValue))
        {
            errors.Add("JWT_SECRET_KEY or Jwt:Key is required");
        }
        else if (jwtKeyValue.Length < 32)
        {
            errors.Add($"JWT_SECRET_KEY must be at least 32 characters (currently {jwtKeyValue.Length})");
        }

        var jwtIssuer = builder.Configuration["Jwt:Issuer"];
        var jwtAudience = builder.Configuration["Jwt:Audience"];
        if (string.IsNullOrWhiteSpace(jwtIssuer) || jwtIssuer == "DigiTransac")
        {
            warnings.Add("Using default JWT Issuer - consider setting a custom value in production");
        }
        if (string.IsNullOrWhiteSpace(jwtAudience) || jwtAudience == "DigiTransac")
        {
            warnings.Add("Using default JWT Audience - consider setting a custom value in production");
        }
    }

    private static void ValidateMongoDbSettings(WebApplicationBuilder builder, List<string> errors)
    {
        if (string.IsNullOrWhiteSpace(builder.Configuration["MongoDb:ConnectionString"]))
        {
            errors.Add("MONGODB_CONNECTION_STRING or MongoDb:ConnectionString is required");
        }

        if (string.IsNullOrWhiteSpace(builder.Configuration["MongoDb:DatabaseName"]))
        {
            errors.Add("MONGODB_DATABASE_NAME or MongoDb:DatabaseName is required");
        }
    }

    private static void ValidateEncryptionSettings(WebApplicationBuilder builder, List<string> errors)
    {
        ValidateBase64Key(builder.Configuration["Encryption:Key"], "ENCRYPTION_KEY", "Encryption:Key", errors);
        ValidateBase64Key(builder.Configuration["Encryption:Kek"], "ENCRYPTION_KEK", "Encryption:Kek", errors);
    }

    private static void ValidateBase64Key(string? value, string envName, string configName, List<string> errors)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            errors.Add($"{envName} or {configName} is required");
            return;
        }

        try
        {
            var keyBytes = Convert.FromBase64String(value);
            if (keyBytes.Length != 32)
            {
                errors.Add($"{envName} must be 32 bytes (256 bits) when decoded, got {keyBytes.Length} bytes");
            }
        }
        catch (FormatException)
        {
            errors.Add($"{envName} must be valid base64 encoded");
        }
    }

    private static void ValidateEmailSettings(WebApplicationBuilder builder, List<string> warnings)
    {
        var emailSender = builder.Configuration["Email:SenderEmail"];
        var emailPassword = builder.Configuration["Email:AppPassword"];
        if (string.IsNullOrWhiteSpace(emailSender) || string.IsNullOrWhiteSpace(emailPassword))
        {
            warnings.Add("Email settings not configured - email functionality will be disabled");
        }
        else if (!emailSender.Contains('@'))
        {
            warnings.Add("EMAIL_SENDER does not appear to be a valid email address");
        }
    }

    private static void ValidateCorsSettings(WebApplicationBuilder builder, List<string> warnings)
    {
        var corsOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>();
        if (!builder.Environment.IsDevelopment() && corsOrigins != null)
        {
            if (corsOrigins.Any(o => o.Contains("localhost")))
            {
                warnings.Add("CORS allows localhost origins in non-development environment");
            }
        }
    }
}