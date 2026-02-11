using System.Security.Claims;
using DigiTransac.Api.Models;
using DigiTransac.Api.Models.Dto;
using DigiTransac.Api.Services;

namespace DigiTransac.Api.Endpoints;

/// <summary>
/// Transaction import endpoints: CSV/Excel parsing, preview, and bulk import execution.
/// </summary>
public static class TransactionImportEndpoints
{
    public static RouteGroupBuilder MapTransactionImportEndpoints(this RouteGroupBuilder group)
    {
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

        return group;
    }
}