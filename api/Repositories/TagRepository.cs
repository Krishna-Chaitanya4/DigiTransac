using DigiTransac.Api.Settings;
using Microsoft.Extensions.Options;
using MongoDB.Bson;
using MongoDB.Driver;
using Tag = DigiTransac.Api.Models.Tag;

namespace DigiTransac.Api.Repositories;

public interface ITagRepository
{
    Task<List<Tag>> GetByUserIdAsync(string userId);
    Task<Tag?> GetByIdAsync(string id);
    Task<Tag?> GetByIdAndUserIdAsync(string id, string userId);
    Task<Tag?> GetByNameAndUserIdAsync(string name, string userId);
    Task<Tag> CreateAsync(Tag tag);
    Task UpdateAsync(Tag tag);
    Task<bool> DeleteAsync(string id, string userId);
    Task<bool> DeleteAllByUserIdAsync(string userId);
}

public class TagRepository : ITagRepository
{
    private readonly IMongoCollection<Tag> _tags;

    public TagRepository(IOptions<MongoDbSettings> settings)
    {
        var client = new MongoClient(settings.Value.ConnectionString);
        var database = client.GetDatabase(settings.Value.DatabaseName);
        _tags = database.GetCollection<Tag>("tags");

        // Create indexes
        var userIdIndex = Builders<Tag>.IndexKeys.Ascending(t => t.UserId);
        _tags.Indexes.CreateOne(new CreateIndexModel<Tag>(userIdIndex));

        // Unique index on name per user
        var uniqueNameIndex = Builders<Tag>.IndexKeys
            .Ascending(t => t.UserId)
            .Ascending(t => t.Name);
        var indexOptions = new CreateIndexOptions { Unique = true };
        _tags.Indexes.CreateOne(new CreateIndexModel<Tag>(uniqueNameIndex, indexOptions));
    }

    public async Task<List<Tag>> GetByUserIdAsync(string userId)
    {
        return await _tags.Find(t => t.UserId == userId)
            .SortBy(t => t.Name)
            .ToListAsync();
    }

    public async Task<Tag?> GetByIdAsync(string id)
    {
        return await _tags.Find(t => t.Id == id).FirstOrDefaultAsync();
    }

    public async Task<Tag?> GetByIdAndUserIdAsync(string id, string userId)
    {
        return await _tags.Find(t => t.Id == id && t.UserId == userId).FirstOrDefaultAsync();
    }

    public async Task<Tag?> GetByNameAndUserIdAsync(string name, string userId)
    {
        return await _tags.Find(t => t.Name == name && t.UserId == userId).FirstOrDefaultAsync();
    }

    public async Task<Tag> CreateAsync(Tag tag)
    {
        await _tags.InsertOneAsync(tag);
        return tag;
    }

    public async Task UpdateAsync(Tag tag)
    {
        await _tags.ReplaceOneAsync(t => t.Id == tag.Id && t.UserId == tag.UserId, tag);
    }

    public async Task<bool> DeleteAsync(string id, string userId)
    {
        var filter = Builders<Tag>.Filter.And(
            Builders<Tag>.Filter.Eq("_id", new ObjectId(id)),
            Builders<Tag>.Filter.Eq(t => t.UserId, userId)
        );
        var result = await _tags.DeleteOneAsync(filter);
        return result.DeletedCount > 0;
    }

    public async Task<bool> DeleteAllByUserIdAsync(string userId)
    {
        var result = await _tags.DeleteManyAsync(t => t.UserId == userId);
        return result.DeletedCount > 0;
    }
}
