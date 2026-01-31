using DigiTransac.Api.Events;
using DigiTransac.Api.Models;
using DigiTransac.Api.Models.Dto;
using DigiTransac.Api.Repositories;
using DigiTransac.Api.Services.UnitOfWork;
using MediatR;

namespace DigiTransac.Api.Services.Transactions;

/// <summary>
/// Core transaction service handling CRUD operations.
/// Orchestrates transfer, P2P, and recurring services as needed.
/// Uses Unit of Work pattern for atomic multi-document operations.
/// Publishes domain events for decoupled side effects.
/// </summary>
public class TransactionCoreService : ITransactionCoreService
{
    private readonly ITransactionRepository _transactionRepository;
    private readonly IAccountRepository _accountRepository;
    private readonly ILabelRepository _labelRepository;
    private readonly ITagRepository _tagRepository;
    private readonly IUserRepository _userRepository;
    private readonly IChatMessageRepository _chatMessageRepository;
    private readonly ITransferService _transferService;
    private readonly IP2PTransactionService _p2pService;
    private readonly IRecurringTransactionService _recurringService;
    private readonly IAccountBalanceService _accountBalanceService;
    private readonly ITransactionMapperService _mapperService;
    private readonly IMongoDbService _mongoDbService;
    private readonly IPublisher _publisher;

    public TransactionCoreService(
        ITransactionRepository transactionRepository,
        IAccountRepository accountRepository,
        ILabelRepository labelRepository,
        ITagRepository tagRepository,
        IUserRepository userRepository,
        IChatMessageRepository chatMessageRepository,
        ITransferService transferService,
        IP2PTransactionService p2pService,
        IRecurringTransactionService recurringService,
        IAccountBalanceService accountBalanceService,
        ITransactionMapperService mapperService,
        IMongoDbService mongoDbService,
        IPublisher publisher)
    {
        _transactionRepository = transactionRepository;
        _accountRepository = accountRepository;
        _labelRepository = labelRepository;
        _tagRepository = tagRepository;
        _userRepository = userRepository;
        _chatMessageRepository = chatMessageRepository;
        _transferService = transferService;
        _p2pService = p2pService;
        _recurringService = recurringService;
        _accountBalanceService = accountBalanceService;
        _mapperService = mapperService;
        _mongoDbService = mongoDbService;
        _publisher = publisher;
    }

    public async Task<TransactionResponse?> GetByIdAsync(string id, string userId)
    {
        var transaction = await _transactionRepository.GetByIdAndUserIdAsync(id, userId);
        if (transaction == null) return null;

        var dek = await _mapperService.GetUserDekAsync(userId);
        var accounts = await _accountRepository.GetByUserIdAsync(userId, true);
        var labels = await _labelRepository.GetByUserIdAsync(userId);
        var tags = await _tagRepository.GetByUserIdAsync(userId);

        // Fetch counterparty user if exists
        var counterpartyUsers = !string.IsNullOrEmpty(transaction.CounterpartyUserId)
            ? await _userRepository.GetByIdsAsync(new[] { transaction.CounterpartyUserId })
            : null;

        return _mapperService.MapToResponse(
            transaction, dek,
            accounts.ToDictionary(a => a.Id),
            labels.ToDictionary(l => l.Id),
            tags.ToDictionary(t => t.Id),
            counterpartyUsers);
    }

    public async Task<TransactionListResponse> GetAllAsync(string userId, TransactionFilterRequest filter)
    {
        // Get accounts, labels, tags for mapping
        var accounts = await _accountRepository.GetByUserIdAsync(userId, true);
        var labels = await _labelRepository.GetByUserIdAsync(userId);
        var tags = await _tagRepository.GetByUserIdAsync(userId);

        // Get all counterparties for search
        var p2pTransactions = await _transactionRepository.GetP2PTransactionsAsync(userId);
        var allCounterpartyIds = p2pTransactions
            .Where(t => !string.IsNullOrEmpty(t.CounterpartyUserId))
            .Select(t => t.CounterpartyUserId!)
            .Distinct()
            .ToList();
        var allCounterpartyUsers = await _userRepository.GetByIdsAsync(allCounterpartyIds);

        // Enrich filter with search matches
        var enrichedFilter = filter;
        if (!string.IsNullOrEmpty(filter.SearchText))
        {
            var searchLower = filter.SearchText.ToLowerInvariant();

            var matchingLabelIds = labels
                .Where(l => l.Name.ToLowerInvariant().Contains(searchLower))
                .Select(l => l.Id)
                .ToList();

            var matchingTagIds = tags
                .Where(t => t.Name.ToLowerInvariant().Contains(searchLower))
                .Select(t => t.Id)
                .ToList();

            var matchingAccountIds = accounts
                .Where(a => a.Name.ToLowerInvariant().Contains(searchLower))
                .Select(a => a.Id)
                .ToList();

            var matchingCounterpartyIds = allCounterpartyUsers.Values
                .Where(u => (u.FullName?.ToLowerInvariant().Contains(searchLower) ?? false) ||
                           u.Email.ToLowerInvariant().Contains(searchLower))
                .Select(u => u.Id)
                .ToList();

            enrichedFilter = filter with
            {
                SearchLabelIds = matchingLabelIds.Count > 0 ? matchingLabelIds : null,
                SearchTagIds = matchingTagIds.Count > 0 ? matchingTagIds : null,
                SearchAccountIds = matchingAccountIds.Count > 0 ? matchingAccountIds : null,
                SearchCounterpartyUserIds = matchingCounterpartyIds.Count > 0 ? matchingCounterpartyIds : null
            };
        }

        var (transactions, totalCount) = await _transactionRepository.GetFilteredAsync(userId, enrichedFilter);
        var dek = await _mapperService.GetUserDekAsync(userId);

        var page = filter.Page ?? 1;
        var pageSize = filter.PageSize ?? 50;
        var totalPages = (int)Math.Ceiling((double)totalCount / pageSize);

        var responses = transactions.Select(t => _mapperService.MapToResponse(
            t, dek,
            accounts.ToDictionary(a => a.Id),
            labels.ToDictionary(l => l.Id),
            tags.ToDictionary(t => t.Id),
            allCounterpartyUsers)).ToList();

        return new TransactionListResponse(responses, totalCount, page, pageSize, totalPages);
    }

    public async Task<(bool Success, string Message, TransactionResponse? Transaction)> CreateAsync(
        string userId,
        CreateTransactionRequest request)
    {
        // Validate account
        var account = await _accountRepository.GetByIdAndUserIdAsync(request.AccountId, userId);
        if (account == null)
            return (false, "Account not found", null);

        // Validate type
        if (!Enum.TryParse<TransactionType>(request.Type, true, out var type))
            return (false, "Invalid transaction type. Use Receive or Send", null);

        // Validate amount
        if (request.Amount <= 0)
            return (false, "Amount must be positive", null);

        // Validate splits
        if (request.Splits == null || request.Splits.Count == 0)
            return (false, "At least one split is required", null);

        var splitSum = request.Splits.Sum(s => s.Amount);
        if (Math.Abs(splitSum - request.Amount) > 0.01m)
            return (false, $"Split amounts ({splitSum}) must equal transaction amount ({request.Amount})", null);

        foreach (var split in request.Splits)
        {
            if (split.Amount <= 0)
                return (false, "Each split amount must be positive", null);
        }

        // Validate labels exist
        var labels = await _labelRepository.GetByUserIdAsync(userId);
        var labelIds = labels.Select(l => l.Id).ToHashSet();
        foreach (var split in request.Splits)
        {
            if (!labelIds.Contains(split.LabelId))
                return (false, $"Label {split.LabelId} not found", null);
        }

        var tags = await _tagRepository.GetByUserIdAsync(userId);
        var dek = await _mapperService.GetUserDekAsync(userId);
        if (dek == null)
            return (false, "Encryption key not available", null);

        bool isP2P = !string.IsNullOrEmpty(request.CounterpartyEmail);
        bool isSelfTransfer = !string.IsNullOrEmpty(request.TransferToAccountId);

        // Validate transfer/P2P exclusivity
        if (isSelfTransfer && isP2P)
            return (false, "Cannot combine transfer with P2P. Use either transfer or counterparty email.", null);

        // Handle self-transfer
        if (isSelfTransfer)
        {
            if (type != TransactionType.Send)
                return (false, "Transfer must use Send type (money leaves source account)", null);

            var transferToAccount = await _accountRepository.GetByIdAndUserIdAsync(request.TransferToAccountId!, userId);
            if (transferToAccount == null)
                return (false, "Destination account not found", null);

            if (request.TransferToAccountId == request.AccountId)
                return (false, "Cannot transfer to the same account", null);

            return await _transferService.CreateTransferAsync(userId, request, account, transferToAccount, dek);
        }

        // Handle P2P
        User? counterpartyUser = null;
        if (isP2P)
        {
            counterpartyUser = await _userRepository.GetByEmailAsync(request.CounterpartyEmail!);
            if (counterpartyUser != null && counterpartyUser.Id == userId)
                return (false, "Cannot send to yourself. Use Transfer to move money between your accounts.", null);
        }

        // Handle recurring
        if (request.RecurringRule != null)
        {
            var (success, message, template, firstInstance) = await _recurringService.CreateRecurringTemplateAsync(
                userId, request, account, dek);

            if (!success)
                return (false, message, null);

            // Handle transfer for recurring (first instance)
            if (isSelfTransfer && firstInstance != null)
            {
                var transferToAccount = await _accountRepository.GetByIdAndUserIdAsync(request.TransferToAccountId!, userId);
                if (transferToAccount != null)
                {
                    // The recurring service already creates the first instance
                    // We need to create its linked transfer transaction
                    // This is handled in RecurringTransactionService
                }
            }

            var accounts = await _accountRepository.GetByUserIdAsync(userId, true);
            var response = _mapperService.MapToResponse(
                firstInstance!,
                dek,
                accounts.ToDictionary(a => a.Id),
                labels.ToDictionary(l => l.Id),
                tags.ToDictionary(t => t.Id),
                null);

            return (true, "Recurring transaction created successfully", response);
        }

        // Create regular transaction
        var transactionLinkId = isP2P ? Guid.NewGuid() : (Guid?)null;

        // Determine transaction source
        TransactionSource source = TransactionSource.Manual;
        if (!string.IsNullOrEmpty(request.Source) &&
            Enum.TryParse<TransactionSource>(request.Source, true, out var requestedSource))
        {
            source = requestedSource;
        }

        var transaction = new Transaction
        {
            UserId = userId,
            AccountId = request.AccountId,
            Type = type,
            Amount = request.Amount,
            Currency = account.Currency,
            Date = request.Date,
            Title = request.Title,
            EncryptedPayee = _mapperService.EncryptIfNotEmpty(request.Payee, dek),
            EncryptedNotes = _mapperService.EncryptIfNotEmpty(request.Notes, dek),
            Splits = request.Splits.Select(s => new TransactionSplit
            {
                LabelId = s.LabelId,
                Amount = s.Amount,
                Notes = s.Notes
            }).ToList(),
            TagIds = request.TagIds ?? new List<string>(),
            Status = TransactionStatus.Confirmed,
            TransactionLinkId = transactionLinkId,
            CounterpartyUserId = isP2P ? counterpartyUser?.Id : null,
            Source = source
        };

        // Handle location
        if (request.Location != null)
        {
            transaction.Location = new TransactionLocation
            {
                Latitude = request.Location.Latitude,
                EncryptedLongitude = _mapperService.EncryptIfNotEmpty(request.Location.Longitude.ToString(), dek),
                EncryptedPlaceName = _mapperService.EncryptIfNotEmpty(request.Location.PlaceName, dek),
                City = request.Location.City,
                Country = request.Location.Country
            };
        }

        // Execute transaction creation and balance update atomically
        await using var unitOfWork = new Services.UnitOfWork.UnitOfWork(_mongoDbService);
        await unitOfWork.ExecuteInTransactionAsync(async session =>
        {
            await _transactionRepository.CreateAsync(transaction, session);
            await _accountBalanceService.UpdateBalanceAsync(account, type, request.Amount, true, session);
        });

        // Handle P2P - create pending transaction for counterparty (outside main transaction)
        if (isP2P && counterpartyUser != null)
        {
            await _p2pService.CreateP2PTransactionAsync(
                userId, request, account, counterpartyUser, transactionLinkId!.Value, dek);
        }

        // Create chat message (outside main transaction - separate operation)
        var recipientUserId = isP2P && counterpartyUser != null
            ? counterpartyUser.Id
            : userId;

        var chatMessage = new ChatMessage
        {
            SenderUserId = userId,
            RecipientUserId = recipientUserId,
            Type = ChatMessageType.Transaction,
            TransactionId = transaction.Id,
            Status = MessageStatus.Sent,
            CreatedAt = DateTime.UtcNow
        };

        await _chatMessageRepository.CreateAsync(chatMessage);
        transaction.ChatMessageId = chatMessage.Id;
        await _transactionRepository.UpdateAsync(transaction);

        // Map response
        var accounts2 = await _accountRepository.GetByUserIdAsync(userId, true);
        var counterpartyUsers = !string.IsNullOrEmpty(transaction.CounterpartyUserId)
            ? await _userRepository.GetByIdsAsync(new[] { transaction.CounterpartyUserId })
            : null;

        var transactionResponse = _mapperService.MapToResponse(
            transaction,
            dek,
            accounts2.ToDictionary(a => a.Id),
            labels.ToDictionary(l => l.Id),
            tags.ToDictionary(t => t.Id),
            counterpartyUsers);

        // Publish TransactionCreatedEvent
        await _publisher.Publish(new TransactionCreatedEvent(
            transaction.Id,
            userId,
            request.AccountId,
            type,
            request.Amount,
            account.Currency,
            isP2P,
            counterpartyUser?.Id
        ));

        return (true, "Transaction created successfully", transactionResponse);
    }

    public async Task<(bool Success, string Message, TransactionResponse? Transaction)> UpdateAsync(
        string id,
        string userId,
        UpdateTransactionRequest request)
    {
        var transaction = await _transactionRepository.GetByIdAndUserIdAsync(id, userId);
        if (transaction == null)
            return (false, "Transaction not found", null);

        if (transaction.IsRecurringTemplate)
            return (false, "Cannot edit recurring template. Delete and recreate instead.", null);

        var dek = await _mapperService.GetUserDekAsync(userId);
        if (dek == null)
            return (false, "Encryption key not available", null);

        // Account lookup
        Account? account = null;
        if (!string.IsNullOrEmpty(transaction.AccountId))
        {
            account = await _accountRepository.GetByIdAndUserIdAsync(transaction.AccountId, userId);
            if (account == null)
                return (false, "Account not found", null);
        }

        // Store old values for balance adjustment
        var oldType = transaction.Type;
        var oldAmount = transaction.Amount;
        var oldAccount = account;

        // Handle account change
        Account? newAccount = null;
        if (!string.IsNullOrEmpty(request.AccountId) && request.AccountId != transaction.AccountId)
        {
            newAccount = await _accountRepository.GetByIdAndUserIdAsync(request.AccountId, userId);
            if (newAccount == null)
                return (false, "New account not found", null);
            if (newAccount.IsArchived)
                return (false, "Cannot move transaction to an archived account", null);

            transaction.AccountId = request.AccountId;
            transaction.Currency = newAccount.Currency;
        }

        // Update fields
        if (request.Type != null && Enum.TryParse<TransactionType>(request.Type, true, out var newType))
        {
            transaction.Type = newType;
        }

        if (request.Amount.HasValue)
        {
            if (request.Amount.Value <= 0)
                return (false, "Amount must be positive", null);
            transaction.Amount = request.Amount.Value;
        }

        if (request.Date.HasValue)
            transaction.Date = request.Date.Value;

        if (request.Title != null)
            transaction.Title = request.Title;

        if (request.Payee != null)
            transaction.EncryptedPayee = _mapperService.EncryptIfNotEmpty(request.Payee, dek);

        if (request.Notes != null)
            transaction.EncryptedNotes = _mapperService.EncryptIfNotEmpty(request.Notes, dek);

        if (!string.IsNullOrEmpty(request.Status) &&
            Enum.TryParse<TransactionStatus>(request.Status, true, out var status))
            transaction.Status = status;

        if (request.TagIds != null)
            transaction.TagIds = request.TagIds;

        if (request.Splits != null)
        {
            if (request.Splits.Count == 0)
                return (false, "At least one split is required", null);

            var splitSum = request.Splits.Sum(s => s.Amount);
            if (Math.Abs(splitSum - transaction.Amount) > 0.01m)
                return (false, $"Split amounts ({splitSum}) must equal transaction amount ({transaction.Amount})", null);

            transaction.Splits = request.Splits.Select(s => new TransactionSplit
            {
                LabelId = s.LabelId,
                Amount = s.Amount,
                Notes = s.Notes
            }).ToList();
        }

        if (request.Location != null)
        {
            transaction.Location = new TransactionLocation
            {
                Latitude = request.Location.Latitude,
                EncryptedLongitude = _mapperService.EncryptIfNotEmpty(request.Location.Longitude.ToString(), dek),
                EncryptedPlaceName = _mapperService.EncryptIfNotEmpty(request.Location.PlaceName, dek),
                City = request.Location.City,
                Country = request.Location.Country
            };
        }

        await _transactionRepository.UpdateAsync(transaction);

        // Sync linked transfer transaction
        if (!string.IsNullOrEmpty(transaction.LinkedTransactionId))
        {
            await _transferService.SyncLinkedTransactionAsync(transaction, request, userId, dek);
        }

        // Sync P2P linked transaction
        if (transaction.TransactionLinkId.HasValue && !string.IsNullOrEmpty(transaction.CounterpartyUserId))
        {
            await _p2pService.SyncP2PTransactionAsync(transaction, request);
        }

        // Adjust balances
        if (newAccount != null && oldAccount != null)
        {
            await _accountBalanceService.UpdateBalanceAsync(oldAccount, oldType, oldAmount, false);
            await _accountBalanceService.UpdateBalanceAsync(newAccount, transaction.Type, transaction.Amount, true);
        }
        else if (newAccount != null && oldAccount == null)
        {
            await _accountBalanceService.UpdateBalanceAsync(newAccount, transaction.Type, transaction.Amount, true);
        }
        else if (account != null && (oldType != transaction.Type || oldAmount != transaction.Amount))
        {
            await _accountBalanceService.UpdateBalanceAsync(account, oldType, oldAmount, false);
            await _accountBalanceService.UpdateBalanceAsync(account, transaction.Type, transaction.Amount, true);
        }

        // Map response
        var accounts = await _accountRepository.GetByUserIdAsync(userId, true);
        var labels = await _labelRepository.GetByUserIdAsync(userId);
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

        // Publish TransactionUpdatedEvent
        await _publisher.Publish(new TransactionUpdatedEvent(
            transaction.Id,
            userId,
            oldAmount,
            transaction.Amount,
            oldType,
            transaction.Type,
            oldAccount?.Id,
            newAccount?.Id ?? transaction.AccountId
        ));

        return (true, "Transaction updated successfully", response);
    }

    public async Task<(bool Success, string Message)> DeleteAsync(string id, string userId)
    {
        var transaction = await _transactionRepository.GetByIdAndUserIdAsync(id, userId);
        if (transaction == null)
            return (false, "Transaction not found");

        // Get account for balance reversal
        Account? account = null;
        if (!transaction.IsRecurringTemplate && !string.IsNullOrEmpty(transaction.AccountId))
        {
            account = await _accountRepository.GetByIdAndUserIdAsync(transaction.AccountId, userId);
        }

        // Delete linked transfer transaction (uses its own UoW internally)
        if (!string.IsNullOrEmpty(transaction.LinkedTransactionId))
        {
            await _transferService.DeleteTransferAsync(userId, transaction);
        }

        // Delete P2P linked transaction
        if (transaction.TransactionLinkId.HasValue && !string.IsNullOrEmpty(transaction.CounterpartyUserId))
        {
            await _p2pService.DeleteP2PTransactionAsync(userId, transaction);
        }

        // Execute delete and balance reversal atomically
        if (account != null)
        {
            await using var unitOfWork = new Services.UnitOfWork.UnitOfWork(_mongoDbService);
            await unitOfWork.ExecuteInTransactionAsync(async session =>
            {
                await _accountBalanceService.UpdateBalanceAsync(
                    account, transaction.Type, transaction.Amount, false, session);
                await _transactionRepository.DeleteAsync(id, userId, session);
            });
        }
        else
        {
            await _transactionRepository.DeleteAsync(id, userId);
        }

        // Publish TransactionDeletedEvent
        await _publisher.Publish(new TransactionDeletedEvent(
            id,
            userId,
            transaction.AccountId,
            transaction.Type,
            transaction.Amount,
            transaction.IsRecurringTemplate
        ));

        return (true, "Transaction deleted successfully");
    }

    public async Task<int> GetPendingCountAsync(string userId)
    {
        return await _transactionRepository.GetPendingCountAsync(userId);
    }
}