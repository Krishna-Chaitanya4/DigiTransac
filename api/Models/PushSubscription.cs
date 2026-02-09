using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace DigiTransac.Api.Models;

/// <summary>
/// Represents a Web Push subscription for a user's device/browser
/// </summary>
[BsonIgnoreExtraElements]
public class PushSubscription
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string Id { get; set; } = null!;

    /// <summary>
    /// The user ID this subscription belongs to
    /// </summary>
    [BsonElement("userId")]
    [BsonRepresentation(BsonType.ObjectId)]
    public string UserId { get; set; } = null!;

    /// <summary>
    /// The push subscription endpoint URL
    /// </summary>
    [BsonElement("endpoint")]
    public string Endpoint { get; set; } = null!;

    /// <summary>
    /// The P256DH key for encryption
    /// </summary>
    [BsonElement("p256dh")]
    public string P256dh { get; set; } = null!;

    /// <summary>
    /// The auth secret for encryption
    /// </summary>
    [BsonElement("auth")]
    public string Auth { get; set; } = null!;

    /// <summary>
    /// User agent string for identifying the device/browser
    /// </summary>
    [BsonElement("userAgent")]
    public string? UserAgent { get; set; }

    /// <summary>
    /// Optional device name provided by the user
    /// </summary>
    [BsonElement("deviceName")]
    public string? DeviceName { get; set; }

    /// <summary>
    /// When the subscription was created
    /// </summary>
    [BsonElement("createdAt")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    /// <summary>
    /// When the subscription was last used successfully
    /// </summary>
    [BsonElement("lastUsedAt")]
    public DateTime? LastUsedAt { get; set; }

    /// <summary>
    /// Whether push notifications are enabled for this subscription
    /// </summary>
    [BsonElement("isEnabled")]
    public bool IsEnabled { get; set; } = true;
}