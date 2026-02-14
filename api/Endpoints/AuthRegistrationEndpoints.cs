using DigiTransac.Api.Common;
using DigiTransac.Api.Models.Dto;
using DigiTransac.Api.Services;
using DigiTransac.Api.Settings;
using DigiTransac.Api.Validators;
using FluentValidation;
using Microsoft.Extensions.Options;

namespace DigiTransac.Api.Endpoints;

/// <summary>
/// Auth registration endpoints: send verification code, verify code, and complete registration.
/// </summary>
public static class AuthRegistrationEndpoints
{
    public static RouteGroupBuilder MapAuthRegistrationEndpoints(this RouteGroupBuilder group)
    {
        // Step 1: Send verification code to email
        group.MapPost("/send-verification", async (
            SendVerificationRequest request, 
            IValidator<SendVerificationRequest> validator,
            IAuthService authService,
            CancellationToken ct) =>
        {
            var validationError = await validator.ValidateAndReturnErrorAsync(request);
            if (validationError != null) return validationError;

            var result = await authService.SendVerificationCodeAsync(request.Email, ct);
            
            if (result.IsFailure)
            {
                return result.ToApiResult();
            }

            return Results.Ok(new VerificationResponse("Verification code sent to your email"));
        })
        .WithName("SendVerification")
        .WithSummary("Send email verification code")
        .WithDescription("Step 1 of registration: Sends a 6-digit verification code to the provided email address. Rate limited to prevent abuse.")
        .Produces<VerificationResponse>(200)
        .Produces<ErrorResponse>(400)
        .RequireRateLimiting("auth");

        // Step 2: Verify the code
        group.MapPost("/verify-code", async (
            VerifyCodeRequest request, 
            IValidator<VerifyCodeRequest> validator,
            IAuthService authService,
            CancellationToken ct) =>
        {
            var validationError = await validator.ValidateAndReturnErrorAsync(request);
            if (validationError != null) return validationError;

            var result = await authService.VerifyCodeAsync(request.Email, request.Code, ct);
            
            if (result.IsFailure)
            {
                return result.ToApiResult();
            }

            return Results.Ok(new VerificationResponse("Email verified successfully", result.Value));
        })
        .WithName("VerifyCode")
        .WithSummary("Verify email code")
        .WithDescription("Step 2 of registration: Verifies the 6-digit code sent to email. Returns a verification token needed for completing registration.")
        .Produces<VerificationResponse>(200)
        .Produces<ErrorResponse>(400)
        .RequireRateLimiting("auth");

        // Step 3: Complete registration (after email verified)
        group.MapPost("/complete-registration", async (
            CompleteRegistrationRequest request,
            IValidator<CompleteRegistrationRequest> validator,
            IAuthService authService,
            ICookieService cookieService,
            IOptions<JwtSettings> jwtSettings,
            HttpContext httpContext,
            CancellationToken ct) =>
        {
            var validationError = await validator.ValidateAndReturnErrorAsync(request);
            if (validationError != null) return validationError;

            var result = await authService.CompleteRegistrationAsync(request, ct);
            if (result == null)
            {
                return Results.BadRequest(new ErrorResponse("Invalid or expired verification token"));
            }

            // Set refresh token as HttpOnly cookie
            cookieService.SetRefreshTokenCookie(httpContext, result.RefreshToken, jwtSettings.Value.RefreshTokenExpireDays);

            // Return response without refresh token (it's in the cookie)
            return Results.Ok(new AuthResponseWithoutRefresh(
                result.AccessToken, 
                result.Email, 
                result.FullName, 
                result.IsEmailVerified,
                result.PrimaryCurrency));
        })
        .WithName("CompleteRegistration")
        .WithSummary("Complete registration")
        .WithDescription("Step 3 of registration: Creates the user account with full name, password, and currency. Requires a valid verification token. Sets refresh token as HttpOnly cookie.")
        .Produces<AuthResponseWithoutRefresh>(200)
        .Produces<ErrorResponse>(400)
        .RequireRateLimiting("auth");

        return group;
    }
}