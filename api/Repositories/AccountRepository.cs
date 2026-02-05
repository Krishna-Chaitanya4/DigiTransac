using DigiTransac.Api.Models;
using DigiTransac.Api.Services;
using MongoDB.Driver;

namespace DigiTransac.Api.Repositories;

public interface IAccountRepository
{
    Task<List<Account>> GetByUserIdAsync(string userId, bool includeArchived = false);
    Task<Account?> GetByIdAsync(string id);
    Task<Account?> GetByIdAndUserIdAsync(string id, string userId);
    Task<bool> ExistsByNameAsync(string name, string userId);
    Task<Account> CreateAsync(Account account);
    Task UpdateAsync(Account account, IClientSessionHandle? session = null);
    Task<bool> DeleteAsync(string id, string userId);
    Task<bool> DeleteAllByUserIdAsync(string userId);
    Task<int> GetCountByUserIdAsync(string userId);
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

    public async Task<List<Account>> GetByUserIdAsync(string userId, bool includeArchived = false)
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
            .ToListAsync();
    }

    public async Task<Account?> GetByIdAsync(string id)
    {
        return await _accounts.Find(a => a.Id == id).FirstOrDefaultAsync();
    }

    public async Task<Account?> GetByIdAndUserIdAsync(string id, string userId)
    {
        return await _accounts.Find(a => a.Id == id && a.UserId == userId).FirstOrDefaultAsync();
    }

    public async Task<bool> ExistsByNameAsync(string name, string userId)
    {
        var normalizedName = name.Trim().ToLowerInvariant();
        return await _accounts.Find(a =>
            a.UserId == userId &&
            a.Name.ToLowerInvariant() == normalizedName
        ).AnyAsync();
    }

    public async Task<Account> CreateAsync(Account account)
    {
        await _accounts.InsertOneAsync(account);
        return account;
    }

    public async Task UpdateAsync(Account account, IClientSessionHandle? session = null)
    {
        account.UpdatedAt = DateTime.UtcNow;
        if (session != null)
            await _accounts.ReplaceOneAsync(session, a => a.Id == account.Id && a.UserId == account.UserId, account);
        else
            await _accounts.ReplaceOneAsync(a => a.Id == account.Id && a.UserId == account.UserId, account);
    }

    public async Task<bool> DeleteAsync(string id, string userId)
    {
        var result = await _accounts.DeleteOneAsync(a => a.Id == id && a.UserId == userId);
        return result.DeletedCount > 0;
    }

    public async Task<bool> DeleteAllByUserIdAsync(string userId)
    {
        var result = await _accounts.DeleteManyAsync(a => a.UserId == userId);
        return result.DeletedCount > 0;
    }

    public async Task<int> GetCountByUserIdAsync(string userId)
    {
        return (int)await _accounts.CountDocumentsAsync(a => a.UserId == userId);
    }
}
