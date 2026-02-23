using System.Security.Claims;
using DigiTransac.Api.Extensions;
using DigiTransac.Api.Models.Dto;
using DigiTransac.Api.Services;
using DigiTransac.Api.Settings;
using DigiTransac.Api.Validators;
using FluentValidation;
using Microsoft.AspNetCore.Authorization;
using Microsoft.Extensions.Options;

namespace DigiTransac.Api.Endpoints;

/// <summary>
/// Auth token endpoints: login, refresh token, revoke token, and revoke all tokens.
/// </summary>
public static class AuthTokenEndpoints
{
    public static RouteGroupBuilder MapAuthTokenEndpoints(this RouteGroupBuilder group)
    {
        // Login
        group.MapPost("/login", async (
            LoginRequest request,
            IValidator<LoginRequest> validator,
            IAuthService authService,
            ICookieService cookieService,
            IOptions<JwtSettings> jwtSettings,
            HttpContext httpContext,
            CancellationToken ct) =>
        {
            var validationError = await validator.ValidateAndReturnErrorAsync(request);
            if (validationError != null) return validationError;

            var result = await authService.LoginAsync(request, ct);
            
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
            // RememberMe=true → persistent cookie (30 days); false → session cookie (cleared on browser close)
            if (result.RefreshToken != null)
            {
                cookieService.SetRefreshTokenCookie(httpContext, result.RefreshToken, jwtSettings.Value.RefreshTokenExpireDays, request.RememberMe);
            }

            return Results.Ok(new LoginResponseWithoutRefresh(
                result.AccessToken,
                result.Email,
                result.FullName,
                result.IsEmailVerified,
                result.PrimaryCurrency));
        })
        .WithName("Login")
        .WithSummary("Login")
        .WithDescription("Authenticates user with email and password. Returns access token and sets refresh token as HttpOnly cookie. If 2FA is enabled, returns a 2FA token instead.")
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
            HttpContext httpContext,
            CancellationToken ct) =>
        {
            // Try to get refresh token from cookie first, then from request body (for backward compatibility)
            var refreshToken = cookieService.GetRefreshTokenFromCookie(httpContext) ?? request?.RefreshToken;
            
            if (string.IsNullOrWhiteSpace(refreshToken))
            {
                return Results.BadRequest(new ErrorResponse("Refresh token is required"));
            }

            var result = await authService.RefreshTokenAsync(refreshToken, ct);
            if (result == null)
            {
                // Clear the invalid cookies
                cookieService.ClearRefreshTokenCookie(httpContext);
                return Results.Unauthorized();
            }

            // Set new refresh token as HttpOnly cookie (preserve rememberMe preference from original login)
            cookieService.SetRefreshTokenCookie(httpContext, result.RefreshToken, jwtSettings.Value.RefreshTokenExpireDays, result.RememberMe);

            return Results.Ok(new AuthResponseWithoutRefresh(
                result.AccessToken,
                result.Email,
                result.FullName,
                result.IsEmailVerified,
                result.PrimaryCurrency));
        })
        .WithName("RefreshToken")
        .WithSummary("Refresh access token")
        .WithDescription("Issues a new access token using the refresh token from HttpOnly cookie or request body. Also rotates the refresh token.")
        .Produces<AuthResponseWithoutRefresh>(200)
        .Produces<ErrorResponse>(400)
        .Produces(401)
        .RequireRateLimiting("auth");

        // Revoke refresh token (logout from specific device)
        group.MapPost("/revoke-token", [Authorize] async (
            RefreshTokenRequest? request, 
            IAuthService authService,
            ICookieService cookieService,
            HttpContext httpContext,
            CancellationToken ct) =>
        {
            // Try to get refresh token from cookie first, then from request body
            var refreshToken = cookieService.GetRefreshTokenFromCookie(httpContext) ?? request?.RefreshToken;
            
            if (string.IsNullOrWhiteSpace(refreshToken))
            {
                return Results.BadRequest(new ErrorResponse("Refresh token is required"));
            }

            var revoked = await authService.RevokeTokenAsync(refreshToken, ct);
            
            // Always clear the cookies on logout attempt
            cookieService.ClearRefreshTokenCookie(httpContext);
            
            if (!revoked)
            {
                return Results.BadRequest(new ErrorResponse("Token not found or already revoked"));
            }

            return Results.Ok(new { message = "Token revoked successfully" });
        })
        .WithName("RevokeToken")
        .WithSummary("Revoke refresh token")
        .WithDescription("Revokes the current refresh token (logout from specific device). Clears the HttpOnly cookie.")
        .Produces(200)
        .Produces<ErrorResponse>(400)
        .Produces(401);

        // Revoke all refresh tokens (logout from all devices)
        group.MapPost("/revoke-all-tokens", [Authorize] async (
            ClaimsPrincipal user, 
            IAuthService authService,
            ICookieService cookieService,
            HttpContext httpContext,
            CancellationToken ct) =>
        {
            if (!user.TryGetUserId(out var userId))
                return Results.Unauthorized();

            await authService.RevokeAllUserTokensAsync(userId, ct);
            
            // Clear the cookies on current device
            cookieService.ClearRefreshTokenCookie(httpContext);
            
            return Results.Ok(new { message = "All tokens revoked successfully" });
        })
        .WithName("RevokeAllTokens")
        .WithSummary("Revoke all tokens")
        .WithDescription("Revokes all refresh tokens for the user (logout from all devices). Clears the cookie on current device.")
        .Produces(200)
        .Produces(401);

        return group;
    }
}