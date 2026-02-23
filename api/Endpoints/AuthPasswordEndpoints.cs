using System.Security.Claims;
using DigiTransac.Api.Common;
using DigiTransac.Api.Extensions;
using DigiTransac.Api.Models.Dto;
using DigiTransac.Api.Services;
using DigiTransac.Api.Validators;
using FluentValidation;
using Microsoft.AspNetCore.Authorization;

namespace DigiTransac.Api.Endpoints;

/// <summary>
/// Auth password endpoints: forgot password flow (send code, verify, reset) and change password.
/// </summary>
public static class AuthPasswordEndpoints
{
    public static RouteGroupBuilder MapAuthPasswordEndpoints(this RouteGroupBuilder group)
    {
        // Forgot password - Step 1: Send reset code
        group.MapPost("/forgot-password", async (
            ForgotPasswordRequest request, 
            IValidator<ForgotPasswordRequest> validator,
            IAuthService authService,
            CancellationToken ct) =>
        {
            var validationError = await validator.ValidateAndReturnErrorAsync(request);
            if (validationError != null) return validationError;

            var result = await authService.SendPasswordResetCodeAsync(request.Email, ct);

            // Always return generic success to prevent email enumeration,
            // regardless of whether the service call succeeded or found the email
            if (result.IsFailure)
            {
                // Log for server-side diagnostics but never reveal to client
            }

            return Results.Ok(new VerificationResponse("If an account with that email exists, a reset code has been sent"));
        })
        .WithName("ForgotPassword")
        .WithSummary("Forgot password")
        .WithDescription("Step 1 of password reset: Sends a reset code to the email. Always returns success to prevent email enumeration.")
        .Produces<VerificationResponse>(200)
        .Produces<ErrorResponse>(400)
        .RequireRateLimiting("sensitive");

        // Forgot password - Step 2: Verify reset code
        group.MapPost("/verify-reset-code", async (
            VerifyCodeRequest request, 
            IValidator<VerifyCodeRequest> validator,
            IAuthService authService,
            CancellationToken ct) =>
        {
            var validationError = await validator.ValidateAndReturnErrorAsync(request);
            if (validationError != null) return validationError;

            var result = await authService.VerifyPasswordResetCodeAsync(request.Email, request.Code, ct);
            
            if (result.IsFailure)
            {
                return result.ToApiResult();
            }

            return Results.Ok(new VerificationResponse("Code verified successfully", result.Value));
        })
        .WithName("VerifyResetCode")
        .WithSummary("Verify password reset code")
        .WithDescription("Step 2 of password reset: Verifies the reset code. Returns a reset token needed for step 3.")
        .Produces<VerificationResponse>(200)
        .Produces<ErrorResponse>(400)
        .RequireRateLimiting("sensitive");

        // Forgot password - Step 3: Reset password
        group.MapPost("/reset-password", async (
            ResetPasswordRequest request, 
            IValidator<ResetPasswordRequest> validator,
            IAuthService authService,
            CancellationToken ct) =>
        {
            var validationError = await validator.ValidateAndReturnErrorAsync(request);
            if (validationError != null) return validationError;

            var result = await authService.ResetPasswordAsync(request, ct);
            
            if (result.IsFailure)
            {
                return result.ToApiResult();
            }

            return Results.Ok(new { message = "Password reset successfully" });
        })
        .WithName("ResetPassword")
        .WithSummary("Reset password")
        .WithDescription("Step 3 of password reset: Sets a new password using the reset token from step 2. Re-encrypts all user data with new credentials.")
        .Produces(200)
        .Produces<ErrorResponse>(400)
        .RequireRateLimiting("sensitive");

        // Change password (while logged in - preserves all encrypted data)
        group.MapPost("/change-password", [Authorize] async (
            ChangePasswordRequest request,
            IValidator<ChangePasswordRequest> validator,
            ClaimsPrincipal user,
            IAuthService authService,
            CancellationToken ct) =>
        {
            if (!user.TryGetUserId(out var userId))
                return Results.Unauthorized();

            var validationError = await validator.ValidateAndReturnErrorAsync(request);
            if (validationError != null) return validationError;

            var result = await authService.ChangePasswordAsync(userId, request.CurrentPassword, request.NewPassword, ct);
            
            if (result.IsFailure)
            {
                return result.ToApiResult();
            }

            return Results.Ok(new { message = "Password changed successfully" });
        })
        .WithName("ChangePassword")
        .WithSummary("Change password")
        .WithDescription("Changes password while logged in. Requires current password for verification. Preserves all encrypted data by re-wrapping the DEK.")
        .Produces(200)
        .Produces<ErrorResponse>(400)
        .Produces(401);

        return group;
    }
}