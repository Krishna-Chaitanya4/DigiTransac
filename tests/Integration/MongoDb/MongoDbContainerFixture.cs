using Testcontainers.MongoDb;

namespace DigiTransac.Tests.Integration.MongoDb;

/// <summary>
/// xUnit collection fixture that provides a MongoDB container for integration tests.
/// The container is started once per test collection and shared across all tests.
/// When Docker is not available, IsAvailable is set to false and tests are skipped gracefully.
/// </summary>
public class MongoDbContainerFixture : IAsyncLifetime
{
    private MongoDbContainer? _mongoDbContainer;
    
    /// <summary>
    /// Indicates whether Docker is available and the MongoDB container started successfully.
    /// </summary>
    public bool IsAvailable { get; private set; }
    
    public string ConnectionString => IsAvailable && _mongoDbContainer != null
        ? _mongoDbContainer.GetConnectionString() 
        : throw new InvalidOperationException("MongoDB container is not available. Docker may not be running.");

    public async Task InitializeAsync()
    {
        try
        {
            _mongoDbContainer = new MongoDbBuilder("mongo:7.0")
                .WithName($"mongo-test-{Guid.NewGuid():N}")
                .Build();
            await _mongoDbContainer.StartAsync();
            IsAvailable = true;
        }
        catch (Exception)
        {
            // Docker is not available or container failed to start.
            // Tests will be skipped gracefully via Skip.IfNot() in the base class.
            IsAvailable = false;
        }
    }

    public async Task DisposeAsync()
    {
        if (IsAvailable && _mongoDbContainer != null)
        {
            await _mongoDbContainer.StopAsync();
            await _mongoDbContainer.DisposeAsync();
        }
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