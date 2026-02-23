using System.Security.Claims;
using FluentValidation;
using DigiTransac.Api.Common;
using DigiTransac.Api.Extensions;
using DigiTransac.Api.Hubs;
using DigiTransac.Api.Models.Dto;
using DigiTransac.Api.Repositories;
using DigiTransac.Api.Services;

namespace DigiTransac.Api.Endpoints;

public static class ConversationEndpoints
{
    public static void MapConversationEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/conversations")
            .WithTags("Conversations")
            .RequireAuthorization();

        // Get all conversations
        group.MapGet("/", async (ClaimsPrincipal user, IConversationService conversationService, CancellationToken ct) =>
        {
            if (!user.TryGetUserId(out var userId))
                return Results.Unauthorized();

            var conversations = await conversationService.GetConversationsAsync(userId, ct);
            return Results.Ok(conversations);
        })
        .WithName("GetConversations")
        .Produces<ConversationListResponse>(200);

        // Get unread count
        group.MapGet("/unread-count", async (ClaimsPrincipal user, IConversationService conversationService, CancellationToken ct) =>
        {
            if (!user.TryGetUserId(out var userId))
                return Results.Unauthorized();

            var count = await conversationService.GetUnreadCountAsync(userId, ct);
            return Results.Ok(new { count });
        })
        .WithName("GetUnreadCount")
        .Produces<object>(200);

        // Get conversation with specific user
        group.MapGet("/{counterpartyUserId}", async (
            string counterpartyUserId,
            int? limit,
            DateTime? before,
            ClaimsPrincipal user,
            IConversationService conversationService,
            CancellationToken ct) =>
        {
            if (!user.TryGetUserId(out var userId))
                return Results.Unauthorized();

            var conversation = await conversationService.GetConversationAsync(
                userId, counterpartyUserId, Math.Min(limit ?? 50, 200), before, ct);
            return Results.Ok(conversation);
        })
        .WithName("GetConversation")
        .Produces<ConversationDetailResponse>(200);

        // Send text message
        group.MapPost("/{counterpartyUserId}/messages", async (
            string counterpartyUserId,
            SendMessageRequest request,
            ClaimsPrincipal user,
            IConversationService conversationService,
            INotificationService notificationService,
            IUserRepository userRepository,
            CancellationToken ct) =>
        {
            if (!user.TryGetUserId(out var userId))
                return Results.Unauthorized();

            var result = await conversationService.SendMessageAsync(
                userId, counterpartyUserId, request, ct);
            
            if (result.IsFailure)
                return result.ToApiResult();

            var chatMessage = result.Value;

            // Send real-time notification to recipient
            if (userId != counterpartyUserId)
            {
                var sender = await userRepository.GetByIdAsync(userId);
                var notification = new ChatMessageNotification(
                    MessageId: chatMessage.Id,
                    SenderId: userId,
                    SenderName: sender?.FullName ?? sender?.Email,
                    MessageType: chatMessage.Type,
                    Content: chatMessage.Content,
                    TransactionId: null,
                    SentAt: chatMessage.CreatedAt
                );
                await notificationService.NotifyChatMessageAsync(userId, counterpartyUserId, notification);
            }

            return Results.Ok(chatMessage);
        })
        .WithName("SendMessage")
        .Produces<ConversationMessage>(200)
        .Produces<ErrorResponse>(400);

        // Send money
        group.MapPost("/{counterpartyUserId}/send-money", async (
            string counterpartyUserId,
            SendMoneyRequest request,
            ClaimsPrincipal user,
            IConversationService conversationService,
            IValidator<SendMoneyRequest> validator,
            INotificationService notificationService,
            IUserRepository userRepository,
            CancellationToken ct) =>
        {
            if (!user.TryGetUserId(out var userId))
                return Results.Unauthorized();

            var validationResult = await validator.ValidateAsync(request, ct);
            if (!validationResult.IsValid)
                return Results.BadRequest(new ErrorResponse(validationResult.Errors.First().ErrorMessage));

            var result = await conversationService.SendMoneyAsync(
                userId, counterpartyUserId, request, ct);
            
            if (result.IsFailure)
                return result.ToApiResult();

            var chatMessage = result.Value;

            // Send real-time notification to recipient
            if (chatMessage != null)
            {
                var sender = await userRepository.GetByIdAsync(userId);
                var notification = new ChatMessageNotification(
                    MessageId: chatMessage.Id,
                    SenderId: userId,
                    SenderName: sender?.FullName ?? sender?.Email,
                    MessageType: chatMessage.Type,
                    Content: null, // Transaction messages don't have text content
                    TransactionId: chatMessage.Transaction?.TransactionId,
                    SentAt: chatMessage.CreatedAt
                );
                await notificationService.NotifyChatMessageAsync(userId, counterpartyUserId, notification);
            }

            return Results.Ok(chatMessage);
        })
        .WithName("SendMoney")
        .Produces<ConversationMessage>(200)
        .Produces<ErrorResponse>(400);

        // Mark conversation as read
        group.MapPost("/{counterpartyUserId}/mark-read", async (
            string counterpartyUserId,
            ClaimsPrincipal user,
            IConversationService conversationService,
            CancellationToken ct) =>
        {
            if (!user.TryGetUserId(out var userId))
                return Results.Unauthorized();

            await conversationService.MarkAsReadAsync(userId, counterpartyUserId, ct);
            return Results.Ok(new { message = "Conversation marked as read" });
        })
        .WithName("MarkConversationAsRead")
        .Produces<object>(200);

        // Edit message
        group.MapPut("/messages/{messageId}", async (
            string messageId,
            EditMessageRequest request,
            ClaimsPrincipal user,
            IConversationService conversationService,
            CancellationToken ct) =>
        {
            if (!user.TryGetUserId(out var userId))
                return Results.Unauthorized();

            var result = await conversationService.EditMessageAsync(userId, messageId, request, ct);
            if (result.IsFailure)
                return result.ToApiResult();

            return Results.Ok(new { message = "Message updated" });
        })
        .WithName("EditMessage")
        .Produces<object>(200)
        .Produces<ErrorResponse>(400);

        // Delete message
        group.MapDelete("/messages/{messageId}", async (
            string messageId,
            ClaimsPrincipal user,
            IConversationService conversationService,
            CancellationToken ct) =>
        {
            if (!user.TryGetUserId(out var userId))
                return Results.Unauthorized();

            var result = await conversationService.DeleteMessageAsync(userId, messageId, ct);
            if (result.IsFailure)
                return result.ToApiResult();

            return Results.Ok(new { message = "Message deleted" });
        })
        .WithName("DeleteMessage")
        .Produces<object>(200)
        .Produces<ErrorResponse>(400);

        // Restore (undo delete) message
        group.MapPost("/messages/{messageId}/restore", async (
            string messageId,
            ClaimsPrincipal user,
            IConversationService conversationService,
            CancellationToken ct) =>
        {
            if (!user.TryGetUserId(out var userId))
                return Results.Unauthorized();

            var result = await conversationService.RestoreMessageAsync(userId, messageId, ct);
            if (result.IsFailure)
                return result.ToApiResult();

            return Results.Ok(new { message = "Message restored" });
        })
        .WithName("RestoreMessage")
        .Produces<object>(200)
        .Produces<ErrorResponse>(400);

        // Search user by email (for starting new conversations)
        group.MapGet("/search-user", async (
            string email,
            ClaimsPrincipal user,
            IConversationService conversationService,
            CancellationToken ct) =>
        {
            if (!user.TryGetUserId(out var userId))
                return Results.Unauthorized();

            var result = await conversationService.SearchUserByEmailAsync(userId, email, ct);
            return Results.Ok(result);
        })
        .WithName("SearchUserByEmail")
        .Produces<UserSearchResponse>(200);
    }
}
