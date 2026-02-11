using System.Security.Claims;
using FluentValidation;
using DigiTransac.Api.Common;
using DigiTransac.Api.Models;
using DigiTransac.Api.Models.Dto;
using DigiTransac.Api.Services;
using DigiTransac.Api.Validators;

namespace DigiTransac.Api.Endpoints;

/// <summary>
/// Transaction CRUD and query endpoints: list, get, create, update, delete, summary, recurring, export, and pending count.
/// </summary>
public static class TransactionCrudEndpoints
{
    public static RouteGroupBuilder MapTransactionCrudEndpoints(this RouteGroupBuilder group)
    {
        // Get all transactions with filters
        group.MapGet("/", async (
            DateTime? startDate,
            DateTime? endDate,
            string? accountIds,
            string? types,
            string? labelIds,
            string? tagIds,
            string? counterpartyUserIds,
            decimal? minAmount,
            decimal? maxAmount,
            string? searchText,
            string? status,
            bool? isRecurring,
            bool? hasLinkedTransaction,
            int? page,
            int? pageSize,
            ClaimsPrincipal user,
            HttpContext httpContext,
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

            List<string>? counterpartyUserIdList = null;
            if (!string.IsNullOrEmpty(counterpartyUserIds))
            {
                counterpartyUserIdList = counterpartyUserIds.Split(',', StringSplitOptions.RemoveEmptyEntries).ToList();
            }

            var filter = new TransactionFilterRequest(
                startDate, endDate, accountIdList, typeList, labelIdList, tagIdList,
                minAmount, maxAmount, searchText, status, isRecurring,
                page, pageSize, hasLinkedTransaction, 
                SearchLabelIds: null, SearchTagIds: null, SearchAccountIds: null,
                CounterpartyUserIds: counterpartyUserIdList);

            var result = await transactionService.GetAllAsync(userId, filter);
            return ETagHelper.OkWithETag(httpContext, result, cacheMaxAgeSeconds: 30);
        })
        .WithName("GetTransactions")
        .WithSummary("Get transactions")
        .WithDescription("Returns a paginated list of transactions with optional filters for date range, accounts, types, labels, tags, amount range, and search text. Supports ETag-based caching with 304 Not Modified.")
        .Produces<TransactionListResponse>(200);

        // Get counterparties for filter dropdown
        group.MapGet("/counterparties", async (
            ClaimsPrincipal user,
            ITransactionService transactionService) =>
        {
            var userId = user.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userId))
                return Results.Unauthorized();

            var counterparties = await transactionService.GetCounterpartiesAsync(userId);
            return Results.Ok(counterparties);
        })
        .WithName("GetTransactionCounterparties")
        .WithSummary("Get transaction counterparties")
        .WithDescription("Returns a list of distinct counterparties (payees/payers) for the authenticated user, used for filter dropdowns.")
        .Produces<List<CounterpartyInfo>>(200);

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
            string? status,
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
                minAmount, maxAmount, null, status, null, 1, int.MaxValue, hasLinkedTransaction);

            var summary = await transactionService.GetSummaryAsync(userId, filter);
            return Results.Ok(summary);
        })
        .WithName("GetTransactionSummary")
        .WithSummary("Get transaction summary")
        .WithDescription("Returns aggregated summary statistics including total income, expenses, and net amount for the specified filters.")
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
        .WithSummary("Get recurring transactions")
        .WithDescription("Returns all active recurring transaction templates for the authenticated user.")
        .Produces<List<RecurringTransactionResponse>>(200);

        // Get single transaction
        // Use regex constraint to only match valid MongoDB ObjectIds (24 hex chars)
        group.MapGet("/{id:regex(^[a-fA-F0-9]{{24}}$)}", async (
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
        .WithSummary("Get transaction by ID")
        .WithDescription("Returns a single transaction by its MongoDB ObjectId. Only returns transactions owned by the authenticated user.")
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

            var result = await transactionService.CreateAsync(userId, request);
            return result.ToApiResult(t => Results.Created($"/api/transactions/{t.Id}", t));
        })
        .WithName("CreateTransaction")
        .WithSummary("Create a transaction")
        .WithDescription("Creates a new transaction. Supports types: Send, Receive, Transfer. Validates account ownership and handles P2P linked transactions.")
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

            var result = await transactionService.UpdateAsync(id, userId, request);
            return result.ToApiResult();
        })
        .WithName("UpdateTransaction")
        .WithSummary("Update a transaction")
        .WithDescription("Updates an existing transaction. Validates ownership and recalculates account balances if amount or account changed.")
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

            var result = await transactionService.DeleteAsync(id, userId);
            return result.IsSuccess
                ? Results.NoContent()
                : result.ToApiResult();
        })
        .WithName("DeleteTransaction")
        .WithSummary("Delete a transaction")
        .WithDescription("Permanently deletes a transaction and reverses the associated account balance change.")
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
        .WithSummary("Delete a recurring transaction")
        .WithDescription("Deletes a recurring transaction template. Optionally deletes all future instances that haven't been processed yet.")
        .Produces(204)
        .Produces<ErrorResponse>(404);

        // Pending Transaction Count
        group.MapGet("/pending/count", async (
            ClaimsPrincipal user,
            ITransactionService transactionService) =>
        {
            var userId = user.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userId))
                return Results.Unauthorized();

            var count = await transactionService.GetPendingCountAsync(userId);
            return Results.Ok(new { count });
        })
        .WithName("GetPendingCount")
        .WithSummary("Get pending transaction count")
        .WithDescription("Returns the count of pending P2P transactions awaiting confirmation by the authenticated user.")
        .Produces<object>(200);

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
                    var notes = (t.Notes ?? "").Replace("\"", "\"\"");
                    var title = (t.Title ?? "").Replace("\"", "\"\"");
                    var payee = (t.Payee ?? "").Replace("\"", "\"\"");
                    
                    csv.AppendLine($"{t.Date:yyyy-MM-dd},{t.Type},{t.Amount},{t.Currency},\"{title}\",\"{payee}\",\"{t.AccountName}\",\"{categoryName}\",\"{tagNames}\",{t.Status},\"{notes}\"");
                }
                
                return Results.Text(csv.ToString(), "text/csv");
            }

            return Results.Ok(transactions);
        })
        .WithName("ExportTransactions")
        .WithSummary("Export transactions")
        .WithDescription("Exports filtered transactions in CSV or JSON format. Use format=csv for CSV download or format=json (default) for JSON response.")
        .Produces<List<TransactionResponse>>(200);

        return group;
    }
}