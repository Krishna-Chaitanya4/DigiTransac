using DigiTransac.Core.Models;
using DigiTransac.Infrastructure.Interfaces;
using MongoDB.Driver;
using MongoDB.Bson;

namespace DigiTransac.Infrastructure.Repositories;

public class CategoryRepository : ICategoryRepository
{
    private readonly IMongoCollection<Category> _categories;

    public CategoryRepository(IMongoClient mongoClient)
    {
        // Match Node.js backend: use environment variable or default to "DigiTransacDB"
        var databaseName = Environment.GetEnvironmentVariable("MONGODB_DATABASE_NAME")
            ?? Environment.GetEnvironmentVariable("COSMOS_DATABASE_NAME")
            ?? "DigiTransacDB";
            
        var database = mongoClient.GetDatabase(databaseName);
        _categories = database.GetCollection<Category>("categories");
    }

    public async Task<List<Category>> GetAllAsync(string userId)
    {
        return await _categories
            .Find(Builders<Category>.Filter.Eq(c => c.UserId, userId))
            .SortBy(c => c.Name)
            .ToListAsync();
    }

    public async Task<Category?> GetByIdAsync(string id, string userId)
    {
        return await _categories
            .Find(Builders<Category>.Filter.And(
                Builders<Category>.Filter.Eq(c => c.Id, id),
                Builders<Category>.Filter.Eq(c => c.UserId, userId)
            ))
            .FirstOrDefaultAsync();
    }

    public async Task<Category> CreateAsync(Category category)
    {
        category.CreatedAt = DateTime.UtcNow;
        category.UpdatedAt = DateTime.UtcNow;
        await _categories.InsertOneAsync(category);
        return category;
    }

    public async Task<bool> UpdateAsync(string id, Category category)
    {
        category.UpdatedAt = DateTime.UtcNow;
        var result = await _categories.ReplaceOneAsync(
            c => c.Id == id && c.UserId == category.UserId,
            category
        );
        return result.ModifiedCount > 0;
    }

    public async Task<bool> DeleteAsync(string id, string userId)
    {
        var result = await _categories.DeleteOneAsync(c => c.Id == id && c.UserId == userId);
        return result.DeletedCount > 0;
    }
}
