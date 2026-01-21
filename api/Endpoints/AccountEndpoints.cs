using System.Security.Claims;
using DigiTransac.Api.Models.Dto;
using DigiTransac.Api.Services;

namespace DigiTransac.Api.Endpoints;

public static class AccountEndpoints
{
    public static void MapAccountEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/accounts")
            .WithTags("Accounts")
            .RequireAuthorization();

        // Get all accounts
        group.MapGet("/", async (
            bool? includeArchived, 
            ClaimsPrincipal user, 
            IAccountService accountService) =>
        {
            var userId = user.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userId))
            {
                return Results.Unauthorized();
            }

            var accounts = await accountService.GetAllAsync(userId, includeArchived ?? false);
            return Results.Ok(accounts);
        })
        .WithName("GetAccounts")
        .Produces<List<AccountResponse>>(200);

        // Get account summary (totals, net worth)
        group.MapGet("/summary", async (ClaimsPrincipal user, IAccountService accountService) =>
        {
            var userId = user.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userId))
            {
                return Results.Unauthorized();
            }

            var summary = await accountService.GetSummaryAsync(userId);
            return Results.Ok(summary);
        })
        .WithName("GetAccountSummary")
        .Produces<AccountSummaryResponse>(200);

        // Get single account
        group.MapGet("/{id}", async (
            string id, 
            ClaimsPrincipal user, 
            IAccountService accountService) =>
        {
            var userId = user.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userId))
            {
                return Results.Unauthorized();
            }

            var account = await accountService.GetByIdAsync(id, userId);
            if (account == null)
            {
                return Results.NotFound(new ErrorResponse("Account not found"));
            }

            return Results.Ok(account);
        })
        .WithName("GetAccount")
        .Produces<AccountResponse>(200)
        .Produces<ErrorResponse>(404);

        // Create account
        group.MapPost("/", async (
            CreateAccountRequest request, 
            ClaimsPrincipal user, 
            IAccountService accountService) =>
        {
            var userId = user.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userId))
            {
                return Results.Unauthorized();
            }

            var (success, message, account) = await accountService.CreateAsync(userId, request);
            if (!success)
            {
                return Results.BadRequest(new ErrorResponse(message));
            }

            return Results.Created($"/api/accounts/{account!.Id}", account);
        })
        .WithName("CreateAccount")
        .Produces<AccountResponse>(201)
        .Produces<ErrorResponse>(400);

        // Update account
        group.MapPut("/{id}", async (
            string id, 
            UpdateAccountRequest request, 
            ClaimsPrincipal user, 
            IAccountService accountService) =>
        {
            var userId = user.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userId))
            {
                return Results.Unauthorized();
            }

            var (success, message, account) = await accountService.UpdateAsync(id, userId, request);
            if (!success)
            {
                return Results.BadRequest(new ErrorResponse(message));
            }

            return Results.Ok(account);
        })
        .WithName("UpdateAccount")
        .Produces<AccountResponse>(200)
        .Produces<ErrorResponse>(400);

        // Adjust balance
        group.MapPost("/{id}/adjust-balance", async (string id, AdjustBalanceRequest request, ClaimsPrincipal user, IAccountService accountService) =>
        {
            var userId = user.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userId))
            {
                return Results.Unauthorized();
            }

            var (success, message) = await accountService.AdjustBalanceAsync(id, userId, request);
            if (!success)
            {
                return Results.BadRequest(new ErrorResponse(message));
            }

            return Results.Ok(new { message });
        })
        .WithName("AdjustAccountBalance")
        .Produces(200)
        .Produces<ErrorResponse>(400);

        // Reorder accounts
        group.MapPost("/reorder", async (ReorderAccountsRequest request, ClaimsPrincipal user, IAccountService accountService) =>
        {
            var userId = user.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userId))
            {
                return Results.Unauthorized();
            }

            var (success, message) = await accountService.ReorderAsync(userId, request);
            if (!success)
            {
                return Results.BadRequest(new ErrorResponse(message));
            }

            return Results.Ok(new { message });
        })
        .WithName("ReorderAccounts")
        .Produces(200)
        .Produces<ErrorResponse>(400);

        // Delete account
        group.MapDelete("/{id}", async (string id, ClaimsPrincipal user, IAccountService accountService) =>
        {
            var userId = user.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userId))
            {
                return Results.Unauthorized();
            }

            var (success, message, errorType) = await accountService.DeleteAsync(id, userId);
            if (!success)
            {
                return errorType == "NotFound" 
                    ? Results.NotFound(new ErrorResponse(message))
                    : Results.BadRequest(new ErrorResponse(message));
            }

            return Results.Ok(new { message });
        })
        .WithName("DeleteFinancialAccount")
        .Produces(200)
        .Produces<ErrorResponse>(400)
        .Produces<ErrorResponse>(404);
    }
}
