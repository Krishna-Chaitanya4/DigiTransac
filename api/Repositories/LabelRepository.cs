using DigiTransac.Api.Models;
using DigiTransac.Api.Services;
using MongoDB.Bson;
using MongoDB.Driver;

namespace DigiTransac.Api.Repositories;

public interface ILabelRepository
{
    Task<List<Label>> GetByUserIdAsync(string userId, CancellationToken ct = default);
    Task<Label?> GetByIdAsync(string id, CancellationToken ct = default);
    Task<Label?> GetByIdAndUserIdAsync(string id, string userId, CancellationToken ct = default);
    Task<Label> CreateAsync(Label label, CancellationToken ct = default);
    Task CreateManyAsync(List<Label> labels, CancellationToken ct = default);
    Task UpdateAsync(Label label, CancellationToken ct = default);
    Task<bool> DeleteAsync(string id, string userId, CancellationToken ct = default);
    Task<bool> DeleteAllByUserIdAsync(string userId, CancellationToken ct = default);
    Task<List<Label>> GetChildrenAsync(string parentId, string userId, CancellationToken ct = default);
    Task<bool> HasChildrenAsync(string parentId, string userId, CancellationToken ct = default);
    Task BulkUpdateOrderAsync(string userId, Dictionary<string, int> orderMap, CancellationToken ct = default);
}

public class LabelRepository : ILabelRepository
{
    private readonly IMongoCollection<Label> _labels;
    private static bool _indexesCreated;
    private static readonly object _indexLock = new();

    public LabelRepository(IMongoDbService mongoDbService)
    {
        _labels = mongoDbService.GetCollection<Label>("labels");

        // Create indexes once per application lifecycle
        if (!_indexesCreated)
        {
            lock (_indexLock)
            {
                if (!_indexesCreated)
                {
                    try
                    {
            var indexModels = new List<CreateIndexModel<Label>>
            {
                // UserId + Order for GetByUserIdAsync (most common query)
                new(Builders<Label>.IndexKeys
                    .Ascending(l => l.UserId)
                    .Ascending(l => l.Order),
                    new CreateIndexOptions { Name = "idx_userId_order" }),
                
                // UserId + ParentId for GetChildrenAsync and HasChildrenAsync
                new(Builders<Label>.IndexKeys
                    .Ascending(l => l.UserId)
                    .Ascending(l => l.ParentId)
                    .Ascending(l => l.Order),
                    new CreateIndexOptions { Name = "idx_userId_parentId_order" }),
                
                // UserId + Type for filtering categories vs folders
                new(Builders<Label>.IndexKeys
                    .Ascending(l => l.UserId)
                    .Ascending(l => l.Type),
                    new CreateIndexOptions { Name = "idx_userId_type" })
            };

            _labels.Indexes.CreateMany(indexModels);
        }
        catch (MongoCommandException)
        {
            // Indexes may already exist with different names - this is OK
        }
        _indexesCreated = true;
                }
            }
        }
    }

    public async Task<List<Label>> GetByUserIdAsync(string userId, CancellationToken ct = default)
    {
        return await _labels.Find(l => l.UserId == userId)
            .SortBy(l => l.Order)
            .ThenBy(l => l.Name)
            .ToListAsync(ct);
    }

    public async Task<Label?> GetByIdAsync(string id, CancellationToken ct = default)
    {
        return await _labels.Find(l => l.Id == id).FirstOrDefaultAsync(ct);
    }

    public async Task<Label?> GetByIdAndUserIdAsync(string id, string userId, CancellationToken ct = default)
    {
        return await _labels.Find(l => l.Id == id && l.UserId == userId).FirstOrDefaultAsync(ct);
    }

    public async Task<Label> CreateAsync(Label label, CancellationToken ct = default)
    {
        await _labels.InsertOneAsync(label, options: null, ct);
        return label;
    }

    public async Task CreateManyAsync(List<Label> labels, CancellationToken ct = default)
    {
        if (labels.Count > 0)
        {
            await _labels.InsertManyAsync(labels, options: null, ct);
        }
    }

    public async Task UpdateAsync(Label label, CancellationToken ct = default)
    {
        await _labels.ReplaceOneAsync(l => l.Id == label.Id && l.UserId == label.UserId, label, options: (ReplaceOptions?)null, ct);
    }

    public async Task<bool> DeleteAsync(string id, string userId, CancellationToken ct = default)
    {
        var filter = Builders<Label>.Filter.And(
            Builders<Label>.Filter.Eq("_id", new ObjectId(id)),
            Builders<Label>.Filter.Eq(l => l.UserId, userId)
        );
        var result = await _labels.DeleteOneAsync(filter, ct);
        return result.DeletedCount > 0;
    }

    public async Task<bool> DeleteAllByUserIdAsync(string userId, CancellationToken ct = default)
    {
        var result = await _labels.DeleteManyAsync(l => l.UserId == userId, ct);
        return result.DeletedCount > 0;
    }

    public async Task<List<Label>> GetChildrenAsync(string parentId, string userId, CancellationToken ct = default)
    {
        return await _labels.Find(l => l.ParentId == parentId && l.UserId == userId)
            .SortBy(l => l.Order)
            .ThenBy(l => l.Name)
            .ToListAsync(ct);
    }

    public async Task<bool> HasChildrenAsync(string parentId, string userId, CancellationToken ct = default)
    {
        return await _labels.Find(l => l.ParentId == parentId && l.UserId == userId).AnyAsync(ct);
    }

    public async Task BulkUpdateOrderAsync(string userId, Dictionary<string, int> orderMap, CancellationToken ct = default)
    {
        if (orderMap.Count == 0) return;

        var bulkOps = orderMap.Select(kvp =>
            new UpdateOneModel<Label>(
                Builders<Label>.Filter.And(
                    Builders<Label>.Filter.Eq("_id", new ObjectId(kvp.Key)),
                    Builders<Label>.Filter.Eq(l => l.UserId, userId)),
                Builders<Label>.Update.Set(l => l.Order, kvp.Value))
        ).ToList<WriteModel<Label>>();

        await _labels.BulkWriteAsync(bulkOps, options: null, ct);
    }
}
