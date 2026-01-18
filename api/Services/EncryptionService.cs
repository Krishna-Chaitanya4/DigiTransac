using System.Security.Cryptography;
using System.Text;
using DigiTransac.Api.Settings;
using Microsoft.Extensions.Options;

namespace DigiTransac.Api.Services;

/// <summary>
/// Interface for encrypting/decrypting data using a Data Encryption Key (DEK)
/// </summary>
public interface IEncryptionService
{
    /// <summary>
    /// Encrypts a plaintext string using AES-256-GCM with the provided DEK
    /// </summary>
    string Encrypt(string plainText, byte[] dek);
    
    /// <summary>
    /// Decrypts a ciphertext string using the provided DEK
    /// </summary>
    string Decrypt(string cipherText, byte[] dek);
    
    /// <summary>
    /// Encrypts sensitive data if not empty, returns null otherwise
    /// </summary>
    string? EncryptIfNotEmpty(string? plainText, byte[] dek);
    
    /// <summary>
    /// Decrypts sensitive data if not empty, returns null otherwise
    /// </summary>
    string? DecryptIfNotEmpty(string? cipherText, byte[] dek);
}

/// <summary>
/// AES-256-GCM encryption service using per-user DEKs
/// </summary>
public class EncryptionService : IEncryptionService
{
    private const int NonceSize = 12; // 96 bits for GCM
    private const int TagSize = 16;   // 128 bits for GCM tag
    private const string EncryptionPrefix = "ENC:v1:"; // Version prefix for future key rotation
    
    public string Encrypt(string plainText, byte[] dek)
    {
        if (string.IsNullOrEmpty(plainText))
        {
            throw new ArgumentException("Plain text cannot be null or empty", nameof(plainText));
        }
        
        if (dek == null || dek.Length != 32)
        {
            throw new ArgumentException("DEK must be 32 bytes (256 bits)", nameof(dek));
        }
        
        var plainBytes = Encoding.UTF8.GetBytes(plainText);
        var nonce = new byte[NonceSize];
        RandomNumberGenerator.Fill(nonce);
        
        var cipherBytes = new byte[plainBytes.Length];
        var tag = new byte[TagSize];
        
        using var aesGcm = new AesGcm(dek, TagSize);
        aesGcm.Encrypt(nonce, plainBytes, cipherBytes, tag);
        
        // Combine: nonce + ciphertext + tag
        var result = new byte[NonceSize + cipherBytes.Length + TagSize];
        Buffer.BlockCopy(nonce, 0, result, 0, NonceSize);
        Buffer.BlockCopy(cipherBytes, 0, result, NonceSize, cipherBytes.Length);
        Buffer.BlockCopy(tag, 0, result, NonceSize + cipherBytes.Length, TagSize);
        
        return EncryptionPrefix + Convert.ToBase64String(result);
    }
    
    public string Decrypt(string cipherText, byte[] dek)
    {
        if (string.IsNullOrEmpty(cipherText))
        {
            throw new ArgumentException("Cipher text cannot be null or empty", nameof(cipherText));
        }
        
        if (dek == null || dek.Length != 32)
        {
            throw new ArgumentException("DEK must be 32 bytes (256 bits)", nameof(dek));
        }
        
        // Remove version prefix if present
        var data = cipherText;
        if (data.StartsWith(EncryptionPrefix))
        {
            data = data.Substring(EncryptionPrefix.Length);
        }
        
        var fullCipher = Convert.FromBase64String(data);
        
        if (fullCipher.Length < NonceSize + TagSize)
        {
            throw new ArgumentException("Invalid cipher text format", nameof(cipherText));
        }
        
        var nonce = new byte[NonceSize];
        var tag = new byte[TagSize];
        var cipherBytes = new byte[fullCipher.Length - NonceSize - TagSize];
        
        Buffer.BlockCopy(fullCipher, 0, nonce, 0, NonceSize);
        Buffer.BlockCopy(fullCipher, NonceSize, cipherBytes, 0, cipherBytes.Length);
        Buffer.BlockCopy(fullCipher, NonceSize + cipherBytes.Length, tag, 0, TagSize);
        
        var plainBytes = new byte[cipherBytes.Length];
        
        using var aesGcm = new AesGcm(dek, TagSize);
        aesGcm.Decrypt(nonce, cipherBytes, tag, plainBytes);
        
        return Encoding.UTF8.GetString(plainBytes);
    }
    
    public string? EncryptIfNotEmpty(string? plainText, byte[] dek)
    {
        if (string.IsNullOrEmpty(plainText))
        {
            return null;
        }
        return Encrypt(plainText, dek);
    }
    
    public string? DecryptIfNotEmpty(string? cipherText, byte[] dek)
    {
        if (string.IsNullOrEmpty(cipherText))
        {
            return null;
        }
        
        try
        {
            return Decrypt(cipherText, dek);
        }
        catch
        {
            // If decryption fails, return the original value
            // This handles migration of unencrypted data
            return cipherText;
        }
    }
}

