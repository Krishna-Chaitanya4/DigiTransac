using DigiTransac.Core.Models;
using DigiTransac.Infrastructure.Interfaces;
using MongoDB.Driver;

namespace DigiTransac.Infrastructure.Repositories;

public class UserRepository : IUserRepository
{
    private readonly IMongoCollection<User> _users;

    public UserRepository(IMongoClient mongoClient)
    {
        var databaseName = Environment.GetEnvironmentVariable("MONGODB_DATABASE_NAME")
            ?? Environment.GetEnvironmentVariable("COSMOS_DATABASE_NAME")
            ?? "DigiTransacDB";
            
        var database = mongoClient.GetDatabase(databaseName);
        _users = database.GetCollection<User>("users");
    }

    public async Task<User?> GetByEmailAsync(string email)
    {
        return await _users.Find(u => u.Email == email).FirstOrDefaultAsync();
    }

    public async Task<User?> GetByUsernameAsync(string username)
    {
        return await _users.Find(u => u.Username == username).FirstOrDefaultAsync();
    }

    public async Task<User?> GetByIdAsync(string id)
    {
        return await _users.Find(u => u.Id == id).FirstOrDefaultAsync();
    }

    public async Task<User> CreateAsync(User user)
    {
        user.CreatedAt = DateTime.UtcNow;
        user.UpdatedAt = DateTime.UtcNow;
        await _users.InsertOneAsync(user);
        return user;
    }

    public async Task<User?> UpdateAsync(string id, User user)
    {
        user.UpdatedAt = DateTime.UtcNow;
        return await _users.FindOneAndUpdateAsync(
            u => u.Id == id,
            new ObjectDefinitionBuilder<User>()
                .Set(u => u.Email, user.Email)
                .Set(u => u.FullName, user.FullName)
                .Set(u => u.Phone, user.Phone)
                .Set(u => u.UpdatedAt, user.UpdatedAt)
                .Build(),
            new FindOneAndUpdateOptions<User> { ReturnDocument = ReturnDocument.After }
        );
    }
}

public class ObjectDefinitionBuilder<T>
{
    private readonly List<UpdateDefinition<T>> _updates = [];

    public ObjectDefinitionBuilder<T> Set<TField>(System.Linq.Expressions.Expression<Func<T, TField>> field, TField value)
    {
        _updates.Add(Builders<T>.Update.Set(field, value));
        return this;
    }

    public UpdateDefinition<T> Build()
    {
        return Builders<T>.Update.Combine(_updates);
    }
}
