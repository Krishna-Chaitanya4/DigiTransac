namespace DigiTransac.Api.Models.Dto;

// Request DTOs
public record TransactionSplitRequest(
    string LabelId,
    decimal Amount,
    string? Notes
);

public record TransactionLocationRequest(
    double Latitude,
    double Longitude,
    string? PlaceName,
    string? City,
    string? Country
);

public record RecurringRuleRequest(
    string Frequency,  // Daily, Weekly, Biweekly, Monthly, Quarterly, Yearly
    int? Interval,     // Default 1
    DateTime? EndDate
);

public record CreateTransactionRequest(
    string AccountId,
    string Type,           // Credit, Debit, Transfer
    decimal Amount,
    DateTime Date,
    string? Title,
    string? Payee,
    string? Notes,
    List<TransactionSplitRequest> Splits,
    List<string>? TagIds,
    TransactionLocationRequest? Location,
    string? TransferToAccountId,  // Required for Transfer type
    RecurringRuleRequest? RecurringRule
);

public record UpdateTransactionRequest(
    string? Type,
    decimal? Amount,
    DateTime? Date,
    string? Title,
    string? Payee,
    string? Notes,
    List<TransactionSplitRequest>? Splits,
    List<string>? TagIds,
    TransactionLocationRequest? Location,
    bool? IsCleared,
    string? TransferToAccountId
);

public record TransactionFilterRequest(
    DateTime? StartDate,
    DateTime? EndDate,
    string? AccountId,
    string? Type,
    string? LabelId,
    string? TagId,
    decimal? MinAmount,
    decimal? MaxAmount,
    string? SearchText,
    bool? IsCleared,
    bool? IsRecurring,
    int? Page,
    int? PageSize
);

// Response DTOs
public record TransactionSplitResponse(
    string LabelId,
    string? LabelName,
    string? LabelColor,
    string? LabelIcon,
    decimal Amount,
    string? Notes
);

public record TransactionLocationResponse(
    double Latitude,
    double Longitude,
    string? PlaceName,
    string? City,
    string? Country
);

public record RecurringRuleResponse(
    string Frequency,
    int Interval,
    DateTime? EndDate,
    DateTime NextOccurrence
);

public record TransactionResponse(
    string Id,
    string AccountId,
    string? AccountName,
    string Type,
    decimal Amount,
    string Currency,
    DateTime Date,
    string? Title,
    string? Payee,
    string? Notes,
    List<TransactionSplitResponse> Splits,
    List<string> TagIds,
    TransactionLocationResponse? Location,
    string? TransferToAccountId,
    string? TransferToAccountName,
    string? LinkedTransactionId,
    RecurringRuleResponse? RecurringRule,
    string? ParentTransactionId,
    bool IsRecurringTemplate,
    bool IsCleared,
    DateTime CreatedAt,
    DateTime UpdatedAt
);

public record TransactionListResponse(
    List<TransactionResponse> Transactions,
    int TotalCount,
    int Page,
    int PageSize,
    int TotalPages
);

public record TransactionSummaryResponse(
    decimal TotalCredits,
    decimal TotalDebits,
    decimal NetChange,
    int TransactionCount,
    Dictionary<string, decimal> ByCategory,  // LabelId -> Amount
    Dictionary<string, decimal> ByTag,       // TagId -> Amount
    string Currency
);

public record RecurringTransactionResponse(
    string Id,
    string AccountId,
    string? AccountName,
    string Type,
    decimal Amount,
    string Currency,
    string? Title,
    string? Payee,
    List<TransactionSplitResponse> Splits,
    RecurringRuleResponse RecurringRule,
    DateTime CreatedAt
);
