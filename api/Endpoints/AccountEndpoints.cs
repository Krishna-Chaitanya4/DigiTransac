using System.Security.Claims;
using FluentValidation;
using DigiTransac.Api.Common;
using DigiTransac.Api.Models.Dto;
using DigiTransac.Api.Services;
using DigiTransac.Api.Validators;
using Microsoft.AspNetCore.Http;

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
            IAccountService accountService,
            HttpContext httpContext,
            CancellationToken ct) =>
        {
            var userId = user.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userId))
            {
                return Results.Unauthorized();
            }

            var accounts = await accountService.GetAllAsync(userId, includeArchived ?? false, ct);
            return ETagHelper.OkWithETag(httpContext, accounts);
        })
        .WithName("GetAccounts")
        .WithSummary("Get all accounts")
        .WithDescription("Returns all financial accounts for the authenticated user. Optionally includes archived accounts.")
        .Produces<List<AccountResponse>>(200);

        // Get account summary (totals, net worth)
        group.MapGet("/summary", async (ClaimsPrincipal user, IAccountService accountService, CancellationToken ct) =>
        {
            var userId = user.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userId))
            {
                return Results.Unauthorized();
            }

            var summary = await accountService.GetSummaryAsync(userId, ct);
            return Results.Ok(summary);
        })
        .WithName("GetAccountSummary")
        .WithSummary("Get account summary")
        .WithDescription("Returns aggregated account totals by type (asset/liability), net worth calculation, and multi-currency breakdown.")
        .Produces<AccountSummaryResponse>(200)
        .CacheOutput("AccountSummary");

        // Get single account
        group.MapGet("/{id}", async (
            string id,
            ClaimsPrincipal user,
            IAccountService accountService,
            CancellationToken ct) =>
        {
            var userId = user.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userId))
            {
                return Results.Unauthorized();
            }

            var account = await accountService.GetByIdAsync(id, userId, ct);
            if (account == null)
            {
                return Results.NotFound(new ErrorResponse("Account not found"));
            }

            return Results.Ok(account);
        })
        .WithName("GetAccount")
        .WithSummary("Get account by ID")
        .WithDescription("Returns a single financial account by its ID. Only returns accounts owned by the authenticated user.")
        .Produces<AccountResponse>(200)
        .Produces<ErrorResponse>(404);

        // Create account
        group.MapPost("/", async (
            CreateAccountRequest request,
            ClaimsPrincipal user,
            IAccountService accountService,
            IValidator<CreateAccountRequest> validator,
            CancellationToken ct) =>
        {
            var validationError = await validator.ValidateAndReturnErrorAsync(request);
            if (validationError != null) return validationError;

            var userId = user.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userId))
            {
                return Results.Unauthorized();
            }

            var result = await accountService.CreateAsync(userId, request, ct);
            return result.ToApiResult(account => Results.Created($"/api/accounts/{account.Id}", account));
        })
        .WithName("CreateAccount")
        .WithSummary("Create an account")
        .WithDescription("Creates a new financial account (bank, credit card, cash, etc.) with initial balance and currency.")
        .Produces<AccountResponse>(201)
        .Produces<ErrorResponse>(400);

        // Update account
        group.MapPut("/{id}", async (
            string id,
            UpdateAccountRequest request,
            ClaimsPrincipal user,
            IAccountService accountService,
            IValidator<UpdateAccountRequest> validator,
            CancellationToken ct) =>
        {
            var validationError = await validator.ValidateAndReturnErrorAsync(request);
            if (validationError != null) return validationError;

            var userId = user.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userId))
            {
                return Results.Unauthorized();
            }

            var result = await accountService.UpdateAsync(id, userId, request, ct);
            return result.ToApiResult();
        })
        .WithName("UpdateAccount")
        .WithSummary("Update an account")
        .WithDescription("Updates account details such as name, icon, color, or archived status.")
        .Produces<AccountResponse>(200)
        .Produces<ErrorResponse>(400);

        // Adjust balance
        group.MapPost("/{id}/adjust-balance", async (string id, AdjustBalanceRequest request, ClaimsPrincipal user, IAccountService accountService, IValidator<AdjustBalanceRequest> validator, CancellationToken ct) =>
        {
            var validationError = await validator.ValidateAndReturnErrorAsync(request);
            if (validationError != null) return validationError;

            var userId = user.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userId))
            {
                return Results.Unauthorized();
            }

            var result = await accountService.AdjustBalanceAsync(id, userId, request, ct);
            if (result.IsFailure)
                return result.ToApiResult();

            return Results.Ok(new { message = "Balance adjusted successfully" });
        })
        .WithName("AdjustAccountBalance")
        .WithSummary("Adjust account balance")
        .WithDescription("Manually adjusts the account balance to a target amount. Creates an audit trail transaction and records the adjustment in Personal chat.")
        .Produces(200)
        .Produces<ErrorResponse>(400);

        // Reorder accounts
        group.MapPost("/reorder", async (ReorderAccountsRequest request, ClaimsPrincipal user, IAccountService accountService, IValidator<ReorderAccountsRequest> validator, CancellationToken ct) =>
        {
            var validationError = await validator.ValidateAndReturnErrorAsync(request);
            if (validationError != null) return validationError;

            var userId = user.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userId))
            {
                return Results.Unauthorized();
            }

            var result = await accountService.ReorderAsync(userId, request, ct);
            if (result.IsFailure)
                return result.ToApiResult();

            return Results.Ok(new { message = "Accounts reordered successfully" });
        })
        .WithName("ReorderAccounts")
        .WithSummary("Reorder accounts")
        .WithDescription("Updates the display order of accounts by providing a list of account IDs in the desired sequence.")
        .Produces(200)
        .Produces<ErrorResponse>(400);

        // Set default account
        group.MapPost("/{id}/set-default", async (string id, ClaimsPrincipal user, IAccountService accountService, CancellationToken ct) =>
        {
            var userId = user.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userId))
            {
                return Results.Unauthorized();
            }

            var result = await accountService.SetDefaultAsync(id, userId, ct);
            if (result.IsFailure)
                return result.ToApiResult();

            return Results.Ok(new { message = "Default account set successfully" });
        })
        .WithName("SetDefaultAccount")
        .WithSummary("Set default account")
        .WithDescription("Sets the specified account as the default for new transactions.")
        .Produces(200)
        .Produces<ErrorResponse>(400);

        // Delete account
        group.MapDelete("/{id}", async (string id, ClaimsPrincipal user, IAccountService accountService, CancellationToken ct) =>
        {
            var userId = user.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userId))
            {
                return Results.Unauthorized();
            }

            var result = await accountService.DeleteAsync(id, userId, ct);
            if (result.IsFailure)
                return result.ToApiResult();

            return Results.Ok(new { message = "Account deleted successfully" });
        })
        .WithName("DeleteFinancialAccount")
        .WithSummary("Delete an account")
        .WithDescription("Deletes a financial account. Fails if the account has associated transactions (must delete transactions first).")
        .Produces(200)
        .Produces<ErrorResponse>(400)
        .Produces<ErrorResponse>(404);
    }
}
