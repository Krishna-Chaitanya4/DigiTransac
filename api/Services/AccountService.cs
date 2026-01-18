using DigiTransac.Api.Models;
using DigiTransac.Api.Models.Dto;
using DigiTransac.Api.Repositories;

namespace DigiTransac.Api.Services;

public interface IAccountService
{
    Task<List<AccountResponse>> GetAllAsync(string userId, bool includeArchived = false);
    Task<AccountResponse?> GetByIdAsync(string id, string userId);
    Task<AccountSummaryResponse> GetSummaryAsync(string userId);
    Task<(bool Success, string Message, AccountResponse? Account)> CreateAsync(string userId, CreateAccountRequest request);
    Task<(bool Success, string Message, AccountResponse? Account)> UpdateAsync(string id, string userId, UpdateAccountRequest request);
    Task<(bool Success, string Message)> AdjustBalanceAsync(string id, string userId, AdjustBalanceRequest request);
    Task<(bool Success, string Message)> ReorderAsync(string userId, ReorderAccountsRequest request);
    Task<(bool Success, string Message)> DeleteAsync(string id, string userId);
}

public class AccountService : IAccountService
{
    private readonly IAccountRepository _accountRepository;
    private readonly IUserRepository _userRepository;
    private readonly IExchangeRateService _exchangeRateService;

    public AccountService(
        IAccountRepository accountRepository,
        IUserRepository userRepository,
        IExchangeRateService exchangeRateService)
    {
        _accountRepository = accountRepository;
        _userRepository = userRepository;
        _exchangeRateService = exchangeRateService;
    }

    public async Task<List<AccountResponse>> GetAllAsync(string userId, bool includeArchived = false)
    {
        var accounts = await _accountRepository.GetByUserIdAsync(userId, includeArchived);
        return accounts.Select(MapToResponse).ToList();
    }

    public async Task<AccountResponse?> GetByIdAsync(string id, string userId)
    {
        var account = await _accountRepository.GetByIdAndUserIdAsync(id, userId);
        return account == null ? null : MapToResponse(account);
    }

    public async Task<AccountSummaryResponse> GetSummaryAsync(string userId)
    {
        var accounts = await _accountRepository.GetByUserIdAsync(userId, includeArchived: false);
        var includedAccounts = accounts.Where(a => a.IncludeInNetWorth).ToList();
        
        // Get user's primary currency preference
        var user = await _userRepository.GetByIdAsync(userId);
        var primaryCurrency = user?.PrimaryCurrency ?? "USD";
        
        // Get exchange rates
        var ratesResponse = await _exchangeRateService.GetRatesAsync();
        var rates = ratesResponse.Rates;

        // Assets: Bank, Cash, DigitalWallet, Investment
        // Liabilities: CreditCard, Loan
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
                    liabilities += Math.Abs(account.CurrentBalance);
                }
                else
                {
                    assets += account.CurrentBalance;
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

    public async Task<(bool Success, string Message, AccountResponse? Account)> CreateAsync(string userId, CreateAccountRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
        {
            return (false, "Account name is required", null);
        }

        if (!Enum.TryParse<AccountType>(request.Type, true, out var accountType))
        {
            return (false, "Invalid account type", null);
        }

        var count = await _accountRepository.GetCountByUserIdAsync(userId);

        // Get user's primary currency if not specified
        var currency = request.Currency;
        if (string.IsNullOrWhiteSpace(currency))
        {
            var user = await _userRepository.GetByIdAsync(userId);
            currency = user?.PrimaryCurrency ?? "USD";
        }

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
            AccountNumber = request.AccountNumber,
            Notes = request.Notes,
            IncludeInNetWorth = request.IncludeInNetWorth ?? true,
            Order = count,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        await _accountRepository.CreateAsync(account);
        return (true, "Account created successfully", MapToResponse(account));
    }

    public async Task<(bool Success, string Message, AccountResponse? Account)> UpdateAsync(string id, string userId, UpdateAccountRequest request)
    {
        var account = await _accountRepository.GetByIdAndUserIdAsync(id, userId);
        if (account == null)
        {
            return (false, "Account not found", null);
        }

        if (request.Name != null)
        {
            if (string.IsNullOrWhiteSpace(request.Name))
            {
                return (false, "Account name cannot be empty", null);
            }
            account.Name = request.Name.Trim();
        }

        if (request.Icon != null) account.Icon = request.Icon;
        if (request.Color != null) account.Color = request.Color;
        
        // Currency can only be changed if balance hasn't been modified
        if (request.Currency != null && request.Currency != account.Currency)
        {
            if (account.CurrentBalance != account.InitialBalance)
            {
                return (false, "Currency cannot be changed after balance has been modified", null);
            }
            account.Currency = request.Currency;
        }
        
        if (request.Institution != null) account.Institution = request.Institution;
        if (request.AccountNumber != null) account.AccountNumber = request.AccountNumber;
        if (request.Notes != null) account.Notes = request.Notes;
        if (request.IsArchived.HasValue) account.IsArchived = request.IsArchived.Value;
        if (request.IncludeInNetWorth.HasValue) account.IncludeInNetWorth = request.IncludeInNetWorth.Value;
        if (request.Order.HasValue) account.Order = request.Order.Value;

        await _accountRepository.UpdateAsync(account);
        return (true, "Account updated successfully", MapToResponse(account));
    }

    public async Task<(bool Success, string Message)> AdjustBalanceAsync(string id, string userId, AdjustBalanceRequest request)
    {
        var account = await _accountRepository.GetByIdAndUserIdAsync(id, userId);
        if (account == null)
        {
            return (false, "Account not found");
        }

        account.CurrentBalance = request.NewBalance;
        if (!string.IsNullOrWhiteSpace(request.Notes))
        {
            account.Notes = request.Notes;
        }

        await _accountRepository.UpdateAsync(account);
        return (true, "Balance adjusted successfully");
    }

    public async Task<(bool Success, string Message)> ReorderAsync(string userId, ReorderAccountsRequest request)
    {
        foreach (var item in request.Items)
        {
            var account = await _accountRepository.GetByIdAndUserIdAsync(item.Id, userId);
            if (account != null)
            {
                account.Order = item.Order;
                await _accountRepository.UpdateAsync(account);
            }
        }

        return (true, "Accounts reordered successfully");
    }

    public async Task<(bool Success, string Message)> DeleteAsync(string id, string userId)
    {
        var account = await _accountRepository.GetByIdAndUserIdAsync(id, userId);
        if (account == null)
        {
            return (false, "Account not found");
        }

        // TODO: Check if account has transactions before deleting
        // For now, allow deletion

        await _accountRepository.DeleteAsync(id, userId);
        return (true, "Account deleted successfully");
    }

    private static AccountResponse MapToResponse(Account account)
    {
        // Currency can only be edited if balance hasn't changed (no transactions/adjustments)
        var canEditCurrency = account.CurrentBalance == account.InitialBalance;
        
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
            AccountNumber: account.AccountNumber,
            Notes: account.Notes,
            IsArchived: account.IsArchived,
            IncludeInNetWorth: account.IncludeInNetWorth,
            Order: account.Order,
            CanEditCurrency: canEditCurrency,
            CreatedAt: account.CreatedAt,
            UpdatedAt: account.UpdatedAt
        );
    }
}
