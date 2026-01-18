namespace DigiTransac.Api.Models.Dto;

// Request DTOs
public record CreateAccountRequest(
    string Name,
    string Type,
    string? Icon,
    string? Color,
    string? Currency,
    decimal? InitialBalance,
    string? Institution,
    string? AccountNumber,
    string? Notes,
    bool? IncludeInNetWorth
);

public record UpdateAccountRequest(
    string? Name,
    string? Icon,
    string? Color,
    string? Currency,
    string? Institution,
    string? AccountNumber,
    string? Notes,
    bool? IsArchived,
    bool? IncludeInNetWorth,
    int? Order
);

public record ReorderAccountsRequest(
    List<AccountOrderItem> Items
);

public record AccountOrderItem(
    string Id,
    int Order
);

public record AdjustBalanceRequest(
    decimal NewBalance,
    string? Notes
);

// Response DTOs
public record AccountResponse(
    string Id,
    string Name,
    string Type,
    string? Icon,
    string? Color,
    string Currency,
    decimal InitialBalance,
    decimal CurrentBalance,
    string? Institution,
    string? AccountNumber,
    string? Notes,
    bool IsArchived,
    bool IncludeInNetWorth,
    int Order,
    bool CanEditCurrency,
    DateTime CreatedAt,
    DateTime UpdatedAt
);

public record AccountSummaryResponse(
    decimal TotalAssets,
    decimal TotalLiabilities,
    decimal NetWorth,
    string PrimaryCurrency,
    Dictionary<string, decimal> BalancesByType,
    Dictionary<string, CurrencyBalances> BalancesByCurrency,
    DateTime? RatesLastUpdated
);

public record CurrencyBalances(
    decimal Assets,
    decimal Liabilities,
    decimal NetWorth,
    decimal AssetsConverted,
    decimal LiabilitiesConverted,
    decimal NetWorthConverted
);
