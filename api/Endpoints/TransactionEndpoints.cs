using System.Security.Claims;
using FluentValidation;
using DigiTransac.Api.Models;
using DigiTransac.Api.Models.Dto;
using DigiTransac.Api.Services;
using DigiTransac.Api.Services.Transactions;
using DigiTransac.Api.Validators;

// Note: ITransactionAnalyticsService is already imported via DigiTransac.Api.Services.Transactions

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
            return Results.Ok(result);
        })
        .WithName("GetTransactions")
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
                case "markconfirmed":
                case "markcleared": // Legacy support
                    result = await transactionService.BatchUpdateStatusAsync(userId, request.Ids, nameof(TransactionStatus.Confirmed));
                    break;
                case "markpending":
                    result = await transactionService.BatchUpdateStatusAsync(userId, request.Ids, nameof(TransactionStatus.Pending));
                    break;
                case "markdeclined":
                    result = await transactionService.BatchUpdateStatusAsync(userId, request.Ids, nameof(TransactionStatus.Declined));
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
        // Cache analytics for 5 minutes to reduce load on expensive aggregate queries
        group.MapGet("/analytics", async (
            DateTime? startDate,
            DateTime? endDate,
            string? accountId,
            ClaimsPrincipal user,
            HttpContext httpContext,
            ITransactionService transactionService) =>
        {
            var userId = user.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userId))
                return Results.Unauthorized();

            var analytics = await transactionService.GetAnalyticsAsync(userId, startDate, endDate, accountId);
            
            // Set cache headers for analytics (5 minutes client-side, must-revalidate)
            SetAnalyticsCacheHeaders(httpContext, TimeSpan.FromMinutes(5));
            
            return Results.Ok(analytics);
        })
        .WithName("GetTransactionAnalytics")
        .Produces<TransactionAnalyticsResponse>(200);

        // Get top counterparties (payees) spending breakdown
        group.MapGet("/analytics/counterparties", async (
            DateTime? startDate,
            DateTime? endDate,
            int? page,
            int? pageSize,
            ClaimsPrincipal user,
            HttpContext httpContext,
            ITransactionAnalyticsService analyticsService) =>
        {
            var userId = user.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userId))
                return Results.Unauthorized();

            var result = await analyticsService.GetTopCounterpartiesAsync(userId, startDate, endDate, page ?? 1, pageSize ?? 10);
            
            // Set cache headers (5 minutes)
            SetAnalyticsCacheHeaders(httpContext, TimeSpan.FromMinutes(5));
            
            return Results.Ok(result);
        })
        .WithName("GetTopCounterparties")
        .Produces<TopCounterpartiesResponse>(200);

        // Get spending breakdown by account
        group.MapGet("/analytics/by-account", async (
            DateTime? startDate,
            DateTime? endDate,
            int? page,
            int? pageSize,
            ClaimsPrincipal user,
            HttpContext httpContext,
            ITransactionAnalyticsService analyticsService) =>
        {
            var userId = user.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userId))
                return Results.Unauthorized();

            var result = await analyticsService.GetSpendingByAccountAsync(userId, startDate, endDate, page ?? 1, pageSize ?? 50);
            
            // Set cache headers (5 minutes)
            SetAnalyticsCacheHeaders(httpContext, TimeSpan.FromMinutes(5));
            
            return Results.Ok(result);
        })
        .WithName("GetSpendingByAccount")
        .Produces<SpendingByAccountResponse>(200);

        // Get spending patterns (by day of week and hour of day)
        group.MapGet("/analytics/patterns", async (
            DateTime? startDate,
            DateTime? endDate,
            ClaimsPrincipal user,
            HttpContext httpContext,
            ITransactionAnalyticsService analyticsService) =>
        {
            var userId = user.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userId))
                return Results.Unauthorized();

            var result = await analyticsService.GetSpendingPatternsAsync(userId, startDate, endDate);
            
            // Set cache headers (5 minutes)
            SetAnalyticsCacheHeaders(httpContext, TimeSpan.FromMinutes(5));
            
            return Results.Ok(result);
        })
        .WithName("GetSpendingPatterns")
        .Produces<SpendingPatternsResponse>(200);

        // Get spending anomalies and alerts
        group.MapGet("/analytics/anomalies", async (
            DateTime? startDate,
            DateTime? endDate,
            int? page,
            int? pageSize,
            ClaimsPrincipal user,
            HttpContext httpContext,
            ITransactionAnalyticsService analyticsService) =>
        {
            var userId = user.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userId))
                return Results.Unauthorized();

            var result = await analyticsService.GetSpendingAnomaliesAsync(userId, startDate, endDate, page ?? 1, pageSize ?? 10);
            
            // Set cache headers (5 minutes)
            SetAnalyticsCacheHeaders(httpContext, TimeSpan.FromMinutes(5));
            
            return Results.Ok(result);
        })
        .WithName("GetSpendingAnomalies")
        .Produces<SpendingAnomaliesResponse>(200);

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
        .Produces<List<TransactionResponse>>(200);

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
        .Produces<object>(200);

        // ===== IMPORT ENDPOINTS =====

        // Parse CSV/Excel and preview import (validates and shows what will be imported)
        group.MapPost("/import/parse", async (
            CsvParseRequest request,
            ClaimsPrincipal user,
            ITransactionImportService importService) =>
        {
            var userId = user.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userId))
                return Results.Unauthorized();

            if (string.IsNullOrWhiteSpace(request.CsvContent) && string.IsNullOrWhiteSpace(request.Base64Content))
                return Results.BadRequest(new ErrorResponse("Either CsvContent or Base64Content is required"));

            if (string.IsNullOrWhiteSpace(request.AccountId))
                return Results.BadRequest(new ErrorResponse("AccountId is required"));

            var result = await importService.ParseAndPreviewAsync(userId, request);
            return Results.Ok(result);
        })
        .WithName("ParseAndPreviewImport")
        .WithTags("Transactions", "Import")
        .Produces<ImportPreviewResponse>(200)
        .Produces<ErrorResponse>(400);

        // Preview import with pre-parsed transactions
        group.MapPost("/import/preview", async (
            ImportPreviewRequest request,
            ClaimsPrincipal user,
            ITransactionImportService importService) =>
        {
            var userId = user.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userId))
                return Results.Unauthorized();

            if (string.IsNullOrWhiteSpace(request.AccountId))
                return Results.BadRequest(new ErrorResponse("AccountId is required"));

            if (request.Transactions == null || request.Transactions.Count == 0)
                return Results.BadRequest(new ErrorResponse("At least one transaction is required"));

            var result = await importService.PreviewImportAsync(userId, request);
            return Results.Ok(result);
        })
        .WithName("PreviewTransactionImport")
        .WithTags("Transactions", "Import")
        .Produces<ImportPreviewResponse>(200)
        .Produces<ErrorResponse>(400);

        // Execute bulk import from pre-validated transactions
        group.MapPost("/import", async (
            BulkImportRequest request,
            ClaimsPrincipal user,
            ITransactionImportService importService) =>
        {
            var userId = user.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userId))
                return Results.Unauthorized();

            if (string.IsNullOrWhiteSpace(request.AccountId))
                return Results.BadRequest(new ErrorResponse("AccountId is required"));

            if (request.Transactions == null || request.Transactions.Count == 0)
                return Results.BadRequest(new ErrorResponse("At least one transaction is required"));

            if (request.Transactions.Count > 1000)
                return Results.BadRequest(new ErrorResponse("Maximum 1000 transactions per import"));

            var result = await importService.ImportAsync(userId, request);
            
            if (result.FailedCount == request.Transactions.Count)
                return Results.BadRequest(result);

            return Results.Ok(result);
        })
        .WithName("ImportTransactions")
        .WithTags("Transactions", "Import")
        .Produces<BulkImportResponse>(200)
        .Produces<BulkImportResponse>(400);
    }
    
    /// <summary>
    /// Sets cache headers for analytics endpoints.
    /// Uses private cache (user-specific data) with short duration for freshness.
    /// </summary>
    /// <param name="httpContext">The HTTP context</param>
    /// <param name="duration">How long to cache the response</param>
    private static void SetAnalyticsCacheHeaders(HttpContext httpContext, TimeSpan duration)
    {
        var response = httpContext.Response;
        
        // Cache-Control: private (user-specific), max-age, must-revalidate
        response.Headers.CacheControl = $"private, max-age={(int)duration.TotalSeconds}, must-revalidate";
        
        // Add Vary header to ensure cache varies by Authorization header
        response.Headers.Vary = "Authorization";
        
        // Set ETag based on current timestamp (changes when data might have changed)
        // This allows clients to use If-None-Match for conditional requests
        var etag = $"\"{DateTime.UtcNow.Ticks}\"";
        response.Headers.ETag = etag;
    }
}
