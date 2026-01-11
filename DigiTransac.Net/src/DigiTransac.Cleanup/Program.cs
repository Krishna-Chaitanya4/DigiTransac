using Azure.Identity;
using Azure.Security.KeyVault.Secrets;
using MongoDB.Driver;

// Get Key Vault URL
var keyVaultUrl = "https://digitransac-kv-3895.vault.azure.net/";
Console.WriteLine($"🔐 Connecting to Key Vault: {keyVaultUrl}");

// Authenticate with Azure
var credential = new DefaultAzureCredential();
var secretClient = new SecretClient(new Uri(keyVaultUrl), credential);

// Get MongoDB connection string
Console.WriteLine("📚 Fetching MongoDB connection string from Key Vault...");
var secret = await secretClient.GetSecretAsync("MongoDB-ConnectionString");
var mongoConnectionString = secret.Value.Value;
Console.WriteLine("✅ Connection string retrieved");

// Connect to MongoDB
var mongoSettings = MongoClientSettings.FromConnectionString(mongoConnectionString);
mongoSettings.ServerApi = new ServerApi(ServerApiVersion.V1);
mongoSettings.RetryReads = true;
mongoSettings.RetryWrites = true;

var mongoClient = new MongoClient(mongoSettings);
var database = mongoClient.GetDatabase("DigiTransacDB");

// Get all collection names
var collections = await database.ListCollectionNamesAsync();
var collectionList = await collections.ToListAsync();

if (collectionList.Count == 0)
{
    Console.WriteLine("✅ Database is already empty!");
}
else
{
    Console.WriteLine($"\n🗑️  Found {collectionList.Count} collections:");
    foreach (var collection in collectionList)
    {
        Console.WriteLine($"   - {collection}");
    }

    Console.WriteLine("\n⚠️  Clearing all collections...");
    foreach (var collectionName in collectionList)
    {
        await database.GetCollection<dynamic>(collectionName).DeleteManyAsync(FilterDefinition<dynamic>.Empty);
        Console.WriteLine($"   ✅ Cleared: {collectionName}");
    }

    Console.WriteLine("\n✅ Database cleaned successfully!");
}

Console.WriteLine("\n🚀 You can now register a new user:");
Console.WriteLine("   Email: testuser@example.com");
Console.WriteLine("   Username: testuser");
Console.WriteLine("   Password: TestPassword123!");
Console.WriteLine("   Full Name: Test User");
