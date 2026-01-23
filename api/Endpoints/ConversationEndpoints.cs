using System.Security.Claims;
using FluentValidation;
using DigiTransac.Api.Models.Dto;
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
        group.MapGet("/", async (ClaimsPrincipal user, IConversationService conversationService) =>
        {
            var userId = user.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userId))
                return Results.Unauthorized();

            var conversations = await conversationService.GetConversationsAsync(userId);
            return Results.Ok(conversations);
        })
        .WithName("GetConversations")
        .Produces<ConversationListResponse>(200);

        // Get unread count
        group.MapGet("/unread-count", async (ClaimsPrincipal user, IConversationService conversationService) =>
        {
            var userId = user.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userId))
                return Results.Unauthorized();

            var count = await conversationService.GetUnreadCountAsync(userId);
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
            IConversationService conversationService) =>
        {
            var userId = user.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userId))
                return Results.Unauthorized();

            var conversation = await conversationService.GetConversationAsync(
                userId, counterpartyUserId, limit ?? 50, before);
            return Results.Ok(conversation);
        })
        .WithName("GetConversation")
        .Produces<ConversationDetailResponse>(200);

        // Send text message
        group.MapPost("/{counterpartyUserId}/messages", async (
            string counterpartyUserId,
            SendMessageRequest request,
            ClaimsPrincipal user,
            IConversationService conversationService) =>
        {
            var userId = user.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userId))
                return Results.Unauthorized();

            var (success, message, chatMessage) = await conversationService.SendMessageAsync(
                userId, counterpartyUserId, request);
            
            if (!success)
                return Results.BadRequest(new ErrorResponse(message));

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
            IValidator<SendMoneyRequest> validator) =>
        {
            var userId = user.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userId))
                return Results.Unauthorized();

            var validationResult = await validator.ValidateAsync(request);
            if (!validationResult.IsValid)
                return Results.BadRequest(new ErrorResponse(validationResult.Errors.First().ErrorMessage));

            var (success, message, chatMessage) = await conversationService.SendMoneyAsync(
                userId, counterpartyUserId, request);
            
            if (!success)
                return Results.BadRequest(new ErrorResponse(message));

            return Results.Ok(chatMessage);
        })
        .WithName("SendMoney")
        .Produces<ConversationMessage>(200)
        .Produces<ErrorResponse>(400);

        // Mark conversation as read
        group.MapPost("/{counterpartyUserId}/mark-read", async (
            string counterpartyUserId,
            ClaimsPrincipal user,
            IConversationService conversationService) =>
        {
            var userId = user.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userId))
                return Results.Unauthorized();

            await conversationService.MarkAsReadAsync(userId, counterpartyUserId);
            return Results.Ok(new { message = "Conversation marked as read" });
        })
        .WithName("MarkConversationAsRead")
        .Produces<object>(200);
    }
}
