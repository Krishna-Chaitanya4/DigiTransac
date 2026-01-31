using DigiTransac.Api.Models;
using DigiTransac.Api.Models.Dto;

namespace DigiTransac.Api.Services.Transactions;

/// <summary>
/// Handles peer-to-peer transaction logic.
/// Creates linked pending transactions for counterparties.
/// </summary>
public interface IP2PTransactionService
{
    /// <summary>
    /// Create a P2P transaction with a counterparty
    /// </summary>
    Task<(bool Success, string Message, Transaction? Transaction)> CreateP2PTransactionAsync(
        string userId,
        CreateTransactionRequest request,
        Account account,
        User counterparty,
        Guid transactionLinkId,
        byte[] dek);
    
    /// <summary>
    /// Sync changes to the counterparty's pending transaction
    /// </summary>
    Task SyncP2PTransactionAsync(
        Transaction transaction,
        UpdateTransactionRequest request);
    
    /// <summary>
    /// Delete a P2P transaction (deletes counterparty's if still pending)
    /// </summary>
    Task<(bool Success, string Message)> DeleteP2PTransactionAsync(
        string userId,
        Transaction transaction);
    
    /// <summary>
    /// Get all counterparties the user has transacted with
    /// </summary>
    Task<List<CounterpartyInfo>> GetCounterpartiesAsync(string userId);
    
    /// <summary>
    /// Accept a pending P2P transaction and assign it to an account
    /// </summary>
    Task<(bool Success, string Message, TransactionResponse? Transaction)> AcceptP2PTransactionAsync(
        string transactionId,
        string userId,
        string accountId);
    
    /// <summary>
    /// Reject a pending P2P transaction
    /// </summary>
    Task<(bool Success, string Message)> RejectP2PTransactionAsync(
        string transactionId,
        string userId,
        string? reason);
}