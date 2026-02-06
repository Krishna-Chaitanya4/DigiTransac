using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace DigiTransac.Api.Models;

/// <summary>
/// Temporary token used during 2FA login flow.
/// After successful password verification, this token is created
/// and must be exchanged along with a valid TOTP code to get access tokens.
/// </summary>
[BsonIgnoreExtraElements]
public class TwoFactorToken
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string Id { get; set; } = null!;

    [BsonElement("userId")]
    public string UserId { get; set; } = null!;

    [BsonElement("token")]
    public string Token { get; set; } = null!;

    [BsonElement("createdAt")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [BsonElement("expiresAt")]
    public DateTime ExpiresAt { get; set; }

    [BsonElement("isUsed")]
    public bool IsUsed { get; set; } = false;

    /// <summary>
    /// Email OTP code for backup 2FA method
    /// </summary>
    [BsonElement("emailOtpCode")]
    public string? EmailOtpCode { get; set; }

    /// <summary>
    /// When the email OTP was sent (for rate limiting)
    /// </summary>
    [BsonElement("emailOtpSentAt")]
    public DateTime? EmailOtpSentAt { get; set; }
}
