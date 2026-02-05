using Polly;
using Polly.Extensions.Http;

namespace DigiTransac.Api.Extensions;

/// <summary>
/// Extension methods to add resilience policies (Circuit Breaker, Retry, Timeout) to HttpClient
/// using Polly for handling transient failures.
/// </summary>
public static class HttpClientResilienceExtensions
{
    /// <summary>
    /// Adds resilience policies to an HttpClientBuilder including:
    /// - Retry with exponential backoff
    /// - Circuit breaker to prevent cascade failures
    /// - Timeout policy
    /// </summary>
    public static IHttpClientBuilder AddResiliencePolicies(
        this IHttpClientBuilder builder,
        ILogger logger,
        int retryCount = 3,
        int circuitBreakerThreshold = 5,
        int circuitBreakerDurationSeconds = 30,
        int timeoutSeconds = 10)
    {
        // Retry policy with exponential backoff
        var retryPolicy = HttpPolicyExtensions
            .HandleTransientHttpError()
            .Or<TimeoutException>()
            .WaitAndRetryAsync(
                retryCount,
                retryAttempt => TimeSpan.FromSeconds(Math.Pow(2, retryAttempt)),
                onRetry: (outcome, timespan, retryAttempt, context) =>
                {
                    logger.LogWarning(
                        "Request failed with {StatusCode}. Retry attempt {RetryAttempt} after {Delay}ms. Reason: {Reason}",
                        outcome.Result?.StatusCode,
                        retryAttempt,
                        timespan.TotalMilliseconds,
                        outcome.Exception?.Message ?? outcome.Result?.ReasonPhrase);
                });

        // Circuit breaker policy
        // Opens circuit after consecutive failures, preventing further calls for a duration
        var circuitBreakerPolicy = HttpPolicyExtensions
            .HandleTransientHttpError()
            .Or<TimeoutException>()
            .CircuitBreakerAsync(
                handledEventsAllowedBeforeBreaking: circuitBreakerThreshold,
                durationOfBreak: TimeSpan.FromSeconds(circuitBreakerDurationSeconds),
                onBreak: (outcome, duration) =>
                {
                    logger.LogError(
                        "Circuit breaker opened for {Duration}s due to {StatusCode}. Reason: {Reason}",
                        duration.TotalSeconds,
                        outcome.Result?.StatusCode,
                        outcome.Exception?.Message ?? outcome.Result?.ReasonPhrase);
                },
                onReset: () =>
                {
                    logger.LogInformation("Circuit breaker reset. Requests will be allowed through.");
                },
                onHalfOpen: () =>
                {
                    logger.LogInformation("Circuit breaker half-open. Testing if service recovered.");
                });

        // Timeout policy - fail fast if request takes too long
        var timeoutPolicy = Policy.TimeoutAsync<HttpResponseMessage>(
            TimeSpan.FromSeconds(timeoutSeconds),
            Polly.Timeout.TimeoutStrategy.Pessimistic,
            onTimeoutAsync: (context, timespan, task) =>
            {
                logger.LogWarning("Request timed out after {Timeout}s", timespan.TotalSeconds);
                return Task.CompletedTask;
            });

        // Combine policies: Timeout -> Retry -> Circuit Breaker
        // Order matters: outer policy wraps inner policy
        return builder
            .AddPolicyHandler(retryPolicy)
            .AddPolicyHandler(circuitBreakerPolicy)
            .AddPolicyHandler(timeoutPolicy);
    }

    /// <summary>
    /// Adds a simple retry policy without circuit breaker for less critical endpoints.
    /// </summary>
    public static IHttpClientBuilder AddSimpleRetryPolicy(
        this IHttpClientBuilder builder,
        ILogger logger,
        int retryCount = 2)
    {
        var retryPolicy = HttpPolicyExtensions
            .HandleTransientHttpError()
            .WaitAndRetryAsync(
                retryCount,
                retryAttempt => TimeSpan.FromSeconds(Math.Pow(2, retryAttempt)),
                onRetry: (outcome, timespan, retryAttempt, context) =>
                {
                    logger.LogWarning(
                        "Request retry {RetryAttempt} after {Delay}ms. Status: {StatusCode}",
                        retryAttempt,
                        timespan.TotalMilliseconds,
                        outcome.Result?.StatusCode);
                });

        return builder.AddPolicyHandler(retryPolicy);
    }
}