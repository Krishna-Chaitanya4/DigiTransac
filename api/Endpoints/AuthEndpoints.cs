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

public static class AuthEndpoints
{
    public static void MapAuthEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/auth").WithTags("Auth");

        // Step 1: Send verification code to email
        group.MapPost("/send-verification", async (
            SendVerificationRequest request, 
            IValidator<SendVerificationRequest> validator,
            IAuthService authService) =>
        {
            var validationError = await validator.ValidateAndReturnErrorAsync(request);
            if (validationError != null) return validationError;

            var (success, message) = await authService.SendVerificationCodeAsync(request.Email);
            
            if (!success)
            {
                return Results.BadRequest(new ErrorResponse(message));
            }

            return Results.Ok(new VerificationResponse(message));
        })
        .WithName("SendVerification")
        .Produces<VerificationResponse>(200)
        .Produces<ErrorResponse>(400)
        .RequireRateLimiting("auth");

        // Step 2: Verify the code
        group.MapPost("/verify-code", async (
            VerifyCodeRequest request, 
            IValidator<VerifyCodeRequest> validator,
            IAuthService authService) =>
        {
            var validationError = await validator.ValidateAndReturnErrorAsync(request);
            if (validationError != null) return validationError;

            var (success, message, verificationToken) = await authService.VerifyCodeAsync(request.Email, request.Code);
            
            if (!success)
            {
                return Results.BadRequest(new ErrorResponse(message));
            }

            return Results.Ok(new VerificationResponse(message, verificationToken));
        })
        .WithName("VerifyCode")
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
            HttpContext httpContext) =>
        {
            var validationError = await validator.ValidateAndReturnErrorAsync(request);
            if (validationError != null) return validationError;

            var result = await authService.CompleteRegistrationAsync(request);
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
        .Produces<AuthResponseWithoutRefresh>(200)
        .Produces<ErrorResponse>(400)
        .RequireRateLimiting("auth");

        // Login
        group.MapPost("/login", async (
            LoginRequest request,
            IValidator<LoginRequest> validator,
            IAuthService authService,
            ICookieService cookieService,
            IOptions<JwtSettings> jwtSettings,
            HttpContext httpContext) =>
        {
            var validationError = await validator.ValidateAndReturnErrorAsync(request);
            if (validationError != null) return validationError;

            var result = await authService.LoginAsync(request);
            
            // Check if credentials were invalid
            if (result.AccessToken == null && !result.RequiresTwoFactor)
            {
                return Results.Unauthorized();
            }

            // If 2FA is required, don't set cookie yet
            if (result.RequiresTwoFactor)
            {
                return Results.Ok(new LoginResponseWithoutRefresh(
                    null, null, null, null,
                    RequiresTwoFactor: true,
                    TwoFactorToken: result.TwoFactorToken));
            }

            // Set refresh token as HttpOnly cookie
            if (result.RefreshToken != null)
            {
                cookieService.SetRefreshTokenCookie(httpContext, result.RefreshToken, jwtSettings.Value.RefreshTokenExpireDays);
            }

            return Results.Ok(new LoginResponseWithoutRefresh(
                result.AccessToken,
                result.Email,
                result.FullName,
                result.IsEmailVerified,
                result.PrimaryCurrency));
        })
        .WithName("Login")
        .Produces<LoginResponseWithoutRefresh>(200)
        .Produces<ErrorResponse>(400)
        .Produces(401)
        .RequireRateLimiting("auth");

        // Refresh access token (reads refresh token from HttpOnly cookie)
        group.MapPost("/refresh-token", async (
            RefreshTokenRequest? request,
            IAuthService authService,
            ICookieService cookieService,
            IOptions<JwtSettings> jwtSettings,
            HttpContext httpContext) =>
        {
            // Try to get refresh token from cookie first, then from request body (for backward compatibility)
            var refreshToken = cookieService.GetRefreshTokenFromCookie(httpContext) ?? request?.RefreshToken;
            
            if (string.IsNullOrWhiteSpace(refreshToken))
            {
                return Results.BadRequest(new ErrorResponse("Refresh token is required"));
            }

            var result = await authService.RefreshTokenAsync(refreshToken);
            if (result == null)
            {
                // Clear the invalid cookies
                cookieService.ClearRefreshTokenCookie(httpContext);
                return Results.Unauthorized();
            }

            // Set new refresh token as HttpOnly cookie
            cookieService.SetRefreshTokenCookie(httpContext, result.RefreshToken, jwtSettings.Value.RefreshTokenExpireDays);

            return Results.Ok(new AuthResponseWithoutRefresh(
                result.AccessToken,
                result.Email,
                result.FullName,
                result.IsEmailVerified,
                result.PrimaryCurrency));
        })
        .WithName("RefreshToken")
        .Produces<AuthResponseWithoutRefresh>(200)
        .Produces<ErrorResponse>(400)
        .Produces(401);

        // Revoke refresh token (logout from specific device)
        group.MapPost("/revoke-token", [Authorize] async (
            RefreshTokenRequest? request, 
            IAuthService authService,
            ICookieService cookieService,
            HttpContext httpContext) =>
        {
            // Try to get refresh token from cookie first, then from request body
            var refreshToken = cookieService.GetRefreshTokenFromCookie(httpContext) ?? request?.RefreshToken;
            
            if (string.IsNullOrWhiteSpace(refreshToken))
            {
                return Results.BadRequest(new ErrorResponse("Refresh token is required"));
            }

            var revoked = await authService.RevokeTokenAsync(refreshToken);
            
            // Always clear the cookies on logout attempt
            cookieService.ClearRefreshTokenCookie(httpContext);
            
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
        group.MapPost("/revoke-all-tokens", [Authorize] async (
            ClaimsPrincipal user, 
            IAuthService authService,
            ICookieService cookieService,
            HttpContext httpContext) =>
        {
            var userId = user.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (userId == null)
            {
                return Results.Unauthorized();
            }

            await authService.RevokeAllUserTokensAsync(userId);
            
            // Clear the cookies on current device
            cookieService.ClearRefreshTokenCookie(httpContext);
            
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

            return Results.Ok(new { 
                currentUser.Email, 
                currentUser.FullName, 
                currentUser.IsEmailVerified,
                currentUser.PrimaryCurrency 
            });
        })
        .WithName("GetCurrentUser")
        .Produces(200)
        .Produces(401);

        // Delete account (requires password confirmation)
        group.MapDelete("/account", [Authorize] async (
            [FromBody] DeleteAccountRequest request, 
            IValidator<DeleteAccountRequest> validator,
            ClaimsPrincipal user, 
            IAuthService authService) =>
        {
            var userId = user.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (userId == null)
            {
                return Results.Unauthorized();
            }

            var validationError = await validator.ValidateAndReturnErrorAsync(request);
            if (validationError != null) return validationError;

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

        // Update name
        group.MapPut("/profile/name", [Authorize] async (
            [FromBody] UpdateNameRequest request, 
            IValidator<UpdateNameRequest> validator,
            ClaimsPrincipal user, 
            IAuthService authService) =>
        {
            var userId = user.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (userId == null)
            {
                return Results.Unauthorized();
            }

            var validationError = await validator.ValidateAndReturnErrorAsync(request);
            if (validationError != null) return validationError;

            var (success, message) = await authService.UpdateNameAsync(userId, request.FullName);
            
            if (!success)
            {
                return Results.BadRequest(new ErrorResponse(message));
            }

            return Results.Ok(new { message });
        })
        .WithName("UpdateName")
        .Produces(200)
        .Produces<ErrorResponse>(400)
        .Produces(401);

        // Send email change verification code
        group.MapPost("/profile/email/send-code", [Authorize] async (
            [FromBody] UpdateEmailRequest request, 
            IValidator<UpdateEmailRequest> validator,
            ClaimsPrincipal user, 
            IAuthService authService) =>
        {
            var userId = user.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (userId == null)
            {
                return Results.Unauthorized();
            }

            var validationError = await validator.ValidateAndReturnErrorAsync(request);
            if (validationError != null) return validationError;

            var (success, message) = await authService.SendEmailChangeCodeAsync(userId, request.NewEmail);
            
            if (!success)
            {
                return Results.BadRequest(new ErrorResponse(message));
            }

            return Results.Ok(new { message });
        })
        .WithName("SendEmailChangeCode")
        .Produces(200)
        .Produces<ErrorResponse>(400)
        .Produces(401);

        // Verify and update email
        group.MapPost("/profile/email/verify", [Authorize] async (
            [FromBody] VerifyEmailChangeRequest request, 
            IValidator<VerifyEmailChangeRequest> validator,
            ClaimsPrincipal user, 
            IAuthService authService) =>
        {
            var userId = user.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (userId == null)
            {
                return Results.Unauthorized();
            }

            var validationError = await validator.ValidateAndReturnErrorAsync(request);
            if (validationError != null) return validationError;

            var (success, message) = await authService.VerifyAndUpdateEmailAsync(userId, request.NewEmail, request.Code);
            
            if (!success)
            {
                return Results.BadRequest(new ErrorResponse(message));
            }

            return Results.Ok(new { message });
        })
        .WithName("VerifyEmailChange")
        .Produces(200)
        .Produces<ErrorResponse>(400)
        .Produces(401);

        // Forgot password - Step 1: Send reset code
        group.MapPost("/forgot-password", async (
            ForgotPasswordRequest request, 
            IValidator<ForgotPasswordRequest> validator,
            IAuthService authService) =>
        {
            var validationError = await validator.ValidateAndReturnErrorAsync(request);
            if (validationError != null) return validationError;

            var (success, message) = await authService.SendPasswordResetCodeAsync(request.Email);
            
            // Always return success to not reveal if email exists
            return Results.Ok(new VerificationResponse(message));
        })
        .WithName("ForgotPassword")
        .Produces<VerificationResponse>(200)
        .Produces<ErrorResponse>(400)
        .RequireRateLimiting("sensitive");

        // Forgot password - Step 2: Verify reset code
        group.MapPost("/verify-reset-code", async (
            VerifyCodeRequest request, 
            IValidator<VerifyCodeRequest> validator,
            IAuthService authService) =>
        {
            var validationError = await validator.ValidateAndReturnErrorAsync(request);
            if (validationError != null) return validationError;

            var (success, message, verificationToken) = await authService.VerifyPasswordResetCodeAsync(request.Email, request.Code);
            
            if (!success)
            {
                return Results.BadRequest(new ErrorResponse(message));
            }

            return Results.Ok(new VerificationResponse(message, verificationToken));
        })
        .WithName("VerifyResetCode")
        .Produces<VerificationResponse>(200)
        .Produces<ErrorResponse>(400)
        .RequireRateLimiting("sensitive");

        // Forgot password - Step 3: Reset password
        group.MapPost("/reset-password", async (
            ResetPasswordRequest request, 
            IValidator<ResetPasswordRequest> validator,
            IAuthService authService) =>
        {
            var validationError = await validator.ValidateAndReturnErrorAsync(request);
            if (validationError != null) return validationError;

            var (success, message) = await authService.ResetPasswordAsync(request);
            
            if (!success)
            {
                return Results.BadRequest(new ErrorResponse(message));
            }

            return Results.Ok(new { message });
        })
        .WithName("ResetPassword")
        .Produces(200)
        .Produces<ErrorResponse>(400)
        .RequireRateLimiting("sensitive");

        // Change password (while logged in - preserves all encrypted data)
        group.MapPost("/change-password", [Authorize] async (
            ChangePasswordRequest request,
            IValidator<ChangePasswordRequest> validator,
            ClaimsPrincipal user,
            IAuthService authService) =>
        {
            var userId = user.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userId))
            {
                return Results.Unauthorized();
            }

            var validationError = await validator.ValidateAndReturnErrorAsync(request);
            if (validationError != null) return validationError;

            var (success, message) = await authService.ChangePasswordAsync(userId, request.CurrentPassword, request.NewPassword);
            
            if (!success)
            {
                return Results.BadRequest(new ErrorResponse(message));
            }

            return Results.Ok(new { message });
        })
        .WithName("ChangePassword")
        .Produces(200)
        .Produces<ErrorResponse>(400)
        .Produces(401);
    }
}
