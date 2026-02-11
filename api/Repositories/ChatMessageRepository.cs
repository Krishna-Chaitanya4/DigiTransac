using DigiTransac.Api.Models;
using DigiTransac.Api.Services;
using MongoDB.Bson;
using MongoDB.Driver;

namespace DigiTransac.Api.Repositories;

public interface IChatMessageRepository
{
    Task<ChatMessage?> GetByIdAsync(string id, CancellationToken ct = default);
    
    /// <summary>
    /// Get multiple messages by their IDs
    /// </summary>
    Task<Dictionary<string, ChatMessage>> GetByIdsAsync(IEnumerable<string> ids, CancellationToken ct = default);
    
    /// <summary>
    /// Get all messages between two users (both directions)
    /// </summary>
    Task<List<ChatMessage>> GetConversationMessagesAsync(string userId, string counterpartyUserId, int? limit = null, DateTime? before = null, CancellationToken ct = default);
    
    /// <summary>
    /// Get the latest message for each conversation the user has
    /// </summary>
    Task<List<ChatMessage>> GetLatestMessagePerConversationAsync(string userId, CancellationToken ct = default);
    
    /// <summary>
    /// Get unread message count for a specific conversation
    /// </summary>
    Task<int> GetUnreadCountAsync(string userId, string counterpartyUserId, CancellationToken ct = default);
    
    /// <summary>
    /// Get unread message counts for multiple counterparties in a single query (batch)
    /// </summary>
    Task<Dictionary<string, int>> GetUnreadCountsAsync(string userId, IEnumerable<string> counterpartyIds, CancellationToken ct = default);
    
    /// <summary>
    /// Get total unread message count across all conversations
    /// </summary>
    Task<int> GetTotalUnreadCountAsync(string userId, CancellationToken ct = default);
    
    Task<ChatMessage> CreateAsync(ChatMessage message, CancellationToken ct = default);
    
    /// <summary>
    /// Mark all messages from counterparty as read
    /// </summary>
    Task MarkConversationAsReadAsync(string userId, string counterpartyUserId, CancellationToken ct = default);
    
    /// <summary>
    /// Mark messages as delivered
    /// </summary>
    Task MarkAsDeliveredAsync(string userId, string counterpartyUserId, CancellationToken ct = default);
    
    /// <summary>
    /// Edit a message's content
    /// </summary>
    Task<bool> EditMessageAsync(string messageId, string senderUserId, string newContent, CancellationToken ct = default);
    
    /// <summary>
    /// Soft delete a message
    /// </summary>
    Task<bool> DeleteMessageAsync(string messageId, string senderUserId, CancellationToken ct = default);
    
    /// <summary>
    /// Create transaction message entry for a P2P transaction
    /// </summary>
    Task CreateTransactionMessageAsync(string senderUserId, string recipientUserId, string transactionId, CancellationToken ct = default);

    /// <summary>
    /// Create a system-generated activity message (e.g., "Transaction confirmed")
    /// </summary>
    Task<ChatMessage> CreateSystemMessageAsync(string userId, string counterpartyUserId, string content, string systemSource, string? transactionId = null, CancellationToken ct = default);

    /// <summary>
    /// Delete all messages where the user is sender or recipient (for account deletion)
    /// </summary>
    Task<bool> DeleteAllByUserIdAsync(string userId, CancellationToken ct = default);
}

public class ChatMessageRepository : IChatMessageRepository
{
    private readonly IMongoCollection<ChatMessage> _chatMessages;

    public ChatMessageRepository(IMongoDbService mongoDbService)
    {
        _chatMessages = mongoDbService.GetCollection<ChatMessage>("chatMessages");
        
        // Create indexes for efficient queries
        var indexKeysBuilder = Builders<ChatMessage>.IndexKeys;
        
        // Index for getting messages in a conversation
        _chatMessages.Indexes.CreateOne(new CreateIndexModel<ChatMessage>(
            indexKeysBuilder.Combine(
                indexKeysBuilder.Ascending(m => m.SenderUserId),
                indexKeysBuilder.Ascending(m => m.RecipientUserId),
                indexKeysBuilder.Descending(m => m.CreatedAt)
            )
        ));
        
        // Index for unread count (using Status)
        _chatMessages.Indexes.CreateOne(new CreateIndexModel<ChatMessage>(
            indexKeysBuilder.Combine(
                indexKeysBuilder.Ascending(m => m.RecipientUserId),
                indexKeysBuilder.Ascending(m => m.Status)
            )
        ));
    }

    public async Task<ChatMessage?> GetByIdAsync(string id, CancellationToken ct = default)
    {
        return await _chatMessages.Find(m => m.Id == id).FirstOrDefaultAsync(ct);
    }

    public async Task<Dictionary<string, ChatMessage>> GetByIdsAsync(IEnumerable<string> ids, CancellationToken ct = default)
    {
        var idList = ids.Where(id => !string.IsNullOrEmpty(id)).Distinct().ToList();
        if (idList.Count == 0)
            return new Dictionary<string, ChatMessage>();

        var filter = Builders<ChatMessage>.Filter.In(m => m.Id, idList);
        var messages = await _chatMessages.Find(filter).ToListAsync(ct);
        return messages.ToDictionary(m => m.Id);
    }

    public async Task<List<ChatMessage>> GetConversationMessagesAsync(
        string userId, 
        string counterpartyUserId, 
        int? limit = null, 
        DateTime? before = null,
        CancellationToken ct = default)
    {
        // Get messages where user is either sender or recipient with this counterparty
        var filter = Builders<ChatMessage>.Filter.Or(
            Builders<ChatMessage>.Filter.And(
                Builders<ChatMessage>.Filter.Eq(m => m.SenderUserId, userId),
                Builders<ChatMessage>.Filter.Eq(m => m.RecipientUserId, counterpartyUserId)
            ),
            Builders<ChatMessage>.Filter.And(
                Builders<ChatMessage>.Filter.Eq(m => m.SenderUserId, counterpartyUserId),
                Builders<ChatMessage>.Filter.Eq(m => m.RecipientUserId, userId)
            )
        );

        if (before.HasValue)
        {
            filter = Builders<ChatMessage>.Filter.And(
                filter,
                Builders<ChatMessage>.Filter.Lt(m => m.CreatedAt, before.Value)
            );
        }

        var findFluent = _chatMessages.Find(filter)
            .SortByDescending(m => m.CreatedAt);

        if (limit.HasValue)
        {
            return await findFluent.Limit(limit.Value).ToListAsync(ct);
        }

        return await findFluent.ToListAsync(ct);
    }

    public async Task<List<ChatMessage>> GetLatestMessagePerConversationAsync(string userId, CancellationToken ct = default)
    {
        // Aggregate to get the latest message per conversation partner
        var userObjectId = new ObjectId(userId);
        
        var pipeline = new BsonDocument[]
        {
            // Match messages where user is involved
            new BsonDocument("$match", new BsonDocument("$or", new BsonArray
            {
                new BsonDocument("senderUserId", userObjectId),
                new BsonDocument("recipientUserId", userObjectId)
            })),
            
            // Add a field for the "other" user in the conversation
            new BsonDocument("$addFields", new BsonDocument("counterpartyId",
                new BsonDocument("$cond", new BsonDocument
                {
                    { "if", new BsonDocument("$eq", new BsonArray { "$senderUserId", userObjectId }) },
                    { "then", "$recipientUserId" },
                    { "else", "$senderUserId" }
                })
            )),
            
            // Sort by date descending
            new BsonDocument("$sort", new BsonDocument("createdAt", -1)),
            
            // Group by counterparty and take the first (latest) message
            new BsonDocument("$group", new BsonDocument
            {
                { "_id", "$counterpartyId" },
                { "message", new BsonDocument("$first", "$$ROOT") }
            }),
            
            // Replace root with the message document
            new BsonDocument("$replaceRoot", new BsonDocument("newRoot", "$message")),
            
            // Remove the temporary counterpartyId field
            new BsonDocument("$unset", "counterpartyId"),
            
            // Sort by date descending for final output
            new BsonDocument("$sort", new BsonDocument("createdAt", -1))
        };

        var pipelineDefinition = PipelineDefinition<ChatMessage, ChatMessage>.Create(pipeline);
        return await _chatMessages.Aggregate(pipelineDefinition).ToListAsync(ct);
    }

    public async Task<int> GetUnreadCountAsync(string userId, string counterpartyUserId, CancellationToken ct = default)
    {
        var filter = Builders<ChatMessage>.Filter.And(
            Builders<ChatMessage>.Filter.Eq(m => m.RecipientUserId, userId),
            Builders<ChatMessage>.Filter.Eq(m => m.SenderUserId, counterpartyUserId),
            Builders<ChatMessage>.Filter.Ne(m => m.Status, MessageStatus.Read),
            Builders<ChatMessage>.Filter.Eq(m => m.IsDeleted, false)
        );

        return (int)await _chatMessages.CountDocumentsAsync(filter, options: null, ct);
    }

    public async Task<Dictionary<string, int>> GetUnreadCountsAsync(string userId, IEnumerable<string> counterpartyIds, CancellationToken ct = default)
    {
        var counterpartyIdList = counterpartyIds.ToList();
        if (counterpartyIdList.Count == 0)
            return new Dictionary<string, int>();

        var filter = Builders<ChatMessage>.Filter.And(
            Builders<ChatMessage>.Filter.Eq(m => m.RecipientUserId, userId),
            Builders<ChatMessage>.Filter.In(m => m.SenderUserId, counterpartyIdList),
            Builders<ChatMessage>.Filter.Ne(m => m.Status, MessageStatus.Read),
            Builders<ChatMessage>.Filter.Eq(m => m.IsDeleted, false)
        );

        var pipeline = _chatMessages.Aggregate()
            .Match(filter)
            .Group(m => m.SenderUserId, g => new { CounterpartyId = g.Key, Count = g.Count() });

        var results = await pipeline.ToListAsync(ct);
        return results.ToDictionary(r => r.CounterpartyId, r => r.Count);
    }

    public async Task<int> GetTotalUnreadCountAsync(string userId, CancellationToken ct = default)
    {
        var filter = Builders<ChatMessage>.Filter.And(
            Builders<ChatMessage>.Filter.Eq(m => m.RecipientUserId, userId),
            Builders<ChatMessage>.Filter.Ne(m => m.Status, MessageStatus.Read),
            Builders<ChatMessage>.Filter.Eq(m => m.IsDeleted, false)
        );

        return (int)await _chatMessages.CountDocumentsAsync(filter, options: null, ct);
    }

    public async Task<ChatMessage> CreateAsync(ChatMessage message, CancellationToken ct = default)
    {
        message.CreatedAt = DateTime.UtcNow;
        message.Status = MessageStatus.Sent;
        await _chatMessages.InsertOneAsync(message, options: null, ct);
        return message;
    }

    public async Task MarkConversationAsReadAsync(string userId, string counterpartyUserId, CancellationToken ct = default)
    {
        var filter = Builders<ChatMessage>.Filter.And(
            Builders<ChatMessage>.Filter.Eq(m => m.RecipientUserId, userId),
            Builders<ChatMessage>.Filter.Eq(m => m.SenderUserId, counterpartyUserId),
            Builders<ChatMessage>.Filter.Ne(m => m.Status, MessageStatus.Read)
        );

        var update = Builders<ChatMessage>.Update
            .Set(m => m.Status, MessageStatus.Read)
            .Set(m => m.ReadAt, DateTime.UtcNow);
        await _chatMessages.UpdateManyAsync(filter, update, options: null, ct);
    }

    public async Task MarkAsDeliveredAsync(string userId, string counterpartyUserId, CancellationToken ct = default)
    {
        var filter = Builders<ChatMessage>.Filter.And(
            Builders<ChatMessage>.Filter.Eq(m => m.RecipientUserId, userId),
            Builders<ChatMessage>.Filter.Eq(m => m.SenderUserId, counterpartyUserId),
            Builders<ChatMessage>.Filter.Eq(m => m.Status, MessageStatus.Sent)
        );

        var update = Builders<ChatMessage>.Update
            .Set(m => m.Status, MessageStatus.Delivered)
            .Set(m => m.DeliveredAt, DateTime.UtcNow);
        await _chatMessages.UpdateManyAsync(filter, update, options: null, ct);
    }

    public async Task<bool> EditMessageAsync(string messageId, string senderUserId, string newContent, CancellationToken ct = default)
    {
        var filter = Builders<ChatMessage>.Filter.And(
            Builders<ChatMessage>.Filter.Eq(m => m.Id, messageId),
            Builders<ChatMessage>.Filter.Eq(m => m.SenderUserId, senderUserId),
            Builders<ChatMessage>.Filter.Eq(m => m.Type, ChatMessageType.Text),
            Builders<ChatMessage>.Filter.Eq(m => m.IsDeleted, false)
        );

        var update = Builders<ChatMessage>.Update
            .Set(m => m.Content, newContent)
            .Set(m => m.IsEdited, true)
            .Set(m => m.EditedAt, DateTime.UtcNow);
        
        var result = await _chatMessages.UpdateOneAsync(filter, update, options: null, ct);
        return result.ModifiedCount > 0;
    }

    public async Task<bool> DeleteMessageAsync(string messageId, string senderUserId, CancellationToken ct = default)
    {
        var filter = Builders<ChatMessage>.Filter.And(
            Builders<ChatMessage>.Filter.Eq(m => m.Id, messageId),
            Builders<ChatMessage>.Filter.Eq(m => m.SenderUserId, senderUserId),
            Builders<ChatMessage>.Filter.Eq(m => m.IsDeleted, false)
        );

        var update = Builders<ChatMessage>.Update
            .Set(m => m.IsDeleted, true)
            .Set(m => m.DeletedAt, DateTime.UtcNow);
        
        var result = await _chatMessages.UpdateOneAsync(filter, update, options: null, ct);
        return result.ModifiedCount > 0;
    }

    public async Task CreateTransactionMessageAsync(
        string senderUserId,
        string recipientUserId,
        string transactionId,
        CancellationToken ct = default)
    {
        // Create a single message that represents the transaction in the chat
        // The sender "sends" a transaction message to the recipient
        var message = new ChatMessage
        {
            SenderUserId = senderUserId,
            RecipientUserId = recipientUserId,
            Type = ChatMessageType.Transaction,
            TransactionId = transactionId, // Reference to the transaction (contains TransactionLinkId)
            Status = MessageStatus.Sent,
            CreatedAt = DateTime.UtcNow
        };

        await _chatMessages.InsertOneAsync(message, options: null, ct);
    }

    public async Task<ChatMessage> CreateSystemMessageAsync(
        string userId,
        string counterpartyUserId,
        string content,
        string systemSource,
        string? transactionId = null,
        CancellationToken ct = default)
    {
        // System messages are created on behalf of the "system" but attributed to userId
        // For self-chat, sender and recipient are the same
        var message = new ChatMessage
        {
            SenderUserId = userId,
            RecipientUserId = counterpartyUserId,
            Type = transactionId != null ? ChatMessageType.Transaction : ChatMessageType.Text,
            Content = content,
            TransactionId = transactionId,
            Status = MessageStatus.Read, // System messages are immediately "read"
            IsSystemGenerated = true,
            SystemSource = systemSource,
            CreatedAt = DateTime.UtcNow,
            ReadAt = DateTime.UtcNow
        };

        await _chatMessages.InsertOneAsync(message, options: null, ct);
        return message;
    }

    public async Task<bool> DeleteAllByUserIdAsync(string userId, CancellationToken ct = default)
    {
        // Delete all messages where user is either sender or recipient
        var filter = Builders<ChatMessage>.Filter.Or(
            Builders<ChatMessage>.Filter.Eq(m => m.SenderUserId, userId),
            Builders<ChatMessage>.Filter.Eq(m => m.RecipientUserId, userId)
        );
        
        var result = await _chatMessages.DeleteManyAsync(filter, ct);
        return result.DeletedCount > 0;
    }
}
