using DigiTransac.Api.Settings;
using Microsoft.Extensions.Options;
using MongoDB.Driver;

namespace DigiTransac.Api.Services;

/// <summary>
/// Provides a singleton MongoDB client and database access.
/// MongoDB recommends using a single client instance per application.
/// </summary>
public interface IMongoDbService
{
    IMongoDatabase Database { get; }
    IMongoCollection<T> GetCollection<T>(string name);
}

public class MongoDbService : IMongoDbService
{
    private readonly IMongoDatabase _database;

    public MongoDbService(IOptions<MongoDbSettings> settings)
    {
        var clientSettings = MongoClientSettings.FromConnectionString(settings.Value.ConnectionString);
        
        // Configure connection pool settings for optimal performance
        clientSettings.MaxConnectionPoolSize = 100;
        clientSettings.MinConnectionPoolSize = 10;
        clientSettings.WaitQueueTimeout = TimeSpan.FromSeconds(30);
        
        var client = new MongoClient(clientSettings);
        _database = client.GetDatabase(settings.Value.DatabaseName);
    }

    public IMongoDatabase Database => _database;

    public IMongoCollection<T> GetCollection<T>(string name)
    {
        return _database.GetCollection<T>(name);
    }
}
