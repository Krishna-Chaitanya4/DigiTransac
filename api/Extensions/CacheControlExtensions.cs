using Microsoft.AspNetCore.Http;

namespace DigiTransac.Api.Extensions;

/// <summary>
/// Extension methods for adding Cache-Control headers to HTTP responses.
/// 
/// Cache-Control strategies:
/// - Private: Only cached by the user's browser, not shared caches
/// - Public: Can be cached by shared caches (CDNs, proxies)
/// - No-Store: Never cache (sensitive data)
/// - No-Cache: Cache but always revalidate
/// - Immutable: Content will never change (good for versioned resources)
/// 
/// Usage in endpoints:
///   app.MapGet("/api/labels", async (HttpContext context) => {
///       context.SetCacheControl(CachePolicy.StaticData);
///       return await labelService.GetLabels();
///   });
/// </summary>
public static class CacheControlExtensions
{
    /// <summary>
    /// Predefined cache policies for common use cases
    /// </summary>
    public static class CachePolicy
    {
        /// <summary>
        /// No caching - for sensitive or frequently changing data
        /// Examples: User profile, authentication responses
        /// </summary>
        public static readonly CacheControlOptions NoCache = new()
        {
            NoStore = true,
            NoCache = true,
            MustRevalidate = true,
            Private = true,
        };

        /// <summary>
        /// Short-lived private cache - for user-specific data that changes occasionally
        /// Examples: Transaction list, account balances (30 seconds)
        /// </summary>
        public static readonly CacheControlOptions ShortPrivate = new()
        {
            Private = true,
            MaxAgeSeconds = 30,
            MustRevalidate = true,
        };

        /// <summary>
        /// Medium-lived private cache - for user-specific data that changes infrequently
        /// Examples: Budget summaries, insights analytics (2 minutes)
        /// </summary>
        public static readonly CacheControlOptions MediumPrivate = new()
        {
            Private = true,
            MaxAgeSeconds = 120,
            StaleWhileRevalidateSeconds = 60,
        };

        /// <summary>
        /// Static data cache - for rarely changing reference data
        /// Examples: Labels, tags, categories (5 minutes)
        /// </summary>
        public static readonly CacheControlOptions StaticData = new()
        {
            Private = true,
            MaxAgeSeconds = 300,
            StaleWhileRevalidateSeconds = 120,
        };

        /// <summary>
        /// Exchange rates cache - refreshed periodically
        /// Examples: Currency exchange rates (5 minutes)
        /// </summary>
        public static readonly CacheControlOptions ExchangeRates = new()
        {
            Public = true, // Can be shared as exchange rates are same for all users
            MaxAgeSeconds = 300,
            StaleWhileRevalidateSeconds = 300,
        };

        /// <summary>
        /// Long-lived public cache - for truly static resources
        /// Examples: App configuration, public reference data (1 hour)
        /// </summary>
        public static readonly CacheControlOptions LongPublic = new()
        {
            Public = true,
            MaxAgeSeconds = 3600,
            StaleWhileRevalidateSeconds = 1800,
        };

        /// <summary>
        /// Immutable cache - for content that will never change
        /// Examples: Versioned assets, historical transaction records (1 year)
        /// </summary>
        public static readonly CacheControlOptions Immutable = new()
        {
            Public = true,
            MaxAgeSeconds = 31536000, // 1 year
            Immutable = true,
        };
    }

    /// <summary>
    /// Options for configuring Cache-Control header
    /// </summary>
    public class CacheControlOptions
    {
        public bool Public { get; init; }
        public bool Private { get; init; }
        public bool NoCache { get; init; }
        public bool NoStore { get; init; }
        public bool MustRevalidate { get; init; }
        public bool Immutable { get; init; }
        public int? MaxAgeSeconds { get; init; }
        public int? SharedMaxAgeSeconds { get; init; }
        public int? StaleWhileRevalidateSeconds { get; init; }
        public int? StaleIfErrorSeconds { get; init; }
    }

    /// <summary>
    /// Set Cache-Control header on the HTTP response
    /// </summary>
    public static void SetCacheControl(this HttpContext context, CacheControlOptions options)
    {
        var directives = new List<string>();

        // Visibility
        if (options.NoStore)
        {
            directives.Add("no-store");
        }
        else if (options.NoCache)
        {
            directives.Add("no-cache");
        }
        else
        {
            if (options.Public)
                directives.Add("public");
            else if (options.Private)
                directives.Add("private");
        }

        // Max-age
        if (options.MaxAgeSeconds.HasValue)
        {
            directives.Add($"max-age={options.MaxAgeSeconds}");
        }

        // Shared max-age (for CDNs)
        if (options.SharedMaxAgeSeconds.HasValue)
        {
            directives.Add($"s-maxage={options.SharedMaxAgeSeconds}");
        }

        // Revalidation
        if (options.MustRevalidate)
        {
            directives.Add("must-revalidate");
        }

        // Immutable
        if (options.Immutable)
        {
            directives.Add("immutable");
        }

        // Stale directives (for resilience)
        if (options.StaleWhileRevalidateSeconds.HasValue)
        {
            directives.Add($"stale-while-revalidate={options.StaleWhileRevalidateSeconds}");
        }

        if (options.StaleIfErrorSeconds.HasValue)
        {
            directives.Add($"stale-if-error={options.StaleIfErrorSeconds}");
        }

        // Set the header
        context.Response.Headers.CacheControl = string.Join(", ", directives);
    }

    /// <summary>
    /// Set Cache-Control header to prevent caching (for sensitive data)
    /// </summary>
    public static void SetNoCache(this HttpContext context)
    {
        context.SetCacheControl(CachePolicy.NoCache);
    }

    /// <summary>
    /// Set Cache-Control for short-lived user data (30 seconds)
    /// </summary>
    public static void SetShortCache(this HttpContext context)
    {
        context.SetCacheControl(CachePolicy.ShortPrivate);
    }

    /// <summary>
    /// Set Cache-Control for medium-lived user data (2 minutes)
    /// </summary>
    public static void SetMediumCache(this HttpContext context)
    {
        context.SetCacheControl(CachePolicy.MediumPrivate);
    }

    /// <summary>
    /// Set Cache-Control for static/reference data (5 minutes)
    /// </summary>
    public static void SetStaticDataCache(this HttpContext context)
    {
        context.SetCacheControl(CachePolicy.StaticData);
    }

    /// <summary>
    /// Set custom Cache-Control with specific max-age
    /// </summary>
    public static void SetCacheMaxAge(this HttpContext context, int seconds, bool isPublic = false)
    {
        context.SetCacheControl(new CacheControlOptions
        {
            Public = isPublic,
            Private = !isPublic,
            MaxAgeSeconds = seconds,
        });
    }

    /// <summary>
    /// Set ETag header for conditional requests
    /// </summary>
    public static void SetETag(this HttpContext context, string etag)
    {
        if (!string.IsNullOrEmpty(etag))
        {
            context.Response.Headers.ETag = $"\"{etag}\"";
        }
    }

    /// <summary>
    /// Set Last-Modified header for conditional requests
    /// </summary>
    public static void SetLastModified(this HttpContext context, DateTime lastModified)
    {
        context.Response.Headers.LastModified = lastModified.ToUniversalTime().ToString("R");
    }

    /// <summary>
    /// Check if the request has a matching ETag (for 304 Not Modified)
    /// </summary>
    public static bool HasMatchingETag(this HttpContext context, string currentETag)
    {
        var ifNoneMatch = context.Request.Headers.IfNoneMatch.ToString();
        if (string.IsNullOrEmpty(ifNoneMatch))
            return false;

        // Parse and compare ETags
        var clientETags = ifNoneMatch.Split(',').Select(e => e.Trim().Trim('"'));
        return clientETags.Any(e => e == currentETag || e == "*");
    }

    /// <summary>
    /// Check if the request has a matching If-Modified-Since header
    /// </summary>
    public static bool IsNotModifiedSince(this HttpContext context, DateTime lastModified)
    {
        var ifModifiedSince = context.Request.Headers.IfModifiedSince.ToString();
        if (string.IsNullOrEmpty(ifModifiedSince))
            return false;

        if (DateTime.TryParse(ifModifiedSince, out var clientDate))
        {
            // Round to seconds for comparison
            var serverTime = new DateTime(lastModified.Year, lastModified.Month, lastModified.Day,
                lastModified.Hour, lastModified.Minute, lastModified.Second, DateTimeKind.Utc);
            return clientDate >= serverTime;
        }

        return false;
    }
}