using DigiTransac.Api.Events;
using DigiTransac.Api.Models;
using DigiTransac.Api.Models.Dto;
using DigiTransac.Api.Repositories;
using MediatR;

namespace DigiTransac.Api.Services.Transactions;

/// <summary>
/// Handles peer-to-peer transaction logic.
/// Creates linked pending transactions for counterparties.
/// Publishes domain events for decoupled side effects.
/// </summary>
public class P2PTransactionService : IP2PTransactionService
{
    private readonly ITransactionRepository _transactionRepository;
    private readonly IAccountRepository _accountRepository;
    private readonly ILabelRepository _labelRepository;
    private readonly ITagRepository _tagRepository;
    private readonly IUserRepository _userRepository;
    private readonly IAccountBalanceService _accountBalanceService;
    private readonly ITransactionMapperService _mapperService;
    private readonly IPublisher _publisher;

    public P2PTransactionService(
        ITransactionRepository transactionRepository,
        IAccountRepository accountRepository,
        ILabelRepository labelRepository,
        ITagRepository tagRepository,
        IUserRepository userRepository,
        IAccountBalanceService accountBalanceService,
        ITransactionMapperService mapperService,
        IPublisher publisher)
    {
        _transactionRepository = transactionRepository;
        _accountRepository = accountRepository;
        _labelRepository = labelRepository;
        _tagRepository = tagRepository;
        _userRepository = userRepository;
        _accountBalanceService = accountBalanceService;
        _mapperService = mapperService;
        _publisher = publisher;
    }

    public async Task<(bool Success, string Message, Transaction? Transaction)> CreateP2PTransactionAsync(
        string userId,
        CreateTransactionRequest request,
        Account account,
        User counterparty,
        Guid transactionLinkId,
        byte[] dek)
    {
        // Determine counterparty's transaction type (opposite of user's)
        var userType = Enum.Parse<TransactionType>(request.Type, true);
        var counterpartyType = userType == TransactionType.Send 
            ? TransactionType.Receive 
            : TransactionType.Send;

        var counterpartyAmount = request.CounterpartyAmount ?? request.Amount;

        // Determine transaction source
        TransactionSource source = TransactionSource.Manual;
        if (!string.IsNullOrEmpty(request.Source) && 
            Enum.TryParse<TransactionSource>(request.Source, true, out var requestedSource))
        {
            source = requestedSource;
        }

        // Create the counterparty's pending transaction
        var receiverTransaction = new Transaction
        {
            UserId = counterparty.Id,
            AccountId = null, // Counterparty will assign their account later
            Type = counterpartyType,
            Amount = counterpartyAmount,
            Currency = account.Currency, // Initially same as user's currency
            Date = request.Date,
            // Timezone-aware date fields (for global travel support)
            // Note: We use the sender's date/timezone initially - counterparty can adjust when accepting
            DateLocal = request.DateLocal,
            DateTimezone = request.DateTimezone,
            Title = request.Title,
            EncryptedNotes = null, // Counterparty can add their own notes
            Splits = new List<TransactionSplit>(), // They'll fill in their own categories
            TagIds = new List<string>(),
            Status = TransactionStatus.Pending, // Pending - counterparty needs to review
            TransactionLinkId = transactionLinkId,
            CounterpartyUserId = userId,
            Source = source
        };

        await _transactionRepository.CreateAsync(receiverTransaction);

        return (true, "P2P transaction created", receiverTransaction);
    }

    public async Task SyncP2PTransactionAsync(
        Transaction transaction,
        UpdateTransactionRequest request)
    {
        if (!transaction.TransactionLinkId.HasValue || 
            string.IsNullOrEmpty(transaction.CounterpartyUserId))
            return;

        var linkedP2PTransaction = await _transactionRepository.GetLinkedP2PTransactionAsync(
            transaction.TransactionLinkId.Value, transaction.UserId);

        // Only sync if the counterparty's transaction is still Pending
        if (linkedP2PTransaction == null || linkedP2PTransaction.Status != TransactionStatus.Pending)
            return;

        // Sync shared fields to the counterparty's pending transaction
        if (request.Amount.HasValue)
        {
            linkedP2PTransaction.Amount = transaction.Amount;
        }

        if (request.Date.HasValue)
        {
            linkedP2PTransaction.Date = transaction.Date;
            linkedP2PTransaction.DateLocal = transaction.DateLocal;
            linkedP2PTransaction.DateTimezone = transaction.DateTimezone;
        }

        if (request.Title != null)
        {
            linkedP2PTransaction.Title = transaction.Title;
        }

        // Sync type (flipped)
        if (request.Type != null)
        {
            linkedP2PTransaction.Type = transaction.Type == TransactionType.Send
                ? TransactionType.Receive
                : TransactionType.Send;
        }

        // Currency syncs only if counterparty hasn't assigned an account yet
        if (string.IsNullOrEmpty(linkedP2PTransaction.AccountId))
        {
            linkedP2PTransaction.Currency = transaction.Currency;
        }

        linkedP2PTransaction.UpdatedAt = DateTime.UtcNow;
        linkedP2PTransaction.LastSyncedAt = DateTime.UtcNow;
        await _transactionRepository.UpdateAsync(linkedP2PTransaction);
    }

    public async Task<(bool Success, string Message)> DeleteP2PTransactionAsync(
        string userId,
        Transaction transaction)
    {
        if (!transaction.TransactionLinkId.HasValue || 
            string.IsNullOrEmpty(transaction.CounterpartyUserId))
            return (true, "No P2P link to delete");

        var linkedP2PTransaction = await _transactionRepository.GetLinkedP2PTransactionAsync(
            transaction.TransactionLinkId.Value, userId);

        // Only delete if the counterparty's transaction is still Pending
        // If they've already confirmed it, leave it (it's their record now)
        if (linkedP2PTransaction != null && linkedP2PTransaction.Status == TransactionStatus.Pending)
        {
            await _transactionRepository.DeleteByIdAsync(linkedP2PTransaction.Id);
        }

        return (true, "P2P linked transaction deleted");
    }

    public async Task<List<CounterpartyInfo>> GetCounterpartiesAsync(string userId)
    {
        // Get all P2P transactions for this user
        var p2pTransactions = await _transactionRepository.GetP2PTransactionsAsync(userId);

        // Group by counterparty and count
        var counterpartyCounts = p2pTransactions
            .Where(t => !string.IsNullOrEmpty(t.CounterpartyUserId))
            .GroupBy(t => t.CounterpartyUserId!)
            .ToDictionary(g => g.Key, g => g.Count());

        // Get user details
        var counterpartyIds = counterpartyCounts.Keys.ToList();
        if (counterpartyIds.Count == 0)
            return new List<CounterpartyInfo>();

        var usersDict = await _userRepository.GetByIdsAsync(counterpartyIds);
        if (usersDict == null || usersDict.Count == 0)
            return new List<CounterpartyInfo>();

        return usersDict.Values
            .Select(u => new CounterpartyInfo(
                UserId: u.Id,
                Email: u.Email,
                Name: u.FullName,
                TransactionCount: counterpartyCounts.GetValueOrDefault(u.Id, 0)
            ))
            .OrderByDescending(c => c.TransactionCount)
            .ThenBy(c => c.Name ?? c.Email)
            .ToList();
    }

    public async Task<(bool Success, string Message, TransactionResponse? Transaction)> AcceptP2PTransactionAsync(
        string transactionId,
        string userId,
        string accountId)
    {
        // Get the pending transaction
        var transaction = await _transactionRepository.GetByIdAndUserIdAsync(transactionId, userId);
        if (transaction == null)
            return (false, "Transaction not found", null);

        if (transaction.Status != TransactionStatus.Pending)
            return (false, "Transaction is not pending", null);

        // Get the account
        var account = await _accountRepository.GetByIdAndUserIdAsync(accountId, userId);
        if (account == null)
            return (false, "Account not found", null);

        if (account.IsArchived)
            return (false, "Cannot accept transaction to an archived account", null);

        // Get DEK for decryption
        var dek = await _mapperService.GetUserDekAsync(userId);
        if (dek == null)
            return (false, "Encryption key not available", null);

        // Get a default label for the transaction
        var labels = await _labelRepository.GetByUserIdAsync(userId);
        var defaultLabel = labels.FirstOrDefault(l => l.Type == LabelType.Category && l.Name == "P2P Transfer")
            ?? labels.FirstOrDefault(l => l.Type == LabelType.Category);

        // Update the transaction
        transaction.AccountId = accountId;
        transaction.Currency = account.Currency;
        transaction.Status = TransactionStatus.Confirmed;
        
        // Add default split if empty
        if (transaction.Splits.Count == 0 && defaultLabel != null)
        {
            transaction.Splits.Add(new TransactionSplit
            {
                LabelId = defaultLabel.Id,
                Amount = transaction.Amount,
                Notes = null
            });
        }

        transaction.UpdatedAt = DateTime.UtcNow;
        await _transactionRepository.UpdateAsync(transaction);

        // Update account balance
        await _accountBalanceService.UpdateBalanceAsync(account, transaction.Type, transaction.Amount, true);

        // Get data for response
        var accounts = await _accountRepository.GetByUserIdAsync(userId, true);
        var tags = await _tagRepository.GetByUserIdAsync(userId);
        var counterpartyUsers = !string.IsNullOrEmpty(transaction.CounterpartyUserId)
            ? await _userRepository.GetByIdsAsync(new[] { transaction.CounterpartyUserId })
            : null;

        var response = _mapperService.MapToResponse(
            transaction,
            dek,
            accounts.ToDictionary(a => a.Id),
            labels.ToDictionary(l => l.Id),
            tags.ToDictionary(t => t.Id),
            counterpartyUsers);

        // Publish P2PTransactionAcceptedEvent
        await _publisher.Publish(new P2PTransactionAcceptedEvent(
            transactionId,
            transaction.CounterpartyUserId!,
            userId,
            accountId,
            transaction.Amount,
            transaction.Currency
        ));

        return (true, "Transaction accepted", response);
    }

    public async Task<(bool Success, string Message)> RejectP2PTransactionAsync(
        string transactionId,
        string userId,
        string? reason)
    {
        // Get the pending transaction
        var transaction = await _transactionRepository.GetByIdAndUserIdAsync(transactionId, userId);
        if (transaction == null)
            return (false, "Transaction not found");

        if (transaction.Status != TransactionStatus.Pending)
            return (false, "Transaction is not pending");

        // Update status to Declined
        transaction.Status = TransactionStatus.Declined;
        transaction.UpdatedAt = DateTime.UtcNow;
        
        // Store rejection reason in notes if provided
        if (!string.IsNullOrEmpty(reason))
        {
            var dek = await _mapperService.GetUserDekAsync(userId);
            if (dek != null)
            {
                transaction.EncryptedNotes = _mapperService.EncryptIfNotEmpty($"Rejected: {reason}", dek);
            }
        }

        await _transactionRepository.UpdateAsync(transaction);

        // Publish P2PTransactionRejectedEvent
        await _publisher.Publish(new P2PTransactionRejectedEvent(
            transactionId,
            transaction.CounterpartyUserId!,
            userId,
            reason
        ));

        return (true, "Transaction rejected");
    }
}