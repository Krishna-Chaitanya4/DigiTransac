using System.Security.Claims;
using DigiTransac.Api.Models.Dto;
using DigiTransac.Api.Services;

namespace DigiTransac.Api.Endpoints;

public static class TransactionEndpoints
{
    public static void MapTransactionEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/transactions")
            .WithTags("Transactions")
            .RequireAuthorization();

        // Get all transactions with filters
        group.MapGet("/", async (
            DateTime? startDate,
            DateTime? endDate,
            string? accountId,
            string? type,
            string? labelId,
            string? tagId,
            decimal? minAmount,
            decimal? maxAmount,
            string? searchText,
            bool? isCleared,
            bool? isRecurring,
            int? page,
            int? pageSize,
            ClaimsPrincipal user,
            ITransactionService transactionService) =>
        {
            var userId = user.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userId))
                return Results.Unauthorized();

            var filter = new TransactionFilterRequest(
                startDate, endDate, accountId, type, labelId, tagId,
                minAmount, maxAmount, searchText, isCleared, isRecurring,
                page, pageSize);

            var result = await transactionService.GetAllAsync(userId, filter);
            return Results.Ok(result);
        })
        .WithName("GetTransactions")
        .Produces<TransactionListResponse>(200);

        // Get transaction summary
        group.MapGet("/summary", async (
            DateTime? startDate,
            DateTime? endDate,
            string? accountId,
            ClaimsPrincipal user,
            ITransactionService transactionService) =>
        {
            var userId = user.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userId))
                return Results.Unauthorized();

            var summary = await transactionService.GetSummaryAsync(userId, startDate, endDate, accountId);
            return Results.Ok(summary);
        })
        .WithName("GetTransactionSummary")
        .Produces<TransactionSummaryResponse>(200);

        // Get recurring transactions
        group.MapGet("/recurring", async (
            ClaimsPrincipal user,
            ITransactionService transactionService) =>
        {
            var userId = user.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userId))
                return Results.Unauthorized();

            var recurring = await transactionService.GetRecurringAsync(userId);
            return Results.Ok(recurring);
        })
        .WithName("GetRecurringTransactions")
        .Produces<List<RecurringTransactionResponse>>(200);

        // Get single transaction
        group.MapGet("/{id}", async (
            string id,
            ClaimsPrincipal user,
            ITransactionService transactionService) =>
        {
            var userId = user.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userId))
                return Results.Unauthorized();

            var transaction = await transactionService.GetByIdAsync(id, userId);
            if (transaction == null)
                return Results.NotFound(new ErrorResponse("Transaction not found"));

            return Results.Ok(transaction);
        })
        .WithName("GetTransaction")
        .Produces<TransactionResponse>(200)
        .Produces<ErrorResponse>(404);

        // Create transaction
        group.MapPost("/", async (
            CreateTransactionRequest request,
            ClaimsPrincipal user,
            ITransactionService transactionService) =>
        {
            var userId = user.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userId))
                return Results.Unauthorized();

            var (success, message, transaction) = await transactionService.CreateAsync(userId, request);
            if (!success)
                return Results.BadRequest(new ErrorResponse(message));

            return Results.Created($"/api/transactions/{transaction!.Id}", transaction);
        })
        .WithName("CreateTransaction")
        .Produces<TransactionResponse>(201)
        .Produces<ErrorResponse>(400);

        // Update transaction
        group.MapPut("/{id}", async (
            string id,
            UpdateTransactionRequest request,
            ClaimsPrincipal user,
            ITransactionService transactionService) =>
        {
            var userId = user.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userId))
                return Results.Unauthorized();

            var (success, message, transaction) = await transactionService.UpdateAsync(id, userId, request);
            if (!success)
            {
                if (message.Contains("not found"))
                    return Results.NotFound(new ErrorResponse(message));
                return Results.BadRequest(new ErrorResponse(message));
            }

            return Results.Ok(transaction);
        })
        .WithName("UpdateTransaction")
        .Produces<TransactionResponse>(200)
        .Produces<ErrorResponse>(400)
        .Produces<ErrorResponse>(404);

        // Delete transaction
        group.MapDelete("/{id}", async (
            string id,
            ClaimsPrincipal user,
            ITransactionService transactionService) =>
        {
            var userId = user.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userId))
                return Results.Unauthorized();

            var (success, message) = await transactionService.DeleteAsync(id, userId);
            if (!success)
                return Results.NotFound(new ErrorResponse(message));

            return Results.NoContent();
        })
        .WithName("DeleteTransaction")
        .Produces(204)
        .Produces<ErrorResponse>(404);

        // Delete recurring transaction
        group.MapDelete("/recurring/{id}", async (
            string id,
            bool? deleteFutureInstances,
            ClaimsPrincipal user,
            ITransactionService transactionService) =>
        {
            var userId = user.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userId))
                return Results.Unauthorized();

            var (success, message) = await transactionService.DeleteRecurringAsync(id, userId, deleteFutureInstances ?? false);
            if (!success)
                return Results.NotFound(new ErrorResponse(message));

            return Results.NoContent();
        })
        .WithName("DeleteRecurringTransaction")
        .Produces(204)
        .Produces<ErrorResponse>(404);
    }
}
