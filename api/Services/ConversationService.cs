using System.Text.RegularExpressions;
using DigiTransac.Api.Common;
using DigiTransac.Api.Models;
using DigiTransac.Api.Models.Dto;
using DigiTransac.Api.Repositories;
using Microsoft.Extensions.Logging;
using CurrencyFormatter = DigiTransac.Api.Common.CurrencyFormatter;

namespace DigiTransac.Api.Services;

/// <summary>
/// Configuration constants for conversation service behavior
/// </summary>
public static class ConversationConstants
{
    /// <summary>Time window in minutes during which messages can be edited</summary>
    public const int EditWindowMinutes = 15;
    
    /// <summary>Time window in minutes during which messages can be deleted</summary>
    public const int DeleteWindowMinutes = 60;
    
    /// <summary>Time window in minutes during which deleted messages can be restored (undo)</summary>
    public const int UndoDeleteWindowMinutes = 1440; // 24 hours
    
    /// <summary>Maximum length for message content</summary>
    public const int MaxMessageLength = 1000;
    
    /// <summary>Truncation length for message preview in conversation list</summary>
    public const int PreviewTruncateLength = 50;
    
    /// <summary>Truncation length for reply preview content</summary>
    public const int ReplyPreviewTruncateLength = 30;
    
    /// <summary>Default page size for conversation messages</summary>
    public const int DefaultMessageLimit = 50;
    
    /// <summary>Display name for self-chat conversations</summary>
    public const string SelfChatDisplayName = "Personal";
}

/// <summary>
/// Utility for email validation
/// </summary>
public static class EmailValidator
{
    private static readonly Regex EmailRegex = new(
        @"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$",
        RegexOptions.Compiled | RegexOptions.IgnoreCase);
    
    /// <summary>
    /// Validate email format
    /// </summary>
    public static bool IsValidEmail(string? email)
    {
        if (string.IsNullOrWhiteSpace(email))
            return false;
        return EmailRegex.IsMatch(email);
    }
}

public interface IConversationService
{
    /// <summary>
    /// Get all conversations for a user (people they've transacted with or messaged)
    /// </summary>
    Task<ConversationListResponse> GetConversationsAsync(string userId, CancellationToken ct = default);
    
    /// <summary>
    /// Get messages/transactions in a conversation with a specific user
    /// </summary>
    Task<ConversationDetailResponse> GetConversationAsync(string userId, string counterpartyUserId, int limit = ConversationConstants.DefaultMessageLimit, DateTime? before = null, CancellationToken ct = default);
    
    /// <summary>
    /// Send a text message to another user
    /// </summary>
    Task<Result<ConversationMessage>> SendMessageAsync(string userId, string counterpartyUserId, SendMessageRequest request, CancellationToken ct = default);
    
    /// <summary>
    /// Edit a message
    /// </summary>
    Task<Result> EditMessageAsync(string userId, string messageId, EditMessageRequest request, CancellationToken ct = default);
    
    /// <summary>
    /// Delete a message
    /// </summary>
    Task<Result<ChatMessage>> DeleteMessageAsync(string userId, string messageId, CancellationToken ct = default);
    
    /// <summary>
    /// Restore a deleted message (undo delete within the undo window)
    /// </summary>
    Task<Result<ChatMessage>> RestoreMessageAsync(string userId, string messageId, CancellationToken ct = default);
    
    /// <summary>
    /// Send money to another user (creates P2P transaction + chat message)
    /// </summary>
    Task<Result<ConversationMessage>> SendMoneyAsync(string userId, string counterpartyUserId, SendMoneyRequest request, CancellationToken ct = default);
    
    /// <summary>
    /// Mark all messages in a conversation as read
    /// </summary>
    Task MarkAsReadAsync(string userId, string counterpartyUserId, CancellationToken ct = default);
    
    /// <summary>
    /// Get total unread message count
    /// </summary>
    Task<int> GetUnreadCountAsync(string userId, CancellationToken ct = default);
    
    /// <summary>
    /// Search for a user by email to start a new conversation
    /// </summary>
    Task<UserSearchResponse> SearchUserByEmailAsync(string currentUserId, string email, CancellationToken ct = default);

    /// <summary>
    /// Search for users by partial name or email
    /// </summary>
    Task<List<UserSearchResult>> SearchUsersAsync(string currentUserId, string query, CancellationToken ct = default);
}

public class ConversationService : IConversationService
{
    private readonly IChatMessageRepository _chatMessageRepository;
    private readonly ITransactionRepository _transactionRepository;
    private readonly IAccountRepository _accountRepository;
    private readonly IUserRepository _userRepository;
    private readonly ITransactionService _transactionService;
    private readonly IExchangeRateService _exchangeRateService;
    private readonly ILabelRepository _labelRepository;
    private readonly ILogger<ConversationService> _logger;

    public ConversationService(
        IChatMessageRepository chatMessageRepository,
        ITransactionRepository transactionRepository,
        IAccountRepository accountRepository,
        IUserRepository userRepository,
        ITransactionService transactionService,
        IExchangeRateService exchangeRateService,
        ILabelRepository labelRepository,
        ILogger<ConversationService> logger)
    {
        _chatMessageRepository = chatMessageRepository;
        _transactionRepository = transactionRepository;
        _accountRepository = accountRepository;
        _userRepository = userRepository;
        _transactionService = transactionService;
        _exchangeRateService = exchangeRateService;
        _labelRepository = labelRepository;
        _logger = logger;
    }

    /// <summary>
    /// Get primary category info from transaction splits (Transaction model)
    /// </summary>
    private static TransactionCategoryInfo? GetPrimaryCategoryInfo(Transaction tx, Dictionary<string, Label> labelsById)
    {
        if (tx.Splits.Count == 0) return null;
        
        var primarySplit = tx.Splits[0];
        if (string.IsNullOrEmpty(primarySplit.LabelId)) return null;
        
        if (!labelsById.TryGetValue(primarySplit.LabelId, out var label)) return null;
        
        return new TransactionCategoryInfo(
            LabelId: label.Id,
            Name: label.Name,
            Icon: label.Icon,
            Color: label.Color
        );
    }

    /// <summary>
    /// Get primary category info from transaction response splits (DTO)
    /// </summary>
    private static TransactionCategoryInfo? GetPrimaryCategoryInfo(TransactionResponse tx)
    {
        if (tx.Splits.Count == 0) return null;
        
        var primarySplit = tx.Splits[0];
        if (string.IsNullOrEmpty(primarySplit.LabelId) || string.IsNullOrEmpty(primarySplit.LabelName)) return null;
        
        return new TransactionCategoryInfo(
            LabelId: primarySplit.LabelId,
            Name: primarySplit.LabelName,
            Icon: primarySplit.LabelIcon,
            Color: primarySplit.LabelColor
        );
    }

    public async Task<ConversationListResponse> GetConversationsAsync(string userId, CancellationToken ct = default)
    {
        // Get all P2P transactions for this user (those with CounterpartyUserId)
        var p2pTransactions = await _transactionRepository.GetP2PTransactionsAsync(userId);
        
        // Get latest messages per conversation
        var latestMessages = await _chatMessageRepository.GetLatestMessagePerConversationAsync(userId, ct);
        
        // Get user's primary currency and exchange rates for conversion
        var currentUser = await _userRepository.GetByIdAsync(userId);
        var primaryCurrency = currentUser?.PrimaryCurrency ?? "USD";
        var ratesResponse = await _exchangeRateService.GetRatesAsync();
        var rates = ratesResponse.Rates;
        
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
        
        // Include self-chat (userId == counterpartyId) if there are self-chat messages
        var hasSelfChat = latestMessages.Any(m => m.SenderUserId == userId && m.RecipientUserId == userId);
        if (hasSelfChat)
        {
            counterpartyIds.Add(userId); // Add self to conversation list
        }
        
        // Fetch user details for all counterparties in a single batch query (fixes N+1)
        var userDetails = await _userRepository.GetByIdsAsync(counterpartyIds);
        
        // Batch fetch unread counts for all counterparties (fixes N+1)
        var unreadCounts = await _chatMessageRepository.GetUnreadCountsAsync(userId, counterpartyIds, ct);
        
        // Build conversation summaries
        var conversations = new List<ConversationSummary>();
        
        foreach (var counterpartyId in counterpartyIds)
        {
            var user = userDetails.GetValueOrDefault(counterpartyId);
            if (user == null) continue; // Skip if user not found
            
            var isSelfChat = counterpartyId == userId;
            
            // Get transactions with this counterparty (or self-transactions for self-chat)
            var txsWithCounterparty = isSelfChat
                ? new List<Transaction>() // Self-chat doesn't aggregate P2P transactions
                : p2pTransactions.Where(t => t.CounterpartyUserId == counterpartyId).ToList();
            
            // Calculate totals with currency conversion to user's primary currency
            decimal totalSent = txsWithCounterparty
                .Where(t => t.Type == TransactionType.Send && !string.IsNullOrEmpty(t.AccountId))
                .Sum(t => _exchangeRateService.Convert(t.Amount, t.Currency, primaryCurrency, rates));
            decimal totalReceived = txsWithCounterparty
                .Where(t => t.Type == TransactionType.Receive && !string.IsNullOrEmpty(t.AccountId))
                .Sum(t => _exchangeRateService.Convert(t.Amount, t.Currency, primaryCurrency, rates));
            
            // Get latest activity (from messages or transactions)
            ChatMessage? latestMessage;
            if (isSelfChat)
            {
                // Self-chat: both sender and recipient are the same user
                latestMessage = latestMessages.FirstOrDefault(m => 
                    m.SenderUserId == userId && m.RecipientUserId == userId);
            }
            else
            {
                latestMessage = latestMessages.FirstOrDefault(m => 
                    (m.SenderUserId == userId && m.RecipientUserId == counterpartyId) ||
                    (m.SenderUserId == counterpartyId && m.RecipientUserId == userId));
            }
            
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
                
                // Check if the message itself was deleted
                if (latestMessage.IsDeleted)
                {
                    lastMessagePreview = "This message was deleted";
                }
                else if (latestMessage.Type == ChatMessageType.Text)
                {
                    lastMessagePreview = TruncateString(latestMessage.Content, ConversationConstants.PreviewTruncateLength);
                }
                else if (latestMessage.Type == ChatMessageType.Transaction && !string.IsNullOrEmpty(latestMessage.TransactionId))
                {
                    // For transaction messages, fetch the actual transaction to generate preview
                    // Use GetByIdAsync (not GetByIdAndUserIdAsync) to include soft-deleted transactions
                    var msgTransaction = latestTx ?? await _transactionRepository.GetByIdAsync(latestMessage.TransactionId);
                    if (msgTransaction != null && msgTransaction.IsDeleted)
                    {
                        lastMessagePreview = "This transaction was deleted";
                    }
                    else
                    {
                        lastMessagePreview = GetTransactionPreview(msgTransaction, userId);
                    }
                }
                else
                {
                    lastMessagePreview = "💰 Transaction";
                }
            }
            else if (latestTx != null)
            {
                lastActivityAt = latestTx.Date;
                lastMessageType = "Transaction";
                if (latestTx.IsDeleted)
                {
                    lastMessagePreview = "This transaction was deleted";
                }
                else
                {
                    lastMessagePreview = GetTransactionPreview(latestTx, userId);
                }
            }
            else
            {
                continue; // No activity, skip
            }
            
            // Get unread count from batch-fetched dictionary
            var unreadCount = unreadCounts.GetValueOrDefault(counterpartyId, 0);
            
            // Determine primary currency
            var currencies = txsWithCounterparty
                .Where(t => !string.IsNullOrEmpty(t.Currency))
                .GroupBy(t => t.Currency)
                .OrderByDescending(g => g.Count())
                .FirstOrDefault();
            
            conversations.Add(new ConversationSummary(
                CounterpartyUserId: counterpartyId,
                CounterpartyEmail: user.Email,
                CounterpartyName: isSelfChat ? ConversationConstants.SelfChatDisplayName : user.FullName,
                LastActivityAt: lastActivityAt,
                LastMessagePreview: lastMessagePreview,
                LastMessageType: lastMessageType,
                UnreadCount: unreadCount,
                TotalSent: totalSent,
                TotalReceived: totalReceived,
                PrimaryCurrency: currencies?.Key,
                IsSelfChat: isSelfChat
            ));
        }
        
        // Sort by last activity
        conversations = conversations
            .OrderByDescending(c => c.LastActivityAt)
            .ToList();
        
        var totalUnread = await _chatMessageRepository.GetTotalUnreadCountAsync(userId, ct);
        
        return new ConversationListResponse(conversations, totalUnread);
    }

    public async Task<ConversationDetailResponse> GetConversationAsync(
        string userId,
        string counterpartyUserId,
        int limit = ConversationConstants.DefaultMessageLimit,
        DateTime? before = null,
        CancellationToken ct = default)
    {
        // Get counterparty details
        var counterparty = await _userRepository.GetByIdAsync(counterpartyUserId);
        if (counterparty == null)
        {
            return new ConversationDetailResponse(
                counterpartyUserId, "", null,
                new List<ConversationMessage>(), 0, false, 0, 0, false);
        }
        
        // Get user's primary currency and exchange rates for conversion
        var currentUser = await _userRepository.GetByIdAsync(userId);
        var primaryCurrency = currentUser?.PrimaryCurrency ?? "USD";
        var ratesResponse = await _exchangeRateService.GetRatesAsync();
        var rates = ratesResponse.Rates;
        
        var isSelfChat = userId == counterpartyUserId;
        
        // Get chat messages
        var chatMessages = await _chatMessageRepository.GetConversationMessagesAsync(
            userId, counterpartyUserId, limit, before, ct);
        
        // Get transactions for this conversation
        List<Transaction> transactionsForChat;
        if (isSelfChat)
        {
            // For self-chat, get transactions by their IDs from chat messages
            // This includes all transactions that have a chat message (not just P2P)
            var transactionIds = chatMessages
                .Where(m => m.Type == ChatMessageType.Transaction && !string.IsNullOrEmpty(m.TransactionId))
                .Select(m => m.TransactionId!)
                .Distinct()
                .ToList();
            transactionsForChat = await _transactionRepository.GetByIdsAsync(transactionIds, userId);
        }
        else
        {
            // For P2P chat, get transactions with this counterparty
            transactionsForChat = await _transactionRepository.GetP2PTransactionsWithCounterpartyAsync(
                userId, counterpartyUserId);
        }
        
        // Filter transactions by before date if specified
        if (before.HasValue)
        {
            transactionsForChat = transactionsForChat.Where(t => t.Date < before.Value).ToList();
        }
        
        // Get user's accounts for display names
        var accounts = (await _accountRepository.GetByUserIdAsync(userId, includeArchived: true, ct))
            .ToDictionary(a => a.Id);
        
        // Get user's labels for category display in transaction cards
        var labels = (await _labelRepository.GetByUserIdAsync(userId, ct))
            .ToDictionary(l => l.Id);
        
        // Build unified message list
        var messages = new List<ConversationMessage>();
        
        // Build a dictionary of transactions by ID for quick lookup
        var transactionsById = transactionsForChat.ToDictionary(t => t.Id);
        
        // Track which transactions are already represented by chat messages
        var transactionIdsInChat = chatMessages
            .Where(m => !string.IsNullOrEmpty(m.TransactionId))
            .Select(m => m.TransactionId!)
            .ToHashSet();
        
        // Add chat messages
        foreach (var msg in chatMessages)
        {
            TransactionMessageData? txData = null;
            Transaction? tx = null;
            
            if (msg.Type == ChatMessageType.Transaction && !string.IsNullOrEmpty(msg.TransactionId))
            {
                // Find the transaction by ID
                transactionsById.TryGetValue(msg.TransactionId, out tx);
                if (tx != null)
                {
                    accounts.TryGetValue(tx.AccountId ?? "", out var account);
                    txData = new TransactionMessageData(
                        TransactionId: tx.Id,
                        TransactionLinkId: tx.TransactionLinkId ?? Guid.Empty,
                        TransactionType: tx.Type.ToString(),
                        Amount: tx.Amount,
                        Currency: tx.Currency,
                        Date: tx.Date,
                        Title: tx.Title,
                        Notes: null, // Don't expose notes in preview
                        Status: tx.Status.ToString(),
                        AccountName: account?.Name,
                        PrimaryCategory: GetPrimaryCategoryInfo(tx, labels),
                        IsDeleted: tx.IsDeleted,
                        DeletedAt: tx.DeletedAt
                    );
                }
            }
            
            // Use ChatMessage's IsSystemGenerated and SystemSource fields (set by TransferService, etc.)
            // Only fall back to deriving from Transaction.Source for backwards compatibility
            bool isSystemGenerated;
            string? systemSource;
            
            if (msg.IsSystemGenerated || !string.IsNullOrEmpty(msg.SystemSource))
            {
                // Use the ChatMessage's own fields (set explicitly by TransferService)
                isSystemGenerated = msg.IsSystemGenerated;
                systemSource = msg.SystemSource;
            }
            else
            {
                // Fall back to deriving from Transaction.Source for older transactions
                isSystemGenerated = tx?.Source is TransactionSource.Recurring
                                               or TransactionSource.Import;
                systemSource = isSystemGenerated ? tx?.Source.ToString() : null;
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
                DeletedAt: msg.DeletedAt,
                ReplyToMessageId: msg.ReplyToMessageId,
                ReplyTo: null, // Will be populated below if needed
                IsSystemGenerated: isSystemGenerated,
                SystemSource: systemSource
            ));
        }
        
        // Build reply previews for messages that have ReplyToMessageId
        var messagesWithReplies = messages.Where(m => !string.IsNullOrEmpty(m.ReplyToMessageId)).ToList();
        if (messagesWithReplies.Any())
        {
            var replyMessageIds = messagesWithReplies.Select(m => m.ReplyToMessageId!).Distinct().ToList();
            
            // Fetch the original messages being replied to in a single batch query (fixes N+1)
            var replyMessages = await _chatMessageRepository.GetByIdsAsync(replyMessageIds, ct);
            
            // Create new list with reply previews populated
            var messagesWithReplyPreviews = new List<ConversationMessage>();
            foreach (var msg in messages)
            {
                if (!string.IsNullOrEmpty(msg.ReplyToMessageId) && replyMessages.TryGetValue(msg.ReplyToMessageId, out var replyMsg))
                {
                    var replySenderName = replyMsg.SenderUserId == userId ? "You" : counterparty.FullName ?? counterparty.Email;
                    var contentPreview = replyMsg.Type switch
                    {
                        ChatMessageType.Text => TruncateString(replyMsg.Content, ConversationConstants.ReplyPreviewTruncateLength),
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
        // Skip for self-chat since we only have transactions that are already in chat messages
        if (!isSelfChat)
        {
            foreach (var tx in transactionsForChat)
            {
                if (transactionIdsInChat.Contains(tx.Id))
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
                    AccountName: account?.Name,
                    PrimaryCategory: GetPrimaryCategoryInfo(tx, labels),
                    IsDeleted: tx.IsDeleted,
                    DeletedAt: tx.DeletedAt
                );
                
                // Determine sender based on transaction type
                var isFromMe = tx.Type == TransactionType.Send;
                
                // Derive IsSystemGenerated from Transaction.Source
                var isSystemGenerated = tx.Source is TransactionSource.Recurring 
                                                  or TransactionSource.Import 
                                                  or TransactionSource.Transfer;
                var systemSource = isSystemGenerated ? tx.Source.ToString() : null;
                
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
                    DeletedAt: null,
                    ReplyToMessageId: null,
                    ReplyTo: null,
                    IsSystemGenerated: isSystemGenerated,
                    SystemSource: systemSource
                ));
            }
        }
        
        // Sort by date ascending (oldest first, newest at bottom) and limit
        messages = messages
            .OrderBy(m => m.CreatedAt)
            .TakeLast(limit)
            .ToList();
        
        // Calculate totals with currency conversion to user's primary currency
        decimal totalSent = transactionsForChat
            .Where(t => t.Type == TransactionType.Send && !string.IsNullOrEmpty(t.AccountId))
            .Sum(t => _exchangeRateService.Convert(t.Amount, t.Currency, primaryCurrency, rates));
        decimal totalReceived = transactionsForChat
            .Where(t => t.Type == TransactionType.Receive && !string.IsNullOrEmpty(t.AccountId))
            .Sum(t => _exchangeRateService.Convert(t.Amount, t.Currency, primaryCurrency, rates));
        
        var totalCount = messages.Count;
        var hasMore = chatMessages.Count == limit || transactionsForChat.Count > limit;
        
        return new ConversationDetailResponse(
            CounterpartyUserId: counterpartyUserId,
            CounterpartyEmail: counterparty.Email,
            CounterpartyName: isSelfChat ? ConversationConstants.SelfChatDisplayName : counterparty.FullName,
            Messages: messages,
            TotalCount: totalCount,
            HasMore: hasMore,
            TotalSent: totalSent,
            TotalReceived: totalReceived,
            IsSelfChat: isSelfChat
        );
    }

    public async Task<Result<ConversationMessage>> SendMessageAsync(
        string userId,
        string counterpartyUserId,
        SendMessageRequest request,
        CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(request.Content))
            return Error.Validation("Message content is required");
        
        if (request.Content.Length > ConversationConstants.MaxMessageLength)
            return Error.Validation($"Message cannot exceed {ConversationConstants.MaxMessageLength} characters");
        
        // Verify counterparty exists (for self-chat, user is their own counterparty)
        var counterparty = await _userRepository.GetByIdAsync(counterpartyUserId);
        if (counterparty == null)
            return Error.NotFound("User");
        
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
        
        await _chatMessageRepository.CreateAsync(chatMessage, ct);
        
        // Build reply preview if this is a reply
        ReplyPreview? replyPreview = null;
        if (!string.IsNullOrEmpty(request.ReplyToMessageId))
        {
            var replyMsg = await _chatMessageRepository.GetByIdAsync(request.ReplyToMessageId, ct);
            if (replyMsg != null)
            {
                var replySender = await _userRepository.GetByIdAsync(replyMsg.SenderUserId);
                var replySenderName = replyMsg.SenderUserId == userId ? "You" : replySender?.FullName ?? replySender?.Email;
                var contentPreview = replyMsg.Type switch
                {
                    ChatMessageType.Text => TruncateString(replyMsg.Content, ConversationConstants.ReplyPreviewTruncateLength),
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
            DeletedAt: null,
            ReplyToMessageId: request.ReplyToMessageId,
            ReplyTo: replyPreview,
            IsSystemGenerated: false, // User-sent messages are not system-generated
            SystemSource: null
        );
        
        return response;
    }

    public async Task<Result<ConversationMessage>> SendMoneyAsync(
        string userId,
        string counterpartyUserId,
        SendMoneyRequest request,
        CancellationToken ct = default)
    {
        // Validate type
        if (request.Type != nameof(TransactionType.Send) && request.Type != nameof(TransactionType.Receive))
            return Error.Validation("Type must be Send or Receive");
        
        // Verify counterparty exists
        var counterparty = await _userRepository.GetByIdAsync(counterpartyUserId);
        if (counterparty == null)
            return Error.NotFound("User");
        
        // Prevent sending to yourself
        if (counterpartyUserId == userId)
            return DomainErrors.Transaction.SelfP2PNotAllowed;
        
        // Create transaction through TransactionService
        var createRequest = new CreateTransactionRequest(
            AccountId: request.AccountId,
            Type: request.Type,  // Use the requested type (Send or Receive)
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
            CounterpartyAmount: null,
            Source: nameof(TransactionSource.Chat)  // Mark as created via chat
        );
        
        var result = await _transactionService.CreateAsync(userId, createRequest);
        
        if (!result.IsSuccess)
            return result.Error;
        
        var transaction = result.Value;
        
        // Create chat message for this transaction
        if (transaction.TransactionLinkId.HasValue)
        {
            await _chatMessageRepository.CreateTransactionMessageAsync(
                userId,
                counterpartyUserId,
                transaction.Id
            );
        }
        
        // Get account for display
        var account = await _accountRepository.GetByIdAndUserIdAsync(request.AccountId, userId, ct);
        
        var txData = new TransactionMessageData(
            TransactionId: transaction.Id,
            TransactionLinkId: transaction.TransactionLinkId ?? Guid.Empty,
            TransactionType: request.Type,  // Use the actual type
            Amount: transaction.Amount,
            Currency: transaction.Currency,
            Date: transaction.Date,
            Title: transaction.Title,
            Notes: null,
            Status: transaction.Status,
            AccountName: account?.Name,
            PrimaryCategory: GetPrimaryCategoryInfo(transaction),
            IsDeleted: transaction.IsDeleted,
            DeletedAt: transaction.DeletedAt
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
            DeletedAt: null,
            ReplyToMessageId: null,
            ReplyTo: null,
            IsSystemGenerated: false, // User-initiated send money is not system-generated
            SystemSource: null
        );
        
        return response;
    }

    public async Task MarkAsReadAsync(string userId, string counterpartyUserId, CancellationToken ct = default)
    {
        await _chatMessageRepository.MarkConversationAsReadAsync(userId, counterpartyUserId, ct);
    }

    public async Task<int> GetUnreadCountAsync(string userId, CancellationToken ct = default)
    {
        return await _chatMessageRepository.GetTotalUnreadCountAsync(userId, ct);
    }

    public async Task<Result> EditMessageAsync(
        string userId,
        string messageId,
        EditMessageRequest request,
        CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(request.Content))
            return Error.Validation("Message content is required");
        
        if (request.Content.Length > ConversationConstants.MaxMessageLength)
            return Error.Validation($"Message cannot exceed {ConversationConstants.MaxMessageLength} characters");
        
        // Check time limit for editing
        var message = await _chatMessageRepository.GetByIdAsync(messageId, ct);
        if (message == null || message.SenderUserId != userId)
            return Error.NotFound("Message");
        
        if (DateTime.UtcNow - message.CreatedAt > TimeSpan.FromMinutes(ConversationConstants.EditWindowMinutes))
            return Error.Validation($"Messages can only be edited within {ConversationConstants.EditWindowMinutes} minutes of sending");
        
        var success = await _chatMessageRepository.EditMessageAsync(messageId, userId, request.Content, ct);
        if (!success)
            return Error.InternalError("Failed to update message");
        
        return Result.Success();
    }

    public async Task<Result<ChatMessage>> DeleteMessageAsync(string userId, string messageId, CancellationToken ct = default)
    {
        // Check time limit for deleting
        var message = await _chatMessageRepository.GetByIdAsync(messageId, ct);
        if (message == null || message.SenderUserId != userId)
            return Error.NotFound("Message");
        
        if (DateTime.UtcNow - message.CreatedAt > TimeSpan.FromMinutes(ConversationConstants.DeleteWindowMinutes))
            return Error.Validation($"Messages can only be deleted within {ConversationConstants.DeleteWindowMinutes} minutes of sending");
        
        var success = await _chatMessageRepository.DeleteMessageAsync(messageId, userId, ct);
        if (!success)
            return Error.InternalError("Failed to delete message");
        
        return Result<ChatMessage>.Success(message);
    }

    public async Task<Result<ChatMessage>> RestoreMessageAsync(string userId, string messageId, CancellationToken ct = default)
    {
        var message = await _chatMessageRepository.GetByIdAsync(messageId, ct);
        if (message == null || message.SenderUserId != userId)
            return Error.NotFound("Message");
        
        if (!message.IsDeleted)
            return Error.Validation("Message is not deleted");
        
        // Check undo window: must restore within 24 hours of deletion
        if (message.DeletedAt.HasValue &&
            DateTime.UtcNow - message.DeletedAt.Value > TimeSpan.FromMinutes(ConversationConstants.UndoDeleteWindowMinutes))
            return Error.Validation("Undo window has expired. Messages can only be restored within 24 hours of deletion.");
        
        // Check if content has been permanently purged
        if (message.Type == ChatMessageType.Text && message.Content == null)
            return Error.Validation("Message content has been permanently removed and cannot be restored.");
        
        var success = await _chatMessageRepository.RestoreMessageAsync(messageId, userId, ct);
        if (!success)
            return Error.InternalError("Failed to restore message");
        
        return Result<ChatMessage>.Success(message);
    }

    public async Task<UserSearchResponse> SearchUserByEmailAsync(string currentUserId, string email, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(email))
        {
            return new UserSearchResponse(null, false);
        }
        
        // Validate email format before database lookup (security hardening)
        var trimmedEmail = email.Trim().ToLowerInvariant();
        if (!EmailValidator.IsValidEmail(trimmedEmail))
        {
            return new UserSearchResponse(null, false);
        }
        
        var user = await _userRepository.GetByEmailAsync(trimmedEmail);
        
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
        
        return CurrencyFormatter.FormatTransactionPreview(tx.Type, tx.Amount, tx.Currency);
    }

    public async Task<List<UserSearchResult>> SearchUsersAsync(string currentUserId, string query, CancellationToken ct = default)
    {
        var users = await _userRepository.SearchAsync(query, currentUserId, 10, ct);
        return users.Select(u => new UserSearchResult(u.Id, u.Email, u.FullName)).ToList();
    }
}
