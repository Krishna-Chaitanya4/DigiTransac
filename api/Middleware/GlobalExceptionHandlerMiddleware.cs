using System.Diagnostics;
using System.Net;
using System.Text.Json;
using FluentValidation;
using MongoDB.Driver;

namespace DigiTransac.Api.Middleware;

/// <summary>
/// Global exception handling middleware that catches unhandled exceptions,
/// maps them to appropriate HTTP status codes, and returns RFC 7807 Problem Details responses.
/// </summary>
public sealed class GlobalExceptionHandlerMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<GlobalExceptionHandlerMiddleware> _logger;
    private readonly IHostEnvironment _environment;

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull
    };

    public GlobalExceptionHandlerMiddleware(
        RequestDelegate next,
        ILogger<GlobalExceptionHandlerMiddleware> logger,
        IHostEnvironment environment)
    {
        _next = next;
        _logger = logger;
        _environment = environment;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await _next(context);
        }
        catch (Exception ex)
        {
            await HandleExceptionAsync(context, ex);
        }
    }

    private async Task HandleExceptionAsync(HttpContext context, Exception exception)
    {
        var traceId = Activity.Current?.Id ?? context.TraceIdentifier;

        var (statusCode, title, detail) = MapException(exception);

        LogException(exception, statusCode, traceId, context.Request.Path);

        if (context.Response.HasStarted)
        {
            _logger.LogWarning(
                "Response has already started, cannot write error response for TraceId: {TraceId}",
                traceId);
            return;
        }

        context.Response.Clear();
        context.Response.StatusCode = (int)statusCode;
        context.Response.ContentType = "application/problem+json";

        var problemDetails = new ProblemDetailsResponse
        {
            Type = GetRfcTypeUri(statusCode),
            Title = title,
            Status = (int)statusCode,
            Detail = detail,
            Instance = context.Request.Path,
            TraceId = traceId,
            Errors = GetValidationErrors(exception)
        };

        // Include stack trace only in development
        if (_environment.IsDevelopment())
        {
            problemDetails.Extensions = new Dictionary<string, object>
            {
                ["exceptionType"] = exception.GetType().FullName ?? exception.GetType().Name,
                ["stackTrace"] = exception.StackTrace ?? string.Empty
            };
        }

        await context.Response.WriteAsync(
            JsonSerializer.Serialize(problemDetails, JsonOptions));
    }

    private static (HttpStatusCode StatusCode, string Title, string Detail) MapException(Exception exception)
    {
        return exception switch
        {
            ValidationException validationEx => (
                HttpStatusCode.BadRequest,
                "Validation Failed",
                validationEx.Message),

            UnauthorizedAccessException => (
                HttpStatusCode.Unauthorized,
                "Unauthorized",
                "You are not authorized to perform this action."),

            KeyNotFoundException => (
                HttpStatusCode.NotFound,
                "Resource Not Found",
                "The requested resource was not found."),

            ArgumentException argEx => (
                HttpStatusCode.BadRequest,
                "Invalid Argument",
                "The request contains an invalid argument."),

            InvalidOperationException invalidOpEx => (
                HttpStatusCode.InternalServerError,
                "Operation Failed",
                "An operation failed. Please try again later."),

            OperationCanceledException => (
                (HttpStatusCode)499,
                "Request Cancelled",
                "The request was cancelled by the client."),

            MongoException mongoEx => (
                HttpStatusCode.ServiceUnavailable,
                "Database Error",
                "A database error occurred. Please try again later."),

            TimeoutException => (
                HttpStatusCode.GatewayTimeout,
                "Request Timeout",
                "The request timed out. Please try again."),

            NotImplementedException => (
                HttpStatusCode.NotImplemented,
                "Not Implemented",
                "This feature is not yet implemented."),

            _ => (
                HttpStatusCode.InternalServerError,
                "Internal Server Error",
                "An unexpected error occurred. Please try again later.")
        };
    }

    private void LogException(Exception exception, HttpStatusCode statusCode, string traceId, string path)
    {
        var logLevel = statusCode switch
        {
            HttpStatusCode.BadRequest => LogLevel.Warning,
            HttpStatusCode.Unauthorized => LogLevel.Warning,
            HttpStatusCode.NotFound => LogLevel.Warning,
            HttpStatusCode.Conflict => LogLevel.Warning,
            (HttpStatusCode)499 => LogLevel.Information,
            _ => LogLevel.Error
        };

        _logger.Log(
            logLevel,
            exception,
            "Exception caught by global handler. StatusCode: {StatusCode}, TraceId: {TraceId}, Path: {Path}, Type: {ExceptionType}",
            (int)statusCode,
            traceId,
            path,
            exception.GetType().Name);
    }

    private static Dictionary<string, string[]>? GetValidationErrors(Exception exception)
    {
        if (exception is not ValidationException validationException)
            return null;

        return validationException.Errors
            .GroupBy(e => e.PropertyName ?? "General")
            .ToDictionary(
                g => g.Key,
                g => g.Select(e => e.ErrorMessage).ToArray());
    }

    private static string GetRfcTypeUri(HttpStatusCode statusCode)
    {
        return statusCode switch
        {
            HttpStatusCode.BadRequest => "https://tools.ietf.org/html/rfc9110#section-15.5.1",
            HttpStatusCode.Unauthorized => "https://tools.ietf.org/html/rfc9110#section-15.5.2",
            HttpStatusCode.NotFound => "https://tools.ietf.org/html/rfc9110#section-15.5.5",
            HttpStatusCode.Conflict => "https://tools.ietf.org/html/rfc9110#section-15.5.10",
            HttpStatusCode.InternalServerError => "https://tools.ietf.org/html/rfc9110#section-15.6.1",
            HttpStatusCode.ServiceUnavailable => "https://tools.ietf.org/html/rfc9110#section-15.6.4",
            HttpStatusCode.GatewayTimeout => "https://tools.ietf.org/html/rfc9110#section-15.6.5",
            HttpStatusCode.NotImplemented => "https://tools.ietf.org/html/rfc9110#section-15.6.2",
            _ => "https://tools.ietf.org/html/rfc9110#section-15.6.1"
        };
    }
}

/// <summary>
/// RFC 7807 Problem Details response model.
/// </summary>
internal sealed class ProblemDetailsResponse
{
    public string? Type { get; set; }
    public string? Title { get; set; }
    public int Status { get; set; }
    public string? Detail { get; set; }
    public string? Instance { get; set; }
    public string? TraceId { get; set; }
    public Dictionary<string, string[]>? Errors { get; set; }
    public Dictionary<string, object>? Extensions { get; set; }
}

/// <summary>
/// Extension method to register the global exception handler middleware.
/// </summary>
public static class GlobalExceptionHandlerExtensions
{
    public static IApplicationBuilder UseGlobalExceptionHandler(this IApplicationBuilder app)
    {
        return app.UseMiddleware<GlobalExceptionHandlerMiddleware>();
    }
}