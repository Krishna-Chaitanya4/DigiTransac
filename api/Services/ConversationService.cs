using DigiTransac.Api.Models;
using DigiTransac.Api.Models.Dto;
using DigiTransac.Api.Repositories;

namespace DigiTransac.Api.Services;

public interface IConversationService
{
    /// <summary>
    /// Get all conversations for a user (people they've transacted with or messaged)
    /// </summary>
    Task<ConversationListResponse> GetConversationsAsync(string userId);
    
    /// <summary>
    /// Get messages/transactions in a conversation with a specific user
    /// </summary>
    Task<ConversationDetailResponse> GetConversationAsync(string userId, string counterpartyUserId, int limit = 50, DateTime? before = null);
    
    /// <summary>
    /// Send a text message to another user
    /// </summary>
    Task<(bool Success, string Message, ConversationMessage? ChatMessage)> SendMessageAsync(string userId, string counterpartyUserId, SendMessageRequest request);
    
    /// <summary>
    /// Edit a message
    /// </summary>
    Task<(bool Success, string Message)> EditMessageAsync(string userId, string messageId, EditMessageRequest request);
    
    /// <summary>
    /// Delete a message
    /// </summary>
    Task<(bool Success, string Message)> DeleteMessageAsync(string userId, string messageId);
    
    /// <summary>
    /// Send money to another user (creates P2P transaction + chat message)
    /// </summary>
    Task<(bool Success, string Message, ConversationMessage? ChatMessage)> SendMoneyAsync(string userId, string counterpartyUserId, SendMoneyRequest request);
    
    /// <summary>
    /// Mark all messages in a conversation as read
    /// </summary>
    Task MarkAsReadAsync(string userId, string counterpartyUserId);
    
    /// <summary>
    /// Get total unread message count
    /// </summary>
    Task<int> GetUnreadCountAsync(string userId);
    
    /// <summary>
    /// Search for a user by email to start a new conversation
    /// </summary>
    Task<UserSearchResponse> SearchUserByEmailAsync(string currentUserId, string email);
}

public class ConversationService : IConversationService
{
    private readonly IChatMessageRepository _chatMessageRepository;
    private readonly ITransactionRepository _transactionRepository;
    private readonly IAccountRepository _accountRepository;
    private readonly IUserRepository _userRepository;
    private readonly ITransactionService _transactionService;

    public ConversationService(
        IChatMessageRepository chatMessageRepository,
        ITransactionRepository transactionRepository,
        IAccountRepository accountRepository,
        IUserRepository userRepository,
        ITransactionService transactionService)
    {
        _chatMessageRepository = chatMessageRepository;
        _transactionRepository = transactionRepository;
        _accountRepository = accountRepository;
        _userRepository = userRepository;
        _transactionService = transactionService;
    }

    public async Task<ConversationListResponse> GetConversationsAsync(string userId)
    {
        // Get all P2P transactions for this user (those with CounterpartyUserId)
        var p2pTransactions = await _transactionRepository.GetP2PTransactionsAsync(userId);
        
        // Get latest messages per conversation
        var latestMessages = await _chatMessageRepository.GetLatestMessagePerConversationAsync(userId);
        
        // Build set of all counterparty user IDs
        var counterpartyIds = new HashSet<string>();
        foreach (var tx in p2pTransactions.Where(tx => !string.IsNullOrEmpty(tx.CounterpartyUserId)))
        {
            counterpartyIds.Add(tx.CounterpartyUserId!);
        }
        foreach (var msg in latestMessages)
        {
            var counterpartyId = msg.SenderUserId == userId ? msg.RecipientUserId : msg.SenderUserId;
            counterpartyIds.Add(counterpartyId);
        }
        
        // Fetch user details for all counterparties
        var userDetails = new Dictionary<string, User>();
        foreach (var cpId in counterpartyIds)
        {
            var user = await _userRepository.GetByIdAsync(cpId);
            if (user != null)
            {
                userDetails[cpId] = user;
            }
        }
        
        // Build conversation summaries
        var conversations = new List<ConversationSummary>();
        
        foreach (var counterpartyId in counterpartyIds)
        {
            var user = userDetails.GetValueOrDefault(counterpartyId);
            if (user == null) continue; // Skip if user not found
            
            // Get transactions with this counterparty
            var txsWithCounterparty = p2pTransactions
                .Where(t => t.CounterpartyUserId == counterpartyId)
                .ToList();
            
            // Calculate totals
            decimal totalSent = txsWithCounterparty
                .Where(t => t.Type == TransactionType.Send && !string.IsNullOrEmpty(t.AccountId))
                .Sum(t => t.Amount);
            decimal totalReceived = txsWithCounterparty
                .Where(t => t.Type == TransactionType.Receive && !string.IsNullOrEmpty(t.AccountId))
                .Sum(t => t.Amount);
            
            // Get latest activity (from messages or transactions)
            var latestMessage = latestMessages.FirstOrDefault(m => 
                (m.SenderUserId == userId && m.RecipientUserId == counterpartyId) ||
                (m.SenderUserId == counterpartyId && m.RecipientUserId == userId));
            
            var latestTx = txsWithCounterparty
                .OrderByDescending(t => t.Date)
                .FirstOrDefault();
            
            DateTime lastActivityAt;
            string? lastMessagePreview = null;
            string? lastMessageType = null;
            
            if (latestMessage != null && (latestTx == null || latestMessage.CreatedAt > latestTx.Date))
            {
                lastActivityAt = latestMessage.CreatedAt;
                lastMessageType = latestMessage.Type.ToString();
                lastMessagePreview = latestMessage.Type == ChatMessageType.Text 
                    ? TruncateString(latestMessage.Content, 50)
                    : GetTransactionPreview(latestTx, userId);
            }
            else if (latestTx != null)
            {
                lastActivityAt = latestTx.Date;
                lastMessageType = "Transaction";
                lastMessagePreview = GetTransactionPreview(latestTx, userId);
            }
            else
            {
                continue; // No activity, skip
            }
            
            // Get unread count
            var unreadCount = await _chatMessageRepository.GetUnreadCountAsync(userId, counterpartyId);
            
            // Determine primary currency
            var currencies = txsWithCounterparty
                .Where(t => !string.IsNullOrEmpty(t.Currency))
                .GroupBy(t => t.Currency)
                .OrderByDescending(g => g.Count())
                .FirstOrDefault();
            
            conversations.Add(new ConversationSummary(
                CounterpartyUserId: counterpartyId,
                CounterpartyEmail: user.Email,
                CounterpartyName: user.FullName,
                LastActivityAt: lastActivityAt,
                LastMessagePreview: lastMessagePreview,
                LastMessageType: lastMessageType,
                UnreadCount: unreadCount,
                TotalSent: totalSent,
                TotalReceived: totalReceived,
                PrimaryCurrency: currencies?.Key
            ));
        }
        
        // Sort by last activity
        conversations = conversations
            .OrderByDescending(c => c.LastActivityAt)
            .ToList();
        
        var totalUnread = await _chatMessageRepository.GetTotalUnreadCountAsync(userId);
        
        return new ConversationListResponse(conversations, totalUnread);
    }

    public async Task<ConversationDetailResponse> GetConversationAsync(
        string userId, 
        string counterpartyUserId, 
        int limit = 50, 
        DateTime? before = null)
    {
        // Get counterparty details
        var counterparty = await _userRepository.GetByIdAsync(counterpartyUserId);
        if (counterparty == null)
        {
            return new ConversationDetailResponse(
                counterpartyUserId, "", null, 
                new List<ConversationMessage>(), 0, false, 0, 0);
        }
        
        // Get chat messages
        var chatMessages = await _chatMessageRepository.GetConversationMessagesAsync(
            userId, counterpartyUserId, limit, before);
        
        // Get P2P transactions with this counterparty
        var p2pTransactions = await _transactionRepository.GetP2PTransactionsWithCounterpartyAsync(
            userId, counterpartyUserId);
        
        // Filter transactions by before date if specified
        if (before.HasValue)
        {
            p2pTransactions = p2pTransactions.Where(t => t.Date < before.Value).ToList();
        }
        
        // Get user's accounts for display names
        var accounts = (await _accountRepository.GetByUserIdAsync(userId, includeArchived: true))
            .ToDictionary(a => a.Id);
        
        // Build unified message list
        var messages = new List<ConversationMessage>();
        
        // Track which transactions are already represented by chat messages
        var transactionLinkIdsInChat = chatMessages
            .Where(m => m.TransactionLinkId.HasValue)
            .Select(m => m.TransactionLinkId!.Value)
            .ToHashSet();
        
        // Add chat messages
        foreach (var msg in chatMessages)
        {
            TransactionMessageData? txData = null;
            
            if (msg.Type == ChatMessageType.Transaction && msg.TransactionLinkId.HasValue)
            {
                // Find the transaction for this user
                var tx = p2pTransactions.FirstOrDefault(t => t.TransactionLinkId == msg.TransactionLinkId);
                if (tx != null)
                {
                    accounts.TryGetValue(tx.AccountId ?? "", out var account);
                    txData = new TransactionMessageData(
                        TransactionId: tx.Id,
                        TransactionLinkId: msg.TransactionLinkId.Value,
                        TransactionType: tx.Type.ToString(),
                        Amount: tx.Amount,
                        Currency: tx.Currency,
                        Date: tx.Date,
                        Title: tx.Title,
                        Notes: null, // Don't expose notes in preview
                        Status: tx.Status.ToString(),
                        AccountName: account?.Name
                    );
                }
            }
            
            messages.Add(new ConversationMessage(
                Id: msg.Id,
                Type: msg.Type.ToString(),
                SenderUserId: msg.SenderUserId,
                IsFromMe: msg.SenderUserId == userId,
                Content: msg.IsDeleted ? null : msg.Content,
                Transaction: txData,
                Status: msg.Status.ToString(),
                CreatedAt: msg.CreatedAt,
                DeliveredAt: msg.DeliveredAt,
                ReadAt: msg.ReadAt,
                IsEdited: msg.IsEdited,
                EditedAt: msg.EditedAt,
                IsDeleted: msg.IsDeleted,
                ReplyToMessageId: msg.ReplyToMessageId,
                ReplyTo: null // Will be populated below if needed
            ));
        }
        
        // Build reply previews for messages that have ReplyToMessageId
        var messagesWithReplies = messages.Where(m => !string.IsNullOrEmpty(m.ReplyToMessageId)).ToList();
        if (messagesWithReplies.Any())
        {
            var replyMessageIds = messagesWithReplies.Select(m => m.ReplyToMessageId!).Distinct().ToList();
            
            // Fetch the original messages being replied to
            var replyMessages = new Dictionary<string, ChatMessage>();
            foreach (var replyId in replyMessageIds)
            {
                var replyMsg = await _chatMessageRepository.GetByIdAsync(replyId);
                if (replyMsg != null)
                {
                    replyMessages[replyId] = replyMsg;
                }
            }
            
            // Create new list with reply previews populated
            var messagesWithReplyPreviews = new List<ConversationMessage>();
            foreach (var msg in messages)
            {
                if (!string.IsNullOrEmpty(msg.ReplyToMessageId) && replyMessages.TryGetValue(msg.ReplyToMessageId, out var replyMsg))
                {
                    var replySenderName = replyMsg.SenderUserId == userId ? "You" : counterparty.FullName ?? counterparty.Email;
                    var contentPreview = replyMsg.Type switch
                    {
                        ChatMessageType.Text => TruncateString(replyMsg.Content, 30),
                        ChatMessageType.Transaction => "💰 Transaction",
                        ChatMessageType.Request => "💸 Request",
                        _ => null
                    };
                    
                    var replyPreview = new ReplyPreview(
                        MessageId: replyMsg.Id,
                        SenderUserId: replyMsg.SenderUserId,
                        SenderName: replySenderName,
                        Type: replyMsg.Type.ToString(),
                        ContentPreview: replyMsg.IsDeleted ? "Deleted message" : contentPreview
                    );
                    
                    messagesWithReplyPreviews.Add(msg with { ReplyTo = replyPreview });
                }
                else
                {
                    messagesWithReplyPreviews.Add(msg);
                }
            }
            messages = messagesWithReplyPreviews;
        }
        
        // Add transactions that don't have chat messages yet (for backward compatibility)
        foreach (var tx in p2pTransactions)
        {
            if (tx.TransactionLinkId.HasValue && transactionLinkIdsInChat.Contains(tx.TransactionLinkId.Value))
            {
                continue; // Already have a chat message for this
            }
            
            accounts.TryGetValue(tx.AccountId ?? "", out var account);
            var txData = new TransactionMessageData(
                TransactionId: tx.Id,
                TransactionLinkId: tx.TransactionLinkId ?? Guid.Empty,
                TransactionType: tx.Type.ToString(),
                Amount: tx.Amount,
                Currency: tx.Currency,
                Date: tx.Date,
                Title: tx.Title,
                Notes: null,
                Status: tx.Status.ToString(),
                AccountName: account?.Name
            );
            
            // Determine sender based on transaction type
            var isFromMe = tx.Type == TransactionType.Send;
            
            messages.Add(new ConversationMessage(
                Id: $"tx-{tx.Id}",
                Type: "Transaction",
                SenderUserId: isFromMe ? userId : counterpartyUserId,
                IsFromMe: isFromMe,
                Content: null,
                Transaction: txData,
                Status: "Read", // Legacy transactions are considered read
                CreatedAt: tx.Date,
                DeliveredAt: tx.Date,
                ReadAt: tx.Date,
                IsEdited: false,
                EditedAt: null,
                IsDeleted: false,
                ReplyToMessageId: null,
                ReplyTo: null
            ));
        }
        
        // Sort by date ascending (oldest first, newest at bottom) and limit
        messages = messages
            .OrderBy(m => m.CreatedAt)
            .TakeLast(limit)
            .ToList();
        
        // Calculate totals
        decimal totalSent = p2pTransactions
            .Where(t => t.Type == TransactionType.Send && !string.IsNullOrEmpty(t.AccountId))
            .Sum(t => t.Amount);
        decimal totalReceived = p2pTransactions
            .Where(t => t.Type == TransactionType.Receive && !string.IsNullOrEmpty(t.AccountId))
            .Sum(t => t.Amount);
        
        var totalCount = messages.Count;
        var hasMore = chatMessages.Count == limit || p2pTransactions.Count > limit;
        
        return new ConversationDetailResponse(
            CounterpartyUserId: counterpartyUserId,
            CounterpartyEmail: counterparty.Email,
            CounterpartyName: counterparty.FullName,
            Messages: messages,
            TotalCount: totalCount,
            HasMore: hasMore,
            TotalSent: totalSent,
            TotalReceived: totalReceived
        );
    }

    public async Task<(bool Success, string Message, ConversationMessage? ChatMessage)> SendMessageAsync(
        string userId, 
        string counterpartyUserId, 
        SendMessageRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Content))
        {
            return (false, "Message content is required", null);
        }
        
        if (request.Content.Length > 1000)
        {
            return (false, "Message cannot exceed 1000 characters", null);
        }
        
        // Verify counterparty exists (for self-chat, user is their own counterparty)
        var counterparty = await _userRepository.GetByIdAsync(counterpartyUserId);
        if (counterparty == null)
        {
            return (false, "User not found", null);
        }
        
        var chatMessage = new ChatMessage
        {
            SenderUserId = userId,
            RecipientUserId = counterpartyUserId,
            Type = ChatMessageType.Text,
            Content = request.Content,
            ReplyToMessageId = request.ReplyToMessageId,
            Status = MessageStatus.Sent,
            CreatedAt = DateTime.UtcNow
        };
        
        await _chatMessageRepository.CreateAsync(chatMessage);
        
        // Build reply preview if this is a reply
        ReplyPreview? replyPreview = null;
        if (!string.IsNullOrEmpty(request.ReplyToMessageId))
        {
            var replyMsg = await _chatMessageRepository.GetByIdAsync(request.ReplyToMessageId);
            if (replyMsg != null)
            {
                var replySender = await _userRepository.GetByIdAsync(replyMsg.SenderUserId);
                var replySenderName = replyMsg.SenderUserId == userId ? "You" : replySender?.FullName ?? replySender?.Email;
                var contentPreview = replyMsg.Type switch
                {
                    ChatMessageType.Text => TruncateString(replyMsg.Content, 30),
                    ChatMessageType.Transaction => "💰 Transaction",
                    ChatMessageType.Request => "💸 Request",
                    _ => null
                };
                
                replyPreview = new ReplyPreview(
                    MessageId: replyMsg.Id,
                    SenderUserId: replyMsg.SenderUserId,
                    SenderName: replySenderName,
                    Type: replyMsg.Type.ToString(),
                    ContentPreview: replyMsg.IsDeleted ? "Deleted message" : contentPreview
                );
            }
        }
        
        var response = new ConversationMessage(
            Id: chatMessage.Id,
            Type: "Text",
            SenderUserId: userId,
            IsFromMe: true,
            Content: request.Content,
            Transaction: null,
            Status: "Sent",
            CreatedAt: chatMessage.CreatedAt,
            DeliveredAt: null,
            ReadAt: null,
            IsEdited: false,
            EditedAt: null,
            IsDeleted: false,
            ReplyToMessageId: request.ReplyToMessageId,
            ReplyTo: replyPreview
        );
        
        return (true, "Message sent", response);
    }

    public async Task<(bool Success, string Message, ConversationMessage? ChatMessage)> SendMoneyAsync(
        string userId, 
        string counterpartyUserId, 
        SendMoneyRequest request)
    {
        // Verify counterparty exists
        var counterparty = await _userRepository.GetByIdAsync(counterpartyUserId);
        if (counterparty == null)
        {
            return (false, "User not found", null);
        }
        
        // Prevent sending to yourself
        if (counterpartyUserId == userId)
        {
            return (false, "Cannot send money to yourself. Use Transfer to move between your accounts.", null);
        }
        
        // Create transaction through TransactionService
        var createRequest = new CreateTransactionRequest(
            AccountId: request.AccountId,
            Type: "Send",
            Amount: request.Amount,
            Date: DateTime.UtcNow,
            Title: request.Title,
            Payee: null,
            Notes: request.Notes,
            Splits: request.Splits,
            TagIds: null,
            Location: null,
            TransferToAccountId: null,
            RecurringRule: null,
            CounterpartyEmail: counterparty.Email, // Use email for the existing P2P flow
            CounterpartyAmount: null
        );
        
        var (success, message, transaction) = await _transactionService.CreateAsync(userId, createRequest);
        
        if (!success || transaction == null)
        {
            return (false, message, null);
        }
        
        // Create chat message for this transaction
        if (transaction.TransactionLinkId.HasValue)
        {
            await _chatMessageRepository.CreateTransactionMessagesAsync(
                userId,
                counterpartyUserId,
                transaction.Id,
                transaction.Id, // The recipient's transaction will be found via TransactionLinkId
                transaction.TransactionLinkId.Value
            );
        }
        
        // Get account for display
        var account = await _accountRepository.GetByIdAndUserIdAsync(request.AccountId, userId);
        
        var txData = new TransactionMessageData(
            TransactionId: transaction.Id,
            TransactionLinkId: transaction.TransactionLinkId ?? Guid.Empty,
            TransactionType: "Send",
            Amount: transaction.Amount,
            Currency: transaction.Currency,
            Date: transaction.Date,
            Title: transaction.Title,
            Notes: null,
            Status: transaction.Status.ToString(),
            AccountName: account?.Name
        );
        
        var response = new ConversationMessage(
            Id: $"tx-{transaction.Id}",
            Type: "Transaction",
            SenderUserId: userId,
            IsFromMe: true,
            Content: null,
            Transaction: txData,
            Status: "Sent",
            CreatedAt: transaction.Date,
            DeliveredAt: null,
            ReadAt: null,
            IsEdited: false,
            EditedAt: null,
            IsDeleted: false,
            ReplyToMessageId: null,
            ReplyTo: null
        );
        
        return (true, "Money sent", response);
    }

    public async Task MarkAsReadAsync(string userId, string counterpartyUserId)
    {
        await _chatMessageRepository.MarkConversationAsReadAsync(userId, counterpartyUserId);
    }

    public async Task<int> GetUnreadCountAsync(string userId)
    {
        return await _chatMessageRepository.GetTotalUnreadCountAsync(userId);
    }

    public async Task<(bool Success, string Message)> EditMessageAsync(
        string userId, 
        string messageId, 
        EditMessageRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Content))
        {
            return (false, "Message content is required");
        }
        
        if (request.Content.Length > 1000)
        {
            return (false, "Message cannot exceed 1000 characters");
        }
        
        // Check time limit - 15 minutes for editing
        var message = await _chatMessageRepository.GetByIdAsync(messageId);
        if (message == null || message.SenderUserId != userId)
        {
            return (false, "Message not found or you don't have permission to edit it");
        }
        
        var editWindowMinutes = 15;
        if (DateTime.UtcNow - message.CreatedAt > TimeSpan.FromMinutes(editWindowMinutes))
        {
            return (false, $"Messages can only be edited within {editWindowMinutes} minutes of sending");
        }
        
        var success = await _chatMessageRepository.EditMessageAsync(messageId, userId, request.Content);
        
        if (!success)
        {
            return (false, "Failed to update message");
        }
        
        return (true, "Message updated");
    }

    public async Task<(bool Success, string Message)> DeleteMessageAsync(string userId, string messageId)
    {
        // Check time limit - 1 hour for deleting
        var message = await _chatMessageRepository.GetByIdAsync(messageId);
        if (message == null || message.SenderUserId != userId)
        {
            return (false, "Message not found or you don't have permission to delete it");
        }
        
        var deleteWindowMinutes = 60; // 1 hour
        if (DateTime.UtcNow - message.CreatedAt > TimeSpan.FromMinutes(deleteWindowMinutes))
        {
            return (false, "Messages can only be deleted within 1 hour of sending");
        }
        
        var success = await _chatMessageRepository.DeleteMessageAsync(messageId, userId);
        
        if (!success)
        {
            return (false, "Failed to delete message");
        }
        
        return (true, "Message deleted");
    }

    public async Task<UserSearchResponse> SearchUserByEmailAsync(string currentUserId, string email)
    {
        if (string.IsNullOrWhiteSpace(email))
        {
            return new UserSearchResponse(null, false);
        }
        
        var user = await _userRepository.GetByEmailAsync(email.Trim().ToLowerInvariant());
        
        if (user == null)
        {
            return new UserSearchResponse(null, false);
        }
        
        // Don't return the current user
        if (user.Id == currentUserId)
        {
            return new UserSearchResponse(null, false);
        }
        
        return new UserSearchResponse(
            new UserSearchResult(user.Id, user.Email, user.FullName),
            true
        );
    }

    private static string? TruncateString(string? str, int maxLength)
    {
        if (string.IsNullOrEmpty(str)) return str;
        return str.Length <= maxLength ? str : str[..maxLength] + "...";
    }

    private static string GetTransactionPreview(Transaction? tx, string userId)
    {
        if (tx == null) return "";
        
        var direction = tx.Type == TransactionType.Send ? "Sent" : "Received";
        var symbol = tx.Currency switch
        {
            "INR" => "₹",
            "USD" => "$",
            "EUR" => "€",
            "GBP" => "£",
            _ => tx.Currency + " "
        };
        
        return $"{direction} {symbol}{tx.Amount:N2}";
    }
}
