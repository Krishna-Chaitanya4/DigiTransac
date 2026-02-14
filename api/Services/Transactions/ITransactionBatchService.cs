using DigiTransac.Api.Models.Dto;

namespace DigiTransac.Api.Services.Transactions;

/// <summary>
/// Handles batch operations on transactions.
/// Supports bulk delete and bulk status updates.
/// </summary>
public interface ITransactionBatchService
{
    /// <summary>
    /// Delete multiple transactions at once
    /// </summary>
    Task<BatchOperationResponse> BatchDeleteAsync(
        string userId, 
        List<string> ids,
        CancellationToken ct = default);
    
    /// <summary>
    /// Update status of multiple transactions at once
    /// </summary>
    Task<BatchOperationResponse> BatchUpdateStatusAsync(
        string userId, 
        List<string> ids, 
        string status,
        CancellationToken ct = default);
}