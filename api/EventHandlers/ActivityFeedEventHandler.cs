using DigiTransac.Api.Events;
using DigiTransac.Api.Models;
using DigiTransac.Api.Repositories;
using MediatR;

namespace DigiTransac.Api.EventHandlers;

/// <summary>
/// Handles P2P transaction events and creates activity feed messages in the chat.
/// These are system-generated messages that inform users about transaction status changes.
/// </summary>
public class ActivityFeedTransactionAcceptedHandler : INotificationHandler<P2PTransactionAcceptedEvent>
{
    private readonly IChatMessageRepository _chatMessageRepository;
    private readonly IUserRepository _userRepository;
    private readonly ITransactionRepository _transactionRepository;
    private readonly ILogger<ActivityFeedTransactionAcceptedHandler> _logger;

    public ActivityFeedTransactionAcceptedHandler(
        IChatMessageRepository chatMessageRepository,
        IUserRepository userRepository,
        ITransactionRepository transactionRepository,
        ILogger<ActivityFeedTransactionAcceptedHandler> logger)
    {
        _chatMessageRepository = chatMessageRepository;
        _userRepository = userRepository;
        _transactionRepository = transactionRepository;
        _logger = logger;
    }

    public async Task Handle(P2PTransactionAcceptedEvent notification, CancellationToken cancellationToken)
    {
        try
        {
            // Get user details for the activity message
            var recipient = await _userRepository.GetByIdAsync(notification.RecipientId);
            var sender = await _userRepository.GetByIdAsync(notification.SenderId);
            if (recipient == null || sender == null) return;

            // Get transaction for amount formatting
            var transaction = await _transactionRepository.GetByIdAsync(notification.TransactionId);
            if (transaction == null) return;

            var formattedAmount = FormatCurrency(notification.Amount, notification.Currency);

            // Create activity message for the sender (the one who initiated the transaction)
            // "John confirmed your transaction of ₹500"
            var senderMessage = $"{recipient.FullName ?? recipient.Email} confirmed your transaction of {formattedAmount}";
            await _chatMessageRepository.CreateSystemMessageAsync(
                userId: notification.SenderId,
                counterpartyUserId: notification.RecipientId,
                content: senderMessage,
                systemSource: SystemMessageSources.TransactionConfirmed,
                transactionId: notification.TransactionId
            );

            // Create activity message for the recipient (the one who confirmed)
            // "You confirmed the transaction of ₹500"
            var recipientMessage = $"You confirmed the transaction of {formattedAmount}";
            await _chatMessageRepository.CreateSystemMessageAsync(
                userId: notification.RecipientId,
                counterpartyUserId: notification.SenderId,
                content: recipientMessage,
                systemSource: SystemMessageSources.TransactionConfirmed,
                transactionId: notification.TransactionId
            );

            _logger.LogInformation(
                "Created activity feed messages for confirmed transaction {TransactionId}",
                notification.TransactionId);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, 
                "Failed to create activity feed messages for confirmed transaction {TransactionId}",
                notification.TransactionId);
        }
    }

    private static string FormatCurrency(decimal amount, string currency)
    {
        return currency.ToUpperInvariant() switch
        {
            "INR" => $"₹{amount:N2}",
            "USD" => $"${amount:N2}",
            "EUR" => $"€{amount:N2}",
            "GBP" => $"£{amount:N2}",
            _ => $"{amount:N2} {currency}"
        };
    }
}

/// <summary>
/// Creates activity feed messages when a transaction is declined/rejected
/// </summary>
public class ActivityFeedTransactionRejectedHandler : INotificationHandler<P2PTransactionRejectedEvent>
{
    private readonly IChatMessageRepository _chatMessageRepository;
    private readonly IUserRepository _userRepository;
    private readonly ITransactionRepository _transactionRepository;
    private readonly ILogger<ActivityFeedTransactionRejectedHandler> _logger;

    public ActivityFeedTransactionRejectedHandler(
        IChatMessageRepository chatMessageRepository,
        IUserRepository userRepository,
        ITransactionRepository transactionRepository,
        ILogger<ActivityFeedTransactionRejectedHandler> logger)
    {
        _chatMessageRepository = chatMessageRepository;
        _userRepository = userRepository;
        _transactionRepository = transactionRepository;
        _logger = logger;
    }

    public async Task Handle(P2PTransactionRejectedEvent notification, CancellationToken cancellationToken)
    {
        try
        {
            // Get user details
            var recipient = await _userRepository.GetByIdAsync(notification.RecipientId);
            var sender = await _userRepository.GetByIdAsync(notification.SenderId);
            if (recipient == null || sender == null) return;

            // Get transaction details
            var transaction = await _transactionRepository.GetByIdAsync(notification.TransactionId);
            if (transaction == null) return;

            var formattedAmount = FormatCurrency(transaction.Amount, transaction.Currency);
            var reasonSuffix = !string.IsNullOrEmpty(notification.Reason) 
                ? $": \"{notification.Reason}\"" 
                : "";

            // Create activity message for the sender
            // "John declined your transaction of ₹500: "reason""
            var senderMessage = $"{recipient.FullName ?? recipient.Email} declined your transaction of {formattedAmount}{reasonSuffix}";
            await _chatMessageRepository.CreateSystemMessageAsync(
                userId: notification.SenderId,
                counterpartyUserId: notification.RecipientId,
                content: senderMessage,
                systemSource: SystemMessageSources.TransactionDeclined,
                transactionId: notification.TransactionId
            );

            // Create activity message for the recipient
            // "You declined the transaction of ₹500"
            var recipientMessage = $"You declined the transaction of {formattedAmount}{reasonSuffix}";
            await _chatMessageRepository.CreateSystemMessageAsync(
                userId: notification.RecipientId,
                counterpartyUserId: notification.SenderId,
                content: recipientMessage,
                systemSource: SystemMessageSources.TransactionDeclined,
                transactionId: notification.TransactionId
            );

            _logger.LogInformation(
                "Created activity feed messages for declined transaction {TransactionId}",
                notification.TransactionId);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, 
                "Failed to create activity feed messages for declined transaction {TransactionId}",
                notification.TransactionId);
        }
    }

    private static string FormatCurrency(decimal amount, string currency)
    {
        return currency.ToUpperInvariant() switch
        {
            "INR" => $"₹{amount:N2}",
            "USD" => $"${amount:N2}",
            "EUR" => $"€{amount:N2}",
            "GBP" => $"£{amount:N2}",
            _ => $"{amount:N2} {currency}"
        };
    }
}

/// <summary>
/// Creates activity feed messages when a transaction is edited
/// Note: This requires a TransactionEditedEvent to be published
/// </summary>
public class ActivityFeedTransactionEditedHandler : INotificationHandler<TransactionEditedEvent>
{
    private readonly IChatMessageRepository _chatMessageRepository;
    private readonly IUserRepository _userRepository;
    private readonly ITransactionRepository _transactionRepository;
    private readonly ILogger<ActivityFeedTransactionEditedHandler> _logger;

    public ActivityFeedTransactionEditedHandler(
        IChatMessageRepository chatMessageRepository,
        IUserRepository userRepository,
        ITransactionRepository transactionRepository,
        ILogger<ActivityFeedTransactionEditedHandler> logger)
    {
        _chatMessageRepository = chatMessageRepository;
        _userRepository = userRepository;
        _transactionRepository = transactionRepository;
        _logger = logger;
    }

    public async Task Handle(TransactionEditedEvent notification, CancellationToken cancellationToken)
    {
        // Only handle P2P transactions
        if (!notification.IsP2P || string.IsNullOrEmpty(notification.CounterpartyUserId))
            return;

        try
        {
            // Get user details
            var editor = await _userRepository.GetByIdAsync(notification.UserId);
            if (editor == null) return;

            // Get transaction details
            var transaction = await _transactionRepository.GetByIdAsync(notification.TransactionId);
            if (transaction == null) return;

            var formattedAmount = FormatCurrency(transaction.Amount, transaction.Currency);
            var changesDescription = BuildChangesDescription(notification.ChangedFields);

            // Create activity message for the editor (current user's chat view)
            // "You edited the transaction: changed amount, notes"
            var editorMessage = $"You edited the transaction of {formattedAmount}{changesDescription}";
            await _chatMessageRepository.CreateSystemMessageAsync(
                userId: notification.UserId,
                counterpartyUserId: notification.CounterpartyUserId,
                content: editorMessage,
                systemSource: SystemMessageSources.TransactionEdited,
                transactionId: notification.TransactionId
            );

            // Note: We don't notify the counterparty about edits because
            // each user has their own independent copy after confirmation.
            // The counterparty's transaction is unaffected by edits.

            _logger.LogInformation(
                "Created activity feed message for edited transaction {TransactionId}",
                notification.TransactionId);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, 
                "Failed to create activity feed message for edited transaction {TransactionId}",
                notification.TransactionId);
        }
    }

    private static string BuildChangesDescription(IReadOnlyList<string>? changedFields)
    {
        if (changedFields == null || changedFields.Count == 0)
            return "";

        var friendlyNames = changedFields.Select(f => f.ToLowerInvariant() switch
        {
            "amount" => "amount",
            "notes" => "notes",
            "title" => "title",
            "date" => "date",
            "accountid" => "account",
            "splits" => "categories",
            _ => f.ToLowerInvariant()
        }).Distinct();

        return $" (changed: {string.Join(", ", friendlyNames)})";
    }

    private static string FormatCurrency(decimal amount, string currency)
    {
        return currency.ToUpperInvariant() switch
        {
            "INR" => $"₹{amount:N2}",
            "USD" => $"${amount:N2}",
            "EUR" => $"€{amount:N2}",
            "GBP" => $"£{amount:N2}",
            _ => $"{amount:N2} {currency}"
        };
    }
}