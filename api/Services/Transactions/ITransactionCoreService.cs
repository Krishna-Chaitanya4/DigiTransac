using DigiTransac.Api.Models;
using DigiTransac.Api.Models.Dto;

namespace DigiTransac.Api.Services.Transactions;

/// <summary>
/// Core transaction service handling CRUD operations and balance management.
/// This is the main entry point for transaction operations.
/// </summary>
public interface ITransactionCoreService
{
    /// <summary>
    /// Get a single transaction by ID
    /// </summary>
    Task<TransactionResponse?> GetByIdAsync(string id, string userId);
    
    /// <summary>
    /// Get all transactions with filters and pagination
    /// </summary>
    Task<TransactionListResponse> GetAllAsync(string userId, TransactionFilterRequest filter);
    
    /// <summary>
    /// Create a new transaction (handles routing to transfer/P2P/regular)
    /// </summary>
    Task<(bool Success, string Message, TransactionResponse? Transaction)> CreateAsync(
        string userId, CreateTransactionRequest request);
    
    /// <summary>
    /// Update an existing transaction
    /// </summary>
    Task<(bool Success, string Message, TransactionResponse? Transaction)> UpdateAsync(
        string id, string userId, UpdateTransactionRequest request);
    
    /// <summary>
    /// Delete a transaction
    /// </summary>
    Task<(bool Success, string Message)> DeleteAsync(string id, string userId);
    
    /// <summary>
    /// Get pending transaction count for a user
    /// </summary>
    Task<int> GetPendingCountAsync(string userId);
}