using DigiTransac.Api.Services.Caching;
using MediatR;

namespace DigiTransac.Api.Events.Handlers;

/// <summary>
/// Handles domain events to invalidate related cache entries.
/// This ensures cache consistency when data changes.
/// </summary>
public class CacheInvalidationHandler :
    INotificationHandler<TransactionCreatedEvent>,
    INotificationHandler<TransactionUpdatedEvent>,
    INotificationHandler<TransactionDeletedEvent>,
    INotificationHandler<TransferCompletedEvent>
{
    private readonly ICacheService _cacheService;
    private readonly ILogger<CacheInvalidationHandler> _logger;

    public CacheInvalidationHandler(
        ICacheService cacheService,
        ILogger<CacheInvalidationHandler> logger)
    {
        _cacheService = cacheService;
        _logger = logger;
    }

    public async Task Handle(TransactionCreatedEvent notification, CancellationToken cancellationToken)
    {
        _logger.LogDebug(
            "Invalidating cache for user {UserId} after transaction creation",
            notification.UserId);

        // Invalidate user-specific caches
        await _cacheService.InvalidateByTagAsync($"user:{notification.UserId}", cancellationToken);
        
        // Invalidate account balance cache
        await _cacheService.RemoveAsync(
            CacheKeys.UserAccounts(notification.UserId), 
            cancellationToken);
    }

    public async Task Handle(TransactionUpdatedEvent notification, CancellationToken cancellationToken)
    {
        _logger.LogDebug(
            "Invalidating cache for user {UserId} after transaction update",
            notification.UserId);

        // Invalidate specific transaction cache
        await _cacheService.RemoveAsync(
            CacheKeys.Transaction(notification.TransactionId), 
            cancellationToken);
        
        // Invalidate user summaries
        await _cacheService.InvalidateByTagAsync($"user:{notification.UserId}", cancellationToken);
        
        // If account changed, invalidate both old and new account caches
        if (notification.OldAccountId != notification.NewAccountId)
        {
            await _cacheService.RemoveAsync(
                CacheKeys.UserAccounts(notification.UserId), 
                cancellationToken);
        }
    }

    public async Task Handle(TransactionDeletedEvent notification, CancellationToken cancellationToken)
    {
        _logger.LogDebug(
            "Invalidating cache for user {UserId} after transaction deletion",
            notification.UserId);

        // Invalidate specific transaction cache
        await _cacheService.RemoveAsync(
            CacheKeys.Transaction(notification.TransactionId), 
            cancellationToken);
        
        // Invalidate user-specific caches
        await _cacheService.InvalidateByTagAsync($"user:{notification.UserId}", cancellationToken);
        
        // Invalidate account balance cache
        await _cacheService.RemoveAsync(
            CacheKeys.UserAccounts(notification.UserId), 
            cancellationToken);
    }

    public async Task Handle(TransferCompletedEvent notification, CancellationToken cancellationToken)
    {
        _logger.LogDebug(
            "Invalidating cache for user {UserId} after transfer completion",
            notification.UserId);

        // Invalidate both transaction caches
        await _cacheService.RemoveAsync(
            CacheKeys.Transaction(notification.SourceTransactionId), 
            cancellationToken);
        await _cacheService.RemoveAsync(
            CacheKeys.Transaction(notification.DestinationTransactionId), 
            cancellationToken);
        
        // Invalidate user account caches (balances changed)
        await _cacheService.RemoveAsync(
            CacheKeys.UserAccounts(notification.UserId), 
            cancellationToken);
        
        // Invalidate summaries
        await _cacheService.InvalidateByTagAsync($"user:{notification.UserId}", cancellationToken);
    }
}