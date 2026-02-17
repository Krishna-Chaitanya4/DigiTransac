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
        List<string> ids,
        CancellationToken ct = default)
    {
        var successCount = 0;
        var failedIds = new List<string>();
        var processedIds = new HashSet<string>();

        // Batch-fetch all transactions upfront to avoid N+1
        var transactions = await _transactionRepository.GetByIdsAsync(ids, userId);
        var transactionMap = transactions.ToDictionary(t => t.Id);

        // Batch-fetch all accounts for this user (one query instead of N)
        var accounts = await _accountRepository.GetByUserIdAsync(userId, includeArchived: true);
        var accountMap = accounts.ToDictionary(a => a.Id);

        foreach (var id in ids)
        {
            if (!transactionMap.TryGetValue(id, out var transaction))
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
            if (!string.IsNullOrEmpty(transaction.AccountId) &&
                accountMap.TryGetValue(transaction.AccountId, out var account))
            {
                await _accountBalanceService.UpdateBalanceAsync(
                    account, transaction.Type, transaction.Amount, false);
            }

            // Delete linked transaction for transfers
            if (!string.IsNullOrEmpty(transaction.LinkedTransactionId) &&
                transactionMap.TryGetValue(transaction.LinkedTransactionId, out var linkedTransaction))
            {
                // Mark linked transaction as processed to avoid double reversal
                processedIds.Add(linkedTransaction.Id);

                // Linked transaction was in the batch — handle it
                if (!string.IsNullOrEmpty(linkedTransaction.AccountId) &&
                    accountMap.TryGetValue(linkedTransaction.AccountId, out var linkedAccount))
                {
                    await _accountBalanceService.UpdateBalanceAsync(
                        linkedAccount, linkedTransaction.Type, linkedTransaction.Amount, false);
                }
                await _transactionRepository.DeleteAsync(linkedTransaction.Id, userId);
            }
            else if (!string.IsNullOrEmpty(transaction.LinkedTransactionId))
            {
                // Linked transaction wasn't in batch — fetch individually (rare case)
                var linkedTx = await _transactionRepository.GetByIdAndUserIdAsync(
                    transaction.LinkedTransactionId, userId);
                if (linkedTx != null)
                {
                    if (!string.IsNullOrEmpty(linkedTx.AccountId) &&
                        accountMap.TryGetValue(linkedTx.AccountId, out var linkedAcct))
                    {
                        await _accountBalanceService.UpdateBalanceAsync(
                            linkedAcct, linkedTx.Type, linkedTx.Amount, false);
                    }
                    await _transactionRepository.DeleteAsync(linkedTx.Id, userId);
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
                processedIds.Add(id);
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
        string status,
        CancellationToken ct = default)
    {
        if (!Enum.TryParse<TransactionStatus>(status, true, out var parsedStatus))
        {
            return new BatchOperationResponse(0, ids.Count, ids, $"Invalid status: {status}");
        }

        // Batch-fetch all transactions upfront to avoid N+1
        var transactions = await _transactionRepository.GetByIdsAsync(ids, userId);
        var transactionMap = transactions.ToDictionary(t => t.Id);

        // Batch-fetch accounts for balance adjustments
        var accounts = await _accountRepository.GetByUserIdAsync(userId, includeArchived: true);
        var accountMap = accounts.ToDictionary(a => a.Id);

        var successCount = 0;
        var failedIds = new List<string>();

        foreach (var id in ids)
        {
            if (!transactionMap.TryGetValue(id, out var transaction))
            {
                failedIds.Add(id);
                continue;
            }

            var oldStatus = transaction.Status;

            // Adjust balance when status changes affect confirmed state
            if (oldStatus != parsedStatus && !string.IsNullOrEmpty(transaction.AccountId) &&
                accountMap.TryGetValue(transaction.AccountId, out var account))
            {
                // Was Confirmed, now becoming non-Confirmed → reverse the balance
                if (oldStatus == TransactionStatus.Confirmed &&
                    parsedStatus != TransactionStatus.Confirmed)
                {
                    await _accountBalanceService.UpdateBalanceAsync(
                        account, transaction.Type, transaction.Amount, false);
                }
                // Was non-Confirmed, now becoming Confirmed → apply the balance
                else if (oldStatus != TransactionStatus.Confirmed &&
                         parsedStatus == TransactionStatus.Confirmed)
                {
                    await _accountBalanceService.UpdateBalanceAsync(
                        account, transaction.Type, transaction.Amount, true);
                }
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