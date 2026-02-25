using DigiTransac.Api.Common;
using DigiTransac.Api.Models;
using DigiTransac.Api.Models.Dto;
using DigiTransac.Api.Repositories;
using DigiTransac.Api.Services.Transactions;

namespace DigiTransac.Api.Services;

public interface IAccountService
{
    Task<List<AccountResponse>> GetAllAsync(string userId, bool includeArchived = false, CancellationToken ct = default);
    Task<AccountResponse?> GetByIdAsync(string id, string userId, CancellationToken ct = default);
    Task<AccountSummaryResponse> GetSummaryAsync(string userId, CancellationToken ct = default);
    Task<Result<AccountResponse>> CreateAsync(string userId, CreateAccountRequest request, CancellationToken ct = default);
    Task<Result<AccountResponse>> UpdateAsync(string id, string userId, UpdateAccountRequest request, CancellationToken ct = default);
    Task<Result> AdjustBalanceAsync(string id, string userId, AdjustBalanceRequest request, CancellationToken ct = default);
    Task<Result> ReorderAsync(string userId, ReorderAccountsRequest request, CancellationToken ct = default);
    Task<Result> SetDefaultAsync(string id, string userId, CancellationToken ct = default);
    Task<Result> DeleteAsync(string id, string userId, CancellationToken ct = default);
}

public class AccountService : IAccountService
{
    private readonly IAccountRepository _accountRepository;
    private readonly ITransactionRepository _transactionRepository;
    private readonly IUserRepository _userRepository;
    private readonly IExchangeRateService _exchangeRateService;
    private readonly ITransactionMapperService _mapperService;
    private readonly ILabelService _labelService;
    private readonly IChatMessageRepository _chatMessageRepository;

    public AccountService(
        IAccountRepository accountRepository,
        ITransactionRepository transactionRepository,
        IUserRepository userRepository,
        IExchangeRateService exchangeRateService,
        ITransactionMapperService mapperService,
        ILabelService labelService,
        IChatMessageRepository chatMessageRepository)
    {
        _accountRepository = accountRepository;
        _transactionRepository = transactionRepository;
        _userRepository = userRepository;
        _exchangeRateService = exchangeRateService;
        _mapperService = mapperService;
        _labelService = labelService;
        _chatMessageRepository = chatMessageRepository;
    }

    public async Task<List<AccountResponse>> GetAllAsync(string userId, bool includeArchived = false, CancellationToken ct = default)
    {
        var accounts = await _accountRepository.GetByUserIdAsync(userId, includeArchived, ct);
        var dek = await _mapperService.GetUserDekAsync(userId);
        
        // Batch get transaction counts for all accounts
        var accountIds = accounts.Select(a => a.Id).ToList();
        var transactionCounts = await _transactionRepository.GetCountsByAccountIdsAsync(accountIds, userId);
        
        return accounts.Select(a => MapToResponse(a, transactionCounts.GetValueOrDefault(a.Id, 0), dek)).ToList();
    }

    public async Task<AccountResponse?> GetByIdAsync(string id, string userId, CancellationToken ct = default)
    {
        var account = await _accountRepository.GetByIdAndUserIdAsync(id, userId, ct);
        if (account == null) return null;
        
        var dek = await _mapperService.GetUserDekAsync(userId);
        var transactionCount = await _transactionRepository.GetCountByAccountIdAsync(id, userId);
        return MapToResponse(account, transactionCount, dek);
    }

    public async Task<AccountSummaryResponse> GetSummaryAsync(string userId, CancellationToken ct = default)
    {
        var accounts = await _accountRepository.GetByUserIdAsync(userId, includeArchived: false, ct);
        var includedAccounts = accounts.Where(a => a.IncludeInNetWorth).ToList();
        
        // Get user's primary currency preference
        var user = await _userRepository.GetByIdAsync(userId);
        var primaryCurrency = user?.PrimaryCurrency ?? "USD";
        
        // Get exchange rates
        var ratesResponse = await _exchangeRateService.GetRatesAsync();
        var rates = ratesResponse.Rates;

        // Assets: Bank, Cash, DigitalWallet, Investment
        // Liabilities: CreditCard, Loan
        // Note: Liability accounts with positive balance = you owe money (liability)
        //       Liability accounts with negative balance = overpayment (effectively an asset)
        var liabilityTypes = new[] { AccountType.CreditCard, AccountType.Loan };
        
        var balancesByType = new Dictionary<string, decimal>();
        var balancesByCurrency = new Dictionary<string, CurrencyBalances>();
        
        decimal totalAssetsConverted = 0;
        decimal totalLiabilitiesConverted = 0;

        // Group accounts by currency first
        var accountsByCurrency = includedAccounts.GroupBy(a => a.Currency.ToUpperInvariant());

        foreach (var currencyGroup in accountsByCurrency)
        {
            var currency = currencyGroup.Key;
            decimal assets = 0;
            decimal liabilities = 0;

            foreach (var account in currencyGroup)
            {
                // Track by type (in original currency)
                var typeName = account.Type.ToString();
                if (!balancesByType.ContainsKey(typeName))
                {
                    balancesByType[typeName] = 0;
                }
                
                // Convert to primary currency for type totals
                var convertedBalance = _exchangeRateService.Convert(
                    account.CurrentBalance,
                    currency,
                    primaryCurrency,
                    rates);
                balancesByType[typeName] += convertedBalance;

                if (liabilityTypes.Contains(account.Type))
                {
                    // For liability accounts:
                    // - Positive balance = debt (liability) - e.g., you owe $500 on credit card
                    // - Negative balance = overpayment/credit (effectively an asset)
                    if (account.CurrentBalance > 0)
                    {
                        liabilities += account.CurrentBalance;
                    }
                    else
                    {
                        // Negative balance on liability = credit/overpayment = asset
                        assets += Math.Abs(account.CurrentBalance);
                    }
                }
                else
                {
                    // For asset accounts: positive = asset, negative = overdraft (liability)
                    if (account.CurrentBalance >= 0)
                    {
                        assets += account.CurrentBalance;
                    }
                    else
                    {
                        // Negative balance on asset account = overdraft = liability
                        liabilities += Math.Abs(account.CurrentBalance);
                    }
                }
            }

            var netWorth = assets - liabilities;
            
            // Convert to primary currency
            var assetsConverted = _exchangeRateService.Convert(assets, currency, primaryCurrency, rates);
            var liabilitiesConverted = _exchangeRateService.Convert(liabilities, currency, primaryCurrency, rates);
            var netWorthConverted = assetsConverted - liabilitiesConverted;

            balancesByCurrency[currency] = new CurrencyBalances(
                Assets: assets,
                Liabilities: liabilities,
                NetWorth: netWorth,
                AssetsConverted: assetsConverted,
                LiabilitiesConverted: liabilitiesConverted,
                NetWorthConverted: netWorthConverted
            );

            totalAssetsConverted += assetsConverted;
            totalLiabilitiesConverted += liabilitiesConverted;
        }

        return new AccountSummaryResponse(
            TotalAssets: totalAssetsConverted,
            TotalLiabilities: totalLiabilitiesConverted,
            NetWorth: totalAssetsConverted - totalLiabilitiesConverted,
            PrimaryCurrency: primaryCurrency,
            BalancesByType: balancesByType,
            BalancesByCurrency: balancesByCurrency,
            RatesLastUpdated: ratesResponse.LastUpdated
        );
    }

    public async Task<Result<AccountResponse>> CreateAsync(string userId, CreateAccountRequest request, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
            return Error.Validation("Account name is required");

        if (!Enum.TryParse<AccountType>(request.Type, true, out var accountType))
            return Error.Validation("Invalid account type");

        // Check for duplicate account name
        if (await _accountRepository.ExistsByNameAsync(request.Name, userId, ct))
            return Error.Conflict("An account with this name already exists");

        var count = await _accountRepository.GetCountByUserIdAsync(userId, ct);

        // Get user's primary currency if not specified
        var currency = request.Currency;
        if (string.IsNullOrWhiteSpace(currency))
        {
            var user = await _userRepository.GetByIdAsync(userId);
            currency = user?.PrimaryCurrency ?? "USD";
        }

        // Get user's DEK for encryption
        var dek = await _mapperService.GetUserDekAsync(userId);

        var account = new Account
        {
            UserId = userId,
            Name = request.Name.Trim(),
            Type = accountType,
            Icon = request.Icon,
            Color = request.Color,
            Currency = currency,
            InitialBalance = request.InitialBalance ?? 0,
            CurrentBalance = request.InitialBalance ?? 0,
            Institution = request.Institution,
            // Encrypt sensitive fields with server-managed DEK
            AccountNumber = dek != null
                ? _mapperService.EncryptIfNotEmpty(request.AccountNumber, dek)
                : request.AccountNumber,
            Notes = dek != null
                ? _mapperService.EncryptIfNotEmpty(request.Notes, dek)
                : request.Notes,
            IncludeInNetWorth = request.IncludeInNetWorth ?? true,
            Order = count,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        await _accountRepository.CreateAsync(account, ct);
        // New account has 0 transactions
        return MapToResponse(account, 0, dek);
    }

    public async Task<Result<AccountResponse>> UpdateAsync(string id, string userId, UpdateAccountRequest request, CancellationToken ct = default)
    {
        var account = await _accountRepository.GetByIdAndUserIdAsync(id, userId, ct);
        if (account == null)
            return DomainErrors.Account.NotFound(id);

        // Get user's DEK for encryption
        var dek = await _mapperService.GetUserDekAsync(userId);

        if (request.Name != null)
        {
            if (string.IsNullOrWhiteSpace(request.Name))
                return Error.Validation("Account name cannot be empty");
            account.Name = request.Name.Trim();
        }

        if (request.Icon != null) account.Icon = request.Icon;
        if (request.Color != null) account.Color = request.Color;
        
        // Currency can only be changed if no transactions exist
        var transactionCount = 0;
        if (request.Currency != null && request.Currency != account.Currency)
        {
            transactionCount = await _transactionRepository.GetCountByAccountIdAsync(id, userId);
            if (transactionCount > 0)
                return Error.Validation($"Currency cannot be changed. This account has {transactionCount} transaction(s). Archive this account and create a new one instead.");
            account.Currency = request.Currency;
        }
        
        if (request.Institution != null) account.Institution = request.Institution;
        // Encrypt sensitive fields with server-managed DEK on update
        if (request.AccountNumber != null)
        {
            account.AccountNumber = dek != null
                ? _mapperService.EncryptIfNotEmpty(request.AccountNumber, dek)
                : request.AccountNumber;
        }
        if (request.Notes != null)
        {
            account.Notes = dek != null
                ? _mapperService.EncryptIfNotEmpty(request.Notes, dek)
                : request.Notes;
        }
        if (request.IsArchived.HasValue) account.IsArchived = request.IsArchived.Value;
        if (request.IncludeInNetWorth.HasValue) account.IncludeInNetWorth = request.IncludeInNetWorth.Value;
        if (request.Order.HasValue) account.Order = request.Order.Value;

        await _accountRepository.UpdateAsync(account, ct: ct);
        
        // Get transaction count for the updated response (if not already fetched)
        if (transactionCount == 0)
        {
            transactionCount = await _transactionRepository.GetCountByAccountIdAsync(id, userId);
        }
        return MapToResponse(account, transactionCount, dek);
    }

    public async Task<Result> AdjustBalanceAsync(string id, string userId, AdjustBalanceRequest request, CancellationToken ct = default)
    {
        var account = await _accountRepository.GetByIdAndUserIdAsync(id, userId, ct);
        if (account == null)
            return DomainErrors.Account.NotFound(id);

        var difference = request.NewBalance - account.CurrentBalance;
        
        // If there's no change, just return success
        if (difference == 0)
            return Result.Success();

        // Get or create the "Balance Adjustment" system category
        var adjustmentCategory = await _labelService.GetOrCreateAdjustmentsCategoryAsync(userId, ct);

        // Create an adjustment transaction to maintain data integrity
        var dek = await _mapperService.GetUserDekAsync(userId);
        var adjustmentNotes = string.IsNullOrWhiteSpace(request.Notes)
            ? "Balance adjustment"
            : $"Balance adjustment: {request.Notes}";

        // Determine transaction type based on account type and balance change
        // For liability accounts (CreditCard, Loan):
        //   - Balance increases (more debt) → Send (you spent money)
        //   - Balance decreases (less debt) → Receive (you paid back)
        // For asset accounts (Bank, Cash, etc.):
        //   - Balance increases → Receive (money came in)
        //   - Balance decreases → Send (money went out)
        var liabilityTypes = new[] { AccountType.CreditCard, AccountType.Loan };
        var isLiability = liabilityTypes.Contains(account.Type);
        
        TransactionType transactionType;
        if (isLiability)
        {
            // For liability accounts, invert the logic:
            // Increasing debt (positive difference) = spending = Send
            // Decreasing debt (negative difference) = payment = Receive
            transactionType = difference > 0 ? TransactionType.Send : TransactionType.Receive;
        }
        else
        {
            // For asset accounts, standard logic:
            // Positive difference = money in = Receive
            // Negative difference = money out = Send
            transactionType = difference > 0 ? TransactionType.Receive : TransactionType.Send;
        }

        var now = DateTime.UtcNow;

        var transaction = new Transaction
        {
            UserId = userId,
            AccountId = id,
            Type = transactionType,
            Amount = Math.Abs(difference),
            Currency = account.Currency,
            Date = now,
            Title = "Balance Adjustment",
            EncryptedNotes = dek != null ? _mapperService.EncryptIfNotEmpty(adjustmentNotes, dek) : adjustmentNotes,
            Status = TransactionStatus.Confirmed,
            Splits = new List<TransactionSplit>
            {
                new TransactionSplit
                {
                    LabelId = adjustmentCategory.Id,
                    Amount = Math.Abs(difference)
                }
            },
            CreatedAt = now,
            UpdatedAt = now
        };

        await _transactionRepository.CreateAsync(transaction);

        // Update account balance
        account.CurrentBalance = request.NewBalance;
        account.UpdatedAt = DateTime.UtcNow;
        await _accountRepository.UpdateAsync(account, ct: ct);

        // Create a chat message in the personal conversation for audit trail
        // Format: "Balance Adjustment: HDFC Bank +₹1,000.00 → ₹15,000.00"
        var formattedDifference = difference > 0
            ? $"+{CurrencyFormatter.Format(difference, account.Currency)}"
            : $"-{CurrencyFormatter.Format(Math.Abs(difference), account.Currency)}";
        var formattedNewBalance = CurrencyFormatter.Format(request.NewBalance, account.Currency);
        var chatContent = $"Balance Adjustment: {account.Name} {formattedDifference} → {formattedNewBalance}";
        
        await _chatMessageRepository.CreateSystemMessageAsync(
            userId: userId,
            counterpartyUserId: userId, // Self-chat (personal conversation)
            content: chatContent,
            systemSource: "BalanceAdjustment",
            transactionId: transaction.Id
        );

        return Result.Success();
    }

    public async Task<Result> ReorderAsync(string userId, ReorderAccountsRequest request, CancellationToken ct = default)
    {
        var orderMap = request.Items.ToDictionary(item => item.Id, item => item.Order);
        await _accountRepository.BulkUpdateOrderAsync(userId, orderMap, ct);

        return Result.Success();
    }

    public async Task<Result> SetDefaultAsync(string id, string userId, CancellationToken ct = default)
    {
        var account = await _accountRepository.GetByIdAndUserIdAsync(id, userId, ct);
        if (account == null)
            return DomainErrors.Account.NotFound(id);

        if (account.IsArchived)
            return DomainErrors.Account.Archived;

        // Clear existing default
        var allAccounts = await _accountRepository.GetByUserIdAsync(userId, includeArchived: false, ct);
        foreach (var acc in allAccounts.Where(a => a.IsDefault))
        {
            acc.IsDefault = false;
            acc.UpdatedAt = DateTime.UtcNow;
            await _accountRepository.UpdateAsync(acc, ct: ct);
        }

        // Set new default
        account.IsDefault = true;
        account.UpdatedAt = DateTime.UtcNow;
        await _accountRepository.UpdateAsync(account, ct: ct);

        return Result.Success();
    }

    public async Task<Result> DeleteAsync(string id, string userId, CancellationToken ct = default)
    {
        var account = await _accountRepository.GetByIdAndUserIdAsync(id, userId, ct);
        if (account == null)
            return DomainErrors.Account.NotFound(id);

        // Check if account has transactions - block deletion if so
        var transactionCount = await _transactionRepository.GetCountByAccountIdAsync(id, userId);
        if (transactionCount > 0)
            return DomainErrors.Account.HasTransactions(transactionCount);

        await _accountRepository.DeleteAsync(id, userId, ct);
        return Result.Success();
    }

    private AccountResponse MapToResponse(Account account, int transactionCount, byte[]? dek = null)
    {
        // Currency can only be edited if there are no transactions for this account
        var canEditCurrency = transactionCount == 0;
        
        // Decrypt sensitive fields with server-managed DEK if available
        var accountNumber = dek != null
            ? _mapperService.DecryptIfNotEmpty(account.AccountNumber, dek)
            : account.AccountNumber;
        var notes = dek != null
            ? _mapperService.DecryptIfNotEmpty(account.Notes, dek)
            : account.Notes;
        
        return new AccountResponse(
            Id: account.Id,
            Name: account.Name,
            Type: account.Type.ToString(),
            Icon: account.Icon,
            Color: account.Color,
            Currency: account.Currency,
            InitialBalance: account.InitialBalance,
            CurrentBalance: account.CurrentBalance,
            Institution: account.Institution,
            AccountNumber: accountNumber,
            Notes: notes,
            IsArchived: account.IsArchived,
            IsDefault: account.IsDefault,
            IncludeInNetWorth: account.IncludeInNetWorth,
            Order: account.Order,
            CanEditCurrency: canEditCurrency,
            CreatedAt: account.CreatedAt,
            UpdatedAt: account.UpdatedAt
        );
    }
}
