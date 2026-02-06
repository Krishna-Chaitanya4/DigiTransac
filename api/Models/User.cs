using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace DigiTransac.Api.Models;

[BsonIgnoreExtraElements]
public class User
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string Id { get; set; } = null!;

    [BsonElement("email")]
    public string Email { get; set; } = null!;

    [BsonElement("passwordHash")]
    public string PasswordHash { get; set; } = null!;

    [BsonElement("fullName")]
    public string FullName { get; set; } = null!;

    [BsonElement("isEmailVerified")]
    public bool IsEmailVerified { get; set; } = false;

    [BsonElement("phoneNumber")]
    public string? PhoneNumber { get; set; }

    [BsonElement("twoFactorEnabled")]
    public bool TwoFactorEnabled { get; set; } = false;

    [BsonElement("twoFactorSecret")]
    public string? TwoFactorSecret { get; set; }

    [BsonElement("primaryCurrency")]
    public string PrimaryCurrency { get; set; } = "USD";

    /// <summary>
    /// User's Data Encryption Key (DEK), wrapped (encrypted) with the server's KEK.
    /// Used for envelope encryption of sensitive user data.
    /// </summary>
    [BsonElement("wrappedDek")]
    public byte[]? WrappedDek { get; set; }

    [BsonElement("createdAt")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
