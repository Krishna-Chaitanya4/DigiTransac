using DigiTransac.Api.Models;
using DigiTransac.Api.Services;
using MongoDB.Bson;
using MongoDB.Driver;

namespace DigiTransac.Api.Repositories;

public interface IChatMessageRepository
{
    Task<ChatMessage?> GetByIdAsync(string id);
    
    /// <summary>
    /// Get all messages between two users (both directions)
    /// </summary>
    Task<List<ChatMessage>> GetConversationMessagesAsync(string userId, string counterpartyUserId, int? limit = null, DateTime? before = null);
    
    /// <summary>
    /// Get the latest message for each conversation the user has
    /// </summary>
    Task<List<ChatMessage>> GetLatestMessagePerConversationAsync(string userId);
    
    /// <summary>
    /// Get unread message count for a specific conversation
    /// </summary>
    Task<int> GetUnreadCountAsync(string userId, string counterpartyUserId);
    
    /// <summary>
    /// Get total unread message count across all conversations
    /// </summary>
    Task<int> GetTotalUnreadCountAsync(string userId);
    
    Task<ChatMessage> CreateAsync(ChatMessage message);
    
    /// <summary>
    /// Mark all messages from counterparty as read
    /// </summary>
    Task MarkConversationAsReadAsync(string userId, string counterpartyUserId);
    
    /// <summary>
    /// Mark messages as delivered
    /// </summary>
    Task MarkAsDeliveredAsync(string userId, string counterpartyUserId);
    
    /// <summary>
    /// Edit a message's content
    /// </summary>
    Task<bool> EditMessageAsync(string messageId, string senderUserId, string newContent);
    
    /// <summary>
    /// Soft delete a message
    /// </summary>
    Task<bool> DeleteMessageAsync(string messageId, string senderUserId);
    
    /// <summary>
    /// Create transaction message entry for a P2P transaction
    /// </summary>
    Task CreateTransactionMessageAsync(string senderUserId, string recipientUserId, string transactionId);
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

    public async Task<ChatMessage?> GetByIdAsync(string id)
    {
        return await _chatMessages.Find(m => m.Id == id).FirstOrDefaultAsync();
    }

    public async Task<List<ChatMessage>> GetConversationMessagesAsync(
        string userId, 
        string counterpartyUserId, 
        int? limit = null, 
        DateTime? before = null)
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
            return await findFluent.Limit(limit.Value).ToListAsync();
        }

        return await findFluent.ToListAsync();
    }

    public async Task<List<ChatMessage>> GetLatestMessagePerConversationAsync(string userId)
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
        return await _chatMessages.Aggregate(pipelineDefinition).ToListAsync();
    }

    public async Task<int> GetUnreadCountAsync(string userId, string counterpartyUserId)
    {
        var filter = Builders<ChatMessage>.Filter.And(
            Builders<ChatMessage>.Filter.Eq(m => m.RecipientUserId, userId),
            Builders<ChatMessage>.Filter.Eq(m => m.SenderUserId, counterpartyUserId),
            Builders<ChatMessage>.Filter.Ne(m => m.Status, MessageStatus.Read),
            Builders<ChatMessage>.Filter.Eq(m => m.IsDeleted, false)
        );

        return (int)await _chatMessages.CountDocumentsAsync(filter);
    }

    public async Task<int> GetTotalUnreadCountAsync(string userId)
    {
        var filter = Builders<ChatMessage>.Filter.And(
            Builders<ChatMessage>.Filter.Eq(m => m.RecipientUserId, userId),
            Builders<ChatMessage>.Filter.Ne(m => m.Status, MessageStatus.Read),
            Builders<ChatMessage>.Filter.Eq(m => m.IsDeleted, false)
        );

        return (int)await _chatMessages.CountDocumentsAsync(filter);
    }

    public async Task<ChatMessage> CreateAsync(ChatMessage message)
    {
        message.CreatedAt = DateTime.UtcNow;
        message.Status = MessageStatus.Sent;
        await _chatMessages.InsertOneAsync(message);
        return message;
    }

    public async Task MarkConversationAsReadAsync(string userId, string counterpartyUserId)
    {
        var filter = Builders<ChatMessage>.Filter.And(
            Builders<ChatMessage>.Filter.Eq(m => m.RecipientUserId, userId),
            Builders<ChatMessage>.Filter.Eq(m => m.SenderUserId, counterpartyUserId),
            Builders<ChatMessage>.Filter.Ne(m => m.Status, MessageStatus.Read)
        );

        var update = Builders<ChatMessage>.Update
            .Set(m => m.Status, MessageStatus.Read)
            .Set(m => m.ReadAt, DateTime.UtcNow);
        await _chatMessages.UpdateManyAsync(filter, update);
    }

    public async Task MarkAsDeliveredAsync(string userId, string counterpartyUserId)
    {
        var filter = Builders<ChatMessage>.Filter.And(
            Builders<ChatMessage>.Filter.Eq(m => m.RecipientUserId, userId),
            Builders<ChatMessage>.Filter.Eq(m => m.SenderUserId, counterpartyUserId),
            Builders<ChatMessage>.Filter.Eq(m => m.Status, MessageStatus.Sent)
        );

        var update = Builders<ChatMessage>.Update
            .Set(m => m.Status, MessageStatus.Delivered)
            .Set(m => m.DeliveredAt, DateTime.UtcNow);
        await _chatMessages.UpdateManyAsync(filter, update);
    }

    public async Task<bool> EditMessageAsync(string messageId, string senderUserId, string newContent)
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
        
        var result = await _chatMessages.UpdateOneAsync(filter, update);
        return result.ModifiedCount > 0;
    }

    public async Task<bool> DeleteMessageAsync(string messageId, string senderUserId)
    {
        var filter = Builders<ChatMessage>.Filter.And(
            Builders<ChatMessage>.Filter.Eq(m => m.Id, messageId),
            Builders<ChatMessage>.Filter.Eq(m => m.SenderUserId, senderUserId),
            Builders<ChatMessage>.Filter.Eq(m => m.IsDeleted, false)
        );

        var update = Builders<ChatMessage>.Update
            .Set(m => m.IsDeleted, true)
            .Set(m => m.DeletedAt, DateTime.UtcNow);
        
        var result = await _chatMessages.UpdateOneAsync(filter, update);
        return result.ModifiedCount > 0;
    }

    public async Task CreateTransactionMessageAsync(
        string senderUserId, 
        string recipientUserId, 
        string transactionId)
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

        await _chatMessages.InsertOneAsync(message);
    }
}
