using MongoDB.Driver;

namespace DigiTransac.Api.Services.UnitOfWork;

/// <summary>
/// Represents a unit of work for managing MongoDB transactions.
/// Use this when you need to perform multiple database operations atomically.
/// On standalone MongoDB servers, operations execute without transactions.
/// </summary>
public interface IUnitOfWork : IDisposable, IAsyncDisposable
{
    /// <summary>
    /// Gets the current MongoDB client session for the transaction.
    /// Pass this to repository methods that support transactional operations.
    /// May be null if session hasn't been started yet.
    /// </summary>
    IClientSessionHandle? Session { get; }
    
    /// <summary>
    /// Gets whether the current MongoDB deployment supports transactions.
    /// Returns false for standalone servers.
    /// </summary>
    bool TransactionsSupported { get; }
    
    /// <summary>
    /// Starts a new transaction. All subsequent repository operations using this session
    /// will be part of the transaction until committed or rolled back.
    /// On standalone servers, this creates a session but no transaction.
    /// </summary>
    Task StartTransactionAsync(CancellationToken cancellationToken = default);
    
    /// <summary>
    /// Commits all changes made during the transaction.
    /// No-op if transactions are not supported (standalone server).
    /// </summary>
    Task CommitAsync(CancellationToken cancellationToken = default);
    
    /// <summary>
    /// Rolls back all changes made during the transaction.
    /// No-op if transactions are not supported (standalone server).
    /// </summary>
    Task RollbackAsync(CancellationToken cancellationToken = default);
    
    /// <summary>
    /// Executes the given action within a transaction. Automatically commits on success
    /// or rolls back on exception. On standalone servers, executes without transaction.
    /// The session parameter may be null on standalone servers.
    /// </summary>
    Task ExecuteInTransactionAsync(Func<IClientSessionHandle?, Task> action, CancellationToken cancellationToken = default);
    
    /// <summary>
    /// Executes the given function within a transaction. Automatically commits on success
    /// or rolls back on exception. Returns the result of the function.
    /// On standalone servers, executes without transaction.
    /// The session parameter may be null on standalone servers.
    /// </summary>
    Task<T> ExecuteInTransactionAsync<T>(Func<IClientSessionHandle?, Task<T>> action, CancellationToken cancellationToken = default);
}