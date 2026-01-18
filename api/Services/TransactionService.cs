using DigiTransac.Api.Models;
using DigiTransac.Api.Models.Dto;
using DigiTransac.Api.Repositories;

namespace DigiTransac.Api.Services;

public interface ITransactionService
{
    Task<TransactionListResponse> GetAllAsync(string userId, TransactionFilterRequest filter);
    Task<TransactionResponse?> GetByIdAsync(string id, string userId);
    Task<TransactionSummaryResponse> GetSummaryAsync(string userId, DateTime? startDate, DateTime? endDate, string? accountId);
    Task<List<RecurringTransactionResponse>> GetRecurringAsync(string userId);
    Task<(bool Success, string Message, TransactionResponse? Transaction)> CreateAsync(string userId, CreateTransactionRequest request);
    Task<(bool Success, string Message, TransactionResponse? Transaction)> UpdateAsync(string id, string userId, UpdateTransactionRequest request);
    Task<(bool Success, string Message)> DeleteAsync(string id, string userId);
    Task<(bool Success, string Message)> DeleteRecurringAsync(string id, string userId, bool deleteFutureInstances);
    Task ProcessRecurringTransactionsAsync();
}

public class TransactionService : ITransactionService
{
    private readonly ITransactionRepository _transactionRepository;
    private readonly IAccountRepository _accountRepository;
    private readonly ILabelRepository _labelRepository;
    private readonly IUserRepository _userRepository;
    private readonly IKeyManagementService _keyManagementService;
    private readonly IDekCacheService _dekCacheService;
    private readonly IEncryptionService _encryptionService;

    public TransactionService(
        ITransactionRepository transactionRepository,
        IAccountRepository accountRepository,
        ILabelRepository labelRepository,
        IUserRepository userRepository,
        IKeyManagementService keyManagementService,
        IDekCacheService dekCacheService,
        IEncryptionService encryptionService)
    {
        _transactionRepository = transactionRepository;
        _accountRepository = accountRepository;
        _labelRepository = labelRepository;
        _userRepository = userRepository;
        _keyManagementService = keyManagementService;
        _dekCacheService = dekCacheService;
        _encryptionService = encryptionService;
    }

    private async Task<byte[]?> GetUserDekAsync(string userId)
    {
        var cachedDek = _dekCacheService.GetDek(userId);
        if (cachedDek != null) return cachedDek;

        var user = await _userRepository.GetByIdAsync(userId);
        if (user?.WrappedDek == null) return null;

        var dek = await _keyManagementService.UnwrapKeyAsync(user.WrappedDek);
        _dekCacheService.SetDek(userId, dek);
        return dek;
    }

    private string? EncryptIfNotEmpty(string? value, byte[] dek)
    {
        if (string.IsNullOrEmpty(value)) return value;
        return _encryptionService.Encrypt(value, dek);
    }

    private string? DecryptIfNotEmpty(string? value, byte[] dek)
    {
        if (string.IsNullOrEmpty(value)) return value;
        try { return _encryptionService.Decrypt(value, dek); }
        catch { return value; }
    }

    public async Task<TransactionListResponse> GetAllAsync(string userId, TransactionFilterRequest filter)
    {
        var (transactions, totalCount) = await _transactionRepository.GetFilteredAsync(userId, filter);
        var dek = await GetUserDekAsync(userId);
        
        // Get accounts and labels for mapping
        var accounts = await _accountRepository.GetByUserIdAsync(userId, true);
        var labels = await _labelRepository.GetByUserIdAsync(userId);

        var accountDict = accounts.ToDictionary(a => a.Id);
        var labelDict = labels.ToDictionary(l => l.Id);

        var page = filter.Page ?? 1;
        var pageSize = filter.PageSize ?? 50;
        var totalPages = (int)Math.Ceiling((double)totalCount / pageSize);

        var responses = transactions.Select(t => MapToResponse(t, dek, accountDict, labelDict)).ToList();

        return new TransactionListResponse(responses, totalCount, page, pageSize, totalPages);
    }

    public async Task<TransactionResponse?> GetByIdAsync(string id, string userId)
    {
        var transaction = await _transactionRepository.GetByIdAndUserIdAsync(id, userId);
        if (transaction == null) return null;

        var dek = await GetUserDekAsync(userId);
        var accounts = await _accountRepository.GetByUserIdAsync(userId, true);
        var labels = await _labelRepository.GetByUserIdAsync(userId);

        return MapToResponse(transaction, dek, accounts.ToDictionary(a => a.Id), labels.ToDictionary(l => l.Id));
    }

    public async Task<TransactionSummaryResponse> GetSummaryAsync(
        string userId, 
        DateTime? startDate, 
        DateTime? endDate, 
        string? accountId)
    {
        var filter = new TransactionFilterRequest(
            startDate, endDate, accountId, null, null, null, null, null, null, null, null, 1, int.MaxValue);

        var (transactions, _) = await _transactionRepository.GetFilteredAsync(userId, filter);
        
        var user = await _userRepository.GetByIdAsync(userId);
        var primaryCurrency = user?.PrimaryCurrency ?? "USD";

        var totalCredits = transactions.Where(t => t.Type == TransactionType.Credit).Sum(t => t.Amount);
        var totalDebits = transactions.Where(t => t.Type == TransactionType.Debit).Sum(t => t.Amount);

        // Get sums by label
        var byCategory = await _transactionRepository.GetSumByLabelAsync(userId, startDate, endDate);
        var byTag = await _transactionRepository.GetSumByTagAsync(userId, startDate, endDate);

        return new TransactionSummaryResponse(
            totalCredits,
            totalDebits,
            totalCredits - totalDebits,
            transactions.Count,
            byCategory,
            byTag,
            primaryCurrency);
    }

    public async Task<List<RecurringTransactionResponse>> GetRecurringAsync(string userId)
    {
        var templates = await _transactionRepository.GetRecurringTemplatesAsync(userId);
        var dek = await GetUserDekAsync(userId);
        var accounts = await _accountRepository.GetByUserIdAsync(userId, true);
        var labels = await _labelRepository.GetByUserIdAsync(userId);

        var accountDict = accounts.ToDictionary(a => a.Id);
        var labelDict = labels.ToDictionary(l => l.Id);

        return templates.Select(t => MapToRecurringResponse(t, dek, accountDict, labelDict)).ToList();
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
            return (false, "Invalid transaction type. Use Credit, Debit, or Transfer", null);

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

        // Validate transfer
        Account? transferToAccount = null;
        if (type == TransactionType.Transfer)
        {
            if (string.IsNullOrEmpty(request.TransferToAccountId))
                return (false, "Transfer requires a destination account", null);

            transferToAccount = await _accountRepository.GetByIdAndUserIdAsync(request.TransferToAccountId, userId);
            if (transferToAccount == null)
                return (false, "Destination account not found", null);

            if (request.TransferToAccountId == request.AccountId)
                return (false, "Cannot transfer to the same account", null);
        }

        var dek = await GetUserDekAsync(userId);
        if (dek == null)
            return (false, "Encryption key not available", null);

        // Build transaction
        var transaction = new Transaction
        {
            UserId = userId,
            AccountId = request.AccountId,
            Type = type,
            Amount = request.Amount,
            Currency = account.Currency,
            Date = request.Date,
            Title = request.Title,
            EncryptedPayee = EncryptIfNotEmpty(request.Payee, dek),
            EncryptedNotes = EncryptIfNotEmpty(request.Notes, dek),
            Splits = request.Splits.Select(s => new TransactionSplit
            {
                LabelId = s.LabelId,
                Amount = s.Amount,
                Notes = s.Notes
            }).ToList(),
            TagIds = request.TagIds ?? new List<string>(),
            TransferToAccountId = request.TransferToAccountId
        };

        // Handle location
        if (request.Location != null)
        {
            transaction.Location = new TransactionLocation
            {
                Latitude = request.Location.Latitude,
                EncryptedLongitude = EncryptIfNotEmpty(request.Location.Longitude.ToString(), dek),
                EncryptedPlaceName = EncryptIfNotEmpty(request.Location.PlaceName, dek),
                City = request.Location.City,
                Country = request.Location.Country
            };
        }

        // Handle recurring
        if (request.RecurringRule != null)
        {
            if (!Enum.TryParse<RecurrenceFrequency>(request.RecurringRule.Frequency, true, out var frequency))
                return (false, "Invalid recurrence frequency", null);

            transaction.IsRecurringTemplate = true;
            transaction.RecurringRule = new RecurringRule
            {
                Frequency = frequency,
                Interval = request.RecurringRule.Interval ?? 1,
                EndDate = request.RecurringRule.EndDate,
                NextOccurrence = request.Date
            };
        }

        await _transactionRepository.CreateAsync(transaction);

        // Update account balance (unless it's a recurring template)
        if (!transaction.IsRecurringTemplate)
        {
            await UpdateAccountBalanceAsync(account, type, request.Amount, true);
        }

        // Handle transfer - create linked transaction
        if (type == TransactionType.Transfer && transferToAccount != null && !transaction.IsRecurringTemplate)
        {
            var linkedTransaction = new Transaction
            {
                UserId = userId,
                AccountId = transferToAccount.Id,
                Type = TransactionType.Credit,
                Amount = request.Amount,
                Currency = transferToAccount.Currency,
                Date = request.Date,
                Title = request.Title,
                EncryptedPayee = EncryptIfNotEmpty(request.Payee, dek),
                EncryptedNotes = EncryptIfNotEmpty(request.Notes, dek),
                Splits = transaction.Splits,
                TagIds = transaction.TagIds,
                LinkedTransactionId = transaction.Id
            };

            await _transactionRepository.CreateAsync(linkedTransaction);
            
            transaction.LinkedTransactionId = linkedTransaction.Id;
            await _transactionRepository.UpdateAsync(transaction);

            await UpdateAccountBalanceAsync(transferToAccount, TransactionType.Credit, request.Amount, true);
        }

        var accounts = await _accountRepository.GetByUserIdAsync(userId, true);
        var labelsDict = labels.ToDictionary(l => l.Id);
        var response = MapToResponse(transaction, dek, accounts.ToDictionary(a => a.Id), labelsDict);

        return (true, "Transaction created successfully", response);
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

        var account = await _accountRepository.GetByIdAndUserIdAsync(transaction.AccountId, userId);
        if (account == null)
            return (false, "Account not found", null);

        var dek = await GetUserDekAsync(userId);
        if (dek == null)
            return (false, "Encryption key not available", null);

        // Store old values for balance adjustment
        var oldType = transaction.Type;
        var oldAmount = transaction.Amount;

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
            transaction.EncryptedPayee = EncryptIfNotEmpty(request.Payee, dek);

        if (request.Notes != null)
            transaction.EncryptedNotes = EncryptIfNotEmpty(request.Notes, dek);

        if (request.IsCleared.HasValue)
            transaction.IsCleared = request.IsCleared.Value;

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
                EncryptedLongitude = EncryptIfNotEmpty(request.Location.Longitude.ToString(), dek),
                EncryptedPlaceName = EncryptIfNotEmpty(request.Location.PlaceName, dek),
                City = request.Location.City,
                Country = request.Location.Country
            };
        }

        await _transactionRepository.UpdateAsync(transaction);

        // Adjust balance if amount or type changed
        if (oldType != transaction.Type || oldAmount != transaction.Amount)
        {
            await UpdateAccountBalanceAsync(account, oldType, oldAmount, false);
            await UpdateAccountBalanceAsync(account, transaction.Type, transaction.Amount, true);
        }

        var accounts = await _accountRepository.GetByUserIdAsync(userId, true);
        var labels = await _labelRepository.GetByUserIdAsync(userId);
        var response = MapToResponse(transaction, dek, accounts.ToDictionary(a => a.Id), labels.ToDictionary(l => l.Id));

        return (true, "Transaction updated successfully", response);
    }

    public async Task<(bool Success, string Message)> DeleteAsync(string id, string userId)
    {
        var transaction = await _transactionRepository.GetByIdAndUserIdAsync(id, userId);
        if (transaction == null)
            return (false, "Transaction not found");

        // Reverse balance change
        if (!transaction.IsRecurringTemplate)
        {
            var account = await _accountRepository.GetByIdAndUserIdAsync(transaction.AccountId, userId);
            if (account != null)
            {
                await UpdateAccountBalanceAsync(account, transaction.Type, transaction.Amount, false);
            }

            // Delete linked transaction for transfers
            if (!string.IsNullOrEmpty(transaction.LinkedTransactionId))
            {
                var linkedTransaction = await _transactionRepository.GetByIdAndUserIdAsync(transaction.LinkedTransactionId, userId);
                if (linkedTransaction != null)
                {
                    var linkedAccount = await _accountRepository.GetByIdAndUserIdAsync(linkedTransaction.AccountId, userId);
                    if (linkedAccount != null)
                    {
                        await UpdateAccountBalanceAsync(linkedAccount, linkedTransaction.Type, linkedTransaction.Amount, false);
                    }
                    await _transactionRepository.DeleteAsync(linkedTransaction.Id, userId);
                }
            }
        }

        await _transactionRepository.DeleteAsync(id, userId);
        return (true, "Transaction deleted successfully");
    }

    public async Task<(bool Success, string Message)> DeleteRecurringAsync(string id, string userId, bool deleteFutureInstances)
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
                await DeleteAsync(transaction.Id, userId);
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
                var account = await _accountRepository.GetByIdAsync(template.AccountId);
                if (account == null) continue;

                var newTransaction = new Transaction
                {
                    UserId = template.UserId,
                    AccountId = template.AccountId,
                    Type = template.Type,
                    Amount = template.Amount,
                    Currency = template.Currency,
                    Date = template.RecurringRule!.NextOccurrence,
                    Title = template.Title,
                    EncryptedPayee = template.EncryptedPayee,
                    EncryptedNotes = template.EncryptedNotes,
                    Splits = template.Splits,
                    TagIds = template.TagIds,
                    Location = template.Location,
                    ParentTransactionId = template.Id
                };

                await _transactionRepository.CreateAsync(newTransaction);
                await UpdateAccountBalanceAsync(account, newTransaction.Type, newTransaction.Amount, true);

                // Handle transfer linked transaction
                if (template.Type == TransactionType.Transfer && !string.IsNullOrEmpty(template.TransferToAccountId))
                {
                    var transferToAccount = await _accountRepository.GetByIdAsync(template.TransferToAccountId);
                    if (transferToAccount != null)
                    {
                        var linkedTransaction = new Transaction
                        {
                            UserId = template.UserId,
                            AccountId = transferToAccount.Id,
                            Type = TransactionType.Credit,
                            Amount = template.Amount,
                            Currency = transferToAccount.Currency,
                            Date = template.RecurringRule.NextOccurrence,
                            Title = template.Title,
                            EncryptedPayee = template.EncryptedPayee,
                            EncryptedNotes = template.EncryptedNotes,
                            Splits = template.Splits,
                            TagIds = template.TagIds,
                            LinkedTransactionId = newTransaction.Id,
                            ParentTransactionId = template.Id
                        };

                        await _transactionRepository.CreateAsync(linkedTransaction);
                        newTransaction.LinkedTransactionId = linkedTransaction.Id;
                        await _transactionRepository.UpdateAsync(newTransaction);
                        await UpdateAccountBalanceAsync(transferToAccount, TransactionType.Credit, template.Amount, true);
                    }
                }

                // Update next occurrence
                template.RecurringRule.LastProcessed = DateTime.UtcNow;
                template.RecurringRule.NextOccurrence = CalculateNextOccurrence(template.RecurringRule);
                await _transactionRepository.UpdateAsync(template);
            }
            catch (Exception)
            {
                // Log error and continue with next template
            }
        }
    }

    private DateTime CalculateNextOccurrence(RecurringRule rule)
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

    private async Task UpdateAccountBalanceAsync(Account account, TransactionType type, decimal amount, bool isAdding)
    {
        var change = type switch
        {
            TransactionType.Credit => amount,
            TransactionType.Debit => -amount,
            TransactionType.Transfer => -amount, // Outgoing from source account
            _ => 0m
        };

        if (!isAdding) change = -change;

        account.CurrentBalance += change;
        await _accountRepository.UpdateAsync(account);
    }

    private TransactionResponse MapToResponse(
        Transaction t, 
        byte[]? dek, 
        Dictionary<string, Account> accounts,
        Dictionary<string, Label> labels)
    {
        accounts.TryGetValue(t.AccountId, out var account);
        accounts.TryGetValue(t.TransferToAccountId ?? "", out var transferToAccount);

        return new TransactionResponse(
            t.Id,
            t.AccountId,
            account?.Name,
            t.Type.ToString(),
            t.Amount,
            t.Currency,
            t.Date,
            t.Title,
            dek != null ? DecryptIfNotEmpty(t.EncryptedPayee, dek) : null,
            dek != null ? DecryptIfNotEmpty(t.EncryptedNotes, dek) : null,
            t.Splits.Select(s => MapSplitToResponse(s, dek, labels)).ToList(),
            t.TagIds,
            MapLocationToResponse(t.Location, dek),
            t.TransferToAccountId,
            transferToAccount?.Name,
            t.LinkedTransactionId,
            t.RecurringRule != null ? new RecurringRuleResponse(
                t.RecurringRule.Frequency.ToString(),
                t.RecurringRule.Interval,
                t.RecurringRule.EndDate,
                t.RecurringRule.NextOccurrence) : null,
            t.ParentTransactionId,
            t.IsRecurringTemplate,
            t.IsCleared,
            t.CreatedAt,
            t.UpdatedAt);
    }

    private TransactionSplitResponse MapSplitToResponse(TransactionSplit split, byte[]? dek, Dictionary<string, Label> labels)
    {
        labels.TryGetValue(split.LabelId, out var label);
        return new TransactionSplitResponse(
            split.LabelId,
            label?.Name,
            label?.Color,
            label?.Icon,
            split.Amount,
            split.Notes);
    }

    private TransactionLocationResponse? MapLocationToResponse(TransactionLocation? location, byte[]? dek)
    {
        if (location == null) return null;

        double longitude = 0;
        if (dek != null && !string.IsNullOrEmpty(location.EncryptedLongitude))
        {
            var decrypted = DecryptIfNotEmpty(location.EncryptedLongitude, dek);
            double.TryParse(decrypted, out longitude);
        }

        return new TransactionLocationResponse(
            location.Latitude,
            longitude,
            dek != null ? DecryptIfNotEmpty(location.EncryptedPlaceName, dek) : null,
            location.City,
            location.Country);
    }

    private RecurringTransactionResponse MapToRecurringResponse(
        Transaction t,
        byte[]? dek,
        Dictionary<string, Account> accounts,
        Dictionary<string, Label> labels)
    {
        accounts.TryGetValue(t.AccountId, out var account);

        return new RecurringTransactionResponse(
            t.Id,
            t.AccountId,
            account?.Name,
            t.Type.ToString(),
            t.Amount,
            t.Currency,
            t.Title,
            dek != null ? DecryptIfNotEmpty(t.EncryptedPayee, dek) : null,
            t.Splits.Select(s => MapSplitToResponse(s, dek, labels)).ToList(),
            new RecurringRuleResponse(
                t.RecurringRule!.Frequency.ToString(),
                t.RecurringRule.Interval,
                t.RecurringRule.EndDate,
                t.RecurringRule.NextOccurrence),
            t.CreatedAt);
    }
}
