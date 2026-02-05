using DigiTransac.Api.Models;
using DigiTransac.Api.Models.Dto;

namespace DigiTransac.Api.Services.Transactions;

/// <summary>
/// Handles mapping between Transaction entities and DTOs.
/// Centralizes encryption/decryption logic for sensitive fields.
/// </summary>
public interface ITransactionMapperService
{
    /// <summary>
    /// Map a transaction to its response DTO
    /// </summary>
    TransactionResponse MapToResponse(
        Transaction transaction,
        byte[]? dek,
        Dictionary<string, Account> accounts,
        Dictionary<string, Label> labels,
        Dictionary<string, Tag> tags,
        Dictionary<string, User>? counterpartyUsers = null);
    
    /// <summary>
    /// Map a recurring transaction to its response DTO
    /// </summary>
    RecurringTransactionResponse MapToRecurringResponse(
        Transaction transaction,
        byte[]? dek,
        Dictionary<string, Account> accounts,
        Dictionary<string, Label> labels);
    
    /// <summary>
    /// Map a split to its response DTO
    /// </summary>
    TransactionSplitResponse MapSplitToResponse(
        TransactionSplit split,
        byte[]? dek,
        Dictionary<string, Label> labels);
    
    /// <summary>
    /// Map a location to its response DTO
    /// </summary>
    TransactionLocationResponse? MapLocationToResponse(
        TransactionLocation? location,
        byte[]? dek);
    
    /// <summary>
    /// Encrypt a value if not empty using the provided DEK
    /// </summary>
    string? EncryptIfNotEmpty(string? value, byte[] dek);
    
    /// <summary>
    /// Decrypt a value if not empty using the provided DEK
    /// </summary>
    string? DecryptIfNotEmpty(string? value, byte[] dek);
    
    /// <summary>
    /// Get the user's DEK (Data Encryption Key), generating if needed
    /// </summary>
    Task<byte[]?> GetUserDekAsync(string userId);
}