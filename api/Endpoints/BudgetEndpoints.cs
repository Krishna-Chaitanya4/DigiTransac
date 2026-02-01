using System.Security.Claims;
using DigiTransac.Api.Models.Dto;
using DigiTransac.Api.Services;

namespace DigiTransac.Api.Endpoints;

public static class BudgetEndpoints
{
    public static void MapBudgetEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/budgets")
            .WithTags("Budgets")
            .RequireAuthorization();

        // Get all budgets for user
        group.MapGet("/", async (
            bool? activeOnly,
            ClaimsPrincipal user,
            IBudgetService budgetService) =>
        {
            var userId = user.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userId))
                return Results.Unauthorized();

            var summary = await budgetService.GetSummaryAsync(userId, activeOnly ?? true);
            return Results.Ok(summary);
        })
        .WithName("GetBudgets")
        .WithDescription("Get all budgets with spending summary")
        .Produces<BudgetSummaryResponse>(200);

        // Get single budget by ID
        group.MapGet("/{id}", async (
            string id,
            ClaimsPrincipal user,
            IBudgetService budgetService) =>
        {
            var userId = user.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userId))
                return Results.Unauthorized();

            var budget = await budgetService.GetByIdAsync(id, userId);
            if (budget == null)
                return Results.NotFound(new ErrorResponse("Budget not found"));

            return Results.Ok(budget);
        })
        .WithName("GetBudget")
        .WithDescription("Get a specific budget by ID")
        .Produces<BudgetResponse>(200)
        .Produces<ErrorResponse>(404);

        // Get budget spending breakdown
        group.MapGet("/{id}/breakdown", async (
            string id,
            ClaimsPrincipal user,
            IBudgetService budgetService) =>
        {
            var userId = user.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userId))
                return Results.Unauthorized();

            var breakdown = await budgetService.GetSpendingBreakdownAsync(id, userId);
            if (breakdown == null)
                return Results.NotFound(new ErrorResponse("Budget not found"));

            return Results.Ok(breakdown);
        })
        .WithName("GetBudgetBreakdown")
        .WithDescription("Get detailed spending breakdown for a budget")
        .Produces<BudgetSpendingBreakdown>(200)
        .Produces<ErrorResponse>(404);

        // Create budget
        group.MapPost("/", async (
            CreateBudgetRequest request,
            ClaimsPrincipal user,
            IBudgetService budgetService) =>
        {
            var userId = user.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userId))
                return Results.Unauthorized();

            if (string.IsNullOrWhiteSpace(request.Name))
                return Results.BadRequest(new ErrorResponse("Name is required"));

            if (request.Amount <= 0)
                return Results.BadRequest(new ErrorResponse("Amount must be greater than 0"));

            var (success, message, budget) = await budgetService.CreateAsync(userId, request);
            if (!success)
                return Results.BadRequest(new ErrorResponse(message));

            return Results.Created($"/api/budgets/{budget!.Id}", budget);
        })
        .WithName("CreateBudget")
        .WithDescription("Create a new budget")
        .Produces<BudgetResponse>(201)
        .Produces<ErrorResponse>(400);

        // Update budget
        group.MapPut("/{id}", async (
            string id,
            UpdateBudgetRequest request,
            ClaimsPrincipal user,
            IBudgetService budgetService) =>
        {
            var userId = user.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userId))
                return Results.Unauthorized();

            var (success, message, budget) = await budgetService.UpdateAsync(id, userId, request);
            if (!success)
            {
                if (message.Contains("not found"))
                    return Results.NotFound(new ErrorResponse(message));
                return Results.BadRequest(new ErrorResponse(message));
            }

            return Results.Ok(budget);
        })
        .WithName("UpdateBudget")
        .WithDescription("Update an existing budget")
        .Produces<BudgetResponse>(200)
        .Produces<ErrorResponse>(400)
        .Produces<ErrorResponse>(404);

        // Delete budget
        group.MapDelete("/{id}", async (
            string id,
            ClaimsPrincipal user,
            IBudgetService budgetService) =>
        {
            var userId = user.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userId))
                return Results.Unauthorized();

            var (success, message) = await budgetService.DeleteAsync(id, userId);
            if (!success)
                return Results.NotFound(new ErrorResponse(message));

            return Results.NoContent();
        })
        .WithName("DeleteBudget")
        .WithDescription("Delete a budget")
        .Produces(204)
        .Produces<ErrorResponse>(404);

        // ===== Notifications =====

        // Get budget notifications
        group.MapGet("/notifications", async (
            bool? unreadOnly,
            ClaimsPrincipal user,
            IBudgetService budgetService) =>
        {
            var userId = user.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userId))
                return Results.Unauthorized();

            var notifications = await budgetService.GetNotificationsAsync(userId, unreadOnly);
            return Results.Ok(notifications);
        })
        .WithName("GetBudgetNotifications")
        .WithDescription("Get budget alert notifications")
        .Produces<BudgetNotificationListResponse>(200);

        // Mark notification as read
        group.MapPut("/notifications/{notificationId}/read", async (
            string notificationId,
            ClaimsPrincipal user,
            IBudgetService budgetService) =>
        {
            var userId = user.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userId))
                return Results.Unauthorized();

            var success = await budgetService.MarkNotificationAsReadAsync(notificationId, userId);
            if (!success)
                return Results.NotFound(new ErrorResponse("Notification not found"));

            return Results.Ok(new { success = true });
        })
        .WithName("MarkBudgetNotificationAsRead")
        .WithDescription("Mark a budget notification as read")
        .Produces<object>(200)
        .Produces<ErrorResponse>(404);

        // Mark all notifications as read
        group.MapPut("/notifications/read-all", async (
            ClaimsPrincipal user,
            IBudgetService budgetService) =>
        {
            var userId = user.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userId))
                return Results.Unauthorized();

            await budgetService.MarkAllNotificationsAsReadAsync(userId);
            return Results.Ok(new { success = true });
        })
        .WithName("MarkAllBudgetNotificationsAsRead")
        .WithDescription("Mark all budget notifications as read")
        .Produces<object>(200);
    }
}