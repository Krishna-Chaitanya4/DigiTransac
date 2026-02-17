using DigiTransac.Api.Common;
using DigiTransac.Api.Models;
using DigiTransac.Api.Models.Dto;

namespace DigiTransac.Api.Services;

/// <summary>
/// Main transaction service interface.
/// This is the public API for transaction operations used by endpoints.
/// </summary>
public interface ITransactionService
{
    // Core CRUD operations
    Task<TransactionResponse?> GetByIdAsync(string id, string userId, CancellationToken ct = default);
    Task<TransactionListResponse> GetAllAsync(string userId, TransactionFilterRequest filter, CancellationToken ct = default);
    Task<Result<TransactionResponse>> CreateAsync(string userId, CreateTransactionRequest request, CancellationToken ct = default);
    Task<Result<TransactionResponse>> UpdateAsync(string id, string userId, UpdateTransactionRequest request, CancellationToken ct = default);
    Task<Result> DeleteAsync(string id, string userId, CancellationToken ct = default);
    Task<Result> RestoreAsync(string id, string userId, CancellationToken ct = default);
    
    // Recurring transactions
    Task<List<RecurringTransactionResponse>> GetRecurringAsync(string userId, CancellationToken ct = default);
    Task<(bool Success, string Message)> DeleteRecurringAsync(string id, string userId, bool deleteFutureInstances, CancellationToken ct = default);
    
    // Analytics and summaries
    Task<TransactionSummaryResponse> GetSummaryAsync(string userId, TransactionFilterRequest filter, CancellationToken ct = default);
    Task<TransactionAnalyticsResponse> GetAnalyticsAsync(string userId, DateTime? startDate, DateTime? endDate, string? accountId, CancellationToken ct = default);
    
    // Batch operations
    Task<BatchOperationResponse> BatchDeleteAsync(string userId, List<string> ids, CancellationToken ct = default);
    Task<BatchOperationResponse> BatchUpdateStatusAsync(string userId, List<string> ids, string status, CancellationToken ct = default);
    
    // Export
    Task<List<TransactionResponse>> GetAllForExportAsync(string userId, TransactionFilterRequest filter, CancellationToken ct = default);
    
    // P2P and counterparties
    Task<List<CounterpartyInfo>> GetCounterpartiesAsync(string userId, CancellationToken ct = default);
    Task<(bool Success, string Message, TransactionResponse? Transaction)> AcceptP2PTransactionAsync(
        string transactionId, string userId, string accountId, CancellationToken ct = default);
    Task<(bool Success, string Message)> RejectP2PTransactionAsync(string transactionId, string userId, string? reason, CancellationToken ct = default);
    
    // Pending count
    Task<int> GetPendingCountAsync(string userId, CancellationToken ct = default);
}