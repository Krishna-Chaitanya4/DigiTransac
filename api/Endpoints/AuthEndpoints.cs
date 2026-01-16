using System.Security.Claims;
using DigiTransac.Api.Models.Dto;
using DigiTransac.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace DigiTransac.Api.Endpoints;

public static class AuthEndpoints
{
    public static void MapAuthEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/auth").WithTags("Auth");

        // Step 1: Send verification code to email
        group.MapPost("/send-verification", async (SendVerificationRequest request, IAuthService authService) =>
        {
            if (string.IsNullOrWhiteSpace(request.Email))
            {
                return Results.BadRequest(new ErrorResponse("Email is required"));
            }

            var (success, message) = await authService.SendVerificationCodeAsync(request.Email);
            
            if (!success)
            {
                return Results.BadRequest(new ErrorResponse(message));
            }

            return Results.Ok(new VerificationResponse(message));
        })
        .WithName("SendVerification")
        .Produces<VerificationResponse>(200)
        .Produces<ErrorResponse>(400);

        // Step 2: Verify the code
        group.MapPost("/verify-code", async (VerifyCodeRequest request, IAuthService authService) =>
        {
            if (string.IsNullOrWhiteSpace(request.Email) || string.IsNullOrWhiteSpace(request.Code))
            {
                return Results.BadRequest(new ErrorResponse("Email and code are required"));
            }

            var (success, message, verificationToken) = await authService.VerifyCodeAsync(request.Email, request.Code);
            
            if (!success)
            {
                return Results.BadRequest(new ErrorResponse(message));
            }

            return Results.Ok(new VerificationResponse(message, verificationToken));
        })
        .WithName("VerifyCode")
        .Produces<VerificationResponse>(200)
        .Produces<ErrorResponse>(400);

        // Step 3: Complete registration (after email verified)
        group.MapPost("/complete-registration", async (CompleteRegistrationRequest request, IAuthService authService) =>
        {
            if (string.IsNullOrWhiteSpace(request.Email) ||
                string.IsNullOrWhiteSpace(request.VerificationToken) ||
                string.IsNullOrWhiteSpace(request.Password) ||
                string.IsNullOrWhiteSpace(request.FullName))
            {
                return Results.BadRequest(new ErrorResponse("All fields are required"));
            }

            if (request.Password.Length < 6)
            {
                return Results.BadRequest(new ErrorResponse("Password must be at least 6 characters"));
            }

            var result = await authService.CompleteRegistrationAsync(request);
            if (result == null)
            {
                return Results.BadRequest(new ErrorResponse("Invalid or expired verification token"));
            }

            return Results.Ok(result);
        })
        .WithName("CompleteRegistration")
        .Produces<AuthResponse>(200)
        .Produces<ErrorResponse>(400);

        // Login
        group.MapPost("/login", async (LoginRequest request, IAuthService authService) =>
        {
            if (string.IsNullOrWhiteSpace(request.Email) || string.IsNullOrWhiteSpace(request.Password))
            {
                return Results.BadRequest(new ErrorResponse("Email and password are required"));
            }

            var result = await authService.LoginAsync(request);
            if (result == null)
            {
                return Results.Unauthorized();
            }

            return Results.Ok(result);
        })
        .WithName("Login")
        .Produces<AuthResponse>(200)
        .Produces<ErrorResponse>(400)
        .Produces(401);

        // Refresh access token
        group.MapPost("/refresh-token", async (RefreshTokenRequest request, IAuthService authService) =>
        {
            if (string.IsNullOrWhiteSpace(request.RefreshToken))
            {
                return Results.BadRequest(new ErrorResponse("Refresh token is required"));
            }

            var result = await authService.RefreshTokenAsync(request.RefreshToken);
            if (result == null)
            {
                return Results.Unauthorized();
            }

            return Results.Ok(result);
        })
        .WithName("RefreshToken")
        .Produces<AuthResponse>(200)
        .Produces<ErrorResponse>(400)
        .Produces(401);

        // Revoke refresh token (logout from specific device)
        group.MapPost("/revoke-token", [Authorize] async (RefreshTokenRequest request, IAuthService authService) =>
        {
            if (string.IsNullOrWhiteSpace(request.RefreshToken))
            {
                return Results.BadRequest(new ErrorResponse("Refresh token is required"));
            }

            var revoked = await authService.RevokeTokenAsync(request.RefreshToken);
            if (!revoked)
            {
                return Results.BadRequest(new ErrorResponse("Token not found or already revoked"));
            }

            return Results.Ok(new { message = "Token revoked successfully" });
        })
        .WithName("RevokeToken")
        .Produces(200)
        .Produces<ErrorResponse>(400)
        .Produces(401);

        // Revoke all refresh tokens (logout from all devices)
        group.MapPost("/revoke-all-tokens", [Authorize] async (ClaimsPrincipal user, IAuthService authService) =>
        {
            var userId = user.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (userId == null)
            {
                return Results.Unauthorized();
            }

            await authService.RevokeAllUserTokensAsync(userId);
            return Results.Ok(new { message = "All tokens revoked successfully" });
        })
        .WithName("RevokeAllTokens")
        .Produces(200)
        .Produces(401);

        // Get current user
        group.MapGet("/me", [Authorize] async (ClaimsPrincipal user, IAuthService authService) =>
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

            return Results.Ok(new { currentUser.Email, currentUser.FullName, currentUser.IsEmailVerified });
        })
        .WithName("GetCurrentUser")
        .Produces(200)
        .Produces(401);

        // Delete account (requires password confirmation)
        group.MapDelete("/account", [Authorize] async ([FromBody] DeleteAccountRequest request, ClaimsPrincipal user, IAuthService authService) =>
        {
            var userId = user.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (userId == null)
            {
                return Results.Unauthorized();
            }

            if (string.IsNullOrWhiteSpace(request.Password))
            {
                return Results.BadRequest(new ErrorResponse("Password is required to confirm account deletion"));
            }

            var (success, message) = await authService.DeleteAccountAsync(userId, request.Password);
            
            if (!success)
            {
                return Results.BadRequest(new ErrorResponse(message));
            }

            return Results.Ok(new { message });
        })
        .WithName("DeleteAccount")
        .Produces(200)
        .Produces<ErrorResponse>(400)
        .Produces(401);

        // Forgot password - Step 1: Send reset code
        group.MapPost("/forgot-password", async (ForgotPasswordRequest request, IAuthService authService) =>
        {
            if (string.IsNullOrWhiteSpace(request.Email))
            {
                return Results.BadRequest(new ErrorResponse("Email is required"));
            }

            var (success, message) = await authService.SendPasswordResetCodeAsync(request.Email);
            
            // Always return success to not reveal if email exists
            return Results.Ok(new VerificationResponse(message));
        })
        .WithName("ForgotPassword")
        .Produces<VerificationResponse>(200)
        .Produces<ErrorResponse>(400);

        // Forgot password - Step 2: Verify reset code
        group.MapPost("/verify-reset-code", async (VerifyCodeRequest request, IAuthService authService) =>
        {
            if (string.IsNullOrWhiteSpace(request.Email) || string.IsNullOrWhiteSpace(request.Code))
            {
                return Results.BadRequest(new ErrorResponse("Email and code are required"));
            }

            var (success, message, verificationToken) = await authService.VerifyPasswordResetCodeAsync(request.Email, request.Code);
            
            if (!success)
            {
                return Results.BadRequest(new ErrorResponse(message));
            }

            return Results.Ok(new VerificationResponse(message, verificationToken));
        })
        .WithName("VerifyResetCode")
        .Produces<VerificationResponse>(200)
        .Produces<ErrorResponse>(400);

        // Forgot password - Step 3: Reset password
        group.MapPost("/reset-password", async (ResetPasswordRequest request, IAuthService authService) =>
        {
            if (string.IsNullOrWhiteSpace(request.Email) ||
                string.IsNullOrWhiteSpace(request.VerificationToken) ||
                string.IsNullOrWhiteSpace(request.NewPassword))
            {
                return Results.BadRequest(new ErrorResponse("All fields are required"));
            }

            var (success, message) = await authService.ResetPasswordAsync(request);
            
            if (!success)
            {
                return Results.BadRequest(new ErrorResponse(message));
            }

            return Results.Ok(new { message });
        })
        .WithName("ResetPassword")
        .Produces(200)
        .Produces<ErrorResponse>(400);
    }
}
