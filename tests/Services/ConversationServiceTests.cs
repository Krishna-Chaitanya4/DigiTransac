using DigiTransac.Api.Models;
using DigiTransac.Api.Models.Dto;
using DigiTransac.Api.Repositories;
using DigiTransac.Api.Services;
using FluentAssertions;
using Moq;

namespace DigiTransac.Tests.Services;

public class ConversationServiceTests
{
    private readonly Mock<IChatMessageRepository> _chatMessageRepositoryMock;
    private readonly Mock<ITransactionRepository> _transactionRepositoryMock;
    private readonly Mock<IAccountRepository> _accountRepositoryMock;
    private readonly Mock<IUserRepository> _userRepositoryMock;
    private readonly Mock<ITransactionService> _transactionServiceMock;
    private readonly ConversationService _conversationService;
    
    private const string TestUserId = "test-user-id";
    private const string CounterpartyUserId = "counterparty-user-id";

    public ConversationServiceTests()
    {
        _chatMessageRepositoryMock = new Mock<IChatMessageRepository>();
        _transactionRepositoryMock = new Mock<ITransactionRepository>();
        _accountRepositoryMock = new Mock<IAccountRepository>();
        _userRepositoryMock = new Mock<IUserRepository>();
        _transactionServiceMock = new Mock<ITransactionService>();

        SetupDefaultMocks();

        _conversationService = new ConversationService(
            _chatMessageRepositoryMock.Object,
            _transactionRepositoryMock.Object,
            _accountRepositoryMock.Object,
            _userRepositoryMock.Object,
            _transactionServiceMock.Object);
    }

    private void SetupDefaultMocks()
    {
        // Default user
        _userRepositoryMock.Setup(x => x.GetByIdAsync(TestUserId))
            .ReturnsAsync(new User { Id = TestUserId, Email = "test@example.com", FullName = "Test User" });

        // Default counterparty
        _userRepositoryMock.Setup(x => x.GetByIdAsync(CounterpartyUserId))
            .ReturnsAsync(new User { Id = CounterpartyUserId, Email = "counter@example.com", FullName = "Counter Party" });

        // Default empty results
        _transactionRepositoryMock.Setup(x => x.GetP2PTransactionsAsync(It.IsAny<string>()))
            .ReturnsAsync(new List<Transaction>());
        _chatMessageRepositoryMock.Setup(x => x.GetLatestMessagePerConversationAsync(It.IsAny<string>()))
            .ReturnsAsync(new List<ChatMessage>());
        _chatMessageRepositoryMock.Setup(x => x.GetUnreadCountAsync(It.IsAny<string>(), It.IsAny<string>()))
            .ReturnsAsync(0);
        _chatMessageRepositoryMock.Setup(x => x.GetTotalUnreadCountAsync(It.IsAny<string>()))
            .ReturnsAsync(0);
        _accountRepositoryMock.Setup(x => x.GetByUserIdAsync(It.IsAny<string>(), It.IsAny<bool>()))
            .ReturnsAsync(new List<Account>());
    }

    #region GetConversationsAsync Tests

    [Fact]
    public async Task GetConversationsAsync_ReturnsEmptyList_WhenNoConversations()
    {
        // Act
        var result = await _conversationService.GetConversationsAsync(TestUserId);

        // Assert
        result.Conversations.Should().BeEmpty();
        result.TotalUnreadCount.Should().Be(0);
    }

    [Fact]
    public async Task GetConversationsAsync_ReturnsConversations_FromP2PTransactions()
    {
        // Arrange
        var transactions = new List<Transaction>
        {
            new()
            {
                Id = "tx-1",
                UserId = TestUserId,
                CounterpartyUserId = CounterpartyUserId,
                Type = TransactionType.Send,
                Amount = 100,
                Currency = "USD",
                Date = DateTime.UtcNow
            }
        };
        _transactionRepositoryMock.Setup(x => x.GetP2PTransactionsAsync(TestUserId))
            .ReturnsAsync(transactions);

        // Act
        var result = await _conversationService.GetConversationsAsync(TestUserId);

        // Assert
        result.Conversations.Should().HaveCount(1);
        result.Conversations[0].CounterpartyUserId.Should().Be(CounterpartyUserId);
    }

    [Fact]
    public async Task GetConversationsAsync_ReturnsConversations_FromChatMessages()
    {
        // Arrange
        var messages = new List<ChatMessage>
        {
            new()
            {
                Id = "msg-1",
                SenderUserId = TestUserId,
                RecipientUserId = CounterpartyUserId,
                Type = ChatMessageType.Text,
                Content = "Hello",
                CreatedAt = DateTime.UtcNow
            }
        };
        _chatMessageRepositoryMock.Setup(x => x.GetLatestMessagePerConversationAsync(TestUserId))
            .ReturnsAsync(messages);

        // Act
        var result = await _conversationService.GetConversationsAsync(TestUserId);

        // Assert
        result.Conversations.Should().HaveCount(1);
        result.Conversations[0].CounterpartyUserId.Should().Be(CounterpartyUserId);
    }

    [Fact]
    public async Task GetConversationsAsync_IncludesSelfChat_WhenSelfMessagesExist()
    {
        // Arrange - Self-chat message (sender and recipient are same)
        var messages = new List<ChatMessage>
        {
            new()
            {
                Id = "msg-1",
                SenderUserId = TestUserId,
                RecipientUserId = TestUserId, // Self-chat
                Type = ChatMessageType.Text,
                Content = "Personal note",
                CreatedAt = DateTime.UtcNow
            }
        };
        _chatMessageRepositoryMock.Setup(x => x.GetLatestMessagePerConversationAsync(TestUserId))
            .ReturnsAsync(messages);

        // Act
        var result = await _conversationService.GetConversationsAsync(TestUserId);

        // Assert
        result.Conversations.Should().HaveCount(1);
        result.Conversations[0].IsSelfChat.Should().BeTrue();
        result.Conversations[0].CounterpartyName.Should().Be("Personal Transactions");
    }

    [Fact]
    public async Task GetConversationsAsync_CalculatesTotals_Correctly()
    {
        // Arrange
        var transactions = new List<Transaction>
        {
            new() { Id = "tx-1", UserId = TestUserId, CounterpartyUserId = CounterpartyUserId, Type = TransactionType.Send, Amount = 100, AccountId = "acc-1", Date = DateTime.UtcNow },
            new() { Id = "tx-2", UserId = TestUserId, CounterpartyUserId = CounterpartyUserId, Type = TransactionType.Send, Amount = 50, AccountId = "acc-1", Date = DateTime.UtcNow },
            new() { Id = "tx-3", UserId = TestUserId, CounterpartyUserId = CounterpartyUserId, Type = TransactionType.Receive, Amount = 75, AccountId = "acc-1", Date = DateTime.UtcNow }
        };
        _transactionRepositoryMock.Setup(x => x.GetP2PTransactionsAsync(TestUserId))
            .ReturnsAsync(transactions);

        // Act
        var result = await _conversationService.GetConversationsAsync(TestUserId);

        // Assert
        result.Conversations.Should().HaveCount(1);
        result.Conversations[0].TotalSent.Should().Be(150); // 100 + 50
        result.Conversations[0].TotalReceived.Should().Be(75);
    }

    [Fact]
    public async Task GetConversationsAsync_SortsConversations_ByLastActivity()
    {
        // Arrange
        var user2 = new User { Id = "user-2", Email = "user2@example.com", FullName = "User Two" };
        _userRepositoryMock.Setup(x => x.GetByIdAsync("user-2")).ReturnsAsync(user2);

        var transactions = new List<Transaction>
        {
            new() { Id = "tx-1", UserId = TestUserId, CounterpartyUserId = CounterpartyUserId, Type = TransactionType.Send, Amount = 100, Date = DateTime.UtcNow.AddDays(-2) },
            new() { Id = "tx-2", UserId = TestUserId, CounterpartyUserId = "user-2", Type = TransactionType.Send, Amount = 50, Date = DateTime.UtcNow }
        };
        _transactionRepositoryMock.Setup(x => x.GetP2PTransactionsAsync(TestUserId))
            .ReturnsAsync(transactions);

        // Act
        var result = await _conversationService.GetConversationsAsync(TestUserId);

        // Assert
        result.Conversations.Should().HaveCount(2);
        result.Conversations[0].CounterpartyUserId.Should().Be("user-2"); // More recent
        result.Conversations[1].CounterpartyUserId.Should().Be(CounterpartyUserId); // Older
    }

    #endregion

    #region GetConversationAsync Tests

    [Fact]
    public async Task GetConversationAsync_ReturnsEmptyConversation_WhenCounterpartyNotFound()
    {
        // Arrange
        _userRepositoryMock.Setup(x => x.GetByIdAsync("unknown-user"))
            .ReturnsAsync((User?)null);

        // Act
        var result = await _conversationService.GetConversationAsync(TestUserId, "unknown-user");

        // Assert
        result.Messages.Should().BeEmpty();
        result.CounterpartyEmail.Should().BeEmpty();
    }

    [Fact]
    public async Task GetConversationAsync_ReturnsChatMessages()
    {
        // Arrange
        var chatMessages = new List<ChatMessage>
        {
            new() { Id = "msg-1", SenderUserId = TestUserId, RecipientUserId = CounterpartyUserId, Type = ChatMessageType.Text, Content = "Hello", CreatedAt = DateTime.UtcNow }
        };
        _chatMessageRepositoryMock.Setup(x => x.GetConversationMessagesAsync(TestUserId, CounterpartyUserId, It.IsAny<int>(), It.IsAny<DateTime?>()))
            .ReturnsAsync(chatMessages);
        _transactionRepositoryMock.Setup(x => x.GetP2PTransactionsWithCounterpartyAsync(TestUserId, CounterpartyUserId))
            .ReturnsAsync(new List<Transaction>());

        // Act
        var result = await _conversationService.GetConversationAsync(TestUserId, CounterpartyUserId);

        // Assert
        result.Messages.Should().HaveCount(1);
        result.Messages[0].Content.Should().Be("Hello");
        result.Messages[0].IsFromMe.Should().BeTrue();
    }

    [Fact]
    public async Task GetConversationAsync_MarksSelfChat_Correctly()
    {
        // Arrange
        var chatMessages = new List<ChatMessage>
        {
            new() { Id = "msg-1", SenderUserId = TestUserId, RecipientUserId = TestUserId, Type = ChatMessageType.Text, Content = "Self note", CreatedAt = DateTime.UtcNow }
        };
        _chatMessageRepositoryMock.Setup(x => x.GetConversationMessagesAsync(TestUserId, TestUserId, It.IsAny<int>(), It.IsAny<DateTime?>()))
            .ReturnsAsync(chatMessages);
        _transactionRepositoryMock.Setup(x => x.GetP2PTransactionsWithCounterpartyAsync(TestUserId, TestUserId))
            .ReturnsAsync(new List<Transaction>());

        // Act
        var result = await _conversationService.GetConversationAsync(TestUserId, TestUserId);

        // Assert
        result.IsSelfChat.Should().BeTrue();
        result.CounterpartyName.Should().Be("Personal Transactions");
    }

    [Fact]
    public async Task GetConversationAsync_IncludesSystemGeneratedFields()
    {
        // Arrange - Transaction with Source = Recurring is system-generated
        var transactionId = "tx-123";
        var transaction = new Transaction
        {
            Id = transactionId,
            UserId = TestUserId,
            Type = TransactionType.Receive,
            Amount = 100,
            Currency = "USD",
            Date = DateTime.UtcNow,
            CounterpartyUserId = TestUserId,
            Source = TransactionSource.Recurring // System-generated from recurring
        };
        
        var chatMessages = new List<ChatMessage>
        {
            new()
            {
                Id = "msg-1",
                SenderUserId = TestUserId,
                RecipientUserId = TestUserId,
                Type = ChatMessageType.Transaction,
                TransactionId = transactionId,
                CreatedAt = DateTime.UtcNow
            }
        };
        _chatMessageRepositoryMock.Setup(x => x.GetConversationMessagesAsync(TestUserId, TestUserId, It.IsAny<int>(), It.IsAny<DateTime?>()))
            .ReturnsAsync(chatMessages);
        _transactionRepositoryMock.Setup(x => x.GetP2PTransactionsWithCounterpartyAsync(TestUserId, TestUserId))
            .ReturnsAsync(new List<Transaction> { transaction });

        // Act
        var result = await _conversationService.GetConversationAsync(TestUserId, TestUserId);

        // Assert - IsSystemGenerated should be derived from Transaction.Source
        result.Messages.Should().HaveCount(1);
        result.Messages[0].IsSystemGenerated.Should().BeTrue();
        result.Messages[0].SystemSource.Should().Be("Recurring");
    }

    #endregion

    #region SendMessageAsync Tests

    [Fact]
    public async Task SendMessageAsync_ReturnsError_WhenContentIsEmpty()
    {
        // Act
        var result = await _conversationService.SendMessageAsync(TestUserId, CounterpartyUserId, new SendMessageRequest(""));

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().Be("Message content is required");
    }

    [Fact]
    public async Task SendMessageAsync_ReturnsError_WhenContentIsWhitespace()
    {
        // Act
        var result = await _conversationService.SendMessageAsync(TestUserId, CounterpartyUserId, new SendMessageRequest("   "));

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().Be("Message content is required");
    }

    [Fact]
    public async Task SendMessageAsync_ReturnsError_WhenContentTooLong()
    {
        // Arrange
        var longContent = new string('a', 1001);

        // Act
        var result = await _conversationService.SendMessageAsync(TestUserId, CounterpartyUserId, new SendMessageRequest(longContent));

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().Be("Message cannot exceed 1000 characters");
    }

    [Fact]
    public async Task SendMessageAsync_ReturnsError_WhenCounterpartyNotFound()
    {
        // Arrange
        _userRepositoryMock.Setup(x => x.GetByIdAsync("unknown-user"))
            .ReturnsAsync((User?)null);

        // Act
        var result = await _conversationService.SendMessageAsync(TestUserId, "unknown-user", new SendMessageRequest("Hello"));

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().Be("User not found");
    }

    [Fact]
    public async Task SendMessageAsync_CreatesMessage_Successfully()
    {
        // Arrange
        ChatMessage? createdMessage = null;
        _chatMessageRepositoryMock.Setup(x => x.CreateAsync(It.IsAny<ChatMessage>()))
            .Callback<ChatMessage>(m => { m.Id = "new-msg-id"; createdMessage = m; })
            .ReturnsAsync((ChatMessage m) => m);

        // Act
        var result = await _conversationService.SendMessageAsync(TestUserId, CounterpartyUserId, new SendMessageRequest("Hello!"));

        // Assert
        result.Success.Should().BeTrue();
        result.ChatMessage.Should().NotBeNull();
        result.ChatMessage!.Content.Should().Be("Hello!");
        result.ChatMessage.IsFromMe.Should().BeTrue();
        
        createdMessage.Should().NotBeNull();
        createdMessage!.SenderUserId.Should().Be(TestUserId);
        createdMessage.RecipientUserId.Should().Be(CounterpartyUserId);
    }

    [Fact]
    public async Task SendMessageAsync_AllowsSelfChat()
    {
        // Arrange
        _chatMessageRepositoryMock.Setup(x => x.CreateAsync(It.IsAny<ChatMessage>()))
            .ReturnsAsync((ChatMessage m) => { m.Id = "msg-id"; return m; });

        // Act
        var result = await _conversationService.SendMessageAsync(TestUserId, TestUserId, new SendMessageRequest("Note to self"));

        // Assert
        result.Success.Should().BeTrue();
        result.ChatMessage.Should().NotBeNull();
    }

    #endregion

    #region EditMessageAsync Tests

    [Fact]
    public async Task EditMessageAsync_ReturnsError_WhenMessageNotFound()
    {
        // Arrange
        _chatMessageRepositoryMock.Setup(x => x.GetByIdAsync("unknown-msg"))
            .ReturnsAsync((ChatMessage?)null);

        // Act
        var result = await _conversationService.EditMessageAsync(TestUserId, "unknown-msg", new EditMessageRequest("Edit"));

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().Be("Message not found or you don't have permission to edit it");
    }

    [Fact]
    public async Task EditMessageAsync_ReturnsError_WhenNotMessageOwner()
    {
        // Arrange
        var message = new ChatMessage { Id = "msg-1", SenderUserId = "other-user", Type = ChatMessageType.Text, CreatedAt = DateTime.UtcNow };
        _chatMessageRepositoryMock.Setup(x => x.GetByIdAsync("msg-1")).ReturnsAsync(message);

        // Act
        var result = await _conversationService.EditMessageAsync(TestUserId, "msg-1", new EditMessageRequest("Edit"));

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().Be("Message not found or you don't have permission to edit it");
    }

    [Fact]
    public async Task EditMessageAsync_ReturnsError_WhenEditFails()
    {
        // Arrange - EditMessageAsync returns false when message is deleted or non-text
        var message = new ChatMessage { Id = "msg-1", SenderUserId = TestUserId, Type = ChatMessageType.Text, CreatedAt = DateTime.UtcNow };
        _chatMessageRepositoryMock.Setup(x => x.GetByIdAsync("msg-1")).ReturnsAsync(message);
        _chatMessageRepositoryMock.Setup(x => x.EditMessageAsync("msg-1", TestUserId, "Edit")).ReturnsAsync(false);

        // Act
        var result = await _conversationService.EditMessageAsync(TestUserId, "msg-1", new EditMessageRequest("Edit"));

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().Be("Failed to update message");
    }

    [Fact]
    public async Task EditMessageAsync_ReturnsError_WhenEditWindowExpired()
    {
        // Arrange
        var message = new ChatMessage { Id = "msg-1", SenderUserId = TestUserId, Type = ChatMessageType.Text, CreatedAt = DateTime.UtcNow.AddMinutes(-20) };
        _chatMessageRepositoryMock.Setup(x => x.GetByIdAsync("msg-1")).ReturnsAsync(message);

        // Act
        var result = await _conversationService.EditMessageAsync(TestUserId, "msg-1", new EditMessageRequest("Edit"));

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().Contain("can only be edited within");
    }

    [Fact]
    public async Task EditMessageAsync_UpdatesMessage_Successfully()
    {
        // Arrange
        var message = new ChatMessage { Id = "msg-1", SenderUserId = TestUserId, Type = ChatMessageType.Text, Content = "Original", CreatedAt = DateTime.UtcNow };
        _chatMessageRepositoryMock.Setup(x => x.GetByIdAsync("msg-1")).ReturnsAsync(message);
        _chatMessageRepositoryMock.Setup(x => x.EditMessageAsync("msg-1", TestUserId, "Edited")).ReturnsAsync(true);

        // Act
        var result = await _conversationService.EditMessageAsync(TestUserId, "msg-1", new EditMessageRequest("Edited"));

        // Assert
        result.Success.Should().BeTrue();
        _chatMessageRepositoryMock.Verify(x => x.EditMessageAsync("msg-1", TestUserId, "Edited"), Times.Once);
    }

    #endregion

    #region DeleteMessageAsync Tests

    [Fact]
    public async Task DeleteMessageAsync_ReturnsError_WhenMessageNotFound()
    {
        // Arrange
        _chatMessageRepositoryMock.Setup(x => x.GetByIdAsync("unknown-msg"))
            .ReturnsAsync((ChatMessage?)null);

        // Act
        var result = await _conversationService.DeleteMessageAsync(TestUserId, "unknown-msg");

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().Be("Message not found or you don't have permission to delete it");
    }

    [Fact]
    public async Task DeleteMessageAsync_ReturnsError_WhenNotMessageOwner()
    {
        // Arrange
        var message = new ChatMessage { Id = "msg-1", SenderUserId = "other-user", CreatedAt = DateTime.UtcNow };
        _chatMessageRepositoryMock.Setup(x => x.GetByIdAsync("msg-1")).ReturnsAsync(message);

        // Act
        var result = await _conversationService.DeleteMessageAsync(TestUserId, "msg-1");

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().Be("Message not found or you don't have permission to delete it");
    }

    [Fact]
    public async Task DeleteMessageAsync_ReturnsError_WhenDeleteFails()
    {
        // Arrange - DeleteMessageAsync returns false for already deleted messages
        var message = new ChatMessage { Id = "msg-1", SenderUserId = TestUserId, CreatedAt = DateTime.UtcNow };
        _chatMessageRepositoryMock.Setup(x => x.GetByIdAsync("msg-1")).ReturnsAsync(message);
        _chatMessageRepositoryMock.Setup(x => x.DeleteMessageAsync("msg-1", TestUserId)).ReturnsAsync(false);

        // Act
        var result = await _conversationService.DeleteMessageAsync(TestUserId, "msg-1");

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().Be("Failed to delete message");
    }

    [Fact]
    public async Task DeleteMessageAsync_ReturnsError_WhenDeleteWindowExpired()
    {
        // Arrange
        var message = new ChatMessage { Id = "msg-1", SenderUserId = TestUserId, CreatedAt = DateTime.UtcNow.AddHours(-2) };
        _chatMessageRepositoryMock.Setup(x => x.GetByIdAsync("msg-1")).ReturnsAsync(message);

        // Act
        var result = await _conversationService.DeleteMessageAsync(TestUserId, "msg-1");

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().Contain("can only be deleted within");
    }

    [Fact]
    public async Task DeleteMessageAsync_SoftDeletesMessage_Successfully()
    {
        // Arrange
        var message = new ChatMessage { Id = "msg-1", SenderUserId = TestUserId, Content = "To delete", CreatedAt = DateTime.UtcNow };
        _chatMessageRepositoryMock.Setup(x => x.GetByIdAsync("msg-1")).ReturnsAsync(message);
        _chatMessageRepositoryMock.Setup(x => x.DeleteMessageAsync("msg-1", TestUserId)).ReturnsAsync(true);

        // Act
        var result = await _conversationService.DeleteMessageAsync(TestUserId, "msg-1");

        // Assert
        result.Success.Should().BeTrue();
        _chatMessageRepositoryMock.Verify(x => x.DeleteMessageAsync("msg-1", TestUserId), Times.Once);
    }

    #endregion

    #region GetUnreadCountAsync Tests

    [Fact]
    public async Task GetUnreadCountAsync_ReturnsCount()
    {
        // Arrange
        _chatMessageRepositoryMock.Setup(x => x.GetTotalUnreadCountAsync(TestUserId))
            .ReturnsAsync(5);

        // Act
        var result = await _conversationService.GetUnreadCountAsync(TestUserId);

        // Assert
        result.Should().Be(5);
    }

    #endregion

    #region SearchUserByEmailAsync Tests

    [Fact]
    public async Task SearchUserByEmailAsync_ReturnsNotFound_WhenUserDoesNotExist()
    {
        // Arrange
        _userRepositoryMock.Setup(x => x.GetByEmailAsync("unknown@example.com"))
            .ReturnsAsync((User?)null);

        // Act
        var result = await _conversationService.SearchUserByEmailAsync(TestUserId, "unknown@example.com");

        // Assert
        result.Found.Should().BeFalse();
        result.User.Should().BeNull();
    }

    [Fact]
    public async Task SearchUserByEmailAsync_ReturnsNotFound_WhenSearchingSelf()
    {
        // Arrange
        var user = new User { Id = TestUserId, Email = "test@example.com" };
        _userRepositoryMock.Setup(x => x.GetByEmailAsync("test@example.com"))
            .ReturnsAsync(user);

        // Act
        var result = await _conversationService.SearchUserByEmailAsync(TestUserId, "test@example.com");

        // Assert
        result.Found.Should().BeFalse();
    }

    [Fact]
    public async Task SearchUserByEmailAsync_ReturnsUser_WhenFound()
    {
        // Arrange
        var user = new User { Id = "other-user", Email = "other@example.com", FullName = "Other User" };
        _userRepositoryMock.Setup(x => x.GetByEmailAsync("other@example.com"))
            .ReturnsAsync(user);

        // Act
        var result = await _conversationService.SearchUserByEmailAsync(TestUserId, "other@example.com");

        // Assert
        result.Found.Should().BeTrue();
        result.User.Should().NotBeNull();
        result.User!.Email.Should().Be("other@example.com");
        result.User.Name.Should().Be("Other User");
    }

    #endregion

    #region MarkAsReadAsync Tests

    [Fact]
    public async Task MarkAsReadAsync_CallsRepository()
    {
        // Arrange
        _chatMessageRepositoryMock.Setup(x => x.MarkConversationAsReadAsync(TestUserId, CounterpartyUserId))
            .Returns(Task.CompletedTask);

        // Act
        await _conversationService.MarkAsReadAsync(TestUserId, CounterpartyUserId);

        // Assert
        _chatMessageRepositoryMock.Verify(x => x.MarkConversationAsReadAsync(TestUserId, CounterpartyUserId), Times.Once);
    }

    #endregion
}
