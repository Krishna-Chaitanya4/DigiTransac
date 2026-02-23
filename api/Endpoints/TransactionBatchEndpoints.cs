using System.Security.Claims;
using FluentValidation;
using DigiTransac.Api.Extensions;
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
            IValidator<BatchOperationRequest> validator,
            CancellationToken ct) =>
        {
            var validationError = await validator.ValidateAndReturnErrorAsync(request);
            if (validationError != null) return validationError;

            if (!user.TryGetUserId(out var userId))
                return Results.Unauthorized();

            BatchOperationResponse result;
            switch (request.Action.ToLowerInvariant())
            {
                case "delete":
                    result = await transactionService.BatchDeleteAsync(userId, request.Ids, ct);
                    break;
                case "markconfirmed":
                case "markcleared": // Legacy support
                    result = await transactionService.BatchUpdateStatusAsync(userId, request.Ids, nameof(TransactionStatus.Confirmed), ct);
                    break;
                case "markpending":
                    result = await transactionService.BatchUpdateStatusAsync(userId, request.Ids, nameof(TransactionStatus.Pending), ct);
                    break;
                case "markdeclined":
                    result = await transactionService.BatchUpdateStatusAsync(userId, request.Ids, nameof(TransactionStatus.Declined), ct);
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