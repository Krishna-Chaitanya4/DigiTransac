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

/// <summary>
/// How the transaction was created
/// </summary>
public enum TransactionSource
{
    Manual,     // User created via transaction form
    Chat,       // Created via chat "Send Money"
    Recurring,  // Auto-generated from recurring template
    Import,     // Imported from CSV/bank
    Transfer    // Internal account transfer
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

    /// <summary>
    /// UTC datetime used for queries/sorting. When DateLocal is present, this is
    /// derived from DateLocal + DateTimezone (noon local → UTC).
    /// </summary>
    [BsonElement("date")]
    public DateTime Date { get; set; }

    /// <summary>
    /// The human-intended calendar date in YYYY-MM-DD format (e.g., "2024-01-15").
    /// This is the date the user selected, independent of timezone.
    /// For display, always prefer this field when available.
    /// </summary>
    [BsonElement("dateLocal")]
    public string? DateLocal { get; set; }

    /// <summary>
    /// The local time in HH:mm format (e.g., "14:30").
    /// This is the time the transaction occurred in the user's local timezone.
    /// Combined with DateLocal and DateTimezone for accurate time reconstruction.
    /// </summary>
    [BsonElement("timeLocal")]
    public string? TimeLocal { get; set; }

    /// <summary>
    /// The IANA timezone identifier at the time of transaction creation (e.g., "Asia/Kolkata").
    /// Enables accurate reconstruction of local time for reporting/analytics.
    /// </summary>
    [BsonElement("dateTimezone")]
    public string? DateTimezone { get; set; }

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

    /// <summary>
    /// Reference to the chat message created for this transaction.
    /// Enables bidirectional navigation between transaction and chat.
    /// </summary>
    [BsonElement("chatMessageId")]
    [BsonRepresentation(BsonType.ObjectId)]
    public string? ChatMessageId { get; set; }

    /// <summary>
    /// How the transaction was created (Manual, Chat, Recurring, Import, Transfer)
    /// </summary>
    [BsonElement("source")]
    [BsonRepresentation(BsonType.String)]
    public TransactionSource Source { get; set; } = TransactionSource.Manual;

    /// <summary>
    /// Whether this transaction has been soft-deleted.
    /// Soft-deleted transactions are hidden from queries but can be restored within the undo window.
    /// </summary>
    [BsonElement("isDeleted")]
    public bool IsDeleted { get; set; } = false;

    /// <summary>
    /// When the transaction was soft-deleted. Used to determine the undo window expiry.
    /// After 24 hours, the transaction is permanently purged by the cleanup service.
    /// </summary>
    [BsonElement("deletedAt")]
    public DateTime? DeletedAt { get; set; }

    [BsonElement("createdAt")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [BsonElement("updatedAt")]
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    [BsonElement("lastSyncedAt")]
    public DateTime? LastSyncedAt { get; set; } // Set when transaction is updated via P2P sync
}
