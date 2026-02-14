namespace DigiTransac.Api.Models.Dto;

// Conversation DTOs

/// <summary>
/// Summary of a conversation with another user (for list view)
/// </summary>
public record ConversationSummary(
    string CounterpartyUserId,
    string CounterpartyEmail,
    string? CounterpartyName,
    DateTime LastActivityAt,
    string? LastMessagePreview,
    string? LastMessageType,  // "Text", "Transaction", "Request"
    int UnreadCount,
    decimal? TotalSent,       // Total amount sent to this person
    decimal? TotalReceived,   // Total amount received from this person
    string? PrimaryCurrency,  // Most common currency used
    bool IsSelfChat = false   // True when this is user's personal transaction log
);

public record ConversationListResponse(
    List<ConversationSummary> Conversations,
    int TotalUnreadCount
);

/// <summary>
/// A single message/item in a conversation
/// </summary>
public record ConversationMessage(
    string Id,
    string Type,              // "Text", "Transaction", "Request"
    string SenderUserId,
    bool IsFromMe,            // Convenience field for UI
    string? Content,          // Text content for text messages
    TransactionMessageData? Transaction,  // Transaction details if type is Transaction
    string Status,            // "Sent", "Delivered", "Read"
    DateTime CreatedAt,
    DateTime? DeliveredAt,
    DateTime? ReadAt,
    bool IsEdited,
    DateTime? EditedAt,
    bool IsDeleted,
    DateTime? DeletedAt,
    string? ReplyToMessageId,
    ReplyPreview? ReplyTo,    // Preview of the replied message
    bool IsSystemGenerated = false,  // True if auto-created (recurring, import, etc.)
    string? SystemSource = null      // Source: "Recurring", "Import", "Transfer", etc.
);

/// <summary>
/// Preview of a replied message
/// </summary>
public record ReplyPreview(
    string MessageId,
    string SenderUserId,
    string? SenderName,
    string Type,
    string? ContentPreview    // Truncated content or "📷 Photo" / "💰 Transaction" etc.
);

/// <summary>
/// Category info for transaction message display
/// </summary>
public record TransactionCategoryInfo(
    string LabelId,
    string Name,
    string? Icon,
    string? Color
);

/// <summary>
/// Transaction data embedded in a conversation message
/// </summary>
public record TransactionMessageData(
    string TransactionId,
    Guid TransactionLinkId,
    string TransactionType,   // "Send" or "Receive" from viewer's perspective
    decimal Amount,
    string Currency,
    DateTime Date,
    string? Title,
    string? Notes,
    string Status,            // "Pending", "Confirmed", "Declined"
    string? AccountName,      // The account used (null if pending)
    TransactionCategoryInfo? PrimaryCategory = null,  // Primary category (first split)
    bool IsDeleted = false,           // Whether the transaction is soft-deleted
    DateTime? DeletedAt = null        // When the transaction was soft-deleted
);

public record ConversationDetailResponse(
    string CounterpartyUserId,
    string CounterpartyEmail,
    string? CounterpartyName,
    List<ConversationMessage> Messages,
    int TotalCount,
    bool HasMore,
    decimal TotalSent,
    decimal TotalReceived,
    bool IsSelfChat = false  // True when this is user's personal transaction log
);

// Request DTOs

public record SendMessageRequest(
    string Content,
    string? ReplyToMessageId = null
);

public record EditMessageRequest(
    string Content
);

public record SendMoneyRequest(
    string AccountId,
    string Type,  // "Send" or "Receive"
    decimal Amount,
    string? Title,
    string? Notes,
    List<TransactionSplitRequest> Splits
);

// User search for starting new conversations

public record UserSearchResult(
    string UserId,
    string Email,
    string? Name
);

public record UserSearchResponse(
    UserSearchResult? User,
    bool Found
);
