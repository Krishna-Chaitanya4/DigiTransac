using MediatR;

namespace DigiTransac.Api.Events;

/// <summary>
/// Marker interface for domain events.
/// All domain events should implement this interface.
/// </summary>
public interface IDomainEvent : INotification
{
    /// <summary>
    /// When the event occurred
    /// </summary>
    DateTime OccurredAt { get; }
    
    /// <summary>
    /// Unique identifier for the event instance
    /// </summary>
    Guid EventId { get; }
}

/// <summary>
/// Base class for domain events with common properties
/// </summary>
public abstract record DomainEvent : IDomainEvent
{
    public DateTime OccurredAt { get; } = DateTime.UtcNow;
    public Guid EventId { get; } = Guid.NewGuid();
}