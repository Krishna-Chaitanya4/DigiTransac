using DigiTransac.Api.Models;

namespace DigiTransac.Api.Events;

/// <summary>
/// Raised when a new transaction is created
/// </summary>
public record TransactionCreatedEvent(
    string TransactionId,
    string UserId,
    string AccountId,
    TransactionType Type,
    decimal Amount,
    string Currency,
    bool IsP2P,
    string? CounterpartyUserId
) : DomainEvent;

/// <summary>
/// Raised when a transaction is updated
/// </summary>
public record TransactionUpdatedEvent(
    string TransactionId,
    string UserId,
    decimal OldAmount,
    decimal NewAmount,
    TransactionType OldType,
    TransactionType NewType,
    string? OldAccountId,
    string? NewAccountId
) : DomainEvent;

/// <summary>
/// Raised when a transaction is deleted
/// </summary>
public record TransactionDeletedEvent(
    string TransactionId,
    string UserId,
    string? AccountId,
    TransactionType Type,
    decimal Amount,
    bool WasRecurringTemplate
) : DomainEvent;

/// <summary>
/// Raised when a P2P transaction is accepted by the recipient
/// </summary>
public record P2PTransactionAcceptedEvent(
    string TransactionId,
    string SenderId,
    string RecipientId,
    string RecipientAccountId,
    decimal Amount,
    string Currency
) : DomainEvent;

/// <summary>
/// Raised when a P2P transaction is rejected by the recipient
/// </summary>
public record P2PTransactionRejectedEvent(
    string TransactionId,
    string SenderId,
    string RecipientId,
    string? Reason
) : DomainEvent;

/// <summary>
/// Raised when a transfer between accounts is completed
/// </summary>
public record TransferCompletedEvent(
    string SourceTransactionId,
    string DestinationTransactionId,
    string UserId,
    string SourceAccountId,
    string DestinationAccountId,
    decimal SourceAmount,
    decimal DestinationAmount,
    string SourceCurrency,
    string DestinationCurrency
) : DomainEvent;

/// <summary>
/// Raised when a recurring transaction template is created
/// </summary>
public record RecurringTemplateCreatedEvent(
    string TemplateId,
    string UserId,
    string AccountId,
    RecurrenceFrequency Frequency,
    DateTime FirstOccurrence
) : DomainEvent;

/// <summary>
/// Raised when a recurring transaction is generated from a template
/// </summary>
public record RecurringTransactionGeneratedEvent(
    string TransactionId,
    string TemplateId,
    string UserId,
    string AccountId,
    decimal Amount,
    DateTime OccurrenceDate
) : DomainEvent;

/// <summary>
/// Raised when a P2P transaction is edited by the owner
/// Used to create activity feed messages in the chat
/// </summary>
public record TransactionEditedEvent(
    string TransactionId,
    string UserId,
    bool IsP2P,
    string? CounterpartyUserId,
    IReadOnlyList<string>? ChangedFields
) : DomainEvent;