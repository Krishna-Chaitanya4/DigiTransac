using DigiTransac.Api.Models;
using DigiTransac.Api.Models.Dto;
using DigiTransac.Api.Repositories;

namespace DigiTransac.Api.Services;

public interface ITransactionService
{
    Task<TransactionListResponse> GetAllAsync(string userId, TransactionFilterRequest filter);
    Task<TransactionResponse?> GetByIdAsync(string id, string userId);
    Task<TransactionSummaryResponse> GetSummaryAsync(string userId, TransactionFilterRequest filter);
    Task<List<RecurringTransactionResponse>> GetRecurringAsync(string userId);
    Task<(bool Success, string Message, TransactionResponse? Transaction)> CreateAsync(string userId, CreateTransactionRequest request);
    Task<(bool Success, string Message, TransactionResponse? Transaction)> UpdateAsync(string id, string userId, UpdateTransactionRequest request);
    Task<(bool Success, string Message)> DeleteAsync(string id, string userId);
    Task<(bool Success, string Message)> DeleteRecurringAsync(string id, string userId, bool deleteFutureInstances);
    Task ProcessRecurringTransactionsAsync();
    
    // Batch operations
    Task<BatchOperationResponse> BatchDeleteAsync(string userId, List<string> ids);
    Task<BatchOperationResponse> BatchUpdateStatusAsync(string userId, List<string> ids, string status);
    
    // Analytics
    Task<TransactionAnalyticsResponse> GetAnalyticsAsync(string userId, DateTime? startDate, DateTime? endDate, string? accountId);
    
    // Export
    Task<List<TransactionResponse>> GetAllForExportAsync(string userId, TransactionFilterRequest filter);
    
    // P2P Pending Transactions
    Task<PendingP2PListResponse> GetPendingP2PAsync(string userId);
    Task<int> GetPendingP2PCountAsync(string userId);
    Task<(bool Success, string Message, TransactionResponse? Transaction)> AcceptP2PAsync(string userId, string transactionId, AcceptP2PRequest request);
    Task<(bool Success, string Message)> RejectP2PAsync(string userId, string transactionId, RejectP2PRequest? request);
}

public class TransactionService : ITransactionService
{
    private readonly ITransactionRepository _transactionRepository;
    private readonly IAccountRepository _accountRepository;
    private readonly ILabelRepository _labelRepository;
    private readonly ITagRepository _tagRepository;
    private readonly IUserRepository _userRepository;
    private readonly IKeyManagementService _keyManagementService;
    private readonly IDekCacheService _dekCacheService;
    private readonly IEncryptionService _encryptionService;
    private readonly IExchangeRateService _exchangeRateService;

    public TransactionService(
        ITransactionRepository transactionRepository,
        IAccountRepository accountRepository,
        ILabelRepository labelRepository,
        ITagRepository tagRepository,
        IUserRepository userRepository,
        IKeyManagementService keyManagementService,
        IDekCacheService dekCacheService,
        IEncryptionService encryptionService,
        IExchangeRateService exchangeRateService)
    {
        _transactionRepository = transactionRepository;
        _accountRepository = accountRepository;
        _labelRepository = labelRepository;
        _tagRepository = tagRepository;
        _userRepository = userRepository;
        _keyManagementService = keyManagementService;
        _dekCacheService = dekCacheService;
        _encryptionService = encryptionService;
        _exchangeRateService = exchangeRateService;
    }

    private async Task<byte[]?> GetUserDekAsync(string userId)
    {
        var cachedDek = _dekCacheService.GetDek(userId);
        if (cachedDek != null) return cachedDek;

        var user = await _userRepository.GetByIdAsync(userId);
        if (user == null) return null;

        // If user doesn't have a DEK, generate one (migration for existing users)
        if (user.WrappedDek == null)
        {
            var newDek = _keyManagementService.GenerateDek();
            var wrappedDek = await _keyManagementService.WrapKeyAsync(newDek);
            user.WrappedDek = wrappedDek;
            await _userRepository.UpdateAsync(user);
            _dekCacheService.SetDek(userId, newDek);
            return newDek;
        }

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
        // Get accounts and labels for mapping (needed for search and response)
        var accounts = await _accountRepository.GetByUserIdAsync(userId, true);
        var labels = await _labelRepository.GetByUserIdAsync(userId);
        var tags = await _tagRepository.GetByUserIdAsync(userId);
        
        // If there's a search text, find matching label/tag/account IDs by name
        var enrichedFilter = filter;
        if (!string.IsNullOrEmpty(filter.SearchText))
        {
            var searchLower = filter.SearchText.ToLowerInvariant();
            
            // Find labels whose name contains the search text
            var matchingLabelIds = labels
                .Where(l => l.Name.ToLowerInvariant().Contains(searchLower))
                .Select(l => l.Id)
                .ToList();
            
            // Find tags whose name contains the search text
            var matchingTagIds = tags
                .Where(t => t.Name.ToLowerInvariant().Contains(searchLower))
                .Select(t => t.Id)
                .ToList();
            
            // Find accounts whose name contains the search text
            var matchingAccountIds = accounts
                .Where(a => a.Name.ToLowerInvariant().Contains(searchLower))
                .Select(a => a.Id)
                .ToList();
            
            // Create enriched filter with matching IDs
            enrichedFilter = filter with 
            { 
                SearchLabelIds = matchingLabelIds.Count > 0 ? matchingLabelIds : null,
                SearchTagIds = matchingTagIds.Count > 0 ? matchingTagIds : null,
                SearchAccountIds = matchingAccountIds.Count > 0 ? matchingAccountIds : null
            };
        }
        
        var (transactions, totalCount) = await _transactionRepository.GetFilteredAsync(userId, enrichedFilter);
        var dek = await GetUserDekAsync(userId);

        var accountDict = accounts.ToDictionary(a => a.Id);
        var labelDict = labels.ToDictionary(l => l.Id);
        var tagDict = tags.ToDictionary(t => t.Id);

        var page = filter.Page ?? 1;
        var pageSize = filter.PageSize ?? 50;
        var totalPages = (int)Math.Ceiling((double)totalCount / pageSize);

        var responses = transactions.Select(t => MapToResponse(t, dek, accountDict, labelDict, tagDict)).ToList();

        return new TransactionListResponse(responses, totalCount, page, pageSize, totalPages);
    }

    public async Task<TransactionResponse?> GetByIdAsync(string id, string userId)
    {
        var transaction = await _transactionRepository.GetByIdAndUserIdAsync(id, userId);
        if (transaction == null) return null;

        var dek = await GetUserDekAsync(userId);
        var accounts = await _accountRepository.GetByUserIdAsync(userId, true);
        var labels = await _labelRepository.GetByUserIdAsync(userId);
        var tags = await _tagRepository.GetByUserIdAsync(userId);

        return MapToResponse(transaction, dek, accounts.ToDictionary(a => a.Id), labels.ToDictionary(l => l.Id), tags.ToDictionary(t => t.Id));
    }

    public async Task<TransactionSummaryResponse> GetSummaryAsync(
        string userId, 
        TransactionFilterRequest filter)
    {
        var (transactions, _) = await _transactionRepository.GetFilteredAsync(userId, filter);
        
        var user = await _userRepository.GetByIdAsync(userId);
        var primaryCurrency = user?.PrimaryCurrency ?? "USD";
        
        // Get accounts to know transaction currencies
        var accounts = await _accountRepository.GetByUserIdAsync(userId, includeArchived: true);
        var accountDict = accounts.ToDictionary(a => a.Id);
        
        // Get exchange rates for currency conversion
        var ratesResponse = await _exchangeRateService.GetRatesAsync();
        var rates = ratesResponse.Rates;

        // Convert all transaction amounts to user's primary currency before summing
        // Transfers are included - this allows seeing currency conversion gains/losses
        decimal totalCredits = 0;
        decimal totalDebits = 0;
        
        foreach (var t in transactions)
        {
            // Skip pending P2P transactions (no AccountId yet)
            if (string.IsNullOrEmpty(t.AccountId))
                continue;
                
            var transactionCurrency = accountDict.TryGetValue(t.AccountId, out var account) 
                ? account.Currency 
                : primaryCurrency;
            
            var convertedAmount = _exchangeRateService.Convert(t.Amount, transactionCurrency, primaryCurrency, rates);
            
            if (t.Type == TransactionType.Receive)
                totalCredits += convertedAmount;
            else if (t.Type == TransactionType.Send)
                totalDebits += convertedAmount;  // Send = money leaving the account
        }

        // Get sums by label (for the filtered date range)
        var byCategory = await _transactionRepository.GetSumByLabelAsync(userId, filter.StartDate, filter.EndDate);
        var byTag = await _transactionRepository.GetSumByTagAsync(userId, filter.StartDate, filter.EndDate);

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

        // Fetch tags for response mapping
        var tags = await _tagRepository.GetByUserIdAsync(userId);

        // Validate based on transaction type
        Account? transferToAccount = null;
        decimal convertedAmount = request.Amount;
        decimal counterpartyAmount = request.CounterpartyAmount ?? request.Amount;
        Label? accountTransferLabel = null;
        User? counterpartyUser = null;
        bool isP2P = !string.IsNullOrEmpty(request.CounterpartyEmail);
        // Transfer = Send type with TransferToAccountId (creates linked Receive in destination)
        bool isSelfTransfer = !string.IsNullOrEmpty(request.TransferToAccountId);
        
        // Self-transfer: must be Send type with destination account
        if (isSelfTransfer)
        {
            if (type != TransactionType.Send)
                return (false, "Transfer must use Send type (money leaves source account)", null);
            
            if (isP2P)
                return (false, "Cannot combine transfer with P2P. Use either transfer or counterparty email.", null);

            transferToAccount = await _accountRepository.GetByIdAndUserIdAsync(request.TransferToAccountId!, userId);
            if (transferToAccount == null)
                return (false, "Destination account not found", null);

            if (request.TransferToAccountId == request.AccountId)
                return (false, "Cannot transfer to the same account", null);
                
            // Convert amount if currencies differ
            if (!account.Currency.Equals(transferToAccount.Currency, StringComparison.OrdinalIgnoreCase))
            {
                var ratesResponse = await _exchangeRateService.GetRatesAsync();
                convertedAmount = _exchangeRateService.Convert(request.Amount, account.Currency, transferToAccount.Currency, ratesResponse.Rates);
            }
            
            // Find the "Account Transfer" category - transfers are locked to this category
            accountTransferLabel = labels.FirstOrDefault(l => l.Type == LabelType.Category && l.Name == "Account Transfer");
        }
        
        // For Send/Receive with counterparty email - this is P2P
        if (isP2P)
        {
            // Check if counterparty exists on the platform
            counterpartyUser = await _userRepository.GetByEmailAsync(request.CounterpartyEmail!);
            
            // Prevent sending to yourself - use self-transfer instead
            if (counterpartyUser != null && counterpartyUser.Id == userId)
                return (false, "Cannot send to yourself. Use Transfer to move money between your accounts.", null);
            
            if (request.CounterpartyAmount.HasValue)
            {
                counterpartyAmount = request.CounterpartyAmount.Value;
            }
        }

        var dek = await GetUserDekAsync(userId);
        if (dek == null)
            return (false, "Encryption key not available", null);

        // For self-transfers, use the Account Transfer category
        // For Send/Receive (including P2P), allow user-specified categories
        var splits = isSelfTransfer && accountTransferLabel != null
            ? new List<TransactionSplit> { new() { LabelId = accountTransferLabel.Id, Amount = request.Amount, Notes = null } }
            : request.Splits.Select(s => new TransactionSplit
              {
                  LabelId = s.LabelId,
                  Amount = s.Amount,
                  Notes = s.Notes
              }).ToList();

        // Generate TransactionLinkId for transfers and P2P
        var transactionLinkId = (isSelfTransfer || isP2P) ? Guid.NewGuid() : (Guid?)null;

        // Build transaction
        var transaction = new Transaction
        {
            UserId = userId,
            AccountId = request.AccountId,
            Type = type,  // Always Send or Receive
            Amount = request.Amount,
            Currency = account.Currency,
            Date = request.Date,
            Title = request.Title,
            EncryptedPayee = EncryptIfNotEmpty(request.Payee, dek),
            EncryptedNotes = EncryptIfNotEmpty(request.Notes, dek),
            Splits = splits,
            TagIds = request.TagIds ?? new List<string>(),
            TransferToAccountId = isSelfTransfer ? request.TransferToAccountId : null,
            Status = TransactionStatus.Confirmed, // Default to confirmed since users enter transactions after completion
            // P2P fields
            TransactionLinkId = transactionLinkId,
            CounterpartyEmail = isP2P ? request.CounterpartyEmail : null,
            CounterpartyUserId = isP2P ? counterpartyUser?.Id : (isSelfTransfer ? userId : null)
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
        Transaction? firstInstance = null;
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
                NextOccurrence = request.Date,
                LastProcessed = DateTime.UtcNow
            };
        }

        await _transactionRepository.CreateAsync(transaction);

        // For recurring templates, create the first transaction instance immediately
        if (transaction.IsRecurringTemplate)
        {
            // Generate a unique link ID for this first instance if it's a transfer
            var firstInstanceLinkId = isSelfTransfer ? Guid.NewGuid() : (Guid?)null;
            
            firstInstance = new Transaction
            {
                UserId = userId,
                AccountId = account.Id,
                Type = type,  // Send or Receive
                Amount = request.Amount,
                Currency = account.Currency,
                Date = request.Date,
                Title = request.Title,
                EncryptedPayee = transaction.EncryptedPayee,
                EncryptedNotes = transaction.EncryptedNotes,
                Splits = transaction.Splits,
                TagIds = transaction.TagIds,
                Location = transaction.Location,
                ParentTransactionId = transaction.Id,
                IsRecurringTemplate = false,
                Status = TransactionStatus.Confirmed, // First instance is auto-confirmed since user is actively creating it
                // P2P fields for recurring (only self-transfers supported)
                TransactionLinkId = firstInstanceLinkId,
                CounterpartyUserId = isSelfTransfer ? userId : null
            };
            
            await _transactionRepository.CreateAsync(firstInstance);
            await UpdateAccountBalanceAsync(account, type, request.Amount, true);
            
            // Handle self-transfer for the first instance (P2P not supported for recurring)
            if (isSelfTransfer && transferToAccount != null)
            {
                // Create splits with converted amount for destination account
                var linkedSplits = accountTransferLabel != null
                    ? new List<TransactionSplit> { new() { LabelId = accountTransferLabel.Id, Amount = convertedAmount, Notes = null } }
                    : transaction.Splits.Select(s => new TransactionSplit { LabelId = s.LabelId, Amount = convertedAmount, Notes = s.Notes }).ToList();
                
                var linkedFirstInstance = new Transaction
                {
                    UserId = userId,
                    AccountId = transferToAccount.Id,
                    Type = TransactionType.Receive, // Linked side is Receive (money coming in)
                    Amount = convertedAmount,  // Use converted amount
                    Currency = transferToAccount.Currency,
                    Date = request.Date,
                    Title = request.Title,
                    EncryptedPayee = transaction.EncryptedPayee,
                    EncryptedNotes = transaction.EncryptedNotes,
                    Splits = linkedSplits,
                    TagIds = transaction.TagIds,
                    LinkedTransactionId = firstInstance.Id,
                    TransferToAccountId = account.Id, // Reference back to source account
                    Status = firstInstance.Status,
                    // P2P fields
                    TransactionLinkId = firstInstanceLinkId,
                    CounterpartyUserId = userId
                };
                
                await _transactionRepository.CreateAsync(linkedFirstInstance);
                firstInstance.LinkedTransactionId = linkedFirstInstance.Id;
                await _transactionRepository.UpdateAsync(firstInstance);
                await UpdateAccountBalanceAsync(transferToAccount, TransactionType.Receive, convertedAmount, true);
            }
            
            // Update NextOccurrence to the next date
            transaction.RecurringRule!.NextOccurrence = CalculateNextOccurrence(transaction.RecurringRule);
            await _transactionRepository.UpdateAsync(transaction);
        }

        // Update account balance (unless it's a recurring template)
        if (!transaction.IsRecurringTemplate)
        {
            await UpdateAccountBalanceAsync(account, type, request.Amount, true);
        }

        // Handle self-transfer - create linked Receive transaction for destination account
        if (isSelfTransfer && transferToAccount != null && !transaction.IsRecurringTemplate)
        {
            // Create splits with converted amount for the destination account
            var linkedSplits = accountTransferLabel != null
                ? new List<TransactionSplit> { new() { LabelId = accountTransferLabel.Id, Amount = convertedAmount, Notes = null } }
                : transaction.Splits.Select(s => new TransactionSplit { LabelId = s.LabelId, Amount = convertedAmount, Notes = s.Notes }).ToList();
            
            var linkedTransaction = new Transaction
            {
                UserId = userId,
                AccountId = transferToAccount.Id,
                Type = TransactionType.Receive, // Linked side is Receive (money coming in)
                Amount = convertedAmount,  // Use converted amount
                Currency = transferToAccount.Currency,
                Date = request.Date,
                Title = request.Title,
                EncryptedPayee = EncryptIfNotEmpty(request.Payee, dek),
                EncryptedNotes = EncryptIfNotEmpty(request.Notes, dek),
                Splits = linkedSplits,
                TagIds = transaction.TagIds,
                LinkedTransactionId = transaction.Id,
                TransferToAccountId = account.Id, // Reference back to source account
                Status = transaction.Status,
                // P2P fields for self-transfer
                TransactionLinkId = transactionLinkId,
                CounterpartyUserId = userId  // Self-transfer, same user
            };

            await _transactionRepository.CreateAsync(linkedTransaction);
            
            transaction.LinkedTransactionId = linkedTransaction.Id;
            await _transactionRepository.UpdateAsync(transaction);

            await UpdateAccountBalanceAsync(transferToAccount, TransactionType.Receive, convertedAmount, true);
        }
        
        // Handle P2P (Send/Receive with counterparty email) - create pending transaction for counterparty
        if (isP2P && !transaction.IsRecurringTemplate)
        {
            // For P2P, we create a pending transaction for the counterparty
            // They will assign their account/categories/tags later
            
            // Determine counterparty's transaction type (opposite of user's)
            var counterpartyType = type == TransactionType.Send ? TransactionType.Receive : TransactionType.Send;
            
            var receiverTransaction = new Transaction
            {
                UserId = counterpartyUser?.Id ?? string.Empty, // Empty if external user
                AccountId = null, // Counterparty will assign their account later (null = pending P2P)
                Type = counterpartyType,
                Amount = counterpartyAmount,
                Currency = account.Currency, // Initially same as user's currency
                Date = request.Date,
                Title = request.Title,
                EncryptedNotes = null, // Counterparty can add their own notes
                Splits = new List<TransactionSplit>(), // They'll fill in their own categories
                TagIds = new List<string>(),
                Status = TransactionStatus.Pending, // Pending - counterparty needs to review
                // P2P fields
                TransactionLinkId = transactionLinkId,
                CounterpartyEmail = (await _userRepository.GetByIdAsync(userId))?.Email,
                CounterpartyUserId = userId
            };
            
            // Only create if counterparty is on the platform
            if (counterpartyUser != null)
            {
                await _transactionRepository.CreateAsync(receiverTransaction);
                transaction.LinkedTransactionId = receiverTransaction.Id;
                await _transactionRepository.UpdateAsync(transaction);
            }
        }

        var accounts = await _accountRepository.GetByUserIdAsync(userId, true);
        var labelsDict = labels.ToDictionary(l => l.Id);
        var tagsDict = tags.ToDictionary(t => t.Id);
        
        // Return the first instance for recurring transactions, otherwise return the transaction itself
        var transactionToReturn = firstInstance ?? transaction;
        var response = MapToResponse(transactionToReturn, dek, accounts.ToDictionary(a => a.Id), labelsDict, tagsDict);

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
        var oldAccountId = transaction.AccountId;
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
            transaction.Currency = newAccount.Currency;  // Update currency to match new account
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
            transaction.EncryptedPayee = EncryptIfNotEmpty(request.Payee, dek);

        if (request.Notes != null)
            transaction.EncryptedNotes = EncryptIfNotEmpty(request.Notes, dek);

        if (!string.IsNullOrEmpty(request.Status) && Enum.TryParse<TransactionStatus>(request.Status, true, out var status))
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
                EncryptedLongitude = EncryptIfNotEmpty(request.Location.Longitude.ToString(), dek),
                EncryptedPlaceName = EncryptIfNotEmpty(request.Location.PlaceName, dek),
                City = request.Location.City,
                Country = request.Location.Country
            };
        }

        await _transactionRepository.UpdateAsync(transaction);

        // Sync linked transfer transaction
        if (!string.IsNullOrEmpty(transaction.LinkedTransactionId))
        {
            var linkedTransaction = await _transactionRepository.GetByIdAndUserIdAsync(transaction.LinkedTransactionId, userId);
            if (linkedTransaction != null)
            {
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
                if (request.Amount.HasValue && oldAmount != transaction.Amount)
                {
                    var isSameCurrency = transaction.Currency.Equals(linkedTransaction.Currency, StringComparison.OrdinalIgnoreCase);
                    var isSourceSide = transaction.Type == TransactionType.Send;
                    
                    if (isSameCurrency)
                    {
                        // Same currency: always sync amount
                        linkedTransaction.Amount = transaction.Amount;
                        // Update splits amount too
                        if (linkedTransaction.Splits.Count > 0)
                        {
                            linkedTransaction.Splits[0].Amount = transaction.Amount;
                        }
                        linkedNeedsUpdate = true;
                    }
                    else if (isSourceSide)
                    {
                        // Different currencies AND editing source: recalculate destination with exchange rate
                        var ratesResponse = await _exchangeRateService.GetRatesAsync();
                        var convertedAmount = _exchangeRateService.Convert(transaction.Amount, transaction.Currency, linkedTransaction.Currency, ratesResponse.Rates);
                        linkedTransaction.Amount = convertedAmount;
                        // Update splits amount too
                        if (linkedTransaction.Splits.Count > 0)
                        {
                            linkedTransaction.Splits[0].Amount = convertedAmount;
                        }
                        linkedNeedsUpdate = true;
                    }
                    // If editing destination side with different currencies: DON'T update source (allow manual correction)
                }
                
                if (linkedNeedsUpdate)
                {
                    await _transactionRepository.UpdateAsync(linkedTransaction);
                    
                    // Update linked account balance if amount changed
                    if (linkedTransaction.Amount != linkedOldAmount)
                    {
                        var linkedAccount = await _accountRepository.GetByIdAndUserIdAsync(linkedTransaction.AccountId, userId);
                        if (linkedAccount != null)
                        {
                            await UpdateAccountBalanceAsync(linkedAccount, linkedTransaction.Type, linkedOldAmount, false);
                            await UpdateAccountBalanceAsync(linkedAccount, linkedTransaction.Type, linkedTransaction.Amount, true);
                        }
                    }
                }
            }
        }

        // Adjust balances
        if (newAccount != null)
        {
            // Account changed - reverse from old account, apply to new account
            await UpdateAccountBalanceAsync(oldAccount, oldType, oldAmount, false);
            await UpdateAccountBalanceAsync(newAccount, transaction.Type, transaction.Amount, true);
        }
        else if (oldType != transaction.Type || oldAmount != transaction.Amount)
        {
            // Same account but amount or type changed
            await UpdateAccountBalanceAsync(account, oldType, oldAmount, false);
            await UpdateAccountBalanceAsync(account, transaction.Type, transaction.Amount, true);
        }

        var accounts = await _accountRepository.GetByUserIdAsync(userId, true);
        var labels = await _labelRepository.GetByUserIdAsync(userId);
        var tags = await _tagRepository.GetByUserIdAsync(userId);
        var response = MapToResponse(transaction, dek, accounts.ToDictionary(a => a.Id), labels.ToDictionary(l => l.Id), tags.ToDictionary(t => t.Id));

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

                // Handle transfer linked transaction (detected by TransferToAccountId, not type)
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
                        await UpdateAccountBalanceAsync(transferToAccount, TransactionType.Receive, template.Amount, true);
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
            TransactionType.Receive => amount,
            TransactionType.Send => -amount,
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
        Dictionary<string, Label> labels,
        Dictionary<string, Tag> tags)
    {
        Account? account = null;
        if (!string.IsNullOrEmpty(t.AccountId))
            accounts.TryGetValue(t.AccountId, out account);
        accounts.TryGetValue(t.TransferToAccountId ?? "", out var transferToAccount);

        // Map tag IDs to tag info with names
        var tagInfos = t.TagIds
            .Select(tagId => tags.TryGetValue(tagId, out var tag) 
                ? new TagInfo(tagId, tag.Name, tag.Color) 
                : new TagInfo(tagId, "Unknown", null))
            .ToList();

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
            tagInfos,
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
            t.Status.ToString(),
            t.CreatedAt,
            t.UpdatedAt,
            t.TransactionLinkId,
            t.CounterpartyEmail,
            t.CounterpartyUserId,
            // Derive role from type for P2P/transfer transactions (has counterparty)
            t.CounterpartyUserId != null || t.CounterpartyEmail != null
                ? (t.Type == TransactionType.Send ? "Sender" : "Receiver")
                : null);
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
        Account? account = null;
        if (!string.IsNullOrEmpty(t.AccountId))
            accounts.TryGetValue(t.AccountId, out account);

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

    // Batch Operations
    public async Task<BatchOperationResponse> BatchDeleteAsync(string userId, List<string> ids)
    {
        var successCount = 0;
        var failedIds = new List<string>();

        foreach (var id in ids)
        {
            var result = await DeleteAsync(id, userId);
            if (result.Success)
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

    public async Task<BatchOperationResponse> BatchUpdateStatusAsync(string userId, List<string> ids, string status)
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

    public async Task<TransactionAnalyticsResponse> GetAnalyticsAsync(
        string userId, 
        DateTime? startDate, 
        DateTime? endDate, 
        string? accountId)
    {
        var dek = await GetUserDekAsync(userId);
        var accounts = (await _accountRepository.GetByUserIdAsync(userId, true))
            .ToDictionary(a => a.Id);
        var labels = (await _labelRepository.GetByUserIdAsync(userId))
            .ToDictionary(l => l.Id);

        // Get user's primary currency and exchange rates
        var user = await _userRepository.GetByIdAsync(userId);
        var primaryCurrency = user?.PrimaryCurrency ?? "USD";
        var ratesResponse = await _exchangeRateService.GetRatesAsync();
        var rates = ratesResponse.Rates;

        // Helper to get transaction currency
        string GetTransactionCurrency(Transaction t) => 
            !string.IsNullOrEmpty(t.AccountId) && accounts.TryGetValue(t.AccountId, out var acc) 
                ? acc.Currency 
                : primaryCurrency;

        // Get all transactions for the period
        var filter = new TransactionFilterRequest(
            startDate, endDate, 
            accountId != null ? new List<string> { accountId } : null,
            null, null, null, null, null, null, null, null, null, null);
        
        var (transactions, _) = await _transactionRepository.GetFilteredAsync(userId, filter);

        // Calculate category breakdown with currency conversion
        var categoryTotals = new Dictionary<string, (decimal amount, int count)>();
        foreach (var t in transactions.Where(t => !t.IsRecurringTemplate))
        {
            var transactionCurrency = GetTransactionCurrency(t);
            foreach (var split in t.Splits)
            {
                if (!categoryTotals.ContainsKey(split.LabelId))
                {
                    categoryTotals[split.LabelId] = (0, 0);
                }
                var current = categoryTotals[split.LabelId];
                var convertedAmount = _exchangeRateService.Convert(split.Amount, transactionCurrency, primaryCurrency, rates);
                categoryTotals[split.LabelId] = (current.amount + convertedAmount, current.count + 1);
            }
        }

        var totalSpending = categoryTotals.Values.Sum(v => v.amount);
        var topCategories = categoryTotals
            .OrderByDescending(kv => kv.Value.amount)
            .Take(10)
            .Select(kv =>
            {
                labels.TryGetValue(kv.Key, out var label);
                return new CategoryBreakdown(
                    kv.Key,
                    label?.Name ?? "Unknown",
                    label?.Icon,
                    label?.Color,
                    kv.Value.amount,
                    kv.Value.count,
                    totalSpending > 0 ? Math.Round(kv.Value.amount / totalSpending * 100, 1) : 0
                );
            })
            .ToList();

        // Calculate spending trends (by month) with currency conversion
        var trends = transactions
            .Where(t => !t.IsRecurringTemplate)
            .GroupBy(t => t.Date.ToString("yyyy-MM"))
            .OrderBy(g => g.Key)
            .Select(g => new SpendingTrend(
                g.Key,
                g.Where(t => t.Type == TransactionType.Receive)
                    .Sum(t => _exchangeRateService.Convert(t.Amount, GetTransactionCurrency(t), primaryCurrency, rates)),
                g.Where(t => t.Type == TransactionType.Send)
                    .Sum(t => _exchangeRateService.Convert(t.Amount, GetTransactionCurrency(t), primaryCurrency, rates)),
                g.Where(t => t.Type == TransactionType.Receive)
                    .Sum(t => _exchangeRateService.Convert(t.Amount, GetTransactionCurrency(t), primaryCurrency, rates)) -
                g.Where(t => t.Type == TransactionType.Send)
                    .Sum(t => _exchangeRateService.Convert(t.Amount, GetTransactionCurrency(t), primaryCurrency, rates)),
                g.Count()
            ))
            .ToList();

        // Calculate averages by type with currency conversion
        var actualTransactions = transactions.Where(t => !t.IsRecurringTemplate).ToList();
        var receives = actualTransactions.Where(t => t.Type == TransactionType.Receive).ToList();
        var sends = actualTransactions.Where(t => t.Type == TransactionType.Send).ToList();
        // Transfers are now Send+Receive, detect by LinkedTransactionId for reporting
        var transfers = actualTransactions.Where(t => !string.IsNullOrEmpty(t.LinkedTransactionId)).ToList();

        var averagesByType = new AveragesByType(
            receives.Any() ? Math.Round(receives.Average(t => _exchangeRateService.Convert(t.Amount, GetTransactionCurrency(t), primaryCurrency, rates)), 2) : 0,
            sends.Any() ? Math.Round(sends.Average(t => _exchangeRateService.Convert(t.Amount, GetTransactionCurrency(t), primaryCurrency, rates)), 2) : 0,
            transfers.Any() ? Math.Round(transfers.Average(t => _exchangeRateService.Convert(t.Amount, GetTransactionCurrency(t), primaryCurrency, rates)), 2) : 0
        );

        // Calculate daily and monthly averages with currency conversion
        var dateRange = (endDate ?? DateTime.UtcNow) - (startDate ?? actualTransactions.Min(t => t.Date));
        var days = Math.Max(1, dateRange.Days);
        var months = Math.Max(1, days / 30.0);
        var totalSends = sends.Sum(t => _exchangeRateService.Convert(t.Amount, GetTransactionCurrency(t), primaryCurrency, rates));

        return new TransactionAnalyticsResponse(
            topCategories,
            trends,
            averagesByType,
            Math.Round(totalSends / days, 2),
            Math.Round(totalSends / (decimal)months, 2)
        );
    }

    public async Task<List<TransactionResponse>> GetAllForExportAsync(string userId, TransactionFilterRequest filter)
    {
        // Get unlimited transactions for export (no pagination)
        var exportFilter = filter with { Page = null, PageSize = null };
        
        var dek = await GetUserDekAsync(userId);
        var accounts = (await _accountRepository.GetByUserIdAsync(userId, true))
            .ToDictionary(a => a.Id);
        var labels = (await _labelRepository.GetByUserIdAsync(userId))
            .ToDictionary(l => l.Id);
        var tags = (await _tagRepository.GetByUserIdAsync(userId))
            .ToDictionary(t => t.Id);

        var (transactions, _) = await _transactionRepository.GetFilteredAsync(userId, exportFilter);

        return transactions
            .Where(t => !t.IsRecurringTemplate)
            .Select(t => MapToResponse(t, dek, accounts, labels, tags))
            .ToList();
    }

    #region P2P Pending Transactions

    public async Task<PendingP2PListResponse> GetPendingP2PAsync(string userId)
    {
        var transactions = await _transactionRepository.GetPendingP2PAsync(userId);
        
        var pendingList = transactions.Select(t => new PendingP2PResponse(
            Id: t.Id,
            Type: t.Type.ToString(),
            Amount: t.Amount,
            Currency: t.Currency,
            Date: t.Date,
            Title: t.Title,
            CounterpartyEmail: t.CounterpartyEmail,
            // Derive role from type
            Role: t.Type == TransactionType.Send ? "Sender" : "Receiver",
            TransactionLinkId: t.TransactionLinkId
        )).ToList();

        return new PendingP2PListResponse(pendingList, pendingList.Count);
    }

    public async Task<int> GetPendingP2PCountAsync(string userId)
    {
        return await _transactionRepository.GetPendingP2PCountAsync(userId);
    }

    public async Task<(bool Success, string Message, TransactionResponse? Transaction)> AcceptP2PAsync(
        string userId, 
        string transactionId, 
        AcceptP2PRequest request)
    {
        // Get the pending P2P transaction
        var transaction = await _transactionRepository.GetByIdAsync(transactionId);
        if (transaction == null)
            return (false, "Transaction not found", null);

        // Verify this transaction belongs to the user and is pending P2P
        if (transaction.UserId != userId)
            return (false, "Transaction not found", null);

        if (!string.IsNullOrEmpty(transaction.AccountId))
            return (false, "Transaction has already been assigned to an account", null);

        if (transaction.TransactionLinkId == null)
            return (false, "This is not a P2P transaction", null);

        // Verify the account belongs to the user
        var account = await _accountRepository.GetByIdAndUserIdAsync(request.AccountId, userId);
        if (account == null)
            return (false, "Account not found", null);

        // Validate labels exist
        var labels = await _labelRepository.GetByUserIdAsync(userId);
        var validLabelIds = labels.Select(l => l.Id).ToHashSet();
        foreach (var split in request.Splits)
        {
            if (!validLabelIds.Contains(split.LabelId))
                return (false, $"Invalid category ID: {split.LabelId}", null);
        }

        // Validate tags if provided
        if (request.TagIds?.Count > 0)
        {
            var tags = await _tagRepository.GetByUserIdAsync(userId);
            var validTagIds = tags.Select(t => t.Id).ToHashSet();
            foreach (var tagId in request.TagIds)
            {
                if (!validTagIds.Contains(tagId))
                    return (false, $"Invalid tag ID: {tagId}", null);
            }
        }

        // Get DEK for encryption
        var dek = await GetUserDekAsync(userId);
        if (dek == null)
            return (false, "Encryption key not available", null);

        // Validate that splits sum equals the amount
        var splitsTotal = request.Splits.Sum(s => s.Amount);
        if (Math.Abs(splitsTotal - request.Amount) > 0.01m)
            return (false, $"Splits total ({splitsTotal}) must equal amount ({request.Amount})", null);

        // Update the transaction with user-provided amount (may differ from sender's due to currency conversion)
        transaction.AccountId = request.AccountId;
        transaction.Amount = request.Amount;  // Use the amount the receiver actually received
        transaction.Currency = account.Currency; // Use the account's currency
        transaction.Splits = request.Splits.Select(s => new TransactionSplit
        {
            LabelId = s.LabelId,
            Amount = s.Amount,
            Notes = s.Notes
        }).ToList();
        transaction.TagIds = request.TagIds ?? new List<string>();
        transaction.EncryptedNotes = EncryptIfNotEmpty(request.Notes, dek);
        transaction.Status = TransactionStatus.Confirmed;
        transaction.UpdatedAt = DateTime.UtcNow;

        await _transactionRepository.UpdateAsync(transaction);

        // Update account balance
        await UpdateAccountBalanceAsync(account, transaction.Type, transaction.Amount, true);

        // Return the updated transaction
        var accounts = (await _accountRepository.GetByUserIdAsync(userId, true)).ToDictionary(a => a.Id);
        var labelsDict = labels.ToDictionary(l => l.Id);
        var tagsDict = (await _tagRepository.GetByUserIdAsync(userId)).ToDictionary(t => t.Id);

        var response = MapToResponse(transaction, dek, accounts, labelsDict, tagsDict);
        return (true, "P2P transaction accepted successfully", response);
    }

    public async Task<(bool Success, string Message)> RejectP2PAsync(
        string userId, 
        string transactionId, 
        RejectP2PRequest? request)
    {
        // Get the pending P2P transaction
        var transaction = await _transactionRepository.GetByIdAsync(transactionId);
        if (transaction == null)
            return (false, "Transaction not found");

        // Verify this transaction belongs to the user and is pending P2P
        if (transaction.UserId != userId)
            return (false, "Transaction not found");

        if (!string.IsNullOrEmpty(transaction.AccountId))
            return (false, "Transaction has already been assigned to an account");

        if (transaction.TransactionLinkId == null)
            return (false, "This is not a P2P transaction");

        // Delete the pending transaction
        // Note: The sender's transaction remains unaffected
        await _transactionRepository.DeleteAsync(transactionId, userId);

        return (true, "P2P transaction rejected");
    }

    #endregion
}
