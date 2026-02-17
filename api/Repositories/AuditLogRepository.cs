using DigiTransac.Api.Models;
using DigiTransac.Api.Services;
using MongoDB.Driver;

namespace DigiTransac.Api.Repositories;

public interface IAuditLogRepository
{
    Task<AuditLog> CreateAsync(AuditLog auditLog, CancellationToken ct = default);
    Task<(List<AuditLog> Logs, int TotalCount)> GetByUserIdAsync(string userId, int page = 1, int pageSize = 50, CancellationToken ct = default);
    Task<(List<AuditLog> Logs, int TotalCount)> GetByActionAsync(AuditAction action, int page = 1, int pageSize = 50, CancellationToken ct = default);
    Task<(List<AuditLog> Logs, int TotalCount)> GetByCategoryAsync(AuditCategory category, int page = 1, int pageSize = 50, CancellationToken ct = default);
    Task<(List<AuditLog> Logs, int TotalCount)> SearchAsync(
        string? userId = null,
        AuditAction? action = null,
        AuditCategory? category = null,
        bool? success = null,
        DateTime? startDate = null,
        DateTime? endDate = null,
        int page = 1,
        int pageSize = 50,
        CancellationToken ct = default);
    Task<List<AuditLog>> GetRecentFailedLoginsAsync(string email, TimeSpan window, CancellationToken ct = default);
    Task<int> GetFailedLoginCountAsync(string email, TimeSpan window, CancellationToken ct = default);
}

public class AuditLogRepository : IAuditLogRepository
{
    private readonly IMongoCollection<AuditLog> _auditLogs;

    public AuditLogRepository(IMongoDbService mongoDbService)
    {
        _auditLogs = mongoDbService.GetCollection<AuditLog>("auditLogs");

        // Create indexes for efficient queries
        var indexModels = new List<CreateIndexModel<AuditLog>>
        {
            // User ID + Timestamp for user audit history
            new(Builders<AuditLog>.IndexKeys
                .Ascending(a => a.UserId)
                .Descending(a => a.Timestamp)),
            
            // Action + Timestamp for filtering by action type
            new(Builders<AuditLog>.IndexKeys
                .Ascending(a => a.Action)
                .Descending(a => a.Timestamp)),
            
            // Category + Timestamp for filtering by category
            new(Builders<AuditLog>.IndexKeys
                .Ascending(a => a.Category)
                .Descending(a => a.Timestamp)),
            
            // Email + Action + Timestamp for failed login tracking
            new(Builders<AuditLog>.IndexKeys
                .Ascending(a => a.UserEmail)
                .Ascending(a => a.Action)
                .Descending(a => a.Timestamp)),
            
            // TTL index to auto-delete old audit logs (optional - 2 years retention)
            new(Builders<AuditLog>.IndexKeys.Ascending(a => a.Timestamp),
                new CreateIndexOptions { ExpireAfter = TimeSpan.FromDays(730) })
        };

        _auditLogs.Indexes.CreateMany(indexModels);
    }

    public async Task<AuditLog> CreateAsync(AuditLog auditLog, CancellationToken ct = default)
    {
        auditLog.Timestamp = DateTime.UtcNow;
        await _auditLogs.InsertOneAsync(auditLog, options: null, ct);
        return auditLog;
    }

    public async Task<(List<AuditLog> Logs, int TotalCount)> GetByUserIdAsync(string userId, int page = 1, int pageSize = 50, CancellationToken ct = default)
    {
        var filter = Builders<AuditLog>.Filter.Eq(a => a.UserId, userId);
        return await GetPaginatedAsync(filter, page, pageSize, ct);
    }

    public async Task<(List<AuditLog> Logs, int TotalCount)> GetByActionAsync(AuditAction action, int page = 1, int pageSize = 50, CancellationToken ct = default)
    {
        var filter = Builders<AuditLog>.Filter.Eq(a => a.Action, action);
        return await GetPaginatedAsync(filter, page, pageSize, ct);
    }

    public async Task<(List<AuditLog> Logs, int TotalCount)> GetByCategoryAsync(AuditCategory category, int page = 1, int pageSize = 50, CancellationToken ct = default)
    {
        var filter = Builders<AuditLog>.Filter.Eq(a => a.Category, category);
        return await GetPaginatedAsync(filter, page, pageSize, ct);
    }

    public async Task<(List<AuditLog> Logs, int TotalCount)> SearchAsync(
        string? userId = null,
        AuditAction? action = null,
        AuditCategory? category = null,
        bool? success = null,
        DateTime? startDate = null,
        DateTime? endDate = null,
        int page = 1,
        int pageSize = 50,
        CancellationToken ct = default)
    {
        var filterBuilder = Builders<AuditLog>.Filter;
        var filters = new List<FilterDefinition<AuditLog>>();

        if (!string.IsNullOrEmpty(userId))
        {
            filters.Add(filterBuilder.Eq(a => a.UserId, userId));
        }

        if (action.HasValue)
        {
            filters.Add(filterBuilder.Eq(a => a.Action, action.Value));
        }

        if (category.HasValue)
        {
            filters.Add(filterBuilder.Eq(a => a.Category, category.Value));
        }

        if (success.HasValue)
        {
            filters.Add(filterBuilder.Eq(a => a.Success, success.Value));
        }

        if (startDate.HasValue)
        {
            filters.Add(filterBuilder.Gte(a => a.Timestamp, startDate.Value));
        }

        if (endDate.HasValue)
        {
            filters.Add(filterBuilder.Lte(a => a.Timestamp, endDate.Value));
        }

        var combinedFilter = filters.Count > 0 
            ? filterBuilder.And(filters) 
            : filterBuilder.Empty;

        return await GetPaginatedAsync(combinedFilter, page, pageSize, ct);
    }

    public async Task<List<AuditLog>> GetRecentFailedLoginsAsync(string email, TimeSpan window, CancellationToken ct = default)
    {
        var cutoff = DateTime.UtcNow - window;
        var filter = Builders<AuditLog>.Filter.And(
            Builders<AuditLog>.Filter.Eq(a => a.UserEmail, email.ToLowerInvariant()),
            Builders<AuditLog>.Filter.Eq(a => a.Action, AuditAction.LoginFailed),
            Builders<AuditLog>.Filter.Gte(a => a.Timestamp, cutoff)
        );

        return await _auditLogs
            .Find(filter)
            .SortByDescending(a => a.Timestamp)
            .ToListAsync(ct);
    }

    public async Task<int> GetFailedLoginCountAsync(string email, TimeSpan window, CancellationToken ct = default)
    {
        var cutoff = DateTime.UtcNow - window;
        var filter = Builders<AuditLog>.Filter.And(
            Builders<AuditLog>.Filter.Eq(a => a.UserEmail, email.ToLowerInvariant()),
            Builders<AuditLog>.Filter.Eq(a => a.Action, AuditAction.LoginFailed),
            Builders<AuditLog>.Filter.Gte(a => a.Timestamp, cutoff)
        );

        return (int)await _auditLogs.CountDocumentsAsync(filter, options: null, ct);
    }

    private async Task<(List<AuditLog> Logs, int TotalCount)> GetPaginatedAsync(
        FilterDefinition<AuditLog> filter, 
        int page, 
        int pageSize,
        CancellationToken ct = default)
    {
        var skip = (page - 1) * pageSize;
        
        var totalCount = await _auditLogs.CountDocumentsAsync(filter, options: null, ct);
        var logs = await _auditLogs
            .Find(filter)
            .SortByDescending(a => a.Timestamp)
            .Skip(skip)
            .Limit(pageSize)
            .ToListAsync(ct);

        return (logs, (int)totalCount);
    }
}