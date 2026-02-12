using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace DigiTransac.Api.Models;

public enum LabelType
{
    Folder,
    Category
}

[BsonIgnoreExtraElements]
public class Label
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string Id { get; set; } = null!;

    [BsonElement("userId")]
    [BsonRepresentation(BsonType.ObjectId)]
    public string UserId { get; set; } = null!;

    [BsonElement("name")]
    public string Name { get; set; } = null!;

    [BsonElement("parentId")]
    [BsonRepresentation(BsonType.ObjectId)]
    public string? ParentId { get; set; }

    [BsonElement("type")]
    [BsonRepresentation(BsonType.String)]
    public LabelType Type { get; set; }

    [BsonElement("icon")]
    public string? Icon { get; set; }

    [BsonElement("color")]
    public string? Color { get; set; }

    [BsonElement("order")]
    public int Order { get; set; } = 0;

    [BsonElement("isSystem")]
    public bool IsSystem { get; set; } = false;

    [BsonElement("excludeFromAnalytics")]
    public bool ExcludeFromAnalytics { get; set; } = false;

    [BsonElement("createdAt")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
