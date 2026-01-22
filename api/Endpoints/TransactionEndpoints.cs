using System.Security.Claims;
using FluentValidation;
using DigiTransac.Api.Models.Dto;
using DigiTransac.Api.Services;
using DigiTransac.Api.Validators;

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
            string? accountIds,
            string? types,
            string? labelIds,
            string? tagIds,
            decimal? minAmount,
            decimal? maxAmount,
            string? searchText,
            bool? isCleared,
            bool? isRecurring,
            bool? hasLinkedTransaction,
            int? page,
            int? pageSize,
            ClaimsPrincipal user,
            ITransactionService transactionService) =>
        {
            var userId = user.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userId))
                return Results.Unauthorized();

            // Parse comma-separated values
            List<string>? accountIdList = null;
            if (!string.IsNullOrEmpty(accountIds))
            {
                accountIdList = accountIds.Split(',', StringSplitOptions.RemoveEmptyEntries).ToList();
            }

            List<string>? typeList = null;
            if (!string.IsNullOrEmpty(types))
            {
                typeList = types.Split(',', StringSplitOptions.RemoveEmptyEntries).ToList();
            }

            List<string>? labelIdList = null;
            if (!string.IsNullOrEmpty(labelIds))
            {
                labelIdList = labelIds.Split(',', StringSplitOptions.RemoveEmptyEntries).ToList();
            }

            List<string>? tagIdList = null;
            if (!string.IsNullOrEmpty(tagIds))
            {
                tagIdList = tagIds.Split(',', StringSplitOptions.RemoveEmptyEntries).ToList();
            }

            var filter = new TransactionFilterRequest(
                startDate, endDate, accountIdList, typeList, labelIdList, tagIdList,
                minAmount, maxAmount, searchText, isCleared, isRecurring,
                page, pageSize, hasLinkedTransaction);

            var result = await transactionService.GetAllAsync(userId, filter);
            return Results.Ok(result);
        })
        .WithName("GetTransactions")
        .Produces<TransactionListResponse>(200);

        // Get transaction summary
        group.MapGet("/summary", async (
            DateTime? startDate,
            DateTime? endDate,
            string? accountIds,
            string? types,
            string? labelIds,
            string? tagIds,
            decimal? minAmount,
            decimal? maxAmount,
            bool? isCleared,
            bool? hasLinkedTransaction,
            ClaimsPrincipal user,
            ITransactionService transactionService) =>
        {
            var userId = user.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userId))
                return Results.Unauthorized();

            // Parse comma-separated values
            var accountIdList = !string.IsNullOrEmpty(accountIds) 
                ? accountIds.Split(',', StringSplitOptions.RemoveEmptyEntries).ToList() 
                : null;
            var typeList = !string.IsNullOrEmpty(types)
                ? types.Split(',', StringSplitOptions.RemoveEmptyEntries).ToList()
                : null;
            var labelIdList = !string.IsNullOrEmpty(labelIds)
                ? labelIds.Split(',', StringSplitOptions.RemoveEmptyEntries).ToList()
                : null;
            var tagIdList = !string.IsNullOrEmpty(tagIds)
                ? tagIds.Split(',', StringSplitOptions.RemoveEmptyEntries).ToList()
                : null;

            var filter = new TransactionFilterRequest(
                startDate, endDate, accountIdList, typeList, labelIdList, tagIdList,
                minAmount, maxAmount, null, isCleared, null, 1, int.MaxValue, hasLinkedTransaction);

            var summary = await transactionService.GetSummaryAsync(userId, filter);
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
            ITransactionService transactionService,
            IValidator<CreateTransactionRequest> validator) =>
        {
            var validationError = await validator.ValidateAndReturnErrorAsync(request);
            if (validationError != null) return validationError;

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
            ITransactionService transactionService,
            IValidator<UpdateTransactionRequest> validator) =>
        {
            var validationError = await validator.ValidateAndReturnErrorAsync(request);
            if (validationError != null) return validationError;

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

        // Batch operations
        group.MapPost("/batch", async (
            BatchOperationRequest request,
            ClaimsPrincipal user,
            ITransactionService transactionService,
            IValidator<BatchOperationRequest> validator) =>
        {
            var validationError = await validator.ValidateAndReturnErrorAsync(request);
            if (validationError != null) return validationError;

            var userId = user.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userId))
                return Results.Unauthorized();

            BatchOperationResponse result;
            switch (request.Action.ToLowerInvariant())
            {
                case "delete":
                    result = await transactionService.BatchDeleteAsync(userId, request.Ids);
                    break;
                case "markcleared":
                    result = await transactionService.BatchMarkClearedAsync(userId, request.Ids, true);
                    break;
                case "markpending":
                    result = await transactionService.BatchMarkClearedAsync(userId, request.Ids, false);
                    break;
                default:
                    return Results.BadRequest(new ErrorResponse($"Unknown action: {request.Action}"));
            }

            return Results.Ok(result);
        })
        .WithName("BatchTransactionOperation")
        .Produces<BatchOperationResponse>(200)
        .Produces<ErrorResponse>(400);

        // Get analytics
        group.MapGet("/analytics", async (
            DateTime? startDate,
            DateTime? endDate,
            string? accountId,
            ClaimsPrincipal user,
            ITransactionService transactionService) =>
        {
            var userId = user.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userId))
                return Results.Unauthorized();

            var analytics = await transactionService.GetAnalyticsAsync(userId, startDate, endDate, accountId);
            return Results.Ok(analytics);
        })
        .WithName("GetTransactionAnalytics")
        .Produces<TransactionAnalyticsResponse>(200);

        // Export transactions
        group.MapGet("/export", async (
            DateTime? startDate,
            DateTime? endDate,
            string? accountIds,
            string? types,
            string? labelIds,
            string? tagIds,
            string? format,
            ClaimsPrincipal user,
            ITransactionService transactionService) =>
        {
            var userId = user.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userId))
                return Results.Unauthorized();

            var filter = new TransactionFilterRequest(
                startDate, endDate,
                accountIds?.Split(',', StringSplitOptions.RemoveEmptyEntries).ToList(),
                types?.Split(',', StringSplitOptions.RemoveEmptyEntries).ToList(),
                labelIds?.Split(',', StringSplitOptions.RemoveEmptyEntries).ToList(),
                tagIds?.Split(',', StringSplitOptions.RemoveEmptyEntries).ToList(),
                null, null, null, null, null, null, null);

            var transactions = await transactionService.GetAllForExportAsync(userId, filter);

            var exportFormat = format?.ToLowerInvariant() ?? "json";
            
            if (exportFormat == "csv")
            {
                var csv = new System.Text.StringBuilder();
                csv.AppendLine("Date,Type,Amount,Currency,Title,Payee,Account,Category,Tags,Status,Notes");
                
                foreach (var t in transactions)
                {
                    var categoryName = t.Splits.FirstOrDefault()?.LabelName ?? "";
                    var tagNames = string.Join(";", t.Tags.Select(tag => tag.Name));
                    var status = t.IsCleared ? "Cleared" : "Pending";
                    var notes = (t.Notes ?? "").Replace("\"", "\"\"");
                    var title = (t.Title ?? "").Replace("\"", "\"\"");
                    var payee = (t.Payee ?? "").Replace("\"", "\"\"");
                    
                    csv.AppendLine($"{t.Date:yyyy-MM-dd},{t.Type},{t.Amount},{t.Currency},\"{title}\",\"{payee}\",\"{t.AccountName}\",\"{categoryName}\",\"{tagNames}\",{status},\"{notes}\"");
                }
                
                return Results.Text(csv.ToString(), "text/csv");
            }

            return Results.Ok(transactions);
        })
        .WithName("ExportTransactions")
        .Produces<List<TransactionResponse>>(200);
    }
}
