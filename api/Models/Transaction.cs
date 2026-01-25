using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace DigiTransac.Api.Models;

public enum TransactionType
{
    Receive,  // Money coming in - user is receiver
    Send      // Money going out - user is sender
    // Note: "Transfer" is a UI concept - it creates linked Send + Receive transactions
}

public enum RecurrenceFrequency
{
    Daily,
    Weekly,
    Biweekly,
    Monthly,
    Quarterly,
    Yearly
}

public enum TransactionStatus
{
    Pending,    // Awaiting counterparty confirmation (P2P)
    Confirmed,  // Verified/accepted transaction
    Declined    // Counterparty rejected (P2P)
}

public class TransactionSplit
{
    [BsonElement("labelId")]
    [BsonRepresentation(BsonType.ObjectId)]
    public string LabelId { get; set; } = null!;

    [BsonElement("amount")]
    public decimal Amount { get; set; }

    [BsonElement("notes")]
    public string? Notes { get; set; }
}

public class TransactionLocation
{
    [BsonElement("latitude")]
    public double Latitude { get; set; }

    [BsonElement("longitude")]
    public string? EncryptedLongitude { get; set; } // Encrypted for privacy

    [BsonElement("placeName")]
    public string? EncryptedPlaceName { get; set; } // Encrypted for privacy

    [BsonElement("city")]
    public string? City { get; set; }

    [BsonElement("country")]
    public string? Country { get; set; }
}

public class RecurringRule
{
    [BsonElement("frequency")]
    [BsonRepresentation(BsonType.String)]
    public RecurrenceFrequency Frequency { get; set; }

    [BsonElement("interval")]
    public int Interval { get; set; } = 1; // e.g., every 2 weeks

    [BsonElement("endDate")]
    public DateTime? EndDate { get; set; }

    [BsonElement("nextOccurrence")]
    public DateTime NextOccurrence { get; set; }

    [BsonElement("lastProcessed")]
    public DateTime? LastProcessed { get; set; }
}

[BsonIgnoreExtraElements]
public class Transaction
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string Id { get; set; } = null!;

    [BsonElement("userId")]
    [BsonRepresentation(BsonType.ObjectId)]
    public string UserId { get; set; } = null!;

    [BsonElement("accountId")]
    [BsonRepresentation(BsonType.ObjectId)]
    [BsonIgnoreIfNull]
    public string? AccountId { get; set; }  // Null for pending P2P transactions

    [BsonElement("type")]
    [BsonRepresentation(BsonType.String)]
    public TransactionType Type { get; set; }

    [BsonElement("amount")]
    public decimal Amount { get; set; } // Always positive, sum of splits

    [BsonElement("currency")]
    public string Currency { get; set; } = null!; // Locked to account's currency

    [BsonElement("date")]
    public DateTime Date { get; set; }

    [BsonElement("title")]
    public string? Title { get; set; }

    [BsonElement("payee")]
    public string? EncryptedPayee { get; set; } // Encrypted

    [BsonElement("notes")]
    public string? EncryptedNotes { get; set; } // Encrypted

    [BsonElement("splits")]
    public List<TransactionSplit> Splits { get; set; } = new();

    [BsonElement("tagIds")]
    [BsonRepresentation(BsonType.ObjectId)]
    public List<string> TagIds { get; set; } = new();

    [BsonElement("location")]
    public TransactionLocation? Location { get; set; }

    // For transfers
    [BsonElement("transferToAccountId")]
    [BsonRepresentation(BsonType.ObjectId)]
    public string? TransferToAccountId { get; set; }

    [BsonElement("linkedTransactionId")]
    [BsonRepresentation(BsonType.ObjectId)]
    public string? LinkedTransactionId { get; set; } // Links the two sides of a transfer

    // P2P / Transfer linking (new unified model)
    [BsonElement("transactionLinkId")]
    [BsonGuidRepresentation(GuidRepresentation.Standard)]
    public Guid? TransactionLinkId { get; set; } // Shared GUID linking both sender and receiver records

    [BsonElement("counterpartyUserId")]
    [BsonRepresentation(BsonType.ObjectId)]
    public string? CounterpartyUserId { get; set; } // The other party's user ID (immutable)

    // Recurring transaction support
    [BsonElement("recurringRule")]
    public RecurringRule? RecurringRule { get; set; }

    [BsonElement("parentTransactionId")]
    [BsonRepresentation(BsonType.ObjectId)]
    public string? ParentTransactionId { get; set; } // For transactions generated from recurring

    [BsonElement("isRecurringTemplate")]
    public bool IsRecurringTemplate { get; set; } = false; // True for recurring template transactions

    // Status
    [BsonElement("status")]
    [BsonRepresentation(BsonType.String)]
    public TransactionStatus Status { get; set; } = TransactionStatus.Confirmed;

    [BsonElement("createdAt")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [BsonElement("updatedAt")]
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    [BsonElement("lastSyncedAt")]
    public DateTime? LastSyncedAt { get; set; } // Set when transaction is updated via P2P sync
}
