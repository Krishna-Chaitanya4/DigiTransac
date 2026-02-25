using DigiTransac.Api.Events;
using DigiTransac.Api.Models;
using DigiTransac.Api.Models.Dto;
using DigiTransac.Api.Repositories;
using DigiTransac.Api.Services.UnitOfWork;
using MediatR;

namespace DigiTransac.Api.Services.Transactions;

/// <summary>
/// Handles internal account-to-account transfers.
/// Creates linked Send (source) and Receive (destination) transactions.
/// Uses Unit of Work pattern for atomic operations.
/// Publishes domain events for decoupled side effects.
/// </summary>
public class TransferService : ITransferService
{
    private readonly ITransactionRepository _transactionRepository;
    private readonly IAccountRepository _accountRepository;
    private readonly ILabelRepository _labelRepository;
    private readonly IChatMessageRepository _chatMessageRepository;
    private readonly IExchangeRateService _exchangeRateService;
    private readonly IAccountBalanceService _accountBalanceService;
    private readonly ITransactionMapperService _mapperService;
    private readonly IMongoDbService _mongoDbService;
    private readonly IPublisher _publisher;

    public TransferService(
        ITransactionRepository transactionRepository,
        IAccountRepository accountRepository,
        ILabelRepository labelRepository,
        IChatMessageRepository chatMessageRepository,
        IExchangeRateService exchangeRateService,
        IAccountBalanceService accountBalanceService,
        ITransactionMapperService mapperService,
        IMongoDbService mongoDbService,
        IPublisher publisher)
    {
        _transactionRepository = transactionRepository;
        _accountRepository = accountRepository;
        _labelRepository = labelRepository;
        _chatMessageRepository = chatMessageRepository;
        _exchangeRateService = exchangeRateService;
        _accountBalanceService = accountBalanceService;
        _mapperService = mapperService;
        _mongoDbService = mongoDbService;
        _publisher = publisher;
    }

    public async Task<(bool Success, string Message, TransactionResponse? Transaction)> CreateTransferAsync(
        string userId,
        CreateTransactionRequest request,
        Account sourceAccount,
        Account destinationAccount,
        byte[] dek,
        CancellationToken ct = default)
    {
        // Convert amount if currencies differ
        decimal convertedAmount = request.Amount;
        if (!sourceAccount.Currency.Equals(destinationAccount.Currency, StringComparison.OrdinalIgnoreCase))
        {
            var ratesResponse = await _exchangeRateService.GetRatesAsync();
            convertedAmount = _exchangeRateService.Convert(
                request.Amount,
                sourceAccount.Currency,
                destinationAccount.Currency,
                ratesResponse.Rates);
        }

        // Find the "Account Transfer" category - transfers are locked to this category
        var labels = await _labelRepository.GetByUserIdAsync(userId);
        var accountTransferLabel = labels.FirstOrDefault(l =>
            l.Type == LabelType.Category && l.Name == "Account Transfer");

        // Generate TransactionLinkId for linking source and destination
        var transactionLinkId = Guid.NewGuid();

        // Create splits with appropriate amounts
        var sourceSplits = accountTransferLabel != null
            ? new List<TransactionSplit> { new() { LabelId = accountTransferLabel.Id, Amount = request.Amount, Notes = null } }
            : request.Splits.Select(s => new TransactionSplit { LabelId = s.LabelId, Amount = s.Amount, Notes = s.Notes }).ToList();

        var destSplits = accountTransferLabel != null
            ? new List<TransactionSplit> { new() { LabelId = accountTransferLabel.Id, Amount = convertedAmount, Notes = null } }
            : request.Splits.Select(s => new TransactionSplit { LabelId = s.LabelId, Amount = convertedAmount, Notes = s.Notes }).ToList();

        // Use the request's Date (already UTC from frontend)
        var derivedDate = request.Date;

        // Create source transaction (Send)
        var sourceTransaction = new Transaction
        {
            UserId = userId,
            AccountId = sourceAccount.Id,
            Type = TransactionType.Send,
            Amount = request.Amount,
            Currency = sourceAccount.Currency,
            Date = derivedDate,
            Title = request.Title,
            EncryptedPayee = _mapperService.EncryptIfNotEmpty(request.Payee, dek),
            EncryptedNotes = _mapperService.EncryptIfNotEmpty(request.Notes, dek),
            Splits = sourceSplits,
            TagIds = request.TagIds ?? new List<string>(),
            TransferToAccountId = destinationAccount.Id,
            Status = TransactionStatus.Confirmed,
            TransactionLinkId = transactionLinkId,
            CounterpartyUserId = userId, // Self-transfer
            Source = TransactionSource.Transfer
        };

        // Handle location
        if (request.Location != null)
        {
            sourceTransaction.Location = new TransactionLocation
            {
                Latitude = request.Location.Latitude,
                EncryptedLongitude = _mapperService.EncryptIfNotEmpty(request.Location.Longitude.ToString(), dek),
                EncryptedPlaceName = _mapperService.EncryptIfNotEmpty(request.Location.PlaceName, dek),
                City = request.Location.City,
                Country = request.Location.Country
            };
        }

        // Create destination transaction (Receive)
        var destTransaction = new Transaction
        {
            UserId = userId,
            AccountId = destinationAccount.Id,
            Type = TransactionType.Receive,
            Amount = convertedAmount,
            Currency = destinationAccount.Currency,
            Date = derivedDate,
            Title = request.Title,
            EncryptedPayee = _mapperService.EncryptIfNotEmpty(request.Payee, dek),
            EncryptedNotes = _mapperService.EncryptIfNotEmpty(request.Notes, dek),
            Splits = destSplits,
            TagIds = sourceTransaction.TagIds,
            TransferToAccountId = sourceAccount.Id, // Reference back to source
            Status = TransactionStatus.Confirmed,
            TransactionLinkId = transactionLinkId,
            CounterpartyUserId = userId, // Self-transfer
            Source = TransactionSource.Transfer
        };

        // Execute all operations atomically within a transaction
        await using var unitOfWork = new Services.UnitOfWork.UnitOfWork(_mongoDbService);
        await unitOfWork.ExecuteInTransactionAsync(async session =>
        {
            // Create source transaction
            await _transactionRepository.CreateAsync(sourceTransaction, session);
            
            // Update source account balance
            await _accountBalanceService.UpdateBalanceAsync(sourceAccount, TransactionType.Send, request.Amount, true, session);
            
            // Link destination to source (we now have source ID)
            destTransaction.LinkedTransactionId = sourceTransaction.Id;
            
            // Create destination transaction
            await _transactionRepository.CreateAsync(destTransaction, session);
            
            // Link source to destination
            sourceTransaction.LinkedTransactionId = destTransaction.Id;
            await _transactionRepository.UpdateAsync(sourceTransaction, session);
            
            // Update destination account balance
            await _accountBalanceService.UpdateBalanceAsync(destinationAccount, TransactionType.Receive, convertedAmount, true, session);
        });

        // Create chat messages for Personal chat (self-chat) so both Send and Receive appear in conversation
        // Send transaction: user-initiated, appears on the right (not system-generated)
        var sendChatMessage = new ChatMessage
        {
            SenderUserId = userId,
            RecipientUserId = userId, // Self-chat for transfers
            Type = ChatMessageType.Transaction,
            TransactionId = sourceTransaction.Id,
            Status = MessageStatus.Sent,
            IsSystemGenerated = false, // User-initiated, appears on the right
            SystemSource = SystemMessageSources.Transfer,
            CreatedAt = DateTime.UtcNow
        };

        await _chatMessageRepository.CreateAsync(sendChatMessage);
        
        // Receive transaction: system-generated response, appears on the left
        var receiveChatMessage = new ChatMessage
        {
            SenderUserId = userId,
            RecipientUserId = userId, // Self-chat for transfers
            Type = ChatMessageType.Transaction,
            TransactionId = destTransaction.Id,
            Status = MessageStatus.Sent,
            IsSystemGenerated = true, // System-generated, appears on the left
            SystemSource = SystemMessageSources.Transfer,
            CreatedAt = DateTime.UtcNow.AddMilliseconds(1) // Slightly after Send to ensure correct ordering
        };

        await _chatMessageRepository.CreateAsync(receiveChatMessage);
        
        // Link chat messages to transactions
        sourceTransaction.ChatMessageId = sendChatMessage.Id;
        destTransaction.ChatMessageId = receiveChatMessage.Id;
        await _transactionRepository.UpdateAsync(sourceTransaction);
        await _transactionRepository.UpdateAsync(destTransaction);

        // Publish TransferCompletedEvent
        await _publisher.Publish(new TransferCompletedEvent(
            sourceTransaction.Id,
            destTransaction.Id,
            userId,
            sourceAccount.Id,
            destinationAccount.Id,
            request.Amount,
            convertedAmount,
            sourceAccount.Currency,
            destinationAccount.Currency
        ));

        // Map to response (outside transaction - read-only)
        var accounts = await _accountRepository.GetByUserIdAsync(userId, true);
        var tags = new Dictionary<string, Tag>();
        
        return (true, "Transfer created successfully",
            _mapperService.MapToResponse(
                sourceTransaction,
                dek,
                accounts.ToDictionary(a => a.Id),
                labels.ToDictionary(l => l.Id),
                tags,
                null));
    }

    public async Task<(bool Success, string Message)> SyncLinkedTransactionAsync(
        Transaction transaction,
        UpdateTransactionRequest request,
        string userId,
        byte[] dek,
        CancellationToken ct = default)
    {
        if (string.IsNullOrEmpty(transaction.LinkedTransactionId))
            return (true, "No linked transaction to sync");

        var linkedTransaction = await _transactionRepository.GetByIdAndUserIdAsync(
            transaction.LinkedTransactionId, userId);
        
        if (linkedTransaction == null)
            return (true, "Linked transaction not found");

        var linkedNeedsUpdate = false;
        var linkedOldAmount = linkedTransaction.Amount;

        // Always sync these fields
        if (request.Date.HasValue && linkedTransaction.Date != transaction.Date)
        {
            linkedTransaction.Date = transaction.Date;
            linkedNeedsUpdate = true;
        }
        if (request.Title != null && linkedTransaction.Title != transaction.Title)
        {
            linkedTransaction.Title = transaction.Title;
            linkedNeedsUpdate = true;
        }
        if (request.Payee != null)
        {
            linkedTransaction.EncryptedPayee = transaction.EncryptedPayee;
            linkedNeedsUpdate = true;
        }
        if (request.Notes != null)
        {
            linkedTransaction.EncryptedNotes = transaction.EncryptedNotes;
            linkedNeedsUpdate = true;
        }
        if (request.TagIds != null)
        {
            linkedTransaction.TagIds = transaction.TagIds;
            linkedNeedsUpdate = true;
        }
        if (!string.IsNullOrEmpty(request.Status) && linkedTransaction.Status != transaction.Status)
        {
            linkedTransaction.Status = transaction.Status;
            linkedNeedsUpdate = true;
        }

        // Handle amount sync based on currency and which side is being edited
        if (request.Amount.HasValue)
        {
            var isSameCurrency = transaction.Currency.Equals(
                linkedTransaction.Currency, StringComparison.OrdinalIgnoreCase);
            var isSourceSide = transaction.Type == TransactionType.Send;

            if (isSameCurrency)
            {
                // Same currency: always sync amount
                linkedTransaction.Amount = transaction.Amount;
                if (linkedTransaction.Splits.Count > 0)
                {
                    linkedTransaction.Splits[0].Amount = transaction.Amount;
                }
                linkedNeedsUpdate = true;
            }
            else if (isSourceSide)
            {
                // Different currencies AND editing source: recalculate destination
                var ratesResponse = await _exchangeRateService.GetRatesAsync();
                var convertedAmount = _exchangeRateService.Convert(
                    transaction.Amount,
                    transaction.Currency,
                    linkedTransaction.Currency,
                    ratesResponse.Rates);
                linkedTransaction.Amount = convertedAmount;
                if (linkedTransaction.Splits.Count > 0)
                {
                    linkedTransaction.Splits[0].Amount = convertedAmount;
                }
                linkedNeedsUpdate = true;
            }
            // If editing destination side with different currencies: DON'T update source
        }

        if (linkedNeedsUpdate)
        {
            // If amount changed, we need to update both the transaction and balance atomically
            if (linkedTransaction.Amount != linkedOldAmount)
            {
                var linkedAccount = await _accountRepository.GetByIdAndUserIdAsync(
                    linkedTransaction.AccountId!, userId);
                
                if (linkedAccount != null)
                {
                    // Execute updates atomically
                    await using var unitOfWork = new Services.UnitOfWork.UnitOfWork(_mongoDbService);
                    await unitOfWork.ExecuteInTransactionAsync(async session =>
                    {
                        await _transactionRepository.UpdateAsync(linkedTransaction, session);
                        await _accountBalanceService.UpdateBalanceAsync(
                            linkedAccount, linkedTransaction.Type, linkedOldAmount, false, session);
                        await _accountBalanceService.UpdateBalanceAsync(
                            linkedAccount, linkedTransaction.Type, linkedTransaction.Amount, true, session);
                    });
                }
                else
                {
                    await _transactionRepository.UpdateAsync(linkedTransaction);
                }
            }
            else
            {
                await _transactionRepository.UpdateAsync(linkedTransaction);
            }
        }

        return (true, "Linked transaction synced");
    }

    public async Task<(bool Success, string Message)> DeleteTransferAsync(
        string userId,
        Transaction transaction,
        CancellationToken ct = default)
    {
        if (string.IsNullOrEmpty(transaction.LinkedTransactionId))
            return (true, "No linked transaction to delete");

        var linkedTransaction = await _transactionRepository.GetByIdAndUserIdAsync(
            transaction.LinkedTransactionId, userId);

        if (linkedTransaction != null)
        {
            var linkedAccount = await _accountRepository.GetByIdAndUserIdAsync(
                linkedTransaction.AccountId!, userId);
            
            if (linkedAccount != null)
            {
                // Execute soft-delete and balance update atomically
                await using var unitOfWork = new Services.UnitOfWork.UnitOfWork(_mongoDbService);
                await unitOfWork.ExecuteInTransactionAsync(async session =>
                {
                    await _accountBalanceService.UpdateBalanceAsync(
                        linkedAccount, linkedTransaction.Type, linkedTransaction.Amount, false, session);
                    await _transactionRepository.SoftDeleteAsync(linkedTransaction.Id, userId, session);
                });
            }
            else
            {
                await _transactionRepository.SoftDeleteAsync(linkedTransaction.Id, userId);
            }
        }

        return (true, "Linked transaction deleted");
    }
}