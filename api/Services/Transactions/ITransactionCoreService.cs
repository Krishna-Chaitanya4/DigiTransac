using DigiTransac.Api.Common;
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
    Task<TransactionResponse?> GetByIdAsync(string id, string userId, CancellationToken ct = default);
    
    /// <summary>
    /// Get all transactions with filters and pagination
    /// </summary>
    Task<TransactionListResponse> GetAllAsync(string userId, TransactionFilterRequest filter, CancellationToken ct = default);
    
    /// <summary>
    /// Create a new transaction (handles routing to transfer/P2P/regular)
    /// </summary>
    Task<Result<TransactionResponse>> CreateAsync(string userId, CreateTransactionRequest request, CancellationToken ct = default);
    
    /// <summary>
    /// Update an existing transaction
    /// </summary>
    Task<Result<TransactionResponse>> UpdateAsync(string id, string userId, UpdateTransactionRequest request, CancellationToken ct = default);
    
    /// <summary>
    /// Delete a transaction (soft-delete with 24-hour undo window)
    /// </summary>
    Task<Result> DeleteAsync(string id, string userId, CancellationToken ct = default);
    
    /// <summary>
    /// Restore a soft-deleted transaction within the undo window
    /// </summary>
    Task<Result> RestoreAsync(string id, string userId, CancellationToken ct = default);
    
    /// <summary>
    /// Get pending transaction count for a user
    /// </summary>
    Task<int> GetPendingCountAsync(string userId, CancellationToken ct = default);
}