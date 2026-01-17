using System.Security.Claims;
using DigiTransac.Api.Models.Dto;
using DigiTransac.Api.Services;

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
        .Produces<List<TagResponse>>(200);

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
        group.MapPost("/", async (CreateTagRequest request, ClaimsPrincipal user, ITagService tagService) =>
        {
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
        group.MapPut("/{id}", async (string id, UpdateTagRequest request, ClaimsPrincipal user, ITagService tagService) =>
        {
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
    }
}
