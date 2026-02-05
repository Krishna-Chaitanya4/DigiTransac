using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace DigiTransac.Api.Models;

/// <summary>
/// Represents an audit log entry for tracking security-sensitive operations.
/// </summary>
public class AuditLog
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string Id { get; set; } = ObjectId.GenerateNewId().ToString();

    /// <summary>
    /// User who performed the action (null for anonymous/system)
    /// </summary>
    [BsonRepresentation(BsonType.ObjectId)]
    public string? UserId { get; set; }

    /// <summary>
    /// Email of the user (for easier querying)
    /// </summary>
    public string? UserEmail { get; set; }

    /// <summary>
    /// Type of action performed
    /// </summary>
    public AuditAction Action { get; set; }

    /// <summary>
    /// Category of the audit event
    /// </summary>
    public AuditCategory Category { get; set; }

    /// <summary>
    /// Whether the action was successful
    /// </summary>
    public bool Success { get; set; }

    /// <summary>
    /// Human-readable description of the action
    /// </summary>
    public string Description { get; set; } = string.Empty;

    /// <summary>
    /// Additional details about the action (JSON serializable)
    /// </summary>
    public Dictionary<string, object>? Details { get; set; }

    /// <summary>
    /// IP address of the client
    /// </summary>
    public string? IpAddress { get; set; }

    /// <summary>
    /// User agent string from the client
    /// </summary>
    public string? UserAgent { get; set; }

    /// <summary>
    /// Request path that triggered this action
    /// </summary>
    public string? RequestPath { get; set; }

    /// <summary>
    /// HTTP method used
    /// </summary>
    public string? HttpMethod { get; set; }

    /// <summary>
    /// Correlation ID for tracing related operations
    /// </summary>
    public string? CorrelationId { get; set; }

    /// <summary>
    /// When the action occurred
    /// </summary>
    public DateTime Timestamp { get; set; } = DateTime.UtcNow;

    /// <summary>
    /// Duration of the operation in milliseconds (if applicable)
    /// </summary>
    public long? DurationMs { get; set; }

    /// <summary>
    /// Error message if the action failed
    /// </summary>
    public string? ErrorMessage { get; set; }
}

/// <summary>
/// Types of auditable actions
/// </summary>
public enum AuditAction
{
    // Authentication
    LoginAttempt,
    LoginSuccess,
    LoginFailed,
    Logout,
    TokenRefresh,
    
    // Account Management
    UserRegistration,
    EmailVerificationSent,
    EmailVerified,
    PasswordChangeRequested,
    PasswordChanged,
    PasswordReset,
    ProfileUpdated,
    AccountDeleted,
    
    // Two-Factor Authentication
    TwoFactorEnabled,
    TwoFactorDisabled,
    TwoFactorVerified,
    TwoFactorFailed,
    
    // Financial Operations
    TransactionCreated,
    TransactionUpdated,
    TransactionDeleted,
    TransferCompleted,
    P2PTransactionSent,
    P2PTransactionAccepted,
    P2PTransactionRejected,
    
    // Budget Operations
    BudgetCreated,
    BudgetUpdated,
    BudgetDeleted,
    BudgetAlertTriggered,
    
    // Account Operations (Financial Accounts)
    FinancialAccountCreated,
    FinancialAccountUpdated,
    FinancialAccountDeleted,
    FinancialAccountArchived,
    
    // Data Export
    DataExported,
    
    // Admin Operations
    AdminAction,
    
    // Security Events
    SuspiciousActivity,
    RateLimitExceeded,
    InvalidTokenUsed
}

/// <summary>
/// Categories for audit events
/// </summary>
public enum AuditCategory
{
    Authentication,
    AccountManagement,
    TwoFactor,
    FinancialOperation,
    DataAccess,
    Security,
    Admin
}