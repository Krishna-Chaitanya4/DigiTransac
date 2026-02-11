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
    IMongoClient Client { get; }
    IMongoCollection<T> GetCollection<T>(string name);
}

public class MongoDbService : IMongoDbService
{
    private readonly IMongoClient _client;
    private readonly IMongoDatabase _database;

    public MongoDbService(IOptions<MongoDbSettings> settings, ILogger<MongoDbService> logger)
    {
        var mongoSettings = settings.Value;
        var clientSettings = MongoClientSettings.FromConnectionString(mongoSettings.ConnectionString);
        
        // Connection pool settings (configurable via appsettings.json > MongoDb section)
        clientSettings.MaxConnectionPoolSize = mongoSettings.MaxConnectionPoolSize;
        clientSettings.MinConnectionPoolSize = mongoSettings.MinConnectionPoolSize;
        clientSettings.WaitQueueTimeout = TimeSpan.FromSeconds(mongoSettings.WaitQueueTimeoutSeconds);
        clientSettings.MaxConnectionIdleTime = TimeSpan.FromSeconds(mongoSettings.MaxConnectionIdleTimeSeconds);
        clientSettings.MaxConnectionLifeTime = TimeSpan.FromSeconds(mongoSettings.MaxConnectionLifeTimeSeconds);
        
        // Timeout settings
        clientSettings.ConnectTimeout = TimeSpan.FromSeconds(mongoSettings.ConnectTimeoutSeconds);
        clientSettings.ServerSelectionTimeout = TimeSpan.FromSeconds(mongoSettings.ServerSelectionTimeoutSeconds);
        
        if (mongoSettings.SocketTimeoutSeconds > 0)
        {
            clientSettings.SocketTimeout = TimeSpan.FromSeconds(mongoSettings.SocketTimeoutSeconds);
        }
        
        // Retry settings
        clientSettings.RetryWrites = mongoSettings.RetryWrites;
        clientSettings.RetryReads = mongoSettings.RetryReads;
        
        _client = new MongoClient(clientSettings);
        _database = _client.GetDatabase(mongoSettings.DatabaseName);
        
        logger.LogInformation(
            "MongoDB connected to {Database} (pool: {Min}-{Max}, waitQueue: {WaitQueue}s)",
            mongoSettings.DatabaseName,
            mongoSettings.MinConnectionPoolSize,
            mongoSettings.MaxConnectionPoolSize,
            mongoSettings.WaitQueueTimeoutSeconds);
    }

    public IMongoDatabase Database => _database;
    public IMongoClient Client => _client;

    public IMongoCollection<T> GetCollection<T>(string name)
    {
        return _database.GetCollection<T>(name);
    }
}
