using System.Security.Claims;
using FluentValidation;
using DigiTransac.Api.Common;
using DigiTransac.Api.Models.Dto;
using DigiTransac.Api.Services;
using DigiTransac.Api.Validators;

namespace DigiTransac.Api.Endpoints;

public static class LabelEndpoints
{
    public static void MapLabelEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/labels")
            .WithTags("Labels")
            .RequireAuthorization();

        // Get all labels (flat list)
        group.MapGet("/", async (ClaimsPrincipal user, ILabelService labelService, CancellationToken ct) =>
        {
            var userId = user.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userId))
            {
                return Results.Unauthorized();
            }

            var labels = await labelService.GetAllAsync(userId, ct);
            return Results.Ok(labels);
        })
        .WithName("GetLabels")
        .Produces<List<LabelResponse>>(200)
        .CacheOutput("StaticData");

        // Get labels as tree structure
        group.MapGet("/tree", async (ClaimsPrincipal user, ILabelService labelService, CancellationToken ct) =>
        {
            var userId = user.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userId))
            {
                return Results.Unauthorized();
            }

            var tree = await labelService.GetTreeAsync(userId, ct);
            return Results.Ok(tree);
        })
        .WithName("GetLabelsTree")
        .Produces<List<LabelTreeResponse>>(200)
        .CacheOutput("StaticData");

        // Get single label
        group.MapGet("/{id}", async (string id, ClaimsPrincipal user, ILabelService labelService, CancellationToken ct) =>
        {
            var userId = user.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userId))
            {
                return Results.Unauthorized();
            }

            var label = await labelService.GetByIdAsync(id, userId, ct);
            if (label == null)
            {
                return Results.NotFound(new ErrorResponse("Label not found"));
            }

            return Results.Ok(label);
        })
        .WithName("GetLabel")
        .Produces<LabelResponse>(200)
        .Produces<ErrorResponse>(404);

        // Create label
        group.MapPost("/", async (CreateLabelRequest request, ClaimsPrincipal user, ILabelService labelService, IValidator<CreateLabelRequest> validator, CancellationToken ct) =>
        {
            var validationError = await validator.ValidateAndReturnErrorAsync(request);
            if (validationError != null) return validationError;

            var userId = user.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userId))
            {
                return Results.Unauthorized();
            }

            var result = await labelService.CreateAsync(userId, request, ct);
            return result.ToApiResult(label => Results.Created($"/api/labels/{label.Id}", label));
        })
        .WithName("CreateLabel")
        .Produces<LabelResponse>(201)
        .Produces<ErrorResponse>(400);

        // Update label
        group.MapPut("/{id}", async (string id, UpdateLabelRequest request, ClaimsPrincipal user, ILabelService labelService, IValidator<UpdateLabelRequest> validator, CancellationToken ct) =>
        {
            var validationError = await validator.ValidateAndReturnErrorAsync(request);
            if (validationError != null) return validationError;

            var userId = user.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userId))
            {
                return Results.Unauthorized();
            }

            var result = await labelService.UpdateAsync(id, userId, request, ct);
            return result.ToApiResult();
        })
        .WithName("UpdateLabel")
        .Produces<LabelResponse>(200)
        .Produces<ErrorResponse>(400);

        // Delete label
        group.MapDelete("/{id}", async (string id, ClaimsPrincipal user, ILabelService labelService, CancellationToken ct) =>
        {
            var userId = user.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userId))
            {
                return Results.Unauthorized();
            }

            var result = await labelService.DeleteAsync(id, userId, ct);
            if (result.IsFailure)
                return result.ToApiResult();

            return Results.Ok(new { message = "Label deleted successfully" });
        })
        .WithName("DeleteLabel")
        .Produces(200)
        .Produces<ErrorResponse>(400);

        // Get transaction count for a label
        group.MapGet("/{id}/transaction-count", async (string id, ClaimsPrincipal user, ILabelService labelService, CancellationToken ct) =>
        {
            var userId = user.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userId))
            {
                return Results.Unauthorized();
            }

            var count = await labelService.GetTransactionCountAsync(id, userId, ct);
            return Results.Ok(new { transactionCount = count });
        })
        .WithName("GetLabelTransactionCount")
        .Produces(200);

        // Delete label with reassignment
        group.MapDelete("/{id}/with-reassignment", async (
            string id,
            string? reassignToId,
            ClaimsPrincipal user,
            ILabelService labelService,
            CancellationToken ct) =>
        {
            var userId = user.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userId))
            {
                return Results.Unauthorized();
            }

            var result = await labelService.DeleteWithReassignmentAsync(id, userId, reassignToId, ct);
            return result.ToApiResult(r => Results.Ok(new { r.Message, r.TransactionCount }));
        })
        .WithName("DeleteLabelWithReassignment")
        .Produces(200)
        .Produces(400);

        // Reorder labels
        group.MapPost("/reorder", async (ReorderLabelsRequest request, ClaimsPrincipal user, ILabelService labelService, CancellationToken ct) =>
        {
            var userId = user.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userId))
            {
                return Results.Unauthorized();
            }

            var result = await labelService.ReorderAsync(userId, request, ct);
            if (result.IsFailure)
                return result.ToApiResult();

            return Results.Ok(new { message = "Labels reordered successfully" });
        })
        .WithName("ReorderLabels")
        .Produces(200)
        .Produces<ErrorResponse>(400);
    }
}
