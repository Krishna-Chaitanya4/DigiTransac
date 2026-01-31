using DigiTransac.Api.Models;
using DigiTransac.Api.Models.Dto;
using DigiTransac.Api.Repositories;

namespace DigiTransac.Api.Services.Transactions;

/// <summary>
/// Handles batch operations on transactions.
/// Supports bulk delete and bulk status updates.
/// </summary>
public class TransactionBatchService : ITransactionBatchService
{
    private readonly ITransactionRepository _transactionRepository;
    private readonly IAccountRepository _accountRepository;
    private readonly IAccountBalanceService _accountBalanceService;

    public TransactionBatchService(
        ITransactionRepository transactionRepository,
        IAccountRepository accountRepository,
        IAccountBalanceService accountBalanceService)
    {
        _transactionRepository = transactionRepository;
        _accountRepository = accountRepository;
        _accountBalanceService = accountBalanceService;
    }

    public async Task<BatchOperationResponse> BatchDeleteAsync(
        string userId,
        List<string> ids)
    {
        var successCount = 0;
        var failedIds = new List<string>();

        foreach (var id in ids)
        {
            var transaction = await _transactionRepository.GetByIdAndUserIdAsync(id, userId);
            if (transaction == null)
            {
                failedIds.Add(id);
                continue;
            }

            // Skip recurring templates from batch delete
            if (transaction.IsRecurringTemplate)
            {
                failedIds.Add(id);
                continue;
            }

            // Reverse balance change
            if (!string.IsNullOrEmpty(transaction.AccountId))
            {
                var account = await _accountRepository.GetByIdAndUserIdAsync(transaction.AccountId, userId);
                if (account != null)
                {
                    await _accountBalanceService.UpdateBalanceAsync(
                        account, transaction.Type, transaction.Amount, false);
                }
            }

            // Delete linked transaction for transfers
            if (!string.IsNullOrEmpty(transaction.LinkedTransactionId))
            {
                var linkedTransaction = await _transactionRepository.GetByIdAndUserIdAsync(
                    transaction.LinkedTransactionId, userId);
                if (linkedTransaction != null)
                {
                    if (!string.IsNullOrEmpty(linkedTransaction.AccountId))
                    {
                        var linkedAccount = await _accountRepository.GetByIdAndUserIdAsync(
                            linkedTransaction.AccountId, userId);
                        if (linkedAccount != null)
                        {
                            await _accountBalanceService.UpdateBalanceAsync(
                                linkedAccount, linkedTransaction.Type, linkedTransaction.Amount, false);
                        }
                    }
                    await _transactionRepository.DeleteAsync(linkedTransaction.Id, userId);
                }
            }

            // Delete P2P linked transaction if still pending
            if (transaction.TransactionLinkId.HasValue && 
                !string.IsNullOrEmpty(transaction.CounterpartyUserId))
            {
                var linkedP2P = await _transactionRepository.GetLinkedP2PTransactionAsync(
                    transaction.TransactionLinkId.Value, userId);
                if (linkedP2P != null && linkedP2P.Status == TransactionStatus.Pending)
                {
                    await _transactionRepository.DeleteByIdAsync(linkedP2P.Id);
                }
            }

            var deleted = await _transactionRepository.DeleteAsync(id, userId);
            if (deleted)
            {
                successCount++;
            }
            else
            {
                failedIds.Add(id);
            }
        }

        return new BatchOperationResponse(
            successCount,
            failedIds.Count,
            failedIds,
            $"Deleted {successCount} of {ids.Count} transactions"
        );
    }

    public async Task<BatchOperationResponse> BatchUpdateStatusAsync(
        string userId,
        List<string> ids,
        string status)
    {
        if (!Enum.TryParse<TransactionStatus>(status, true, out var parsedStatus))
        {
            return new BatchOperationResponse(0, ids.Count, ids, $"Invalid status: {status}");
        }

        var successCount = 0;
        var failedIds = new List<string>();

        foreach (var id in ids)
        {
            var transaction = await _transactionRepository.GetByIdAsync(id);
            if (transaction == null || transaction.UserId != userId)
            {
                failedIds.Add(id);
                continue;
            }

            transaction.Status = parsedStatus;
            transaction.UpdatedAt = DateTime.UtcNow;
            await _transactionRepository.UpdateAsync(transaction);
            successCount++;
        }

        return new BatchOperationResponse(
            successCount,
            failedIds.Count,
            failedIds,
            $"{successCount} of {ids.Count} transactions updated to {status}"
        );
    }
}