using System.Security.Claims;
using DigiTransac.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

namespace DigiTransac.Api.Hubs;

/// <summary>
/// SignalR hub for real-time notifications.
/// Sends notifications for P2P transactions, chat messages, and other real-time updates.
/// Users are added to groups based on their user ID for targeted notifications.
/// </summary>
[Authorize]
public class NotificationHub : Hub
{
    private readonly ILogger<NotificationHub> _logger;

    public NotificationHub(ILogger<NotificationHub> logger)
    {
        _logger = logger;
    }

    public override async Task OnConnectedAsync()
    {
        var userId = GetUserId();
        if (!string.IsNullOrEmpty(userId))
        {
            // Add user to their own group for direct notifications
            await Groups.AddToGroupAsync(Context.ConnectionId, $"user:{userId}");
            _logger.LogInformation("User {UserId} connected with connection {ConnectionId}", userId, Context.ConnectionId);
        }
        
        await base.OnConnectedAsync();
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        var userId = GetUserId();
        if (!string.IsNullOrEmpty(userId))
        {
            await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"user:{userId}");
            _logger.LogInformation("User {UserId} disconnected from connection {ConnectionId}", userId, Context.ConnectionId);
        }
        
        if (exception != null)
        {
            _logger.LogError(exception, "User {UserId} disconnected with error", userId);
        }
        
        await base.OnDisconnectedAsync(exception);
    }

    /// <summary>
    /// Join a conversation group to receive real-time updates for that conversation
    /// </summary>
    public async Task JoinConversation(string counterpartyUserId)
    {
        var userId = GetUserId();
        if (string.IsNullOrEmpty(userId)) return;

        // Create a deterministic conversation group name (sorted user IDs)
        var conversationGroup = GetConversationGroupName(userId, counterpartyUserId);
        await Groups.AddToGroupAsync(Context.ConnectionId, conversationGroup);
        _logger.LogDebug("User {UserId} joined conversation group {Group}", userId, conversationGroup);
    }

    /// <summary>
    /// Leave a conversation group
    /// </summary>
    public async Task LeaveConversation(string counterpartyUserId)
    {
        var userId = GetUserId();
        if (string.IsNullOrEmpty(userId)) return;

        var conversationGroup = GetConversationGroupName(userId, counterpartyUserId);
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, conversationGroup);
        _logger.LogDebug("User {UserId} left conversation group {Group}", userId, conversationGroup);
    }

    /// <summary>
    /// Ping to keep connection alive
    /// </summary>
    public async Task Ping()
    {
        await Clients.Caller.SendAsync("Pong", DateTime.UtcNow);
    }

    private string? GetUserId()
    {
        return Context.User?.FindFirstValue(ClaimTypes.NameIdentifier) 
            ?? Context.User?.FindFirstValue("sub");
    }

    /// <summary>
    /// Creates a deterministic group name for a conversation between two users
    /// </summary>
    public static string GetConversationGroupName(string userId1, string userId2)
    {
        // Sort IDs to ensure same group name regardless of order
        var ids = new[] { userId1, userId2 }.OrderBy(id => id).ToArray();
        return $"conversation:{ids[0]}:{ids[1]}";
    }
}

/// <summary>
/// Service for sending notifications through SignalR from outside the hub
/// </summary>
public interface INotificationService
{
    /// <summary>
    /// Send a notification to a specific user
    /// </summary>
    Task NotifyUserAsync(string userId, string method, object payload);

    /// <summary>
    /// Send a notification to all participants of a conversation
    /// </summary>
    Task NotifyConversationAsync(string userId1, string userId2, string method, object payload);

    /// <summary>
    /// Send a P2P transaction created notification
    /// </summary>
    Task NotifyP2PTransactionCreatedAsync(string recipientUserId, P2PTransactionNotification notification);

    /// <summary>
    /// Send a P2P transaction accepted notification
    /// </summary>
    Task NotifyP2PTransactionAcceptedAsync(string senderUserId, P2PTransactionNotification notification);

    /// <summary>
    /// Send a P2P transaction rejected notification
    /// </summary>
    Task NotifyP2PTransactionRejectedAsync(string senderUserId, P2PTransactionNotification notification);

    /// <summary>
    /// Send a chat message notification
    /// </summary>
    Task NotifyChatMessageAsync(string userId1, string userId2, ChatMessageNotification notification);
    
    /// <summary>
    /// Send a budget alert notification when spending threshold is crossed
    /// </summary>
    Task SendBudgetAlertAsync(
        string userId,
        string budgetId,
        string budgetName,
        int thresholdPercent,
        decimal actualPercent,
        decimal amountSpent,
        decimal budgetAmount,
        string currency);
}

public class NotificationService : INotificationService
{
    private readonly IHubContext<NotificationHub> _hubContext;
    private readonly IWebPushService? _webPushService;
    private readonly ILogger<NotificationService> _logger;

    public NotificationService(
        IHubContext<NotificationHub> hubContext,
        ILogger<NotificationService> logger,
        IWebPushService? webPushService = null)
    {
        _hubContext = hubContext;
        _logger = logger;
        _webPushService = webPushService;
    }

    public async Task NotifyUserAsync(string userId, string method, object payload)
    {
        try
        {
            await _hubContext.Clients.Group($"user:{userId}").SendAsync(method, payload);
            _logger.LogDebug("Sent {Method} notification to user {UserId}", method, userId);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to send {Method} notification to user {UserId}", method, userId);
        }
    }

    public async Task NotifyConversationAsync(string userId1, string userId2, string method, object payload)
    {
        try
        {
            var groupName = NotificationHub.GetConversationGroupName(userId1, userId2);
            await _hubContext.Clients.Group(groupName).SendAsync(method, payload);
            _logger.LogDebug("Sent {Method} notification to conversation {Group}", method, groupName);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to send {Method} notification to conversation", method);
        }
    }

    public async Task NotifyP2PTransactionCreatedAsync(string recipientUserId, P2PTransactionNotification notification)
    {
        await NotifyUserAsync(recipientUserId, "P2PTransactionCreated", notification);
    }

    public async Task NotifyP2PTransactionAcceptedAsync(string senderUserId, P2PTransactionNotification notification)
    {
        await NotifyUserAsync(senderUserId, "P2PTransactionAccepted", notification);
    }

    public async Task NotifyP2PTransactionRejectedAsync(string senderUserId, P2PTransactionNotification notification)
    {
        await NotifyUserAsync(senderUserId, "P2PTransactionRejected", notification);
    }

    public async Task NotifyChatMessageAsync(string userId1, string userId2, ChatMessageNotification notification)
    {
        // Send to conversation group and also directly to the recipient via SignalR (real-time in-app)
        await NotifyConversationAsync(userId1, userId2, "ChatMessage", notification);
        
        // Also send direct notification to recipient user via SignalR
        var recipientId = notification.SenderId == userId1 ? userId2 : userId1;
        await NotifyUserAsync(recipientId, "NewChatMessage", notification);
        
        // Send web push notification to recipient (for when app is closed/background)
        if (_webPushService != null)
        {
            try
            {
                var pushPayload = new PushNotificationPayload(
                    Title: notification.SenderName ?? "New Message",
                    Body: notification.MessageType == "money"
                        ? $"{notification.SenderName ?? "Someone"} sent you money!"
                        : notification.Content ?? "You have a new message",
                    Icon: "/icons/icon-192x192.png",
                    Badge: "/icons/icon-72x72.png",
                    Tag: $"chat-{notification.SenderId}",
                    Url: $"/chats?userId={notification.SenderId}"
                );
                
                await _webPushService.SendToUserAsync(recipientId, pushPayload);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to send web push notification for chat message");
            }
        }
    }
    
    public async Task SendBudgetAlertAsync(
        string userId,
        string budgetId,
        string budgetName,
        int thresholdPercent,
        decimal actualPercent,
        decimal amountSpent,
        decimal budgetAmount,
        string currency)
    {
        var notification = new BudgetAlertNotification(
            BudgetId: budgetId,
            BudgetName: budgetName,
            ThresholdPercent: thresholdPercent,
            ActualPercent: actualPercent,
            AmountSpent: amountSpent,
            BudgetAmount: budgetAmount,
            Currency: currency,
            AlertedAt: DateTime.UtcNow);
            
        await NotifyUserAsync(userId, "BudgetAlert", notification);
        _logger.LogInformation("Sent budget alert for {BudgetName} ({Threshold}%) to user {UserId}",
            budgetName, thresholdPercent, userId);
    }
}

#region Notification DTOs

/// <summary>
/// Notification payload for P2P transaction events
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
/// Notification payload for chat messages
/// </summary>
public record ChatMessageNotification(
    string MessageId,
    string SenderId,
    string? SenderName,
    string MessageType,
    string? Content,
    string? TransactionId,
    DateTime SentAt
);

/// <summary>
/// Notification for pending transaction count updates
/// </summary>
public record PendingCountNotification(
    int PendingCount
);

/// <summary>
/// Notification payload for budget alerts
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

#endregion