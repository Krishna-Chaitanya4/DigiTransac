using Microsoft.Extensions.Logging;
using MongoDB.Driver;

namespace DigiTransac.Api.Services.UnitOfWork;

/// <summary>
/// Implementation of Unit of Work pattern for MongoDB transactions.
/// Manages a client session and transaction lifecycle.
/// Gracefully falls back to non-transactional execution on standalone servers.
/// </summary>
public class UnitOfWork : IUnitOfWork
{
    private readonly IMongoClient _client;
    private readonly ILogger<UnitOfWork>? _logger;
    private IClientSessionHandle? _session;
    private bool _transactionStarted;
    private bool _transactionsSupported = true;
    private bool _disposed;

    public UnitOfWork(IMongoDbService mongoDbService, ILogger<UnitOfWork>? logger = null)
    {
        _client = mongoDbService.Client;
        _logger = logger;
    }

    /// <summary>
    /// Gets whether the current MongoDB deployment supports transactions.
    /// Returns false for standalone servers.
    /// </summary>
    public bool TransactionsSupported => _transactionsSupported;

    public IClientSessionHandle? Session => _session;

    public async Task StartTransactionAsync(CancellationToken cancellationToken = default)
    {
        if (_transactionStarted)
        {
            throw new InvalidOperationException("Transaction has already been started.");
        }

        _session = await _client.StartSessionAsync(cancellationToken: cancellationToken);
        
        try
        {
            // Configure transaction options for read concern and write concern
            var transactionOptions = new TransactionOptions(
                readConcern: ReadConcern.Snapshot,
                writeConcern: WriteConcern.WMajority,
                readPreference: ReadPreference.Primary);
            
            _session.StartTransaction(transactionOptions);
            _transactionStarted = true;
        }
        catch (NotSupportedException ex) when (ex.Message.Contains("Standalone servers do not support transactions"))
        {
            // Standalone MongoDB server - transactions not supported
            // Continue without transaction - operations will be non-atomic
            _transactionsSupported = false;
            _logger?.LogWarning(
                "MongoDB standalone server detected. Transactions are not supported. " +
                "Operations will be executed without transactional guarantees. " +
                "Consider using a replica set for production deployments.");
        }
    }

    public async Task CommitAsync(CancellationToken cancellationToken = default)
    {
        if (_session == null)
        {
            return; // No session to commit
        }

        if (!_transactionStarted)
        {
            return; // No transaction to commit (standalone server)
        }

        try
        {
            await _session.CommitTransactionAsync(cancellationToken);
        }
        finally
        {
            _transactionStarted = false;
        }
    }

    public async Task RollbackAsync(CancellationToken cancellationToken = default)
    {
        if (_session == null)
        {
            return; // No session to rollback
        }

        if (!_transactionStarted)
        {
            return; // No transaction to rollback (standalone server)
        }

        try
        {
            await _session.AbortTransactionAsync(cancellationToken);
        }
        finally
        {
            _transactionStarted = false;
        }
    }

    public async Task ExecuteInTransactionAsync(
        Func<IClientSessionHandle?, Task> action,
        CancellationToken cancellationToken = default)
    {
        await StartTransactionAsync(cancellationToken);
        
        try
        {
            // Pass session (may be null for standalone without transaction support)
            await action(_session);
            await CommitAsync(cancellationToken);
        }
        catch
        {
            await RollbackAsync(cancellationToken);
            throw;
        }
        finally
        {
            _session?.Dispose();
            _session = null;
        }
    }

    public async Task<T> ExecuteInTransactionAsync<T>(
        Func<IClientSessionHandle?, Task<T>> action,
        CancellationToken cancellationToken = default)
    {
        await StartTransactionAsync(cancellationToken);
        
        try
        {
            // Pass session (may still have session even if transaction not started for standalone)
            var result = await action(_session);
            await CommitAsync(cancellationToken);
            return result;
        }
        catch
        {
            await RollbackAsync(cancellationToken);
            throw;
        }
        finally
        {
            _session?.Dispose();
            _session = null;
        }
    }

    public void Dispose()
    {
        Dispose(true);
        GC.SuppressFinalize(this);
    }

    public async ValueTask DisposeAsync()
    {
        await DisposeAsyncCore();
        Dispose(false);
        GC.SuppressFinalize(this);
    }

    protected virtual void Dispose(bool disposing)
    {
        if (!_disposed)
        {
            if (disposing)
            {
                _session?.Dispose();
                _session = null;
            }
            _disposed = true;
        }
    }

    protected virtual ValueTask DisposeAsyncCore()
    {
        _session?.Dispose();
        _session = null;
        return ValueTask.CompletedTask;
    }
}