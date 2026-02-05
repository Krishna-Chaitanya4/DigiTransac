using System.Security.Claims;
using DigiTransac.Api.Models.Dto;
using DigiTransac.Api.Services;
using DigiTransac.Api.Settings;
using DigiTransac.Api.Validators;
using FluentValidation;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;

namespace DigiTransac.Api.Endpoints;

public static class TwoFactorEndpoints
{
    public static void MapTwoFactorEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/auth/2fa").WithTags("Two-Factor Authentication");

        // Get 2FA status
        group.MapGet("/status", [Authorize] async (ClaimsPrincipal user, ITwoFactorService twoFactorService, IAuthService authService) =>
        {
            var userId = user.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (userId == null)
            {
                return Results.Unauthorized();
            }

            var currentUser = await authService.GetCurrentUserAsync(userId);
            if (currentUser == null)
            {
                return Results.NotFound();
            }

            return Results.Ok(new TwoFactorStatusResponse(currentUser.TwoFactorEnabled));
        })
        .WithName("GetTwoFactorStatus")
        .Produces<TwoFactorStatusResponse>(200)
        .Produces(401);

        // Generate 2FA setup (QR code, secret)
        group.MapPost("/setup", [Authorize] async (ClaimsPrincipal user, ITwoFactorService twoFactorService) =>
        {
            var userId = user.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (userId == null)
            {
                return Results.Unauthorized();
            }

            try
            {
                var setupInfo = await twoFactorService.GenerateSetupInfoAsync(userId);
                return Results.Ok(new TwoFactorSetupResponse(
                    setupInfo.Secret,
                    setupInfo.QrCodeUri,
                    setupInfo.ManualEntryKey
                ));
            }
            catch (InvalidOperationException ex)
            {
                return Results.BadRequest(new ErrorResponse(ex.Message));
            }
        })
        .WithName("SetupTwoFactor")
        .Produces<TwoFactorSetupResponse>(200)
        .Produces<ErrorResponse>(400)
        .Produces(401);

        // Enable 2FA (verify code and activate)
        group.MapPost("/enable", [Authorize] async (
            [FromBody] EnableTwoFactorRequest request, 
            IValidator<EnableTwoFactorRequest> validator,
            ClaimsPrincipal user, 
            ITwoFactorService twoFactorService) =>
        {
            var userId = user.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (userId == null)
            {
                return Results.Unauthorized();
            }

            var validationError = await validator.ValidateAndReturnErrorAsync(request);
            if (validationError != null) return validationError;

            var (success, message) = await twoFactorService.EnableTwoFactorAsync(userId, request.Code);
            
            if (!success)
            {
                return Results.BadRequest(new ErrorResponse(message));
            }

            return Results.Ok(new { message });
        })
        .WithName("EnableTwoFactor")
        .Produces(200)
        .Produces<ErrorResponse>(400)
        .Produces(401);

        // Disable 2FA (requires password)
        group.MapPost("/disable", [Authorize] async (
            [FromBody] DisableTwoFactorRequest request, 
            IValidator<DisableTwoFactorRequest> validator,
            ClaimsPrincipal user, 
            ITwoFactorService twoFactorService) =>
        {
            var userId = user.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (userId == null)
            {
                return Results.Unauthorized();
            }

            var validationError = await validator.ValidateAndReturnErrorAsync(request);
            if (validationError != null) return validationError;

            var (success, message) = await twoFactorService.DisableTwoFactorAsync(userId, request.Password);
            
            if (!success)
            {
                return Results.BadRequest(new ErrorResponse(message));
            }

            return Results.Ok(new { message });
        })
        .WithName("DisableTwoFactor")
        .Produces(200)
        .Produces<ErrorResponse>(400)
        .Produces(401);

        // Verify 2FA during login
        group.MapPost("/verify", async (
            [FromBody] TwoFactorLoginRequest request,
            IValidator<TwoFactorLoginRequest> validator,
            IAuthService authService,
            ICookieService cookieService,
            IOptions<JwtSettings> jwtSettings,
            HttpContext httpContext) =>
        {
            var validationError = await validator.ValidateAndReturnErrorAsync(request);
            if (validationError != null) return validationError;

            var result = await authService.VerifyTwoFactorLoginAsync(request.TwoFactorToken, request.Code);
            
            if (result == null)
            {
                return Results.BadRequest(new ErrorResponse("Invalid or expired verification code"));
            }

            // Set refresh token as HttpOnly cookie
            cookieService.SetRefreshTokenCookie(httpContext, result.RefreshToken, jwtSettings.Value.RefreshTokenExpireDays);

            return Results.Ok(new AuthResponseWithoutRefresh(
                result.AccessToken,
                result.Email,
                result.FullName,
                result.IsEmailVerified,
                result.PrimaryCurrency));
        })
        .WithName("VerifyTwoFactorLogin")
        .Produces<AuthResponseWithoutRefresh>(200)
        .Produces<ErrorResponse>(400)
        .RequireRateLimiting("sensitive");

        // Send email OTP as backup for 2FA
        group.MapPost("/send-email-code", async (
            [FromBody] SendTwoFactorEmailOtpRequest request, 
            IValidator<SendTwoFactorEmailOtpRequest> validator,
            IAuthService authService) =>
        {
            var validationError = await validator.ValidateAndReturnErrorAsync(request);
            if (validationError != null) return validationError;

            var (success, message) = await authService.SendTwoFactorEmailOtpAsync(request.TwoFactorToken);
            
            if (!success)
            {
                return Results.BadRequest(new ErrorResponse(message));
            }

            return Results.Ok(new { message });
        })
        .WithName("SendTwoFactorEmailOtp")
        .Produces(200)
        .Produces<ErrorResponse>(400)
        .RequireRateLimiting("sensitive");

        // Verify email OTP for 2FA login
        group.MapPost("/verify-email-code", async (
            [FromBody] TwoFactorEmailOtpLoginRequest request,
            IValidator<TwoFactorEmailOtpLoginRequest> validator,
            IAuthService authService,
            ICookieService cookieService,
            IOptions<JwtSettings> jwtSettings,
            HttpContext httpContext) =>
        {
            var validationError = await validator.ValidateAndReturnErrorAsync(request);
            if (validationError != null) return validationError;

            var result = await authService.VerifyTwoFactorEmailOtpAsync(request.TwoFactorToken, request.EmailCode);
            
            if (result == null)
            {
                return Results.BadRequest(new ErrorResponse("Invalid or expired verification code"));
            }

            // Set refresh token as HttpOnly cookie
            cookieService.SetRefreshTokenCookie(httpContext, result.RefreshToken, jwtSettings.Value.RefreshTokenExpireDays);

            return Results.Ok(new AuthResponseWithoutRefresh(
                result.AccessToken,
                result.Email,
                result.FullName,
                result.IsEmailVerified,
                result.PrimaryCurrency));
        })
        .WithName("VerifyTwoFactorEmailOtp")
        .Produces<AuthResponseWithoutRefresh>(200)
        .Produces<ErrorResponse>(400)
        .RequireRateLimiting("sensitive");
    }
}
