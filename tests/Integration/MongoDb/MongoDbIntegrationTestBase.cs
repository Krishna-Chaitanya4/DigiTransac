using System.Net.Http.Headers;
using System.Net.Http.Json;
using DigiTransac.Api.Models;
using DigiTransac.Api.Models.Dto;
using DigiTransac.Api.Services;
using Microsoft.Extensions.DependencyInjection;
using MongoDB.Driver;

namespace DigiTransac.Tests.Integration.MongoDb;

/// <summary>
/// Base class for MongoDB integration tests.
/// Provides helper methods for authentication and database operations.
/// </summary>
public abstract class MongoDbIntegrationTestBase : IAsyncLifetime
{
    protected readonly MongoDbContainerFixture MongoFixture;
    protected MongoDbWebApplicationFactory Factory = null!;
    protected HttpClient Client = null!;
    
    // TestUserId must be a valid 24 digit hex string for MongoDB ObjectId
    protected const string TestUserId = "aabbccddeeff00112233445a";
    protected const string TestEmail = "integration@example.com";
    protected const string TestPassword = "Test@123456!";
    protected User? TestUser;

    protected MongoDbIntegrationTestBase(MongoDbContainerFixture mongoFixture)
    {
        MongoFixture = mongoFixture;
    }

    public virtual async Task InitializeAsync()
    {
        Factory = new MongoDbWebApplicationFactory(MongoFixture.ConnectionString);
        Client = Factory.CreateClient();
        
        // Set up a test user for authentication
        await SetupTestUserAsync();
    }

    public virtual async Task DisposeAsync()
    {
        // Clean up test data
        await CleanupDatabaseAsync();
        
        Client.Dispose();
        await Factory.DisposeAsync();
    }

    /// <summary>
    /// Creates a test user in the database for authentication tests.
    /// The user's DEK is properly wrapped using the configured IKeyManagementService.
    /// </summary>
    protected async Task SetupTestUserAsync()
    {
        using var scope = Factory.Services.CreateScope();
        var mongoDbService = scope.ServiceProvider.GetRequiredService<IMongoDbService>();
        var keyManagementService = scope.ServiceProvider.GetRequiredService<IKeyManagementService>();
        var usersCollection = mongoDbService.GetCollection<User>("users");
        
        // Generate and properly wrap a DEK for the test user
        var dek = keyManagementService.GenerateDek();
        var wrappedDek = await keyManagementService.WrapKeyAsync(dek);
        
        TestUser = new User
        {
            Id = TestUserId,
            Email = TestEmail,
            FullName = "Integration Test User",
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(TestPassword),
            IsEmailVerified = true,
            WrappedDek = wrappedDek,
            PrimaryCurrency = "INR",
            CreatedAt = DateTime.UtcNow
        };

        // Remove existing test user if any
        await usersCollection.DeleteOneAsync(u => u.Id == TestUserId);
        await usersCollection.InsertOneAsync(TestUser);
    }

    /// <summary>
    /// Gets an authenticated HTTP client with a valid JWT token.
    /// </summary>
    protected async Task<HttpClient> GetAuthenticatedClientAsync()
    {
        var loginRequest = new LoginRequest(TestEmail, TestPassword);
        var loginResponse = await Client.PostAsJsonAsync("/api/auth/login", loginRequest);
        
        if (!loginResponse.IsSuccessStatusCode)
        {
            var error = await loginResponse.Content.ReadAsStringAsync();
            throw new InvalidOperationException($"Login failed: {error}");
        }
        
        var authResponse = await loginResponse.Content.ReadFromJsonAsync<LoginResponseWithoutRefresh>();
        
        var authClient = Factory.CreateClient();
        authClient.DefaultRequestHeaders.Authorization = 
            new AuthenticationHeaderValue("Bearer", authResponse!.AccessToken);
        
        return authClient;
    }

    /// <summary>
    /// Cleans up all test data from the database.
    /// </summary>
    protected async Task CleanupDatabaseAsync()
    {
        using var scope = Factory.Services.CreateScope();
        var mongoDbService = scope.ServiceProvider.GetRequiredService<IMongoDbService>();
        var database = mongoDbService.Database;
        
        // Drop all test collections
        var collections = await database.ListCollectionNamesAsync();
        await collections.ForEachAsync(async name =>
        {
            await database.DropCollectionAsync(name);
        });
    }

    /// <summary>
    /// Gets a collection from the test database.
    /// </summary>
    protected IMongoCollection<T> GetCollection<T>(string name)
    {
        using var scope = Factory.Services.CreateScope();
        var mongoDbService = scope.ServiceProvider.GetRequiredService<IMongoDbService>();
        return mongoDbService.GetCollection<T>(name);
    }
}