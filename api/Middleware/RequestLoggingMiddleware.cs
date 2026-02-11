using System.Diagnostics;
using Serilog;

namespace DigiTransac.Api.Middleware;

/// <summary>
/// Middleware that logs structured request/response information for every HTTP request.
/// Captures method, path, status code, duration, user ID, and request metadata.
/// Sensitive paths (auth endpoints) have their request details redacted.
/// </summary>
public class RequestLoggingMiddleware
{
    private readonly RequestDelegate _next;
    private static readonly HashSet<string> SensitivePaths = new(StringComparer.OrdinalIgnoreCase)
    {
        "/api/auth/login",
        "/api/auth/register",
        "/api/auth/change-password",
        "/api/auth/reset-password",
        "/api/auth/forgot-password",
        "/api/auth/2fa"
    };

    private static readonly HashSet<string> ExcludedPaths = new(StringComparer.OrdinalIgnoreCase)
    {
        "/api/health",
        "/api/health/live",
        "/api/health/ready",
        "/hubs/notifications"
    };

    public RequestLoggingMiddleware(RequestDelegate next)
    {
        _next = next;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        var path = context.Request.Path.Value ?? "/";

        // Skip logging for health checks and SignalR
        if (IsExcludedPath(path))
        {
            await _next(context);
            return;
        }

        var stopwatch = Stopwatch.StartNew();
        var requestId = context.TraceIdentifier;
        var method = context.Request.Method;
        var queryString = context.Request.QueryString.HasValue ? context.Request.QueryString.Value : null;
        var userAgent = context.Request.Headers.UserAgent.FirstOrDefault();
        var clientIp = context.Connection.RemoteIpAddress?.ToString();
        var contentLength = context.Request.ContentLength;

        // Extract user ID from claims if authenticated
        string? userId = null;
        
        try
        {
            await _next(context);
        }
        finally
        {
            stopwatch.Stop();
            
            // Extract userId after auth middleware has run
            userId = context.User?.FindFirst("UserId")?.Value
                  ?? context.User?.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;

            var statusCode = context.Response.StatusCode;
            var elapsed = stopwatch.Elapsed.TotalMilliseconds;
            var isSensitive = IsSensitivePath(path);

            var logger = Log.ForContext("RequestId", requestId)
                .ForContext("HttpMethod", method)
                .ForContext("RequestPath", path)
                .ForContext("StatusCode", statusCode)
                .ForContext("ElapsedMs", elapsed)
                .ForContext("ClientIp", clientIp)
                .ForContext("UserId", userId ?? "anonymous");

            if (!isSensitive && queryString != null)
            {
                logger = logger.ForContext("QueryString", queryString);
            }

            if (contentLength.HasValue)
            {
                logger = logger.ForContext("RequestContentLength", contentLength.Value);
            }

            if (userAgent != null)
            {
                logger = logger.ForContext("UserAgent", userAgent);
            }

            var responseContentLength = context.Response.ContentLength;
            if (responseContentLength.HasValue)
            {
                logger = logger.ForContext("ResponseContentLength", responseContentLength.Value);
            }

            if (statusCode >= 500)
            {
                logger.Error(
                    "HTTP {Method} {Path} responded {StatusCode} in {Elapsed:0.00}ms",
                    method, isSensitive ? RedactPath(path) : path, statusCode, elapsed);
            }
            else if (statusCode >= 400)
            {
                logger.Warning(
                    "HTTP {Method} {Path} responded {StatusCode} in {Elapsed:0.00}ms",
                    method, isSensitive ? RedactPath(path) : path, statusCode, elapsed);
            }
            else
            {
                logger.Information(
                    "HTTP {Method} {Path} responded {StatusCode} in {Elapsed:0.00}ms",
                    method, isSensitive ? RedactPath(path) : path, statusCode, elapsed);
            }
        }
    }

    private static bool IsExcludedPath(string path)
    {
        return ExcludedPaths.Any(excluded => path.StartsWith(excluded, StringComparison.OrdinalIgnoreCase));
    }

    private static bool IsSensitivePath(string path)
    {
        return SensitivePaths.Any(sensitive => path.StartsWith(sensitive, StringComparison.OrdinalIgnoreCase));
    }

    private static string RedactPath(string path)
    {
        // Show the base path but redact any path parameters
        var segments = path.Split('/');
        if (segments.Length > 4)
        {
            return string.Join('/', segments.Take(4)) + "/***";
        }
        return path;
    }
}

/// <summary>
/// Extension method for registering the request logging middleware.
/// </summary>
public static class RequestLoggingMiddlewareExtensions
{
    public static IApplicationBuilder UseRequestLogging(this IApplicationBuilder app)
    {
        return app.UseMiddleware<RequestLoggingMiddleware>();
    }
}