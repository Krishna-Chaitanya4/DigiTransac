using DigiTransac.Api.Models;
using DigiTransac.Api.Models.Dto;

namespace DigiTransac.Api.Services.Transactions;

/// <summary>
/// Handles internal account-to-account transfers.
/// Creates linked transactions for source (Send) and destination (Receive) accounts.
/// </summary>
public interface ITransferService
{
    /// <summary>
    /// Create a transfer between two accounts owned by the same user
    /// </summary>
    Task<(bool Success, string Message, TransactionResponse? Transaction)> CreateTransferAsync(
        string userId,
        CreateTransactionRequest request,
        Account sourceAccount,
        Account destinationAccount,
        byte[] dek);
    
    /// <summary>
    /// Sync changes to the linked transaction when the source is updated
    /// </summary>
    Task<(bool Success, string Message)> SyncLinkedTransactionAsync(
        Transaction transaction,
        UpdateTransactionRequest request,
        string userId,
        byte[] dek);
    
    /// <summary>
    /// Delete a transfer and its linked transaction, reversing balances
    /// </summary>
    Task<(bool Success, string Message)> DeleteTransferAsync(
        string userId,
        Transaction transaction);
}