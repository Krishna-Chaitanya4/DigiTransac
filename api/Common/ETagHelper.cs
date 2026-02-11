using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace DigiTransac.Api.Common;

/// <summary>
/// Provides content-based ETag generation and conditional request handling.
/// Computes a SHA256 hash of the serialized response data to generate a strong ETag,
/// then checks the client's If-None-Match header to return 304 Not Modified when appropriate.
/// </summary>
public static class ETagHelper
{
    private static readonly JsonSerializerOptions SerializerOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull
    };

    /// <summary>
    /// Returns an IResult with content-based ETag support.
    /// If the client's If-None-Match header matches the computed ETag, returns 304 Not Modified.
    /// Otherwise, returns HTTP 200 with the data and sets the ETag header.
    /// </summary>
    /// <typeparam name="T">The response data type.</typeparam>
    /// <param name="context">The current HttpContext.</param>
    /// <param name="data">The response data to serialize and hash.</param>
    /// <param name="cacheMaxAgeSeconds">Optional max-age for Cache-Control header (private). Defaults to 0 (no-cache with revalidation).</param>
    /// <returns>Either Results.StatusCode(304) or Results.Ok(data) with ETag header set.</returns>
    public static IResult OkWithETag<T>(HttpContext context, T data, int cacheMaxAgeSeconds = 0)
    {
        var etag = ComputeETag(data);

        // Check If-None-Match header
        if (HasMatchingETag(context, etag))
        {
            // Set the ETag on the 304 response too, per RFC 7232
            context.Response.Headers.ETag = FormatETag(etag);
            SetCacheHeaders(context, cacheMaxAgeSeconds);
            return Results.StatusCode(304);
        }

        // Set ETag and cache headers
        context.Response.Headers.ETag = FormatETag(etag);
        SetCacheHeaders(context, cacheMaxAgeSeconds);

        return Results.Ok(data);
    }

    /// <summary>
    /// Computes a SHA256-based ETag from the serialized JSON of the data.
    /// </summary>
    public static string ComputeETag<T>(T data)
    {
        var json = JsonSerializer.Serialize(data, SerializerOptions);
        var hashBytes = SHA256.HashData(Encoding.UTF8.GetBytes(json));
        // Use first 16 bytes (128 bits) for a shorter but still collision-resistant ETag
        return Convert.ToBase64String(hashBytes, 0, 16)
            .Replace("+", "-")
            .Replace("/", "_")
            .TrimEnd('=');
    }

    /// <summary>
    /// Checks if the client's If-None-Match header contains the given ETag.
    /// </summary>
    private static bool HasMatchingETag(HttpContext context, string currentETag)
    {
        var ifNoneMatch = context.Request.Headers.IfNoneMatch.ToString();
        if (string.IsNullOrEmpty(ifNoneMatch))
            return false;

        // Handle wildcard
        if (ifNoneMatch.Trim() == "*")
            return true;

        // Parse multiple ETags (comma-separated)
        var clientETags = ifNoneMatch.Split(',')
            .Select(e => e.Trim().Trim('"'));

        return clientETags.Any(e => e == currentETag);
    }

    /// <summary>
    /// Formats the ETag value as a quoted strong ETag per RFC 7232.
    /// </summary>
    private static string FormatETag(string etag) => $"\"{etag}\"";

    /// <summary>
    /// Sets appropriate Cache-Control headers for ETag-based revalidation.
    /// </summary>
    private static void SetCacheHeaders(HttpContext context, int maxAgeSeconds)
    {
        if (maxAgeSeconds > 0)
        {
            context.Response.Headers.CacheControl = $"private, max-age={maxAgeSeconds}, must-revalidate";
        }
        else
        {
            // no-cache means "always revalidate" (the browser still caches but must check ETag)
            context.Response.Headers.CacheControl = "private, no-cache";
        }

        // Vary by Authorization to ensure user-specific caching
        context.Response.Headers.Vary = "Authorization";
    }
}