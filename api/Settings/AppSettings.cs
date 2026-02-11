namespace DigiTransac.Api.Settings;

public class MongoDbSettings
{
    public string ConnectionString { get; set; } = null!;
    public string DatabaseName { get; set; } = null!;

    /// <summary>
    /// Maximum number of connections in the connection pool.
    /// MongoDB driver default is 100.
    /// </summary>
    public int MaxConnectionPoolSize { get; set; } = 100;

    /// <summary>
    /// Minimum number of connections maintained in the pool.
    /// MongoDB driver default is 0.
    /// </summary>
    public int MinConnectionPoolSize { get; set; } = 10;

    /// <summary>
    /// Maximum time (in seconds) a thread will wait for a connection to become available.
    /// MongoDB driver default is 120 seconds.
    /// </summary>
    public int WaitQueueTimeoutSeconds { get; set; } = 30;

    /// <summary>
    /// Maximum time (in seconds) a connection can remain idle before being removed.
    /// MongoDB driver default is 600 seconds (10 minutes).
    /// </summary>
    public int MaxConnectionIdleTimeSeconds { get; set; } = 600;

    /// <summary>
    /// Maximum time (in seconds) a connection can be open.
    /// MongoDB driver default is 1800 seconds (30 minutes).
    /// </summary>
    public int MaxConnectionLifeTimeSeconds { get; set; } = 1800;

    /// <summary>
    /// Connection timeout in seconds. How long to wait for a connection to be established.
    /// MongoDB driver default is 30 seconds.
    /// </summary>
    public int ConnectTimeoutSeconds { get; set; } = 30;

    /// <summary>
    /// Socket timeout in seconds for read/write operations.
    /// MongoDB driver default is 0 (no timeout).
    /// </summary>
    public int SocketTimeoutSeconds { get; set; } = 0;

    /// <summary>
    /// Server selection timeout in seconds.
    /// MongoDB driver default is 30 seconds.
    /// </summary>
    public int ServerSelectionTimeoutSeconds { get; set; } = 30;

    /// <summary>
    /// Enable command-level retry for transient failures.
    /// MongoDB driver default is true.
    /// </summary>
    public bool RetryWrites { get; set; } = true;

    /// <summary>
    /// Enable retry for read operations.
    /// MongoDB driver default is true.
    /// </summary>
    public bool RetryReads { get; set; } = true;
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
    /// <summary>
    /// Global rate limit - permits per window for anonymous/IP-based limiting
    /// </summary>
    public int PermitLimit { get; set; } = 100;
    
    /// <summary>
    /// Time window in seconds for global rate limiting
    /// </summary>
    public int WindowSeconds { get; set; } = 60;
    
    /// <summary>
    /// Number of requests allowed to queue when limit is reached
    /// </summary>
    public int QueueLimit { get; set; } = 0;
    
    /// <summary>
    /// Rate limit for authentication endpoints (login, register)
    /// </summary>
    public int? AuthPermitLimit { get; set; }
    public int? AuthWindowSeconds { get; set; }
    
    /// <summary>
    /// Rate limit for sensitive endpoints (password reset, 2FA)
    /// </summary>
    public int? SensitivePermitLimit { get; set; }
    public int? SensitiveWindowSeconds { get; set; }
    
    /// <summary>
    /// Per-user rate limit for authenticated requests
    /// </summary>
    public int UserPermitLimit { get; set; } = 200;
    
    /// <summary>
    /// Time window in seconds for per-user rate limiting
    /// </summary>
    public int UserWindowSeconds { get; set; } = 60;
    
    /// <summary>
    /// Rate limit for transaction creation per user
    /// </summary>
    public int TransactionPermitLimit { get; set; } = 50;
    
    /// <summary>
    /// Time window in seconds for transaction creation rate limiting
    /// </summary>
    public int TransactionWindowSeconds { get; set; } = 60;
}

public class SecuritySettings
{
    public bool UseHttps { get; set; } = true;
    public bool UseSecureCookies { get; set; } = true;
    public string CookieDomain { get; set; } = "";
}
