using System.Security.Claims;
using DigiTransac.Api.Common;
using DigiTransac.Api.Extensions;
using DigiTransac.Api.Models.Dto;
using DigiTransac.Api.Services;
using DigiTransac.Api.Validators;
using FluentValidation;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace DigiTransac.Api.Endpoints;

/// <summary>
/// Auth profile endpoints: get current user, delete account, update name, and email change flow.
/// </summary>
public static class AuthProfileEndpoints
{
    public static RouteGroupBuilder MapAuthProfileEndpoints(this RouteGroupBuilder group)
    {
        // Get current user
        group.MapGet("/me", [Authorize] async (ClaimsPrincipal user, IAuthService authService, CancellationToken ct) =>
        {
            if (!user.TryGetUserId(out var userId))
                return Results.Unauthorized();

            var currentUser = await authService.GetCurrentUserAsync(userId, ct);
            if (currentUser == null)
            {
                return Results.NotFound();
            }

            return Results.Ok(new { 
                currentUser.Email, 
                currentUser.FullName, 
                currentUser.IsEmailVerified,
                currentUser.PrimaryCurrency 
            });
        })
        .WithName("GetCurrentUser")
        .WithSummary("Get current user")
        .WithDescription("Returns the authenticated user's profile including email, full name, verification status, and primary currency.")
        .Produces(200)
        .Produces(401);

        // Delete account (requires password confirmation)
        group.MapDelete("/account", [Authorize] async (
            [FromBody] DeleteAccountRequest request, 
            IValidator<DeleteAccountRequest> validator,
            ClaimsPrincipal user, 
            IAuthService authService,
            CancellationToken ct) =>
        {
            if (!user.TryGetUserId(out var userId))
                return Results.Unauthorized();

            var validationError = await validator.ValidateAndReturnErrorAsync(request);
            if (validationError != null) return validationError;

            var result = await authService.DeleteAccountAsync(userId, request.Password, ct);
            
            if (result.IsFailure)
            {
                return result.ToApiResult();
            }

            return Results.Ok(new { message = "Account deleted successfully" });
        })
        .WithName("DeleteAccount")
        .WithSummary("Delete user account")
        .WithDescription("Permanently deletes the user account and all associated data (transactions, accounts, labels, etc.). Requires password confirmation. Operation is transactional.")
        .Produces(200)
        .Produces<ErrorResponse>(400)
        .Produces(401);

        // Update name
        group.MapPut("/profile/name", [Authorize] async (
            [FromBody] UpdateNameRequest request, 
            IValidator<UpdateNameRequest> validator,
            ClaimsPrincipal user, 
            IAuthService authService,
            CancellationToken ct) =>
        {
            if (!user.TryGetUserId(out var userId))
                return Results.Unauthorized();

            var validationError = await validator.ValidateAndReturnErrorAsync(request);
            if (validationError != null) return validationError;

            var result = await authService.UpdateNameAsync(userId, request.FullName, ct);
            
            if (result.IsFailure)
            {
                return result.ToApiResult();
            }

            return Results.Ok(new { message = "Name updated successfully" });
        })
        .WithName("UpdateName")
        .WithSummary("Update display name")
        .WithDescription("Updates the authenticated user's display name.")
        .Produces(200)
        .Produces<ErrorResponse>(400)
        .Produces(401);

        // Send email change verification code
        group.MapPost("/profile/email/send-code", [Authorize] async (
            [FromBody] UpdateEmailRequest request, 
            IValidator<UpdateEmailRequest> validator,
            ClaimsPrincipal user, 
            IAuthService authService,
            CancellationToken ct) =>
        {
            if (!user.TryGetUserId(out var userId))
                return Results.Unauthorized();

            var validationError = await validator.ValidateAndReturnErrorAsync(request);
            if (validationError != null) return validationError;

            var result = await authService.SendEmailChangeCodeAsync(userId, request.NewEmail, ct);
            
            if (result.IsFailure)
            {
                return result.ToApiResult();
            }

            return Results.Ok(new { message = "Verification code sent to your new email address" });
        })
        .WithName("SendEmailChangeCode")
        .WithSummary("Send email change verification")
        .WithDescription("Step 1 of email change: Sends a verification code to the new email address to confirm ownership.")
        .Produces(200)
        .Produces<ErrorResponse>(400)
        .Produces(401);

        // Verify and update email
        group.MapPost("/profile/email/verify", [Authorize] async (
            [FromBody] VerifyEmailChangeRequest request, 
            IValidator<VerifyEmailChangeRequest> validator,
            ClaimsPrincipal user, 
            IAuthService authService,
            CancellationToken ct) =>
        {
            if (!user.TryGetUserId(out var userId))
                return Results.Unauthorized();

            var validationError = await validator.ValidateAndReturnErrorAsync(request);
            if (validationError != null) return validationError;

            var result = await authService.VerifyAndUpdateEmailAsync(userId, request.NewEmail, request.Code, ct);
            
            if (result.IsFailure)
            {
                return result.ToApiResult();
            }

            return Results.Ok(new { message = "Email updated successfully" });
        })
        .WithName("VerifyEmailChange")
        .WithSummary("Verify and update email")
        .WithDescription("Step 2 of email change: Verifies the code and updates the user's email address. Re-encrypts user data with the new identity.")
        .Produces(200)
        .Produces<ErrorResponse>(400)
        .Produces(401);

        return group;
    }
}