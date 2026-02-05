namespace DigiTransac.Api.Models.Dto;

// Request DTOs
public record CreateLabelRequest(
    string Name,
    string? ParentId,
    string Type, // "Folder" or "Category"
    string? Icon,
    string? Color
);

public record UpdateLabelRequest(
    string Name,
    string? ParentId,
    string? Icon,
    string? Color,
    int? Order
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
    DateTime CreatedAt,
    List<LabelTreeResponse> Children
);
