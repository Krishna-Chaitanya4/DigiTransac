using System.Security.Claims;
using DigiTransac.Api.Models.Dto;
using DigiTransac.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

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
        group.MapPost("/enable", [Authorize] async ([FromBody] EnableTwoFactorRequest request, ClaimsPrincipal user, ITwoFactorService twoFactorService) =>
        {
            var userId = user.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (userId == null)
            {
                return Results.Unauthorized();
            }

            if (string.IsNullOrWhiteSpace(request.Code))
            {
                return Results.BadRequest(new ErrorResponse("Verification code is required"));
            }

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
        group.MapPost("/disable", [Authorize] async ([FromBody] DisableTwoFactorRequest request, ClaimsPrincipal user, ITwoFactorService twoFactorService) =>
        {
            var userId = user.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (userId == null)
            {
                return Results.Unauthorized();
            }

            if (string.IsNullOrWhiteSpace(request.Password))
            {
                return Results.BadRequest(new ErrorResponse("Password is required to disable two-factor authentication"));
            }

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
        group.MapPost("/verify", async ([FromBody] TwoFactorLoginRequest request, IAuthService authService) =>
        {
            if (string.IsNullOrWhiteSpace(request.TwoFactorToken) || string.IsNullOrWhiteSpace(request.Code))
            {
                return Results.BadRequest(new ErrorResponse("Two-factor token and code are required"));
            }

            var result = await authService.VerifyTwoFactorLoginAsync(request.TwoFactorToken, request.Code);
            
            if (result == null)
            {
                return Results.BadRequest(new ErrorResponse("Invalid or expired verification code"));
            }

            return Results.Ok(result);
        })
        .WithName("VerifyTwoFactorLogin")
        .Produces<AuthResponse>(200)
        .Produces<ErrorResponse>(400);

        // Send email OTP as backup for 2FA
        group.MapPost("/send-email-code", async ([FromBody] SendTwoFactorEmailOtpRequest request, IAuthService authService) =>
        {
            if (string.IsNullOrWhiteSpace(request.TwoFactorToken))
            {
                return Results.BadRequest(new ErrorResponse("Two-factor token is required"));
            }

            var (success, message) = await authService.SendTwoFactorEmailOtpAsync(request.TwoFactorToken);
            
            if (!success)
            {
                return Results.BadRequest(new ErrorResponse(message));
            }

            return Results.Ok(new { message });
        })
        .WithName("SendTwoFactorEmailOtp")
        .Produces(200)
        .Produces<ErrorResponse>(400);

        // Verify email OTP for 2FA login
        group.MapPost("/verify-email-code", async ([FromBody] TwoFactorEmailOtpLoginRequest request, IAuthService authService) =>
        {
            if (string.IsNullOrWhiteSpace(request.TwoFactorToken) || string.IsNullOrWhiteSpace(request.EmailCode))
            {
                return Results.BadRequest(new ErrorResponse("Two-factor token and email code are required"));
            }

            var result = await authService.VerifyTwoFactorEmailOtpAsync(request.TwoFactorToken, request.EmailCode);
            
            if (result == null)
            {
                return Results.BadRequest(new ErrorResponse("Invalid or expired verification code"));
            }

            return Results.Ok(result);
        })
        .WithName("VerifyTwoFactorEmailOtp")
        .Produces<AuthResponse>(200)
        .Produces<ErrorResponse>(400);
    }
}
