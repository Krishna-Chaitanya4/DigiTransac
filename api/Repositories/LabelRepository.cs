using DigiTransac.Api.Models;
using DigiTransac.Api.Services;
using MongoDB.Bson;
using MongoDB.Driver;

namespace DigiTransac.Api.Repositories;

public interface ILabelRepository
{
    Task<List<Label>> GetByUserIdAsync(string userId);
    Task<Label?> GetByIdAsync(string id);
    Task<Label?> GetByIdAndUserIdAsync(string id, string userId);
    Task<Label> CreateAsync(Label label);
    Task CreateManyAsync(List<Label> labels);
    Task UpdateAsync(Label label);
    Task<bool> DeleteAsync(string id, string userId);
    Task<bool> DeleteAllByUserIdAsync(string userId);
    Task<List<Label>> GetChildrenAsync(string parentId, string userId);
    Task<bool> HasChildrenAsync(string parentId, string userId);
}

public class LabelRepository : ILabelRepository
{
    private readonly IMongoCollection<Label> _labels;

    public LabelRepository(IMongoDbService mongoDbService)
    {
        _labels = mongoDbService.GetCollection<Label>("labels");

        // Create indexes
        var userIdIndex = Builders<Label>.IndexKeys.Ascending(l => l.UserId);
        _labels.Indexes.CreateOne(new CreateIndexModel<Label>(userIdIndex));

        var parentIdIndex = Builders<Label>.IndexKeys.Ascending(l => l.ParentId);
        _labels.Indexes.CreateOne(new CreateIndexModel<Label>(parentIdIndex));
    }

    public async Task<List<Label>> GetByUserIdAsync(string userId)
    {
        return await _labels.Find(l => l.UserId == userId)
            .SortBy(l => l.Order)
            .ThenBy(l => l.Name)
            .ToListAsync();
    }

    public async Task<Label?> GetByIdAsync(string id)
    {
        return await _labels.Find(l => l.Id == id).FirstOrDefaultAsync();
    }

    public async Task<Label?> GetByIdAndUserIdAsync(string id, string userId)
    {
        return await _labels.Find(l => l.Id == id && l.UserId == userId).FirstOrDefaultAsync();
    }

    public async Task<Label> CreateAsync(Label label)
    {
        await _labels.InsertOneAsync(label);
        return label;
    }

    public async Task CreateManyAsync(List<Label> labels)
    {
        if (labels.Count > 0)
        {
            await _labels.InsertManyAsync(labels);
        }
    }

    public async Task UpdateAsync(Label label)
    {
        await _labels.ReplaceOneAsync(l => l.Id == label.Id && l.UserId == label.UserId, label);
    }

    public async Task<bool> DeleteAsync(string id, string userId)
    {
        var filter = Builders<Label>.Filter.And(
            Builders<Label>.Filter.Eq("_id", new ObjectId(id)),
            Builders<Label>.Filter.Eq(l => l.UserId, userId)
        );
        var result = await _labels.DeleteOneAsync(filter);
        return result.DeletedCount > 0;
    }

    public async Task<bool> DeleteAllByUserIdAsync(string userId)
    {
        var result = await _labels.DeleteManyAsync(l => l.UserId == userId);
        return result.DeletedCount > 0;
    }

    public async Task<List<Label>> GetChildrenAsync(string parentId, string userId)
    {
        return await _labels.Find(l => l.ParentId == parentId && l.UserId == userId)
            .SortBy(l => l.Order)
            .ThenBy(l => l.Name)
            .ToListAsync();
    }

    public async Task<bool> HasChildrenAsync(string parentId, string userId)
    {
        return await _labels.Find(l => l.ParentId == parentId && l.UserId == userId).AnyAsync();
    }
}
