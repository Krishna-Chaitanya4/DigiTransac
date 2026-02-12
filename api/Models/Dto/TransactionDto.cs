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
    // Timezone-aware date/time fields (for global travel support & advanced options)
    string? DateLocal = null,     // "YYYY-MM-DD" - the human-intended calendar date
    string? TimeLocal = null,     // "HH:mm" - the local time (e.g., "14:30")
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
    // Timezone-aware date/time fields (for global travel support & advanced options)
    string? DateLocal = null,     // "YYYY-MM-DD" - the human-intended calendar date
    string? TimeLocal = null,     // "HH:mm" - the local time (e.g., "14:30")
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
)
{
    /// <summary>
    /// Creates a filter for simple date range queries with optional pagination.
    /// </summary>
    public static TransactionFilterRequest ForDateRange(
        DateTime? startDate = null,
        DateTime? endDate = null,
        int page = 1,
        int pageSize = 50)
    {
        return new TransactionFilterRequest(
            startDate, endDate,
            null, null, null, null, null, null, null, null, null,
            page, pageSize);
    }

    /// <summary>
    /// Creates a filter for analytics queries (no pagination, returns all matching).
    /// </summary>
    public static TransactionFilterRequest ForAnalytics(
        DateTime startDate,
        DateTime endDate,
        List<string>? accountIds = null,
        List<string>? types = null,
        List<string>? labelIds = null)
    {
        return new TransactionFilterRequest(
            startDate, endDate,
            accountIds, types, labelIds,
            null, null, null, null, null, null,
            1, int.MaxValue);
    }

    /// <summary>
    /// Creates a filter for budget spending calculations (expenses only).
    /// </summary>
    public static TransactionFilterRequest ForBudget(
        DateTime periodStart,
        DateTime periodEnd,
        List<string>? accountIds = null,
        List<string>? labelIds = null)
    {
        return new TransactionFilterRequest(
            periodStart, periodEnd,
            accountIds,
            new List<string> { "Send" },  // Budget tracks expenses (Send type)
            labelIds,
            null, null, null, null, null, null,
            1, int.MaxValue);
    }

    /// <summary>
    /// Creates a filter for recurring transaction queries.
    /// </summary>
    public static TransactionFilterRequest ForRecurring(
        DateTime? startDate = null,
        int page = 1,
        int pageSize = int.MaxValue)
    {
        return new TransactionFilterRequest(
            startDate, null,
            null, null, null, null, null, null, null, null, null,
            page, pageSize);
    }

    /// <summary>
    /// Creates an empty filter that returns all transactions with default pagination.
    /// </summary>
    public static TransactionFilterRequest Empty(int page = 1, int pageSize = 50)
    {
        return new TransactionFilterRequest(
            null, null,
            null, null, null, null, null, null, null, null, null,
            page, pageSize);
    }

    /// <summary>
    /// Creates a filter with full control over all parameters (builder-style).
    /// </summary>
    public static TransactionFilterRequestBuilder Builder() => new();
}

/// <summary>
/// Fluent builder for TransactionFilterRequest for complex filtering scenarios.
/// </summary>
public class TransactionFilterRequestBuilder
{
    private DateTime? _startDate;
    private DateTime? _endDate;
    private List<string>? _accountIds;
    private List<string>? _types;
    private List<string>? _labelIds;
    private List<string>? _tagIds;
    private decimal? _minAmount;
    private decimal? _maxAmount;
    private string? _searchText;
    private string? _status;
    private bool? _isRecurring;
    private int? _page;
    private int? _pageSize;
    private bool? _hasLinkedTransaction;
    private List<string>? _searchLabelIds;
    private List<string>? _searchTagIds;
    private List<string>? _searchAccountIds;
    private List<string>? _counterpartyUserIds;
    private List<string>? _searchCounterpartyUserIds;

    public TransactionFilterRequestBuilder WithDateRange(DateTime? start, DateTime? end)
    {
        _startDate = start;
        _endDate = end;
        return this;
    }

    public TransactionFilterRequestBuilder WithAccounts(List<string>? accountIds)
    {
        _accountIds = accountIds;
        return this;
    }

    public TransactionFilterRequestBuilder WithTypes(List<string>? types)
    {
        _types = types;
        return this;
    }

    public TransactionFilterRequestBuilder WithLabels(List<string>? labelIds)
    {
        _labelIds = labelIds;
        return this;
    }

    public TransactionFilterRequestBuilder WithTags(List<string>? tagIds)
    {
        _tagIds = tagIds;
        return this;
    }

    public TransactionFilterRequestBuilder WithAmountRange(decimal? min, decimal? max)
    {
        _minAmount = min;
        _maxAmount = max;
        return this;
    }

    public TransactionFilterRequestBuilder WithSearch(string? searchText)
    {
        _searchText = searchText;
        return this;
    }

    public TransactionFilterRequestBuilder WithStatus(string? status)
    {
        _status = status;
        return this;
    }

    public TransactionFilterRequestBuilder WithRecurring(bool? isRecurring)
    {
        _isRecurring = isRecurring;
        return this;
    }

    public TransactionFilterRequestBuilder WithPagination(int page, int pageSize)
    {
        _page = page;
        _pageSize = pageSize;
        return this;
    }

    public TransactionFilterRequestBuilder WithLinkedTransaction(bool? hasLinked)
    {
        _hasLinkedTransaction = hasLinked;
        return this;
    }

    public TransactionFilterRequestBuilder WithSearchFilters(
        List<string>? searchLabelIds = null,
        List<string>? searchTagIds = null,
        List<string>? searchAccountIds = null)
    {
        _searchLabelIds = searchLabelIds;
        _searchTagIds = searchTagIds;
        _searchAccountIds = searchAccountIds;
        return this;
    }

    public TransactionFilterRequestBuilder WithCounterparties(
        List<string>? counterpartyUserIds = null,
        List<string>? searchCounterpartyUserIds = null)
    {
        _counterpartyUserIds = counterpartyUserIds;
        _searchCounterpartyUserIds = searchCounterpartyUserIds;
        return this;
    }

    public TransactionFilterRequest Build()
    {
        return new TransactionFilterRequest(
            _startDate,
            _endDate,
            _accountIds,
            _types,
            _labelIds,
            _tagIds,
            _minAmount,
            _maxAmount,
            _searchText,
            _status,
            _isRecurring,
            _page ?? 1,
            _pageSize ?? 50,
            _hasLinkedTransaction,
            _searchLabelIds,
            _searchTagIds,
            _searchAccountIds,
            _counterpartyUserIds,
            _searchCounterpartyUserIds);
    }
}

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
    // Timezone-aware date/time fields (for global travel support & analytics)
    string? DateLocal,      // "YYYY-MM-DD" - the human-intended calendar date (always display this if available)
    string? TimeLocal,      // "HH:mm" - the local time (e.g., "14:30")
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
    decimal MonthlyAverage,
    List<SpendingTrend>? DailyTrend = null
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

// Extended Analytics DTOs for Insights Page

/// <summary>
/// Top counterparties (payees) with spending breakdown
/// </summary>
public record TopCounterpartiesResponse(
    List<CounterpartySpending> Counterparties,
    string Currency,
    int? Page = null,
    int? PageSize = null,
    int? TotalCount = null
);

public record CounterpartySpending(
    string Name,            // Payee name (or counterparty email for P2P)
    string? UserId,         // P2P counterparty user ID if applicable
    string? Email,          // P2P counterparty email if applicable
    decimal TotalAmount,
    int TransactionCount,
    decimal Percentage,     // Percentage of total spending
    string Type             // "Payee" or "P2P"
);

/// <summary>
/// Spending breakdown by account
/// </summary>
public record SpendingByAccountResponse(
    List<AccountSpending> Accounts,
    string Currency,
    int? Page = null,
    int? PageSize = null,
    int? TotalCount = null
);

public record AccountSpending(
    string AccountId,
    string AccountName,
    string AccountCurrency,
    decimal TotalDebits,    // Converted to primary currency
    decimal TotalCredits,   // Converted to primary currency
    decimal NetChange,
    int TransactionCount,
    decimal Percentage      // Percentage of total debits
);

/// <summary>
/// Spending patterns by day of week and hour of day
/// </summary>
public record SpendingPatternsResponse(
    List<DayOfWeekSpending> ByDayOfWeek,
    List<HourOfDaySpending> ByHourOfDay,
    string Currency
);

public record DayOfWeekSpending(
    int DayOfWeek,          // 0 = Sunday, 6 = Saturday
    string DayName,         // "Sunday", "Monday", etc.
    decimal TotalAmount,
    int TransactionCount,
    decimal AverageAmount
);

public record HourOfDaySpending(
    int Hour,               // 0-23
    string Label,           // "12 AM", "1 AM", etc.
    decimal TotalAmount,
    int TransactionCount,
    decimal AverageAmount
);

/// <summary>
/// Spending anomalies and alerts
/// </summary>
public record SpendingAnomaliesResponse(
    List<SpendingAnomaly> Anomalies,
    string Currency,
    int? Page = null,
    int? PageSize = null,
    int? TotalCount = null
);

public record SpendingAnomaly(
    string Type,            // "HighTransaction", "UnusualCategory", "SpendingSpike", "NewPayee"
    string Severity,        // "Low", "Medium", "High"
    string Title,
    string Description,
    decimal? Amount,
    string? TransactionId,
    string? CategoryName,
    string? PayeeName,
    DateTime DetectedAt
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

// Location-based Analytics DTOs

/// <summary>
/// Location-based spending insights
/// </summary>
public record LocationInsightsResponse(
    List<LocationSpendingCluster> TopLocations,
    LocationSpendingCluster? NearbySpending,  // Spending near provided coordinates
    decimal TotalSpendingWithLocation,
    int TransactionsWithLocation,
    int TotalTransactions,
    string Currency
);

/// <summary>
/// A cluster of spending at a geographic location
/// </summary>
public record LocationSpendingCluster(
    string Name,              // Place name or city
    double Latitude,
    double Longitude,
    string? City,
    string? Country,
    decimal TotalAmount,
    int TransactionCount,
    decimal Percentage,       // Percentage of total spending with location
    string? TopCategory,      // Most spent category at this location
    string? TopCategoryColor,
    decimal AverageAmount,
    DateTime? FirstVisit,     // Earliest transaction at this location
    DateTime? LastVisit       // Most recent transaction at this location
);

// ============ Trip Grouping DTOs ============

/// <summary>
/// Response containing detected trips based on geographic clustering
/// </summary>
public record TripGroupsResponse(
    List<TripGroup> Trips,
    decimal TotalTripSpending,
    int TotalTripTransactions,
    string Currency
);

/// <summary>
/// A detected trip - a cluster of transactions in a different geographic region
/// </summary>
public record TripGroup(
    string Id,
    string Name,                // Auto-generated name like "Tokyo Trip" or "Paris Weekend"
    string? City,
    string? Country,
    double CenterLatitude,
    double CenterLongitude,
    DateTime StartDate,
    DateTime EndDate,
    int DurationDays,
    decimal TotalAmount,
    int TransactionCount,
    List<TripCategoryBreakdown> CategoryBreakdown,
    List<TripDaySpending> DailyBreakdown,
    bool IsHomeBase              // True if this is the user's home location (not a trip)
);

/// <summary>
/// Category breakdown for a trip
/// </summary>
public record TripCategoryBreakdown(
    string LabelId,
    string LabelName,
    string? LabelColor,
    string? LabelIcon,
    decimal Amount,
    int TransactionCount,
    decimal Percentage
);

/// <summary>
/// Daily spending breakdown for a trip
/// </summary>
public record TripDaySpending(
    DateTime Date,
    string DateLocal,           // YYYY-MM-DD format
    decimal Amount,
    int TransactionCount
);
