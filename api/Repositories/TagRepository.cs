using DigiTransac.Api.Services;
using MongoDB.Bson;
using MongoDB.Driver;
using Tag = DigiTransac.Api.Models.Tag;

namespace DigiTransac.Api.Repositories;

public interface ITagRepository
{
    Task<List<Tag>> GetByUserIdAsync(string userId, CancellationToken ct = default);
    Task<Tag?> GetByIdAsync(string id, CancellationToken ct = default);
    Task<Tag?> GetByIdAndUserIdAsync(string id, string userId, CancellationToken ct = default);
    Task<Tag?> GetByNameAndUserIdAsync(string name, string userId, CancellationToken ct = default);
    Task<Tag> CreateAsync(Tag tag, CancellationToken ct = default);
    Task UpdateAsync(Tag tag, CancellationToken ct = default);
    Task<bool> DeleteAsync(string id, string userId, CancellationToken ct = default);
    Task<bool> DeleteAllByUserIdAsync(string userId, CancellationToken ct = default);
}

public class TagRepository : ITagRepository
{
    private readonly IMongoCollection<Tag> _tags;

    public TagRepository(IMongoDbService mongoDbService)
    {
        _tags = mongoDbService.GetCollection<Tag>("tags");

        // Create indexes
        // Wrapped in try-catch to handle cases where indexes already exist with different names/options
        try
        {
            var indexModels = new List<CreateIndexModel<Tag>>
            {
                // UserId for basic user filtering
                new(Builders<Tag>.IndexKeys.Ascending(t => t.UserId),
                    new CreateIndexOptions { Name = "idx_userId" }),
                
                // Unique index on name per user (for tag name uniqueness within a user's tags)
                new(Builders<Tag>.IndexKeys
                    .Ascending(t => t.UserId)
                    .Ascending(t => t.Name),
                    new CreateIndexOptions { Name = "idx_userId_name_unique", Unique = true })
            };

            _tags.Indexes.CreateMany(indexModels);
        }
        catch (MongoCommandException)
        {
            // Indexes may already exist with different names/options - this is OK
            // The existing indexes will be used
        }
    }

    public async Task<List<Tag>> GetByUserIdAsync(string userId, CancellationToken ct = default)
    {
        return await _tags.Find(t => t.UserId == userId)
            .SortBy(t => t.Name)
            .ToListAsync(ct);
    }

    public async Task<Tag?> GetByIdAsync(string id, CancellationToken ct = default)
    {
        return await _tags.Find(t => t.Id == id).FirstOrDefaultAsync(ct);
    }

    public async Task<Tag?> GetByIdAndUserIdAsync(string id, string userId, CancellationToken ct = default)
    {
        return await _tags.Find(t => t.Id == id && t.UserId == userId).FirstOrDefaultAsync(ct);
    }

    public async Task<Tag?> GetByNameAndUserIdAsync(string name, string userId, CancellationToken ct = default)
    {
        return await _tags.Find(t => t.Name == name && t.UserId == userId).FirstOrDefaultAsync(ct);
    }

    public async Task<Tag> CreateAsync(Tag tag, CancellationToken ct = default)
    {
        await _tags.InsertOneAsync(tag, options: null, ct);
        return tag;
    }

    public async Task UpdateAsync(Tag tag, CancellationToken ct = default)
    {
        await _tags.ReplaceOneAsync(t => t.Id == tag.Id && t.UserId == tag.UserId, tag, options: (ReplaceOptions?)null, ct);
    }

    public async Task<bool> DeleteAsync(string id, string userId, CancellationToken ct = default)
    {
        var filter = Builders<Tag>.Filter.And(
            Builders<Tag>.Filter.Eq("_id", new ObjectId(id)),
            Builders<Tag>.Filter.Eq(t => t.UserId, userId)
        );
        var result = await _tags.DeleteOneAsync(filter, ct);
        return result.DeletedCount > 0;
    }

    public async Task<bool> DeleteAllByUserIdAsync(string userId, CancellationToken ct = default)
    {
        var result = await _tags.DeleteManyAsync(t => t.UserId == userId, ct);
        return result.DeletedCount > 0;
    }
}
