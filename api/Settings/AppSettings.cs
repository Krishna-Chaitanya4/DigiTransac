namespace DigiTransac.Api.Settings;

public class MongoDbSettings
{
    public string ConnectionString { get; set; } = null!;
    public string DatabaseName { get; set; } = null!;
}

public class JwtSettings
{
    public string Key { get; set; } = null!;
    public string Issuer { get; set; } = null!;
    public string Audience { get; set; } = null!;
    public int AccessTokenExpireMinutes { get; set; } = 15;
    public int RefreshTokenExpireDays { get; set; } = 7;
}

public class EncryptionSettings
{
    /// <summary>
    /// Key Encryption Key (KEK) for envelope encryption - Base64 encoded 32 bytes
    /// In production, this should come from Azure Key Vault
    /// </summary>
    public string Kek { get; set; } = null!;
    
    /// <summary>
    /// Provider for key management: "Local" or "AzureKeyVault"
    /// </summary>
    public string Provider { get; set; } = "Local";
    
    /// <summary>
    /// Azure Key Vault URL (only used when Provider = "AzureKeyVault")
    /// </summary>
    public string? KeyVaultUrl { get; set; }
    
    /// <summary>
    /// Key name in Azure Key Vault (only used when Provider = "AzureKeyVault")
    /// </summary>
    public string? KeyName { get; set; }
}

public class RateLimitSettings
{
    public int PermitLimit { get; set; } = 100;
    public int WindowSeconds { get; set; } = 60;
    public int QueueLimit { get; set; } = 0;
}

public class SecuritySettings
{
    public bool UseHttps { get; set; } = true;
    public bool UseSecureCookies { get; set; } = true;
    public string CookieDomain { get; set; } = "";
}
