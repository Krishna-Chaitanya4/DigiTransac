using DigiTransac.Api.Events;
using DigiTransac.Api.Hubs;
using DigiTransac.Api.Models.Dto;
using DigiTransac.Api.Repositories;
using MediatR;

namespace DigiTransac.Api.EventHandlers;

/// <summary>
/// Handles P2P transaction events and sends real-time notifications via SignalR.
/// This keeps the notification logic decoupled from the transaction services.
/// </summary>
public class P2PTransactionCreatedNotificationHandler : INotificationHandler<TransactionCreatedEvent>
{
    private readonly INotificationService _notificationService;
    private readonly IUserRepository _userRepository;
    private readonly ITransactionRepository _transactionRepository;
    private readonly ILogger<P2PTransactionCreatedNotificationHandler> _logger;

    public P2PTransactionCreatedNotificationHandler(
        INotificationService notificationService,
        IUserRepository userRepository,
        ITransactionRepository transactionRepository,
        ILogger<P2PTransactionCreatedNotificationHandler> logger)
    {
        _notificationService = notificationService;
        _userRepository = userRepository;
        _transactionRepository = transactionRepository;
        _logger = logger;
    }

    public async Task Handle(TransactionCreatedEvent notification, CancellationToken cancellationToken)
    {
        // Only handle P2P transactions
        if (!notification.IsP2P || string.IsNullOrEmpty(notification.CounterpartyUserId))
            return;

        try
        {
            // Get sender user details
            var sender = await _userRepository.GetByIdAsync(notification.UserId);
            if (sender == null) return;

            // Get the transaction details
            var transaction = await _transactionRepository.GetByIdAsync(notification.TransactionId);
            if (transaction == null) return;

            // Notify the counterparty about the new pending transaction
            var p2pNotification = new P2PTransactionNotification(
                TransactionId: notification.TransactionId,
                CounterpartyUserId: notification.UserId,
                CounterpartyEmail: sender.Email,
                CounterpartyName: sender.FullName,
                Type: notification.Type.ToString(),
                Amount: notification.Amount,
                Currency: notification.Currency,
                Title: transaction.Title,
                Date: transaction.Date,
                Status: "Pending"
            );

            await _notificationService.NotifyP2PTransactionCreatedAsync(
                notification.CounterpartyUserId, 
                p2pNotification);

            _logger.LogInformation(
                "Sent P2P transaction created notification to user {CounterpartyUserId} for transaction {TransactionId}",
                notification.CounterpartyUserId, notification.TransactionId);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, 
                "Failed to send P2P transaction created notification for transaction {TransactionId}",
                notification.TransactionId);
        }
    }
}

/// <summary>
/// Handles P2P transaction accepted events and notifies the original sender
/// </summary>
public class P2PTransactionAcceptedNotificationHandler : INotificationHandler<P2PTransactionAcceptedEvent>
{
    private readonly INotificationService _notificationService;
    private readonly IUserRepository _userRepository;
    private readonly ITransactionRepository _transactionRepository;
    private readonly ILogger<P2PTransactionAcceptedNotificationHandler> _logger;

    public P2PTransactionAcceptedNotificationHandler(
        INotificationService notificationService,
        IUserRepository userRepository,
        ITransactionRepository transactionRepository,
        ILogger<P2PTransactionAcceptedNotificationHandler> logger)
    {
        _notificationService = notificationService;
        _userRepository = userRepository;
        _transactionRepository = transactionRepository;
        _logger = logger;
    }

    public async Task Handle(P2PTransactionAcceptedEvent notification, CancellationToken cancellationToken)
    {
        try
        {
            // Get recipient (the one who accepted) details
            var recipient = await _userRepository.GetByIdAsync(notification.RecipientId);
            if (recipient == null) return;

            // Get the transaction details
            var transaction = await _transactionRepository.GetByIdAsync(notification.TransactionId);
            if (transaction == null) return;

            // Notify the original sender that the transaction was accepted
            var p2pNotification = new P2PTransactionNotification(
                TransactionId: notification.TransactionId,
                CounterpartyUserId: notification.RecipientId,
                CounterpartyEmail: recipient.Email,
                CounterpartyName: recipient.FullName,
                Type: transaction.Type.ToString(),
                Amount: notification.Amount,
                Currency: notification.Currency,
                Title: transaction.Title,
                Date: transaction.Date,
                Status: "Confirmed"
            );

            await _notificationService.NotifyP2PTransactionAcceptedAsync(
                notification.SenderId, 
                p2pNotification);

            _logger.LogInformation(
                "Sent P2P transaction accepted notification to user {SenderId} for transaction {TransactionId}",
                notification.SenderId, notification.TransactionId);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, 
                "Failed to send P2P transaction accepted notification for transaction {TransactionId}",
                notification.TransactionId);
        }
    }
}

/// <summary>
/// Handles P2P transaction rejected events and notifies the original sender
/// </summary>
public class P2PTransactionRejectedNotificationHandler : INotificationHandler<P2PTransactionRejectedEvent>
{
    private readonly INotificationService _notificationService;
    private readonly IUserRepository _userRepository;
    private readonly ITransactionRepository _transactionRepository;
    private readonly ILogger<P2PTransactionRejectedNotificationHandler> _logger;

    public P2PTransactionRejectedNotificationHandler(
        INotificationService notificationService,
        IUserRepository userRepository,
        ITransactionRepository transactionRepository,
        ILogger<P2PTransactionRejectedNotificationHandler> logger)
    {
        _notificationService = notificationService;
        _userRepository = userRepository;
        _transactionRepository = transactionRepository;
        _logger = logger;
    }

    public async Task Handle(P2PTransactionRejectedEvent notification, CancellationToken cancellationToken)
    {
        try
        {
            // Get recipient (the one who rejected) details
            var recipient = await _userRepository.GetByIdAsync(notification.RecipientId);
            if (recipient == null) return;

            // Get the transaction details
            var transaction = await _transactionRepository.GetByIdAsync(notification.TransactionId);
            if (transaction == null) return;

            // Notify the original sender that the transaction was rejected
            var p2pNotification = new P2PTransactionNotification(
                TransactionId: notification.TransactionId,
                CounterpartyUserId: notification.RecipientId,
                CounterpartyEmail: recipient.Email,
                CounterpartyName: recipient.FullName,
                Type: transaction.Type.ToString(),
                Amount: transaction.Amount,
                Currency: transaction.Currency,
                Title: transaction.Title,
                Date: transaction.Date,
                Status: "Declined",
                Reason: notification.Reason
            );

            await _notificationService.NotifyP2PTransactionRejectedAsync(
                notification.SenderId, 
                p2pNotification);

            _logger.LogInformation(
                "Sent P2P transaction rejected notification to user {SenderId} for transaction {TransactionId}",
                notification.SenderId, notification.TransactionId);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, 
                "Failed to send P2P transaction rejected notification for transaction {TransactionId}",
                notification.TransactionId);
        }
    }
}