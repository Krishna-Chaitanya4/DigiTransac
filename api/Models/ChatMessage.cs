using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace DigiTransac.Api.Models;

public enum ChatMessageType
{
    Text,           // Regular text message
    Transaction,    // Reference to a P2P transaction
    Request         // Money request (future feature)
}

public class ChatMessage
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string Id { get; set; } = null!;

    /// <summary>
    /// The user who sent this message
    /// </summary>
    [BsonElement("senderUserId")]
    [BsonRepresentation(BsonType.ObjectId)]
    public string SenderUserId { get; set; } = null!;

    /// <summary>
    /// The user who receives this message
    /// </summary>
    [BsonElement("recipientUserId")]
    [BsonRepresentation(BsonType.ObjectId)]
    public string RecipientUserId { get; set; } = null!;

    /// <summary>
    /// Type of message: Text, Transaction reference, or Request
    /// </summary>
    [BsonElement("type")]
    [BsonRepresentation(BsonType.String)]
    public ChatMessageType Type { get; set; } = ChatMessageType.Text;

    /// <summary>
    /// Text content (for Text type messages)
    /// </summary>
    [BsonElement("content")]
    public string? Content { get; set; }

    /// <summary>
    /// Reference to transaction (for Transaction type messages)
    /// Links to the user's own transaction in the P2P pair
    /// </summary>
    [BsonElement("transactionId")]
    [BsonRepresentation(BsonType.ObjectId)]
    public string? TransactionId { get; set; }

    /// <summary>
    /// The shared link ID between P2P transaction pairs
    /// Used to identify the same transaction from both sides
    /// </summary>
    [BsonElement("transactionLinkId")]
    public Guid? TransactionLinkId { get; set; }

    /// <summary>
    /// Whether the recipient has read this message
    /// </summary>
    [BsonElement("isRead")]
    public bool IsRead { get; set; } = false;

    [BsonElement("createdAt")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
