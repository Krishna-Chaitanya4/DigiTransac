using OpenTelemetry;
using OpenTelemetry.Resources;
using OpenTelemetry.Trace;
using System.Diagnostics;

namespace DigiTransac.Api.Extensions;

/// <summary>
/// Extension methods for configuring OpenTelemetry tracing.
/// </summary>
public static class OpenTelemetryExtensions
{
    /// <summary>
    /// Activity source for custom DigiTransac spans
    /// </summary>
    public static readonly ActivitySource DigiTransacActivitySource = new("DigiTransac.Api");

    /// <summary>
    /// Adds OpenTelemetry tracing to the service collection.
    /// </summary>
    public static IServiceCollection AddOpenTelemetryTracing(
        this IServiceCollection services, 
        IConfiguration configuration)
    {
        var serviceName = configuration["OpenTelemetry:ServiceName"] ?? "DigiTransac.Api";
        var serviceVersion = configuration["OpenTelemetry:ServiceVersion"] ?? "1.0.0";
        var otlpEndpoint = configuration["OpenTelemetry:OtlpEndpoint"];

        services.AddOpenTelemetry()
            .ConfigureResource(resource =>
            {
                resource.AddService(
                    serviceName: serviceName,
                    serviceVersion: serviceVersion,
                    serviceInstanceId: Environment.MachineName);
                    
                resource.AddAttributes(new Dictionary<string, object>
                {
                    ["environment"] = configuration["ASPNETCORE_ENVIRONMENT"] ?? "Development",
                    ["deployment.region"] = configuration["OpenTelemetry:Region"] ?? "local"
                });
            })
            .WithTracing(tracing =>
            {
                tracing
                    // Add DigiTransac custom activity source
                    .AddSource(DigiTransacActivitySource.Name)
                    
                    // Add ASP.NET Core instrumentation
                    .AddAspNetCoreInstrumentation(options =>
                    {
                        options.RecordException = true;
                        options.Filter = httpContext =>
                        {
                            // Filter out health check endpoints from traces
                            var path = httpContext.Request.Path.Value;
                            return path != "/health" && 
                                   path != "/health/ready" && 
                                   path != "/health/live";
                        };
                        options.EnrichWithHttpRequest = (activity, request) =>
                        {
                            activity.SetTag("http.request.content_type", request.ContentType);
                            activity.SetTag("http.request.content_length", request.ContentLength);
                        };
                        options.EnrichWithHttpResponse = (activity, response) =>
                        {
                            activity.SetTag("http.response.content_type", response.ContentType);
                            activity.SetTag("http.response.content_length", response.ContentLength);
                        };
                    })
                    
                    // Add HTTP client instrumentation
                    .AddHttpClientInstrumentation(options =>
                    {
                        options.RecordException = true;
                    });

                // Configure exporters based on configuration
                var useConsoleExporter = configuration.GetValue<bool>("OpenTelemetry:UseConsoleExporter");
                if (useConsoleExporter)
                {
                    tracing.AddConsoleExporter();
                }

                // Add OTLP exporter if endpoint is configured
                if (!string.IsNullOrEmpty(otlpEndpoint))
                {
                    tracing.AddOtlpExporter(options =>
                    {
                        options.Endpoint = new Uri(otlpEndpoint);
                    });
                }
            });

        return services;
    }

    /// <summary>
    /// Creates a new activity (span) for the given operation.
    /// Returns null if tracing is not active or if the activity source doesn't have listeners.
    /// </summary>
    public static Activity? StartActivity(string operationName, ActivityKind kind = ActivityKind.Internal)
    {
        return DigiTransacActivitySource.StartActivity(operationName, kind);
    }

    /// <summary>
    /// Creates a new activity with tags for a transaction operation.
    /// </summary>
    public static Activity? StartTransactionActivity(
        string operationName, 
        string userId, 
        string? transactionId = null,
        string? accountId = null)
    {
        var activity = DigiTransacActivitySource.StartActivity(operationName, ActivityKind.Internal);
        
        if (activity != null)
        {
            activity.SetTag("user.id", userId);
            
            if (!string.IsNullOrEmpty(transactionId))
                activity.SetTag("transaction.id", transactionId);
                
            if (!string.IsNullOrEmpty(accountId))
                activity.SetTag("account.id", accountId);
        }
        
        return activity;
    }

    /// <summary>
    /// Records an exception on the current activity.
    /// </summary>
    public static void RecordException(this Activity? activity, Exception exception)
    {
        if (activity == null) return;
        
        activity.SetStatus(ActivityStatusCode.Error, exception.Message);
        activity.RecordException(exception);
    }

    /// <summary>
    /// Sets a success status on the activity.
    /// </summary>
    public static void SetSuccess(this Activity? activity, string? description = null)
    {
        activity?.SetStatus(ActivityStatusCode.Ok, description);
    }
}