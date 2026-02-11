using DigiTransac.Api.Models;
using DigiTransac.Api.Services;
using MongoDB.Driver;

namespace DigiTransac.Api.Repositories;

public interface IAccountRepository
{
    Task<List<Account>> GetByUserIdAsync(string userId, bool includeArchived = false, CancellationToken ct = default);
    Task<Account?> GetByIdAsync(string id, CancellationToken ct = default);
    Task<Account?> GetByIdAndUserIdAsync(string id, string userId, CancellationToken ct = default);
    Task<bool> ExistsByNameAsync(string name, string userId, CancellationToken ct = default);
    Task<Account> CreateAsync(Account account, CancellationToken ct = default);
    Task UpdateAsync(Account account, IClientSessionHandle? session = null, CancellationToken ct = default);
    Task<bool> DeleteAsync(string id, string userId, CancellationToken ct = default);
    Task<bool> DeleteAllByUserIdAsync(string userId, CancellationToken ct = default);
    Task<int> GetCountByUserIdAsync(string userId, CancellationToken ct = default);
    Task BulkUpdateOrderAsync(string userId, Dictionary<string, int> orderMap, CancellationToken ct = default);
}

public class AccountRepository : IAccountRepository
{
    private readonly IMongoCollection<Account> _accounts;

    public AccountRepository(IMongoDbService mongoDbService)
    {
        _accounts = mongoDbService.GetCollection<Account>("accounts");

        // Create compound indexes for efficient queries
        // Wrapped in try-catch to handle cases where indexes already exist with different names
        try
        {
            var indexModels = new List<CreateIndexModel<Account>>
            {
                // UserId + IsArchived + Order for GetByUserIdAsync (most common query)
                new(Builders<Account>.IndexKeys
                    .Ascending(a => a.UserId)
                    .Ascending(a => a.IsArchived)
                    .Ascending(a => a.Order),
                    new CreateIndexOptions { Name = "idx_userId_isArchived_order" }),
                
                // UserId + Type for type-based filtering
                new(Builders<Account>.IndexKeys
                    .Ascending(a => a.UserId)
                    .Ascending(a => a.Type),
                    new CreateIndexOptions { Name = "idx_userId_type" })
            };

            _accounts.Indexes.CreateMany(indexModels);
        }
        catch (MongoCommandException)
        {
            // Indexes may already exist with different names - this is OK
        }
    }

    public async Task<List<Account>> GetByUserIdAsync(string userId, bool includeArchived = false, CancellationToken ct = default)
    {
        var filter = Builders<Account>.Filter.Eq(a => a.UserId, userId);
        
        if (!includeArchived)
        {
            filter = Builders<Account>.Filter.And(
                filter,
                Builders<Account>.Filter.Eq(a => a.IsArchived, false)
            );
        }

        return await _accounts.Find(filter)
            .SortBy(a => a.Order)
            .ThenBy(a => a.Name)
            .ToListAsync(ct);
    }

    public async Task<Account?> GetByIdAsync(string id, CancellationToken ct = default)
    {
        return await _accounts.Find(a => a.Id == id).FirstOrDefaultAsync(ct);
    }

    public async Task<Account?> GetByIdAndUserIdAsync(string id, string userId, CancellationToken ct = default)
    {
        return await _accounts.Find(a => a.Id == id && a.UserId == userId).FirstOrDefaultAsync(ct);
    }

    public async Task<bool> ExistsByNameAsync(string name, string userId, CancellationToken ct = default)
    {
        var normalizedName = name.Trim().ToLowerInvariant();
        return await _accounts.Find(a =>
            a.UserId == userId &&
            a.Name.ToLowerInvariant() == normalizedName
        ).AnyAsync(ct);
    }

    public async Task<Account> CreateAsync(Account account, CancellationToken ct = default)
    {
        await _accounts.InsertOneAsync(account, options: null, ct);
        return account;
    }

    public async Task UpdateAsync(Account account, IClientSessionHandle? session = null, CancellationToken ct = default)
    {
        account.UpdatedAt = DateTime.UtcNow;
        if (session != null)
            await _accounts.ReplaceOneAsync(session, a => a.Id == account.Id && a.UserId == account.UserId, account, options: (ReplaceOptions?)null, ct);
        else
            await _accounts.ReplaceOneAsync(a => a.Id == account.Id && a.UserId == account.UserId, account, options: (ReplaceOptions?)null, ct);
    }

    public async Task<bool> DeleteAsync(string id, string userId, CancellationToken ct = default)
    {
        var result = await _accounts.DeleteOneAsync(a => a.Id == id && a.UserId == userId, ct);
        return result.DeletedCount > 0;
    }

    public async Task<bool> DeleteAllByUserIdAsync(string userId, CancellationToken ct = default)
    {
        var result = await _accounts.DeleteManyAsync(a => a.UserId == userId, ct);
        return result.DeletedCount > 0;
    }

    public async Task<int> GetCountByUserIdAsync(string userId, CancellationToken ct = default)
    {
        return (int)await _accounts.CountDocumentsAsync(a => a.UserId == userId, options: null, ct);
    }

    public async Task BulkUpdateOrderAsync(string userId, Dictionary<string, int> orderMap, CancellationToken ct = default)
    {
        if (orderMap.Count == 0) return;

        var bulkOps = orderMap.Select(kvp =>
            new UpdateOneModel<Account>(
                Builders<Account>.Filter.And(
                    Builders<Account>.Filter.Eq(a => a.Id, kvp.Key),
                    Builders<Account>.Filter.Eq(a => a.UserId, userId)),
                Builders<Account>.Update
                    .Set(a => a.Order, kvp.Value)
                    .Set(a => a.UpdatedAt, DateTime.UtcNow))
        ).ToList<WriteModel<Account>>();

        await _accounts.BulkWriteAsync(bulkOps, options: null, ct);
    }
}
