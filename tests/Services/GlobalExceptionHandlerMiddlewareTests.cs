using System.Net;
using System.Text.Json;
using DigiTransac.Api.Middleware;
using FluentAssertions;
using FluentValidation;
using FluentValidation.Results;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using MongoDB.Driver;
using Moq;

namespace DigiTransac.Tests.Services;

public class GlobalExceptionHandlerMiddlewareTests
{
    private readonly Mock<ILogger<GlobalExceptionHandlerMiddleware>> _loggerMock;
    private readonly Mock<IHostEnvironment> _environmentMock;

    public GlobalExceptionHandlerMiddlewareTests()
    {
        _loggerMock = new Mock<ILogger<GlobalExceptionHandlerMiddleware>>();
        _environmentMock = new Mock<IHostEnvironment>();
        _environmentMock.Setup(x => x.EnvironmentName).Returns("Production");
    }

    private GlobalExceptionHandlerMiddleware CreateMiddleware(RequestDelegate next)
    {
        return new GlobalExceptionHandlerMiddleware(next, _loggerMock.Object, _environmentMock.Object);
    }

    private static DefaultHttpContext CreateContext()
    {
        var context = new DefaultHttpContext();
        context.Request.Path = "/api/test";
        context.Response.Body = new MemoryStream();
        return context;
    }

    private static async Task<ProblemDetailsResult> ReadProblemDetails(HttpContext context)
    {
        context.Response.Body.Seek(0, SeekOrigin.Begin);
        var body = await new StreamReader(context.Response.Body).ReadToEndAsync();
        return JsonSerializer.Deserialize<ProblemDetailsResult>(body, new JsonSerializerOptions
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase
        })!;
    }

    // ========================================================================
    // No exception → passthrough
    // ========================================================================

    [Fact]
    public async Task InvokeAsync_NoException_PassesThrough()
    {
        var wasCalled = false;
        var middleware = CreateMiddleware(_ => { wasCalled = true; return Task.CompletedTask; });
        var context = CreateContext();

        await middleware.InvokeAsync(context);

        wasCalled.Should().BeTrue();
        context.Response.StatusCode.Should().Be(200);
    }

    // ========================================================================
    // Exception mapping
    // ========================================================================

    [Fact]
    public async Task InvokeAsync_ValidationException_Returns400()
    {
        var failures = new List<ValidationFailure>
        {
            new("Email", "Email is required"),
            new("Email", "Email is invalid")
        };
        var middleware = CreateMiddleware(_ => throw new ValidationException(failures));
        var context = CreateContext();

        await middleware.InvokeAsync(context);

        context.Response.StatusCode.Should().Be(400);
        context.Response.ContentType.Should().Be("application/problem+json");

        var problem = await ReadProblemDetails(context);
        problem.Title.Should().Be("Validation Failed");
        problem.Errors.Should().ContainKey("Email");
        problem.Errors!["Email"].Should().HaveCount(2);
    }

    [Fact]
    public async Task InvokeAsync_UnauthorizedAccessException_Returns401()
    {
        var middleware = CreateMiddleware(_ => throw new UnauthorizedAccessException());
        var context = CreateContext();

        await middleware.InvokeAsync(context);

        context.Response.StatusCode.Should().Be(401);
        var problem = await ReadProblemDetails(context);
        problem.Title.Should().Be("Unauthorized");
    }

    [Fact]
    public async Task InvokeAsync_KeyNotFoundException_Returns404()
    {
        var middleware = CreateMiddleware(_ => throw new KeyNotFoundException("Resource not found"));
        var context = CreateContext();

        await middleware.InvokeAsync(context);

        context.Response.StatusCode.Should().Be(404);
        var problem = await ReadProblemDetails(context);
        problem.Title.Should().Be("Resource Not Found");
    }

    [Fact]
    public async Task InvokeAsync_ArgumentException_Returns400()
    {
        var middleware = CreateMiddleware(_ => throw new ArgumentException("Bad arg"));
        var context = CreateContext();

        await middleware.InvokeAsync(context);

        context.Response.StatusCode.Should().Be(400);
        var problem = await ReadProblemDetails(context);
        problem.Title.Should().Be("Invalid Argument");
    }

    [Fact]
    public async Task InvokeAsync_InvalidOperationException_Returns500()
    {
        var middleware = CreateMiddleware(_ => throw new InvalidOperationException("Op failed"));
        var context = CreateContext();

        await middleware.InvokeAsync(context);

        context.Response.StatusCode.Should().Be(500);
        var problem = await ReadProblemDetails(context);
        problem.Title.Should().Be("Operation Failed");
    }

    [Fact]
    public async Task InvokeAsync_OperationCanceledException_Returns499()
    {
        var middleware = CreateMiddleware(_ => throw new OperationCanceledException());
        var context = CreateContext();

        await middleware.InvokeAsync(context);

        context.Response.StatusCode.Should().Be(499);
        var problem = await ReadProblemDetails(context);
        problem.Title.Should().Be("Request Cancelled");
    }

    [Fact]
    public async Task InvokeAsync_MongoException_Returns503()
    {
        var middleware = CreateMiddleware(_ => throw new MongoException("Connection refused"));
        var context = CreateContext();

        await middleware.InvokeAsync(context);

        context.Response.StatusCode.Should().Be(503);
        var problem = await ReadProblemDetails(context);
        problem.Title.Should().Be("Database Error");
    }

    [Fact]
    public async Task InvokeAsync_TimeoutException_Returns504()
    {
        var middleware = CreateMiddleware(_ => throw new TimeoutException());
        var context = CreateContext();

        await middleware.InvokeAsync(context);

        context.Response.StatusCode.Should().Be(504);
        var problem = await ReadProblemDetails(context);
        problem.Title.Should().Be("Request Timeout");
    }

    [Fact]
    public async Task InvokeAsync_NotImplementedException_Returns501()
    {
        var middleware = CreateMiddleware(_ => throw new NotImplementedException());
        var context = CreateContext();

        await middleware.InvokeAsync(context);

        context.Response.StatusCode.Should().Be(501);
        var problem = await ReadProblemDetails(context);
        problem.Title.Should().Be("Not Implemented");
    }

    [Fact]
    public async Task InvokeAsync_GenericException_Returns500()
    {
        var middleware = CreateMiddleware(_ => throw new Exception("Something went wrong"));
        var context = CreateContext();

        await middleware.InvokeAsync(context);

        context.Response.StatusCode.Should().Be(500);
        var problem = await ReadProblemDetails(context);
        problem.Title.Should().Be("Internal Server Error");
    }

    // ========================================================================
    // Response format
    // ========================================================================

    [Fact]
    public async Task InvokeAsync_SetsContentTypeToProblemJson()
    {
        var middleware = CreateMiddleware(_ => throw new Exception("Fail"));
        var context = CreateContext();

        await middleware.InvokeAsync(context);

        context.Response.ContentType.Should().Be("application/problem+json");
    }

    [Fact]
    public async Task InvokeAsync_IncludesTraceId()
    {
        var middleware = CreateMiddleware(_ => throw new Exception("Fail"));
        var context = CreateContext();

        await middleware.InvokeAsync(context);

        var problem = await ReadProblemDetails(context);
        problem.TraceId.Should().NotBeNullOrEmpty();
    }

    [Fact]
    public async Task InvokeAsync_IncludesInstancePath()
    {
        var middleware = CreateMiddleware(_ => throw new Exception("Fail"));
        var context = CreateContext();
        context.Request.Path = "/api/transactions";

        await middleware.InvokeAsync(context);

        var problem = await ReadProblemDetails(context);
        problem.Instance.Should().Be("/api/transactions");
    }

    [Fact]
    public async Task InvokeAsync_IncludesRfcTypeUri()
    {
        var middleware = CreateMiddleware(_ => throw new KeyNotFoundException());
        var context = CreateContext();

        await middleware.InvokeAsync(context);

        var problem = await ReadProblemDetails(context);
        problem.Type.Should().Contain("rfc9110");
    }

    // ========================================================================
    // Development vs Production
    // ========================================================================

    [Fact]
    public async Task InvokeAsync_Development_IncludesStackTrace()
    {
        _environmentMock.Setup(x => x.EnvironmentName).Returns("Development");
        var middleware = CreateMiddleware(_ => throw new Exception("Dev error"));
        var context = CreateContext();

        await middleware.InvokeAsync(context);

        context.Response.Body.Seek(0, SeekOrigin.Begin);
        var body = await new StreamReader(context.Response.Body).ReadToEndAsync();
        body.Should().Contain("stackTrace");
        body.Should().Contain("exceptionType");
    }

    [Fact]
    public async Task InvokeAsync_Production_ExcludesStackTrace()
    {
        _environmentMock.Setup(x => x.EnvironmentName).Returns("Production");
        var middleware = CreateMiddleware(_ => throw new Exception("Prod error"));
        var context = CreateContext();

        await middleware.InvokeAsync(context);

        context.Response.Body.Seek(0, SeekOrigin.Begin);
        var body = await new StreamReader(context.Response.Body).ReadToEndAsync();
        body.Should().NotContain("stackTrace");
    }

    // ========================================================================
    // Validation errors grouping
    // ========================================================================

    [Fact]
    public async Task InvokeAsync_ValidationException_GroupsErrorsByProperty()
    {
        var failures = new List<ValidationFailure>
        {
            new("Name", "Name is required"),
            new("Name", "Name too short"),
            new("Amount", "Amount must be positive")
        };
        var middleware = CreateMiddleware(_ => throw new ValidationException(failures));
        var context = CreateContext();

        await middleware.InvokeAsync(context);

        var problem = await ReadProblemDetails(context);
        problem.Errors.Should().HaveCount(2);
        problem.Errors!["Name"].Should().HaveCount(2);
        problem.Errors["Amount"].Should().HaveCount(1);
    }

    [Fact]
    public async Task InvokeAsync_NonValidationException_NoErrorsField()
    {
        var middleware = CreateMiddleware(_ => throw new Exception("Generic"));
        var context = CreateContext();

        await middleware.InvokeAsync(context);

        var problem = await ReadProblemDetails(context);
        problem.Errors.Should().BeNull();
    }

    // Helper class for deserialization
    private class ProblemDetailsResult
    {
        public string? Type { get; set; }
        public string? Title { get; set; }
        public int Status { get; set; }
        public string? Detail { get; set; }
        public string? Instance { get; set; }
        public string? TraceId { get; set; }
        public Dictionary<string, string[]>? Errors { get; set; }
    }
}
