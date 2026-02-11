using DigiTransac.Api.Models;
using DigiTransac.Api.Services;
using MongoDB.Bson;
using MongoDB.Driver;

namespace DigiTransac.Api.Repositories;

public interface IUserRepository
{
    Task<User?> GetByEmailAsync(string email, CancellationToken ct = default);
    Task<User?> GetByIdAsync(string id, CancellationToken ct = default);
    Task<Dictionary<string, User>> GetByIdsAsync(IEnumerable<string> ids, CancellationToken ct = default);
    Task<User> CreateAsync(User user, CancellationToken ct = default);
    Task UpdateAsync(User user, CancellationToken ct = default);
    Task<bool> DeleteAsync(string id, CancellationToken ct = default);
}

public class UserRepository : IUserRepository
{
    private readonly IMongoCollection<User> _users;
    private static bool _indexesCreated = false;
    private static readonly object _indexLock = new();

    public UserRepository(IMongoDbService mongoDbService)
    {
        _users = mongoDbService.GetCollection<User>("users");

        // Create unique index on email (only once per application lifecycle)
        if (!_indexesCreated)
        {
            lock (_indexLock)
            {
                if (!_indexesCreated)
                {
                    try
                    {
                        var indexKeys = Builders<User>.IndexKeys.Ascending(u => u.Email);
                        var indexOptions = new CreateIndexOptions { Unique = true };
                        _users.Indexes.CreateOne(new CreateIndexModel<User>(indexKeys, indexOptions));
                    }
                    catch (MongoCommandException)
                    {
                        // Index already exists (possibly with different options) - this is okay
                        // Common error codes: 85 (IndexOptionsConflict), 86 (IndexKeySpecsConflict)
                        // Also handles "An existing index has the same name" errors
                        // The existing index will be used for email uniqueness enforcement
                    }
                    _indexesCreated = true;
                }
            }
        }
    }

    public async Task<User?> GetByEmailAsync(string email, CancellationToken ct = default)
    {
        return await _users.Find(u => u.Email == email.ToLowerInvariant()).FirstOrDefaultAsync(ct);
    }

    public async Task<User?> GetByIdAsync(string id, CancellationToken ct = default)
    {
        return await _users.Find(u => u.Id == id).FirstOrDefaultAsync(ct);
    }

    public async Task<Dictionary<string, User>> GetByIdsAsync(IEnumerable<string> ids, CancellationToken ct = default)
    {
        var idList = ids.Where(id => !string.IsNullOrEmpty(id)).Distinct().ToList();
        if (idList.Count == 0)
            return new Dictionary<string, User>();

        var filter = Builders<User>.Filter.In(u => u.Id, idList);
        var users = await _users.Find(filter).ToListAsync(ct);
        return users.ToDictionary(u => u.Id);
    }

    public async Task<User> CreateAsync(User user, CancellationToken ct = default)
    {
        user.Email = user.Email.ToLowerInvariant();
        await _users.InsertOneAsync(user, cancellationToken: ct);
        return user;
    }

    public async Task UpdateAsync(User user, CancellationToken ct = default)
    {
        await _users.ReplaceOneAsync(u => u.Id == user.Id, user, cancellationToken: ct);
    }

    public async Task<bool> DeleteAsync(string id, CancellationToken ct = default)
    {
        // Use ObjectId filter for more reliable deletion
        var filter = Builders<User>.Filter.Eq("_id", new ObjectId(id));
        var result = await _users.DeleteOneAsync(filter, ct);
        return result.DeletedCount > 0;
    }
}
