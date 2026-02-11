using System.Security.Claims;
using FluentValidation;
using DigiTransac.Api.Models;
using DigiTransac.Api.Models.Dto;
using DigiTransac.Api.Services;
using DigiTransac.Api.Validators;

namespace DigiTransac.Api.Endpoints;

/// <summary>
/// Transaction batch operation endpoints: bulk delete, status updates.
/// </summary>
public static class TransactionBatchEndpoints
{
    public static RouteGroupBuilder MapTransactionBatchEndpoints(this RouteGroupBuilder group)
    {
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
        .WithSummary("Batch transaction operation")
        .WithDescription("Performs bulk operations on multiple transactions. Supported actions: delete, markConfirmed, markPending, markDeclined.")
        .Produces<BatchOperationResponse>(200)
        .Produces<ErrorResponse>(400);

        return group;
    }
}