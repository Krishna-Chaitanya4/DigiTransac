using MediatR;
using Serilog;

namespace DigiTransac.Api.Events.Handlers;

/// <summary>
/// Handles TransactionCreatedEvent for logging and analytics
/// </summary>
public class TransactionCreatedEventHandler : INotificationHandler<TransactionCreatedEvent>
{
    private readonly ILogger<TransactionCreatedEventHandler> _logger;

    public TransactionCreatedEventHandler(ILogger<TransactionCreatedEventHandler> logger)
    {
        _logger = logger;
    }

    public Task Handle(TransactionCreatedEvent notification, CancellationToken cancellationToken)
    {
        _logger.LogInformation(
            "Transaction created: {TransactionId} by user {UserId}, Type: {Type}, Amount: {Amount} {Currency}",
            notification.TransactionId,
            notification.UserId,
            notification.Type,
            notification.Amount,
            notification.Currency);

        // Future: Send to analytics, update dashboards, etc.
        return Task.CompletedTask;
    }
}

/// <summary>
/// Handles P2PTransactionAcceptedEvent to update sender's records
/// </summary>
public class P2PTransactionAcceptedEventHandler : INotificationHandler<P2PTransactionAcceptedEvent>
{
    private readonly ILogger<P2PTransactionAcceptedEventHandler> _logger;

    public P2PTransactionAcceptedEventHandler(ILogger<P2PTransactionAcceptedEventHandler> logger)
    {
        _logger = logger;
    }

    public Task Handle(P2PTransactionAcceptedEvent notification, CancellationToken cancellationToken)
    {
        _logger.LogInformation(
            "P2P transaction {TransactionId} accepted: Sender {SenderId} -> Recipient {RecipientId}, Amount: {Amount} {Currency}",
            notification.TransactionId,
            notification.SenderId,
            notification.RecipientId,
            notification.Amount,
            notification.Currency);

        // Future: Send push notification to sender, update UI in real-time, etc.
        return Task.CompletedTask;
    }
}

/// <summary>
/// Handles P2PTransactionRejectedEvent to update sender's records
/// </summary>
public class P2PTransactionRejectedEventHandler : INotificationHandler<P2PTransactionRejectedEvent>
{
    private readonly ILogger<P2PTransactionRejectedEventHandler> _logger;

    public P2PTransactionRejectedEventHandler(ILogger<P2PTransactionRejectedEventHandler> logger)
    {
        _logger = logger;
    }

    public Task Handle(P2PTransactionRejectedEvent notification, CancellationToken cancellationToken)
    {
        _logger.LogInformation(
            "P2P transaction {TransactionId} rejected: Sender {SenderId}, Recipient {RecipientId}, Reason: {Reason}",
            notification.TransactionId,
            notification.SenderId,
            notification.RecipientId,
            notification.Reason ?? "No reason provided");

        // Future: Send push notification to sender, reverse any provisional balance changes, etc.
        return Task.CompletedTask;
    }
}

/// <summary>
/// Handles TransferCompletedEvent for audit logging
/// </summary>
public class TransferCompletedEventHandler : INotificationHandler<TransferCompletedEvent>
{
    private readonly ILogger<TransferCompletedEventHandler> _logger;

    public TransferCompletedEventHandler(ILogger<TransferCompletedEventHandler> logger)
    {
        _logger = logger;
    }

    public Task Handle(TransferCompletedEvent notification, CancellationToken cancellationToken)
    {
        _logger.LogInformation(
            "Transfer completed: {SourceAccountId} -> {DestinationAccountId}, " +
            "{SourceAmount} {SourceCurrency} -> {DestinationAmount} {DestinationCurrency}",
            notification.SourceAccountId,
            notification.DestinationAccountId,
            notification.SourceAmount,
            notification.SourceCurrency,
            notification.DestinationAmount,
            notification.DestinationCurrency);

        // Future: Audit log, analytics, etc.
        return Task.CompletedTask;
    }
}

/// <summary>
/// Handles RecurringTransactionGeneratedEvent for notifications
/// </summary>
public class RecurringTransactionGeneratedEventHandler : INotificationHandler<RecurringTransactionGeneratedEvent>
{
    private readonly ILogger<RecurringTransactionGeneratedEventHandler> _logger;

    public RecurringTransactionGeneratedEventHandler(ILogger<RecurringTransactionGeneratedEventHandler> logger)
    {
        _logger = logger;
    }

    public Task Handle(RecurringTransactionGeneratedEvent notification, CancellationToken cancellationToken)
    {
        _logger.LogInformation(
            "Recurring transaction generated: {TransactionId} from template {TemplateId}, " +
            "User: {UserId}, Amount: {Amount}, Date: {OccurrenceDate}",
            notification.TransactionId,
            notification.TemplateId,
            notification.UserId,
            notification.Amount,
            notification.OccurrenceDate);

        // Future: Send notification to user about auto-generated transaction
        return Task.CompletedTask;
    }
}

/// <summary>
/// Handles TransactionDeletedEvent for cleanup operations
/// </summary>
public class TransactionDeletedEventHandler : INotificationHandler<TransactionDeletedEvent>
{
    private readonly ILogger<TransactionDeletedEventHandler> _logger;

    public TransactionDeletedEventHandler(ILogger<TransactionDeletedEventHandler> logger)
    {
        _logger = logger;
    }

    public Task Handle(TransactionDeletedEvent notification, CancellationToken cancellationToken)
    {
        _logger.LogInformation(
            "Transaction deleted: {TransactionId}, User: {UserId}, Type: {Type}, Amount: {Amount}",
            notification.TransactionId,
            notification.UserId,
            notification.Type,
            notification.Amount);

        // Future: Update analytics, clean up related data, etc.
        return Task.CompletedTask;
    }
}