using System.Security.Claims;
using FluentValidation;
using DigiTransac.Api.Models.Dto;
using DigiTransac.Api.Services;
using DigiTransac.Api.Validators;

namespace DigiTransac.Api.Endpoints;

public static class TagEndpoints
{
    public static void MapTagEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/tags")
            .WithTags("Tags")
            .RequireAuthorization();

        // Get all tags
        group.MapGet("/", async (ClaimsPrincipal user, ITagService tagService) =>
        {
            var userId = user.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userId))
            {
                return Results.Unauthorized();
            }

            var tags = await tagService.GetAllAsync(userId);
            return Results.Ok(tags);
        })
        .WithName("GetTags")
        .Produces<List<TagResponse>>(200)
        .CacheOutput("StaticData");

        // Get single tag
        group.MapGet("/{id}", async (string id, ClaimsPrincipal user, ITagService tagService) =>
        {
            var userId = user.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userId))
            {
                return Results.Unauthorized();
            }

            var tag = await tagService.GetByIdAsync(id, userId);
            if (tag == null)
            {
                return Results.NotFound(new ErrorResponse("Tag not found"));
            }

            return Results.Ok(tag);
        })
        .WithName("GetTag")
        .Produces<TagResponse>(200)
        .Produces<ErrorResponse>(404);

        // Create tag
        group.MapPost("/", async (CreateTagRequest request, ClaimsPrincipal user, ITagService tagService, IValidator<CreateTagRequest> validator) =>
        {
            var validationError = await validator.ValidateAndReturnErrorAsync(request);
            if (validationError != null) return validationError;

            var userId = user.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userId))
            {
                return Results.Unauthorized();
            }

            var (success, message, tag) = await tagService.CreateAsync(userId, request);
            if (!success)
            {
                return Results.BadRequest(new ErrorResponse(message));
            }

            return Results.Created($"/api/tags/{tag!.Id}", tag);
        })
        .WithName("CreateTag")
        .Produces<TagResponse>(201)
        .Produces<ErrorResponse>(400);

        // Update tag
        group.MapPut("/{id}", async (string id, UpdateTagRequest request, ClaimsPrincipal user, ITagService tagService, IValidator<UpdateTagRequest> validator) =>
        {
            var validationError = await validator.ValidateAndReturnErrorAsync(request);
            if (validationError != null) return validationError;

            var userId = user.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userId))
            {
                return Results.Unauthorized();
            }

            var (success, message, tag) = await tagService.UpdateAsync(id, userId, request);
            if (!success)
            {
                return Results.BadRequest(new ErrorResponse(message));
            }

            return Results.Ok(tag);
        })
        .WithName("UpdateTag")
        .Produces<TagResponse>(200)
        .Produces<ErrorResponse>(400);

        // Delete tag
        group.MapDelete("/{id}", async (string id, ClaimsPrincipal user, ITagService tagService) =>
        {
            var userId = user.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userId))
            {
                return Results.Unauthorized();
            }

            var (success, message) = await tagService.DeleteAsync(id, userId);
            if (!success)
            {
                return Results.BadRequest(new ErrorResponse(message));
            }

            return Results.Ok(new { message });
        })
        .WithName("DeleteTag")
        .Produces(200)
        .Produces<ErrorResponse>(400);

        // Get transaction count for a tag
        group.MapGet("/{id}/transaction-count", async (string id, ClaimsPrincipal user, ITagService tagService) =>
        {
            var userId = user.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userId))
            {
                return Results.Unauthorized();
            }

            var count = await tagService.GetTransactionCountAsync(id, userId);
            return Results.Ok(new { transactionCount = count });
        })
        .WithName("GetTagTransactionCount")
        .Produces(200);

        // Delete tag with confirmation (removes from all transactions)
        group.MapDelete("/{id}/confirmed", async (string id, ClaimsPrincipal user, ITagService tagService) =>
        {
            var userId = user.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userId))
            {
                return Results.Unauthorized();
            }

            var (success, message, transactionCount) = await tagService.DeleteWithConfirmationAsync(id, userId, confirmed: true);
            if (!success)
            {
                return Results.BadRequest(new { message, transactionCount });
            }

            return Results.Ok(new { message, transactionCount });
        })
        .WithName("DeleteTagConfirmed")
        .Produces(200)
        .Produces(400);
    }
}
