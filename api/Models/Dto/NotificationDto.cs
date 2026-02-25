namespace DigiTransac.Api.Models.Dto;

/// <summary>
/// Notification payload for P2P transaction events (created, accepted, rejected).
/// </summary>
public record P2PTransactionNotification(
    string TransactionId,
    string CounterpartyUserId,
    string? CounterpartyEmail,
    string? CounterpartyName,
    string Type,
    decimal Amount,
    string Currency,
    string? Title,
    DateTime Date,
    string Status,
    string? Reason = null
);

/// <summary>
/// Notification payload for chat messages sent via SignalR.
/// </summary>
public record ChatMessageNotification(
    string MessageId,
    string SenderId,
    string RecipientId,
    string? SenderName,
    string MessageType,
    string? Content,
    string? TransactionId,
    DateTime SentAt,
    // Optional transaction data for instant optimistic display on both sender and receiver
    string? TransactionType = null,   // "Send" or "Receive" (from sender's perspective)
    decimal? Amount = null,
    string? Currency = null,
    string? Title = null,
    string? TransactionStatus = null  // "Pending", "Confirmed", "Declined"
);

/// <summary>
/// Notification payload sent via SignalR when a chat message is deleted.
/// </summary>
public record MessageDeletedNotification(
    string MessageId,
    string SenderId
);

/// <summary>
/// Notification payload sent via SignalR when a deleted chat message is restored (undo).
/// </summary>
public record MessageRestoredNotification(
    string MessageId,
    string SenderId
);

/// <summary>
/// Notification for pending transaction count updates.
/// </summary>
public record PendingCountNotification(
    int PendingCount
);

/// <summary>
/// Notification payload for budget alerts when spending thresholds are crossed.
/// </summary>
public record BudgetAlertNotification(
    string BudgetId,
    string BudgetName,
    int ThresholdPercent,
    decimal ActualPercent,
    decimal AmountSpent,
    decimal BudgetAmount,
    string Currency,
    DateTime AlertedAt
);

/// <summary>
/// Payload for Web Push notifications sent to browser service workers.
/// </summary>
public record PushNotificationPayload(
    string Title,
    string Body,
    string? Icon = null,
    string? Badge = null,
    string? Tag = null,
    string? Url = null,
    Dictionary<string, object>? Data = null
);