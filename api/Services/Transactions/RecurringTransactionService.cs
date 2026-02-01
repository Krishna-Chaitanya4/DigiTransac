using DigiTransac.Api.Events;
using DigiTransac.Api.Models;
using DigiTransac.Api.Models.Dto;
using DigiTransac.Api.Repositories;
using MediatR;

namespace DigiTransac.Api.Services.Transactions;

/// <summary>
/// Handles recurring transaction templates and processing.
/// Manages recurring rules, creates instances, and background processing.
/// Publishes domain events for decoupled side effects.
/// </summary>
public class RecurringTransactionService : IRecurringTransactionService
{
    private readonly ITransactionRepository _transactionRepository;
    private readonly IAccountRepository _accountRepository;
    private readonly ILabelRepository _labelRepository;
    private readonly IChatMessageRepository _chatMessageRepository;
    private readonly IAccountBalanceService _accountBalanceService;
    private readonly ITransactionMapperService _mapperService;
    private readonly IPublisher _publisher;
    private readonly ILogger<RecurringTransactionService> _logger;

    public RecurringTransactionService(
        ITransactionRepository transactionRepository,
        IAccountRepository accountRepository,
        ILabelRepository labelRepository,
        IChatMessageRepository chatMessageRepository,
        IAccountBalanceService accountBalanceService,
        ITransactionMapperService mapperService,
        IPublisher publisher,
        ILogger<RecurringTransactionService> logger)
    {
        _transactionRepository = transactionRepository;
        _accountRepository = accountRepository;
        _labelRepository = labelRepository;
        _chatMessageRepository = chatMessageRepository;
        _accountBalanceService = accountBalanceService;
        _mapperService = mapperService;
        _publisher = publisher;
        _logger = logger;
    }

    public async Task<List<RecurringTransactionResponse>> GetRecurringAsync(string userId)
    {
        var templates = await _transactionRepository.GetRecurringTemplatesAsync(userId);
        var dek = await _mapperService.GetUserDekAsync(userId);
        var accounts = await _accountRepository.GetByUserIdAsync(userId, true);
        var labels = await _labelRepository.GetByUserIdAsync(userId);

        return templates.Select(t => _mapperService.MapToRecurringResponse(
            t, dek, accounts.ToDictionary(a => a.Id), labels.ToDictionary(l => l.Id)
        )).ToList();
    }

    public async Task<(bool Success, string Message, Transaction? Template, Transaction? FirstInstance)> CreateRecurringTemplateAsync(
        string userId,
        CreateTransactionRequest request,
        Account account,
        byte[] dek)
    {
        if (request.RecurringRule == null)
            return (false, "Recurring rule is required", null, null);

        if (!Enum.TryParse<RecurrenceFrequency>(request.RecurringRule.Frequency, true, out var frequency))
            return (false, "Invalid recurrence frequency", null, null);

        if (!Enum.TryParse<TransactionType>(request.Type, true, out var type))
            return (false, "Invalid transaction type", null, null);

        // Create splits
        var splits = request.Splits.Select(s => new TransactionSplit
        {
            LabelId = s.LabelId,
            Amount = s.Amount,
            Notes = s.Notes
        }).ToList();

        // Derive Date (UTC) from DateLocal + TimeLocal + DateTimezone
        // This ensures Date is always consistent with local fields - no independent edits allowed
        var (derivedDate, dateLocal, timeLocal, dateTimezone) = DateTimeHelper.NormalizeDateTimeFields(
            request.Date, request.DateLocal, request.TimeLocal, request.DateTimezone);

        // Create template
        var template = new Transaction
        {
            UserId = userId,
            AccountId = account.Id,
            Type = type,
            Amount = request.Amount,
            Currency = account.Currency,
            Date = derivedDate,
            // Timezone-aware date fields (source of truth for Date)
            DateLocal = dateLocal,
            TimeLocal = timeLocal,
            DateTimezone = dateTimezone,
            Title = request.Title,
            EncryptedPayee = _mapperService.EncryptIfNotEmpty(request.Payee, dek),
            EncryptedNotes = _mapperService.EncryptIfNotEmpty(request.Notes, dek),
            Splits = splits,
            TagIds = request.TagIds ?? new List<string>(),
            IsRecurringTemplate = true,
            RecurringRule = new RecurringRule
            {
                Frequency = frequency,
                Interval = request.RecurringRule.Interval ?? 1,
                EndDate = request.RecurringRule.EndDate,
                NextOccurrence = request.Date,
                LastProcessed = DateTime.UtcNow
            },
            TransferToAccountId = request.TransferToAccountId,
            Status = TransactionStatus.Confirmed
        };

        // Handle location
        if (request.Location != null)
        {
            template.Location = new TransactionLocation
            {
                Latitude = request.Location.Latitude,
                EncryptedLongitude = _mapperService.EncryptIfNotEmpty(request.Location.Longitude.ToString(), dek),
                EncryptedPlaceName = _mapperService.EncryptIfNotEmpty(request.Location.PlaceName, dek),
                City = request.Location.City,
                Country = request.Location.Country
            };
        }

        await _transactionRepository.CreateAsync(template);

        // Create the first instance immediately
        var firstInstance = new Transaction
        {
            UserId = userId,
            AccountId = account.Id,
            Type = type,
            Amount = request.Amount,
            Currency = account.Currency,
            Date = derivedDate,
            // Timezone-aware date fields (source of truth for Date)
            DateLocal = dateLocal,
            TimeLocal = timeLocal,
            DateTimezone = dateTimezone,
            Title = request.Title,
            EncryptedPayee = template.EncryptedPayee,
            EncryptedNotes = template.EncryptedNotes,
            Splits = template.Splits,
            TagIds = template.TagIds,
            Location = template.Location,
            ParentTransactionId = template.Id,
            IsRecurringTemplate = false,
            Status = TransactionStatus.Confirmed,
            Source = TransactionSource.Recurring
        };

        await _transactionRepository.CreateAsync(firstInstance);
        await _accountBalanceService.UpdateBalanceAsync(account, type, request.Amount, true);

        // Create chat message for first instance
        var chatMessage = new ChatMessage
        {
            SenderUserId = userId,
            RecipientUserId = userId, // Self-chat for recurring
            Type = ChatMessageType.Transaction,
            TransactionId = firstInstance.Id,
            Status = MessageStatus.Sent,
            CreatedAt = DateTime.UtcNow
        };

        await _chatMessageRepository.CreateAsync(chatMessage);
        firstInstance.ChatMessageId = chatMessage.Id;
        await _transactionRepository.UpdateAsync(firstInstance);

        // Update NextOccurrence to the next date
        template.RecurringRule!.NextOccurrence = CalculateNextOccurrence(template.RecurringRule);
        await _transactionRepository.UpdateAsync(template);

        // Publish RecurringTemplateCreatedEvent
        await _publisher.Publish(new RecurringTemplateCreatedEvent(
            template.Id,
            userId,
            account.Id,
            template.RecurringRule.Frequency,
            request.Date
        ));

        return (true, "Recurring transaction created", template, firstInstance);
    }

    public async Task<(bool Success, string Message)> DeleteRecurringAsync(
        string id,
        string userId,
        bool deleteFutureInstances)
    {
        var template = await _transactionRepository.GetByIdAndUserIdAsync(id, userId);
        if (template == null || !template.IsRecurringTemplate)
            return (false, "Recurring transaction not found");

        await _transactionRepository.DeleteAsync(id, userId);

        if (deleteFutureInstances)
        {
            // Delete future instances (transactions with parentTransactionId = this id and date >= today)
            var filter = new TransactionFilterRequest(
                DateTime.UtcNow.Date, null, null, null, null, null, null, null, null, null, null, 1, int.MaxValue);
            var (transactions, _) = await _transactionRepository.GetFilteredAsync(userId, filter);

            foreach (var transaction in transactions.Where(t => t.ParentTransactionId == id))
            {
                var account = await _accountRepository.GetByIdAndUserIdAsync(transaction.AccountId!, userId);
                if (account != null)
                {
                    await _accountBalanceService.UpdateBalanceAsync(
                        account, transaction.Type, transaction.Amount, false);
                }
                await _transactionRepository.DeleteAsync(transaction.Id, userId);
            }
        }

        return (true, "Recurring transaction deleted successfully");
    }

    public async Task ProcessRecurringTransactionsAsync()
    {
        var pendingTemplates = await _transactionRepository.GetPendingRecurringAsync(DateTime.UtcNow);

        foreach (var template in pendingTemplates)
        {
            try
            {
                var account = await _accountRepository.GetByIdAsync(template.AccountId!);
                if (account == null) continue;

                // For recurring instances, derive Date from NextOccurrence + template's timezone
                var nextOccurrence = template.RecurringRule!.NextOccurrence;
                var recurringDateLocal = nextOccurrence.ToString("yyyy-MM-dd");
                var recurringTimeLocal = template.TimeLocal ?? "12:00";
                var recurringTimezone = template.DateTimezone ?? TimeZoneInfo.Local.Id;
                var recurringDerivedDate = DateTimeHelper.DeriveUtcDate(
                    recurringDateLocal, recurringTimeLocal, recurringTimezone, nextOccurrence);

                var newTransaction = new Transaction
                {
                    UserId = template.UserId,
                    AccountId = template.AccountId,
                    Type = template.Type,
                    Amount = template.Amount,
                    Currency = template.Currency,
                    Date = recurringDerivedDate,
                    // Timezone-aware date fields (source of truth for Date)
                    DateLocal = recurringDateLocal,
                    TimeLocal = recurringTimeLocal,
                    DateTimezone = recurringTimezone,
                    Title = template.Title,
                    EncryptedPayee = template.EncryptedPayee,
                    EncryptedNotes = template.EncryptedNotes,
                    Splits = template.Splits,
                    TagIds = template.TagIds,
                    Location = template.Location,
                    ParentTransactionId = template.Id,
                    Source = TransactionSource.Recurring
                };

                await _transactionRepository.CreateAsync(newTransaction);
                await _accountBalanceService.UpdateBalanceAsync(account, newTransaction.Type, newTransaction.Amount, true);

                // Create a chat message for this recurring instance
                var recurringChatMessage = new ChatMessage
                {
                    SenderUserId = template.UserId,
                    RecipientUserId = template.UserId,
                    Type = ChatMessageType.Transaction,
                    TransactionId = newTransaction.Id,
                    Status = MessageStatus.Sent,
                    CreatedAt = DateTime.UtcNow
                };

                await _chatMessageRepository.CreateAsync(recurringChatMessage);
                newTransaction.ChatMessageId = recurringChatMessage.Id;
                await _transactionRepository.UpdateAsync(newTransaction);

                // Handle transfer linked transaction
                if (!string.IsNullOrEmpty(template.TransferToAccountId))
                {
                    var transferToAccount = await _accountRepository.GetByIdAsync(template.TransferToAccountId);
                    if (transferToAccount != null)
                    {
                        var linkedTransaction = new Transaction
                        {
                            UserId = template.UserId,
                            AccountId = transferToAccount.Id,
                            Type = TransactionType.Receive,
                            Amount = template.Amount,
                            Currency = transferToAccount.Currency,
                            Date = recurringDerivedDate,
                            // Timezone-aware date fields (source of truth for Date)
                            DateLocal = recurringDateLocal,
                            TimeLocal = recurringTimeLocal,
                            DateTimezone = recurringTimezone,
                            Title = template.Title,
                            EncryptedPayee = template.EncryptedPayee,
                            EncryptedNotes = template.EncryptedNotes,
                            Splits = template.Splits,
                            TagIds = template.TagIds,
                            LinkedTransactionId = newTransaction.Id,
                            ParentTransactionId = template.Id,
                            Source = TransactionSource.Recurring
                        };

                        await _transactionRepository.CreateAsync(linkedTransaction);
                        newTransaction.LinkedTransactionId = linkedTransaction.Id;
                        await _transactionRepository.UpdateAsync(newTransaction);
                        await _accountBalanceService.UpdateBalanceAsync(
                            transferToAccount, TransactionType.Receive, template.Amount, true);
                    }
                }

                // Update next occurrence
                template.RecurringRule.LastProcessed = DateTime.UtcNow;
                template.RecurringRule.NextOccurrence = CalculateNextOccurrence(template.RecurringRule);
                await _transactionRepository.UpdateAsync(template);

                // Publish RecurringTransactionGeneratedEvent
                await _publisher.Publish(new RecurringTransactionGeneratedEvent(
                    newTransaction.Id,
                    template.Id,
                    template.UserId,
                    template.AccountId!,
                    template.Amount,
                    template.RecurringRule.NextOccurrence
                ));

                _logger.LogInformation(
                    "Processed recurring transaction {TemplateId} for user {UserId}",
                    template.Id, template.UserId);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, 
                    "Error processing recurring transaction {TemplateId}", template.Id);
            }
        }
    }

    public DateTime CalculateNextOccurrence(RecurringRule rule)
    {
        var current = rule.NextOccurrence;
        var interval = rule.Interval;

        return rule.Frequency switch
        {
            RecurrenceFrequency.Daily => current.AddDays(interval),
            RecurrenceFrequency.Weekly => current.AddDays(7 * interval),
            RecurrenceFrequency.Biweekly => current.AddDays(14 * interval),
            RecurrenceFrequency.Monthly => current.AddMonths(interval),
            RecurrenceFrequency.Quarterly => current.AddMonths(3 * interval),
            RecurrenceFrequency.Yearly => current.AddYears(interval),
            _ => current.AddMonths(1)
        };
    }
}