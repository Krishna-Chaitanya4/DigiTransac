using Testcontainers.MongoDb;

namespace DigiTransac.Tests.Integration.MongoDb;

/// <summary>
/// xUnit collection fixture that provides a MongoDB container for integration tests.
/// The container is started once per test collection and shared across all tests.
/// </summary>
public class MongoDbContainerFixture : IAsyncLifetime
{
    private readonly MongoDbContainer _mongoDbContainer;
    
    public string ConnectionString => _mongoDbContainer.GetConnectionString();
    
    public MongoDbContainerFixture()
    {
        _mongoDbContainer = new MongoDbBuilder()
            .WithImage("mongo:7.0")
            .WithName($"mongo-test-{Guid.NewGuid():N}")
            .Build();
    }

    public async Task InitializeAsync()
    {
        await _mongoDbContainer.StartAsync();
    }

    public async Task DisposeAsync()
    {
        await _mongoDbContainer.StopAsync();
        await _mongoDbContainer.DisposeAsync();
    }
}

/// <summary>
/// Defines a test collection that shares the MongoDB container.
/// </summary>
[CollectionDefinition(Name)]
public class MongoDbTestCollection : ICollectionFixture<MongoDbContainerFixture>
{
    public const string Name = "MongoDb Integration Tests";
}