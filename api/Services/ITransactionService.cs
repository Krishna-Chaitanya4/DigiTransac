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
    Task<TransactionResponse?> GetByIdAsync(string id, string userId);
    Task<TransactionListResponse> GetAllAsync(string userId, TransactionFilterRequest filter);
    Task<Result<TransactionResponse>> CreateAsync(string userId, CreateTransactionRequest request);
    Task<Result<TransactionResponse>> UpdateAsync(string id, string userId, UpdateTransactionRequest request);
    Task<Result> DeleteAsync(string id, string userId);
    
    // Recurring transactions
    Task<List<RecurringTransactionResponse>> GetRecurringAsync(string userId);
    Task<(bool Success, string Message)> DeleteRecurringAsync(string id, string userId, bool deleteFutureInstances);
    
    // Analytics and summaries
    Task<TransactionSummaryResponse> GetSummaryAsync(string userId, TransactionFilterRequest filter);
    Task<TransactionAnalyticsResponse> GetAnalyticsAsync(string userId, DateTime? startDate, DateTime? endDate, string? accountId);
    
    // Batch operations
    Task<BatchOperationResponse> BatchDeleteAsync(string userId, List<string> ids);
    Task<BatchOperationResponse> BatchUpdateStatusAsync(string userId, List<string> ids, string status);
    
    // Export
    Task<List<TransactionResponse>> GetAllForExportAsync(string userId, TransactionFilterRequest filter);
    
    // P2P and counterparties
    Task<List<CounterpartyInfo>> GetCounterpartiesAsync(string userId);
    Task<(bool Success, string Message, TransactionResponse? Transaction)> AcceptP2PTransactionAsync(
        string transactionId, string userId, string accountId);
    Task<(bool Success, string Message)> RejectP2PTransactionAsync(string transactionId, string userId, string? reason);
    
    // Pending count
    Task<int> GetPendingCountAsync(string userId);
}