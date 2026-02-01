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
    string Type,           // Receive, Send, Transfer
    decimal Amount,
    DateTime Date,
    string? Title,
    string? Payee,
    string? Notes,
    List<TransactionSplitRequest> Splits,
    List<string>? TagIds,
    TransactionLocationRequest? Location,
    string? TransferToAccountId,  // Required for Transfer type (between own accounts)
    RecurringRuleRequest? RecurringRule,
    // P2P fields (optional for Send/Receive)
    string? CounterpartyEmail,    // If provided, creates P2P transaction
    decimal? CounterpartyAmount,  // Optional: if different currency
    // Source (optional, defaults to Manual)
    string? Source = null,        // "Manual", "Chat", "Recurring", "Import", "Transfer"
    // Timezone-aware date fields (for global travel support)
    string? DateLocal = null,     // "YYYY-MM-DD" - the human-intended calendar date
    string? DateTimezone = null   // IANA timezone e.g., "Asia/Kolkata"
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
    string? Status,  // "Pending", "Confirmed", "Declined"
    string? TransferToAccountId,
    string? AccountId,  // Allow changing the account
    // Timezone-aware date fields (for global travel support)
    string? DateLocal = null,     // "YYYY-MM-DD" - the human-intended calendar date
    string? DateTimezone = null   // IANA timezone e.g., "Asia/Kolkata"
);

public record TransactionFilterRequest(
    DateTime? StartDate,
    DateTime? EndDate,
    List<string>? AccountIds,
    List<string>? Types,
    List<string>? LabelIds,
    List<string>? TagIds,
    decimal? MinAmount,
    decimal? MaxAmount,
    string? SearchText,
    string? Status,  // "Pending", "Confirmed", "Declined"
    bool? IsRecurring,
    int? Page,
    int? PageSize,
    bool? HasLinkedTransaction = null,  // Filter for transfers (transactions with linkedTransactionId)
    List<string>? SearchLabelIds = null,
    List<string>? SearchTagIds = null,
    List<string>? SearchAccountIds = null,
    List<string>? CounterpartyUserIds = null,  // Filter by counterparty users
    List<string>? SearchCounterpartyUserIds = null  // Search matched counterparty IDs
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

public record TagInfo(
    string Id,
    string Name,
    string? Color
);

public record TransactionResponse(
    string Id,
    string? AccountId,  // Null for pending P2P transactions
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
    List<TagInfo> Tags,
    TransactionLocationResponse? Location,
    string? TransferToAccountId,
    string? TransferToAccountName,
    string? LinkedTransactionId,
    RecurringRuleResponse? RecurringRule,
    string? ParentTransactionId,
    bool IsRecurringTemplate,
    string Status,  // "Pending", "Confirmed", "Declined"
    DateTime CreatedAt,
    DateTime UpdatedAt,
    // P2P fields
    Guid? TransactionLinkId,
    string? CounterpartyEmail,
    string? CounterpartyUserId,
    string? Role,  // "Sender" or "Receiver"
    DateTime? LastSyncedAt,  // Set when transaction was updated via P2P sync (shows "Edited" badge)
    // Chat integration
    string? ChatMessageId,  // Reference to chat message for "View in Chat" action
    // Timezone-aware date fields (for global travel support)
    string? DateLocal,      // "YYYY-MM-DD" - the human-intended calendar date (always display this if available)
    string? DateTimezone    // IANA timezone e.g., "Asia/Kolkata" (original timezone at creation)
);

public record TransactionListResponse(
    List<TransactionResponse> Transactions,
    int TotalCount,
    int Page,
    int PageSize,
    int TotalPages
);

// Counterparty info for filter dropdown
public record CounterpartyInfo(
    string UserId,
    string Email,
    string? Name,
    int TransactionCount
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
    string? AccountId,  // Null for pending P2P transactions
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

// Batch operation DTOs
public record BatchOperationRequest(
    List<string> Ids,
    string Action,  // delete, markCleared, markPending, updateCategory
    string? LabelId  // For updateCategory action
);

public record BatchOperationResponse(
    int SuccessCount,
    int FailedCount,
    List<string> FailedIds,
    string Message
);

// Export DTOs
public record ExportRequest(
    DateTime? StartDate,
    DateTime? EndDate,
    List<string>? AccountIds,
    List<string>? Types,
    List<string>? LabelIds,
    List<string>? TagIds,
    string Format  // csv, json
);

// Analytics DTOs
public record TransactionAnalyticsResponse(
    List<CategoryBreakdown> TopCategories,
    List<SpendingTrend> SpendingTrend,
    AveragesByType AveragesByType,
    decimal DailyAverage,
    decimal MonthlyAverage
);

public record CategoryBreakdown(
    string LabelId,
    string LabelName,
    string? LabelIcon,
    string? LabelColor,
    decimal Amount,
    int TransactionCount,
    decimal Percentage
);

public record SpendingTrend(
    string Period,  // YYYY-MM-DD or YYYY-MM or YYYY-Wxx
    decimal Credits,
    decimal Debits,
    decimal Net,
    int TransactionCount
);

public record AveragesByType(
    decimal AverageCredit,
    decimal AverageDebit,
    decimal AverageTransfer
);

// Import DTOs
public record ImportTransactionRequest(
    string Type,           // "Receive" or "Send"
    decimal Amount,
    string Date,           // YYYY-MM-DD format
    string? Title,
    string? Payee,
    string? Notes,
    string? LabelName,     // Label name for auto-mapping
    List<string>? TagNames // Tag names for auto-mapping
);

public record BulkImportRequest(
    string AccountId,
    List<ImportTransactionRequest> Transactions,
    bool CreateMissingLabels = false,  // Auto-create labels that don't exist
    bool CreateMissingTags = false,    // Auto-create tags that don't exist
    bool SkipDuplicates = true,        // Skip transactions with same date/amount/payee
    string? DateTimezone = null        // IANA timezone for all imported transactions
);

public record ImportResult(
    int RowNumber,
    bool Success,
    string? TransactionId,
    string? Error
);

public record BulkImportResponse(
    int TotalRows,
    int SuccessCount,
    int FailedCount,
    int SkippedDuplicates,
    List<ImportResult> Results,
    List<string> CreatedLabels,
    List<string> CreatedTags
);

public record ImportPreviewRequest(
    string AccountId,
    List<ImportTransactionRequest> Transactions,
    bool CreateMissingLabels = false,
    bool CreateMissingTags = false,
    bool SkipDuplicates = true
);

// CSV parsing request (for raw CSV/Base64 input)
public record CsvParseRequest(
    string AccountId,
    string? CsvContent,             // Raw CSV text content
    string? Base64Content,          // Base64 encoded file content (for Excel/binary)
    bool HasHeaderRow = true,       // Whether CSV has header row
    string? DateFormat = null,      // Expected date format (optional, auto-detect if null)
    bool CreateMissingLabels = false,
    bool CreateMissingTags = false,
    bool SkipDuplicates = true
);

public record ImportPreviewResponse(
    int TotalRows,
    int ValidRows,
    int InvalidRows,
    int DuplicateRows,
    List<ImportPreviewRow> Rows,
    List<string> MissingLabels,
    List<string> MissingTags
);

public record ImportPreviewRow(
    int RowNumber,
    bool IsValid,
    bool IsDuplicate,
    ImportTransactionRequest Data,
    string? LabelId,         // Mapped label ID (null if not found)
    List<string> TagIds,     // Mapped tag IDs
    List<string> Errors      // Validation errors
);
