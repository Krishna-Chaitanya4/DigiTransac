using DigiTransac.Api.Models;
using DigiTransac.Api.Services;
using MongoDB.Driver;

namespace DigiTransac.Api.Repositories;

/// <summary>
/// Repository interface for budget operations
/// </summary>
public interface IBudgetRepository
{
    Task<Budget> CreateAsync(Budget budget, CancellationToken ct = default);
    Task<Budget?> GetByIdAsync(string id, CancellationToken ct = default);
    Task<Budget?> GetByIdAndUserIdAsync(string id, string userId, CancellationToken ct = default);
    Task<List<Budget>> GetByUserIdAsync(string userId, bool? isActive = null, CancellationToken ct = default);
    Task<Budget> UpdateAsync(Budget budget, CancellationToken ct = default);
    Task<bool> DeleteAsync(string id, CancellationToken ct = default);
    Task<bool> DeleteAllByUserIdAsync(string userId, CancellationToken ct = default);
    
    // Notifications
    Task<BudgetNotification> CreateNotificationAsync(BudgetNotification notification, CancellationToken ct = default);
    Task<List<BudgetNotification>> GetNotificationsByUserIdAsync(string userId, bool? unreadOnly = null, int limit = 50, CancellationToken ct = default);
    Task<int> GetUnreadNotificationCountAsync(string userId, CancellationToken ct = default);
    Task<bool> MarkNotificationAsReadAsync(string notificationId, string userId, CancellationToken ct = default);
    Task<bool> MarkAllNotificationsAsReadAsync(string userId, CancellationToken ct = default);
    Task<bool> DeleteOldNotificationsAsync(DateTime olderThan, CancellationToken ct = default);
    Task<bool> DeleteAllNotificationsByUserIdAsync(string userId, CancellationToken ct = default);
}

/// <summary>
/// MongoDB repository for budgets and budget notifications
/// </summary>
public class BudgetRepository : IBudgetRepository
{
    private readonly IMongoCollection<Budget> _budgets;
    private readonly IMongoCollection<BudgetNotification> _notifications;
    private readonly ILogger<BudgetRepository> _logger;

    public BudgetRepository(IMongoDbService mongoDbService, ILogger<BudgetRepository> logger)
    {
        _budgets = mongoDbService.GetCollection<Budget>("budgets");
        _notifications = mongoDbService.GetCollection<BudgetNotification>("budget_notifications");
        _logger = logger;
        
        // Create indexes
        CreateIndexes();
    }

    private void CreateIndexes()
    {
        try
        {
            // Budget indexes
            var budgetIndexes = new[]
            {
                new CreateIndexModel<Budget>(
                    Builders<Budget>.IndexKeys.Ascending(b => b.UserId),
                    new CreateIndexOptions { Name = "idx_budget_userId" }),
                new CreateIndexModel<Budget>(
                    Builders<Budget>.IndexKeys
                        .Ascending(b => b.UserId)
                        .Ascending(b => b.IsActive),
                    new CreateIndexOptions { Name = "idx_budget_userId_isActive" }),
                new CreateIndexModel<Budget>(
                    Builders<Budget>.IndexKeys
                        .Ascending(b => b.UserId)
                        .Ascending(b => b.LabelIds),
                    new CreateIndexOptions { Name = "idx_budget_userId_labelIds" })
            };
            _budgets.Indexes.CreateMany(budgetIndexes);

            // Notification indexes
            var notificationIndexes = new[]
            {
                new CreateIndexModel<BudgetNotification>(
                    Builders<BudgetNotification>.IndexKeys.Ascending(n => n.UserId),
                    new CreateIndexOptions { Name = "idx_notification_userId" }),
                new CreateIndexModel<BudgetNotification>(
                    Builders<BudgetNotification>.IndexKeys
                        .Ascending(n => n.UserId)
                        .Ascending(n => n.IsRead),
                    new CreateIndexOptions { Name = "idx_notification_userId_isRead" }),
                new CreateIndexModel<BudgetNotification>(
                    Builders<BudgetNotification>.IndexKeys.Descending(n => n.CreatedAt),
                    new CreateIndexOptions 
                    { 
                        Name = "idx_notification_createdAt",
                        ExpireAfter = TimeSpan.FromDays(90)  // Auto-delete old notifications
                    }),
                new CreateIndexModel<BudgetNotification>(
                    Builders<BudgetNotification>.IndexKeys
                        .Ascending(n => n.BudgetId)
                        .Ascending(n => n.ThresholdPercent)
                        .Descending(n => n.CreatedAt),
                    new CreateIndexOptions { Name = "idx_notification_budget_threshold" })
            };
            _notifications.Indexes.CreateMany(notificationIndexes);

            _logger.LogInformation("Budget indexes created successfully");
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Error creating budget indexes (may already exist)");
        }
    }

    public async Task<Budget> CreateAsync(Budget budget, CancellationToken ct = default)
    {
        await _budgets.InsertOneAsync(budget, options: null, ct);
        _logger.LogInformation("Created budget {BudgetId} for user {UserId}", budget.Id, budget.UserId);
        return budget;
    }

    public async Task<Budget?> GetByIdAsync(string id, CancellationToken ct = default)
    {
        return await _budgets.Find(b => b.Id == id).FirstOrDefaultAsync(ct);
    }

    public async Task<Budget?> GetByIdAndUserIdAsync(string id, string userId, CancellationToken ct = default)
    {
        return await _budgets.Find(b => b.Id == id && b.UserId == userId).FirstOrDefaultAsync(ct);
    }

    public async Task<List<Budget>> GetByUserIdAsync(string userId, bool? isActive = null, CancellationToken ct = default)
    {
        var filter = Builders<Budget>.Filter.Eq(b => b.UserId, userId);
        
        if (isActive.HasValue)
        {
            filter &= Builders<Budget>.Filter.Eq(b => b.IsActive, isActive.Value);
        }
        
        return await _budgets
            .Find(filter)
            .SortByDescending(b => b.CreatedAt)
            .ToListAsync(ct);
    }

    public async Task<Budget> UpdateAsync(Budget budget, CancellationToken ct = default)
    {
        budget.UpdatedAt = DateTime.UtcNow;
        await _budgets.ReplaceOneAsync(b => b.Id == budget.Id, budget, options: (ReplaceOptions?)null, ct);
        _logger.LogInformation("Updated budget {BudgetId}", budget.Id);
        return budget;
    }

    public async Task<bool> DeleteAsync(string id, CancellationToken ct = default)
    {
        var result = await _budgets.DeleteOneAsync(b => b.Id == id, ct);
        if (result.DeletedCount > 0)
        {
            _logger.LogInformation("Deleted budget {BudgetId}", id);
            return true;
        }
        return false;
    }

    public async Task<bool> DeleteAllByUserIdAsync(string userId, CancellationToken ct = default)
    {
        // Delete all budgets for the user
        var budgetResult = await _budgets.DeleteManyAsync(b => b.UserId == userId, ct);
        
        // Also delete all notifications for the user
        var notificationResult = await _notifications.DeleteManyAsync(n => n.UserId == userId, ct);
        
        _logger.LogInformation("Deleted {BudgetCount} budgets and {NotificationCount} notifications for user {UserId}",
            budgetResult.DeletedCount, notificationResult.DeletedCount, userId);
        
        return budgetResult.DeletedCount > 0 || notificationResult.DeletedCount > 0;
    }

    public async Task<bool> DeleteAllNotificationsByUserIdAsync(string userId, CancellationToken ct = default)
    {
        var result = await _notifications.DeleteManyAsync(n => n.UserId == userId, ct);
        _logger.LogInformation("Deleted {Count} notifications for user {UserId}", result.DeletedCount, userId);
        return result.DeletedCount > 0;
    }

    // Notification methods

    public async Task<BudgetNotification> CreateNotificationAsync(BudgetNotification notification, CancellationToken ct = default)
    {
        await _notifications.InsertOneAsync(notification, options: null, ct);
        _logger.LogInformation("Created budget notification for budget {BudgetId}, threshold {Threshold}%", 
            notification.BudgetId, notification.ThresholdPercent);
        return notification;
    }

    public async Task<List<BudgetNotification>> GetNotificationsByUserIdAsync(string userId, bool? unreadOnly = null, int limit = 50, CancellationToken ct = default)
    {
        var filter = Builders<BudgetNotification>.Filter.Eq(n => n.UserId, userId);
        
        if (unreadOnly == true)
        {
            filter &= Builders<BudgetNotification>.Filter.Eq(n => n.IsRead, false);
        }
        
        return await _notifications
            .Find(filter)
            .SortByDescending(n => n.CreatedAt)
            .Limit(limit)
            .ToListAsync(ct);
    }

    public async Task<int> GetUnreadNotificationCountAsync(string userId, CancellationToken ct = default)
    {
        return (int)await _notifications.CountDocumentsAsync(
            n => n.UserId == userId && !n.IsRead, options: null, ct);
    }

    public async Task<bool> MarkNotificationAsReadAsync(string notificationId, string userId, CancellationToken ct = default)
    {
        var result = await _notifications.UpdateOneAsync(
            n => n.Id == notificationId && n.UserId == userId,
            Builders<BudgetNotification>.Update.Set(n => n.IsRead, true),
            options: null, ct);
        return result.ModifiedCount > 0;
    }

    public async Task<bool> MarkAllNotificationsAsReadAsync(string userId, CancellationToken ct = default)
    {
        var result = await _notifications.UpdateManyAsync(
            n => n.UserId == userId && !n.IsRead,
            Builders<BudgetNotification>.Update.Set(n => n.IsRead, true),
            options: null, ct);
        _logger.LogInformation("Marked {Count} notifications as read for user {UserId}", 
            result.ModifiedCount, userId);
        return result.ModifiedCount > 0;
    }

    public async Task<bool> DeleteOldNotificationsAsync(DateTime olderThan, CancellationToken ct = default)
    {
        var result = await _notifications.DeleteManyAsync(n => n.CreatedAt < olderThan, ct);
        if (result.DeletedCount > 0)
        {
            _logger.LogInformation("Deleted {Count} old budget notifications", result.DeletedCount);
        }
        return result.DeletedCount > 0;
    }
}