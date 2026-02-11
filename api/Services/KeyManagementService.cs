using System.Security.Cryptography;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Options;
using DigiTransac.Api.Settings;

namespace DigiTransac.Api.Services;

/// <summary>
/// Interface for key management operations (wrapping/unwrapping DEKs)
/// Implementations can use local KEK (dev) or Azure Key Vault (prod)
/// </summary>
public interface IKeyManagementService
{
    /// <summary>
    /// Generate a new Data Encryption Key
    /// </summary>
    byte[] GenerateDek();

    /// <summary>
    /// Wrap (encrypt) a DEK using the Key Encryption Key
    /// </summary>
    Task<byte[]> WrapKeyAsync(byte[] dek);

    /// <summary>
    /// Unwrap (decrypt) a DEK using the Key Encryption Key
    /// </summary>
    Task<byte[]> UnwrapKeyAsync(byte[] wrappedDek);
}

/// <summary>
/// Local key management using KEK from configuration (for development)
/// Uses AES-256-GCM for key wrapping
/// </summary>
public class LocalKeyManagementService : IKeyManagementService
{
    private readonly byte[] _kek;
    private const int DekSize = 32; // 256 bits
    private const int NonceSize = 12; // 96 bits for AES-GCM
    private const int TagSize = 16; // 128 bits

    public LocalKeyManagementService(IOptions<EncryptionSettings> settings)
    {
        var kekBase64 = settings.Value.Kek;
        if (string.IsNullOrEmpty(kekBase64))
        {
            throw new InvalidOperationException(
                "Encryption KEK not configured. Set 'Encryption:Kek' in configuration or ENCRYPTION_KEK environment variable.");
        }

        try
        {
            _kek = Convert.FromBase64String(kekBase64);
            if (_kek.Length != 32)
            {
                throw new InvalidOperationException(
                    $"Encryption KEK must be 32 bytes (256 bits). Got {_kek.Length} bytes.");
            }
        }
        catch (FormatException)
        {
            throw new InvalidOperationException(
                "Encryption KEK must be a valid Base64 string.");
        }
    }

    public byte[] GenerateDek()
    {
        return RandomNumberGenerator.GetBytes(DekSize);
    }

    public Task<byte[]> WrapKeyAsync(byte[] dek)
    {
        // Generate random nonce
        var nonce = RandomNumberGenerator.GetBytes(NonceSize);
        var tag = new byte[TagSize];
        var ciphertext = new byte[dek.Length];

        using var aes = new AesGcm(_kek, TagSize);
        aes.Encrypt(nonce, dek, ciphertext, tag);

        // Combine: nonce + ciphertext + tag
        var wrapped = new byte[NonceSize + ciphertext.Length + TagSize];
        Buffer.BlockCopy(nonce, 0, wrapped, 0, NonceSize);
        Buffer.BlockCopy(ciphertext, 0, wrapped, NonceSize, ciphertext.Length);
        Buffer.BlockCopy(tag, 0, wrapped, NonceSize + ciphertext.Length, TagSize);

        return Task.FromResult(wrapped);
    }

    public Task<byte[]> UnwrapKeyAsync(byte[] wrappedDek)
    {
        if (wrappedDek.Length < NonceSize + TagSize)
        {
            throw new CryptographicException("Invalid wrapped key format");
        }

        var ciphertextLength = wrappedDek.Length - NonceSize - TagSize;
        var nonce = new byte[NonceSize];
        var ciphertext = new byte[ciphertextLength];
        var tag = new byte[TagSize];

        Buffer.BlockCopy(wrappedDek, 0, nonce, 0, NonceSize);
        Buffer.BlockCopy(wrappedDek, NonceSize, ciphertext, 0, ciphertextLength);
        Buffer.BlockCopy(wrappedDek, NonceSize + ciphertextLength, tag, 0, TagSize);

        var dek = new byte[ciphertextLength];

        using var aes = new AesGcm(_kek, TagSize);
        aes.Decrypt(nonce, ciphertext, tag, dek);

        return Task.FromResult(dek);
    }
}

/// <summary>
/// Azure Key Vault implementation (for production).
/// Currently a placeholder — will be implemented when deploying to Azure.
///
/// To use this, set Encryption:Provider to "AzureKeyVault" and configure:
///   - Encryption:KeyVaultUrl — your Key Vault URI
///   - Encryption:KeyName — the name of the key to use for wrapping
///
/// The application will fail fast at startup if this provider is selected
/// but not yet implemented, preventing silent runtime failures.
/// </summary>
public class AzureKeyVaultService : IKeyManagementService
{
    // TODO: Implement using Azure.Security.KeyVault.Keys
    // private readonly KeyClient _keyClient;
    // private readonly string _keyName;

    public AzureKeyVaultService(IOptions<EncryptionSettings> settings)
    {
        // Fail fast at startup with a clear, actionable error message
        var keyVaultUrl = settings.Value.KeyVaultUrl;
        
        throw new InvalidOperationException(
            "Azure Key Vault key management is not yet implemented. " +
            $"KeyVault URL configured: '{keyVaultUrl ?? "(not set)"}'. " +
            "Please use the 'Local' encryption provider by setting Encryption:Provider to 'Local' " +
            "or omitting it (Local is the default). " +
            "To implement Azure Key Vault support, see: https://learn.microsoft.com/en-us/dotnet/api/azure.security.keyvault.keys");
    }

    public byte[] GenerateDek()
    {
        throw new InvalidOperationException("AzureKeyVaultService is not implemented.");
    }

    public Task<byte[]> WrapKeyAsync(byte[] dek)
    {
        throw new InvalidOperationException("AzureKeyVaultService is not implemented.");
    }

    public Task<byte[]> UnwrapKeyAsync(byte[] wrappedDek)
    {
        throw new InvalidOperationException("AzureKeyVaultService is not implemented.");
    }
}

/// <summary>
/// Interface for caching unwrapped DEKs in memory
/// </summary>
public interface IDekCacheService
{
    byte[]? GetDek(string userId);
    void SetDek(string userId, byte[] dek);
    void RemoveDek(string userId);
}

/// <summary>
/// In-memory cache for unwrapped DEKs
/// TTL: 15 minutes to balance security and performance
/// </summary>
public class DekCacheService : IDekCacheService
{
    private readonly IMemoryCache _cache;
    private readonly TimeSpan _ttl = TimeSpan.FromMinutes(15);

    public DekCacheService(IMemoryCache cache)
    {
        _cache = cache;
    }

    public byte[]? GetDek(string userId)
    {
        var key = GetCacheKey(userId);
        return _cache.TryGetValue(key, out byte[]? dek) ? dek : null;
    }

    public void SetDek(string userId, byte[] dek)
    {
        var key = GetCacheKey(userId);
        var options = new MemoryCacheEntryOptions
        {
            AbsoluteExpirationRelativeToNow = _ttl,
            Size = dek.Length
        };
        _cache.Set(key, dek, options);
    }

    public void RemoveDek(string userId)
    {
        var key = GetCacheKey(userId);
        _cache.Remove(key);
    }

    private static string GetCacheKey(string userId) => $"dek:{userId}";
}
