using System.Security.Claims;

namespace DigiTransac.Api.Extensions;

/// <summary>
/// Extension methods for <see cref="ClaimsPrincipal"/> to reduce repeated
/// user-ID extraction logic across all endpoint files.
/// </summary>
public static class ClaimsPrincipalExtensions
{
    /// <summary>
    /// Extracts the authenticated user's ID from the NameIdentifier claim.
    /// Returns null when the claim is missing or empty.
    /// </summary>
    public static string? GetUserId(this ClaimsPrincipal user)
    {
        var userId = user.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        return string.IsNullOrEmpty(userId) ? null : userId;
    }

    /// <summary>
    /// Extracts the authenticated user's ID, or returns <see cref="Results.Unauthorized"/>
    /// via the out parameter when the claim is missing.
    /// <para>Usage:
    /// <code>
    /// if (!user.TryGetUserId(out var userId))
    ///     return Results.Unauthorized();
    /// </code>
    /// </para>
    /// </summary>
    public static bool TryGetUserId(this ClaimsPrincipal user, out string userId)
    {
        var id = user.GetUserId();
        userId = id ?? string.Empty;
        return id != null;
    }
}
