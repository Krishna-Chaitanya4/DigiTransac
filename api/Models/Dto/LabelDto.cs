namespace DigiTransac.Api.Models.Dto;

// Request DTOs
public record CreateLabelRequest(
    string Name,
    string? ParentId,
    string Type, // "Folder" or "Category"
    string? Icon,
    string? Color,
    bool? ExcludeFromAnalytics = null
);

public record UpdateLabelRequest(
    string? Name = null,
    string? ParentId = null,
    string? Icon = null,
    string? Color = null,
    int? Order = null,
    bool? ExcludeFromAnalytics = null
);

public record ReorderLabelsRequest(
    List<LabelOrderItem> Items
);

public record LabelOrderItem(
    string Id,
    int Order
);

// Response DTOs
public record LabelResponse(
    string Id,
    string Name,
    string? ParentId,
    string Type,
    string? Icon,
    string? Color,
    int Order,
    bool IsSystem,
    bool ExcludeFromAnalytics,
    DateTime CreatedAt
);

public record LabelTreeResponse(
    string Id,
    string Name,
    string? ParentId,
    string Type,
    string? Icon,
    string? Color,
    int Order,
    bool IsSystem,
    bool ExcludeFromAnalytics,
    DateTime CreatedAt,
    List<LabelTreeResponse> Children
);

// Usage statistics per label
public record LabelUsageStat(
    int TransactionCount,
    decimal TotalAmount
);

public record LabelUsageStatsResponse(
    Dictionary<string, LabelUsageStat> Stats,
    string Currency
);
