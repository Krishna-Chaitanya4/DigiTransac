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
    string? PrimaryCurrency   // Most common currency used
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
    bool IsRead,
    DateTime CreatedAt
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
    bool IsPending,           // True if AccountId is null (needs acceptance)
    bool IsCleared,
    string? AccountName       // The account used (null if pending)
);

public record ConversationDetailResponse(
    string CounterpartyUserId,
    string CounterpartyEmail,
    string? CounterpartyName,
    List<ConversationMessage> Messages,
    int TotalCount,
    bool HasMore,
    decimal TotalSent,
    decimal TotalReceived
);

// Request DTOs

public record SendMessageRequest(
    string Content
);

public record SendMoneyRequest(
    string AccountId,
    decimal Amount,
    string? Title,
    string? Notes,
    List<TransactionSplitRequest> Splits
);
