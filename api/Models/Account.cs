using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace DigiTransac.Api.Models;

public enum AccountType
{
    Bank,
    CreditCard,
    Cash,
    DigitalWallet,
    Investment,
    Loan
}

[BsonIgnoreExtraElements]
public class Account
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string Id { get; set; } = null!;

    [BsonElement("userId")]
    [BsonRepresentation(BsonType.ObjectId)]
    public string UserId { get; set; } = null!;

    [BsonElement("name")]
    public string Name { get; set; } = null!;

    [BsonElement("type")]
    [BsonRepresentation(BsonType.String)]
    public AccountType Type { get; set; }

    [BsonElement("icon")]
    public string? Icon { get; set; }

    [BsonElement("color")]
    public string? Color { get; set; }

    [BsonElement("currency")]
    public string Currency { get; set; } = "USD";

    [BsonElement("initialBalance")]
    public decimal InitialBalance { get; set; } = 0;

    [BsonElement("currentBalance")]
    public decimal CurrentBalance { get; set; } = 0;

    [BsonElement("institution")]
    public string? Institution { get; set; }

    [BsonElement("accountNumber")]
    public string? AccountNumber { get; set; }

    [BsonElement("notes")]
    public string? Notes { get; set; }

    [BsonElement("isArchived")]
    public bool IsArchived { get; set; } = false;

    [BsonElement("isDefault")]
    public bool IsDefault { get; set; } = false;  // Default account for P2P transactions

    [BsonElement("includeInNetWorth")]
    public bool IncludeInNetWorth { get; set; } = true;

    [BsonElement("order")]
    public int Order { get; set; } = 0;

    [BsonElement("createdAt")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [BsonElement("updatedAt")]
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
