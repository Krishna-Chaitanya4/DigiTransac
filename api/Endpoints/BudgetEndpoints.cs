using System.Security.Claims;
using DigiTransac.Api.Common;
using DigiTransac.Api.Extensions;
using DigiTransac.Api.Models.Dto;
using DigiTransac.Api.Services;
using DigiTransac.Api.Validators;
using FluentValidation;

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
            IBudgetService budgetService,
            CancellationToken ct) =>
        {
            if (!user.TryGetUserId(out var userId))
                return Results.Unauthorized();

            var summary = await budgetService.GetSummaryAsync(userId, activeOnly ?? true, ct);
            return Results.Ok(summary);
        })
        .WithName("GetBudgets")
        .WithDescription("Get all budgets with spending summary")
        .Produces<BudgetSummaryResponse>(200);

        // Get single budget by ID
        group.MapGet("/{id}", async (
            string id,
            ClaimsPrincipal user,
            IBudgetService budgetService,
            CancellationToken ct) =>
        {
            if (!user.TryGetUserId(out var userId))
                return Results.Unauthorized();

            var budget = await budgetService.GetByIdAsync(id, userId, ct);
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
            IBudgetService budgetService,
            CancellationToken ct) =>
        {
            if (!user.TryGetUserId(out var userId))
                return Results.Unauthorized();

            var breakdown = await budgetService.GetSpendingBreakdownAsync(id, userId, ct);
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
            IBudgetService budgetService,
            IValidator<CreateBudgetRequest> validator,
            CancellationToken ct) =>
        {
            if (!user.TryGetUserId(out var userId))
                return Results.Unauthorized();

            var validationError = await validator.ValidateAndReturnErrorAsync(request);
            if (validationError != null) return validationError;

            var result = await budgetService.CreateAsync(userId, request, ct);
            return result.ToApiResult(budget => Results.Created($"/api/budgets/{budget.Id}", budget));
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
            IBudgetService budgetService,
            IValidator<UpdateBudgetRequest> validator,
            CancellationToken ct) =>
        {
            if (!user.TryGetUserId(out var userId))
                return Results.Unauthorized();

            var validationError = await validator.ValidateAndReturnErrorAsync(request);
            if (validationError != null) return validationError;

            var result = await budgetService.UpdateAsync(id, userId, request, ct);
            return result.ToApiResult();
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
            IBudgetService budgetService,
            CancellationToken ct) =>
        {
            if (!user.TryGetUserId(out var userId))
                return Results.Unauthorized();

            var result = await budgetService.DeleteAsync(id, userId, ct);
            if (result.IsFailure)
                return result.ToApiResult();

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
            IBudgetService budgetService,
            CancellationToken ct) =>
        {
            if (!user.TryGetUserId(out var userId))
                return Results.Unauthorized();

            var notifications = await budgetService.GetNotificationsAsync(userId, unreadOnly, ct);
            return Results.Ok(notifications);
        })
        .WithName("GetBudgetNotifications")
        .WithDescription("Get budget alert notifications")
        .Produces<BudgetNotificationListResponse>(200);

        // Mark notification as read
        group.MapPut("/notifications/{notificationId}/read", async (
            string notificationId,
            ClaimsPrincipal user,
            IBudgetService budgetService,
            CancellationToken ct) =>
        {
            if (!user.TryGetUserId(out var userId))
                return Results.Unauthorized();

            var success = await budgetService.MarkNotificationAsReadAsync(notificationId, userId, ct);
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
            IBudgetService budgetService,
            CancellationToken ct) =>
        {
            if (!user.TryGetUserId(out var userId))
                return Results.Unauthorized();

            await budgetService.MarkAllNotificationsAsReadAsync(userId, ct);
            return Results.Ok(new { success = true });
        })
        .WithName("MarkAllBudgetNotificationsAsRead")
        .WithDescription("Mark all budget notifications as read")
        .Produces<object>(200);
    }
}