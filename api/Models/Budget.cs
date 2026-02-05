using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace DigiTransac.Api.Models;

/// <summary>
/// Budget period types for recurring budgets
/// </summary>
public enum BudgetPeriod
{
    Weekly,
    Monthly,
    Quarterly,
    Yearly,
    Custom
}

/// <summary>
/// Alert threshold configuration
/// </summary>
public class BudgetAlert
{
    /// <summary>
    /// Threshold percentage (0-100) that triggers alert
    /// </summary>
    [BsonElement("threshold")]
    public int ThresholdPercent { get; set; }
    
    /// <summary>
    /// Whether to send notification when threshold is crossed
    /// </summary>
    [BsonElement("notifyEnabled")]
    public bool NotifyEnabled { get; set; } = true;
    
    /// <summary>
    /// Whether this alert has been triggered for the current period
    /// </summary>
    [BsonElement("triggered")]
    public bool Triggered { get; set; } = false;
    
    /// <summary>
    /// When the alert was last triggered
    /// </summary>
    [BsonElement("lastTriggeredAt")]
    public DateTime? LastTriggeredAt { get; set; }
}

/// <summary>
/// Budget model for tracking spending limits
/// </summary>
[BsonIgnoreExtraElements]
public class Budget
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string Id { get; set; } = null!;
    
    /// <summary>
    /// User who owns this budget
    /// </summary>
    [BsonElement("userId")]
    [BsonRepresentation(BsonType.ObjectId)]
    public string UserId { get; set; } = null!;
    
    /// <summary>
    /// Budget name (e.g., "Monthly Groceries", "Entertainment")
    /// </summary>
    [BsonElement("name")]
    public string Name { get; set; } = null!;
    
    /// <summary>
    /// Budget description
    /// </summary>
    [BsonElement("description")]
    public string? Description { get; set; }
    
    /// <summary>
    /// Budget limit amount
    /// </summary>
    [BsonElement("amount")]
    public decimal Amount { get; set; }
    
    /// <summary>
    /// Currency code (ISO 4217)
    /// </summary>
    [BsonElement("currency")]
    public string Currency { get; set; } = "INR";
    
    /// <summary>
    /// Budget period type
    /// </summary>
    [BsonElement("period")]
    [BsonRepresentation(BsonType.String)]
    public BudgetPeriod Period { get; set; } = BudgetPeriod.Monthly;
    
    /// <summary>
    /// Start date of the budget (used for custom periods)
    /// </summary>
    [BsonElement("startDate")]
    public DateTime StartDate { get; set; }
    
    /// <summary>
    /// End date of the budget (optional, for custom periods)
    /// </summary>
    [BsonElement("endDate")]
    public DateTime? EndDate { get; set; }
    
    /// <summary>
    /// Labels/categories to track for this budget (if empty, tracks all expenses)
    /// </summary>
    [BsonElement("labelIds")]
    public List<string> LabelIds { get; set; } = new();
    
    /// <summary>
    /// Account IDs to track for this budget (if empty, tracks all accounts)
    /// </summary>
    [BsonElement("accountIds")]
    public List<string> AccountIds { get; set; } = new();
    
    /// <summary>
    /// Alert thresholds (e.g., 50%, 80%, 100%)
    /// </summary>
    [BsonElement("alerts")]
    public List<BudgetAlert> Alerts { get; set; } = new()
    {
        new BudgetAlert { ThresholdPercent = 50, NotifyEnabled = false },
        new BudgetAlert { ThresholdPercent = 80, NotifyEnabled = true },
        new BudgetAlert { ThresholdPercent = 100, NotifyEnabled = true }
    };
    
    /// <summary>
    /// Whether the budget is currently active
    /// </summary>
    [BsonElement("isActive")]
    public bool IsActive { get; set; } = true;
    
    /// <summary>
    /// Color for UI display
    /// </summary>
    [BsonElement("color")]
    public string? Color { get; set; }
    
    /// <summary>
    /// Icon for UI display
    /// </summary>
    [BsonElement("icon")]
    public string? Icon { get; set; }
    
    [BsonElement("createdAt")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    
    [BsonElement("updatedAt")]
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

/// <summary>
/// Spending alert notification for a budget
/// </summary>
[BsonIgnoreExtraElements]
public class BudgetNotification
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string Id { get; set; } = null!;
    
    /// <summary>
    /// User who receives this notification
    /// </summary>
    [BsonElement("userId")]
    [BsonRepresentation(BsonType.ObjectId)]
    public string UserId { get; set; } = null!;
    
    /// <summary>
    /// Budget that triggered this notification
    /// </summary>
    [BsonElement("budgetId")]
    [BsonRepresentation(BsonType.ObjectId)]
    public string BudgetId { get; set; } = null!;
    
    /// <summary>
    /// Budget name at time of notification
    /// </summary>
    [BsonElement("budgetName")]
    public string BudgetName { get; set; } = null!;
    
    /// <summary>
    /// Threshold that was crossed
    /// </summary>
    [BsonElement("thresholdPercent")]
    public int ThresholdPercent { get; set; }
    
    /// <summary>
    /// Actual percentage spent when alert triggered
    /// </summary>
    [BsonElement("actualPercent")]
    public decimal ActualPercent { get; set; }
    
    /// <summary>
    /// Amount spent when alert triggered
    /// </summary>
    [BsonElement("amountSpent")]
    public decimal AmountSpent { get; set; }
    
    /// <summary>
    /// Budget limit amount
    /// </summary>
    [BsonElement("budgetAmount")]
    public decimal BudgetAmount { get; set; }
    
    /// <summary>
    /// Currency code
    /// </summary>
    [BsonElement("currency")]
    public string Currency { get; set; } = null!;
    
    /// <summary>
    /// Whether the notification has been read
    /// </summary>
    [BsonElement("isRead")]
    public bool IsRead { get; set; } = false;
    
    /// <summary>
    /// Period start date
    /// </summary>
    [BsonElement("periodStart")]
    public DateTime PeriodStart { get; set; }
    
    /// <summary>
    /// Period end date
    /// </summary>
    [BsonElement("periodEnd")]
    public DateTime PeriodEnd { get; set; }
    
    [BsonElement("createdAt")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}