using DigiTransac.Api.Endpoints;
using DigiTransac.Api.Hubs;
using DigiTransac.Api.Middleware;
using DigiTransac.Api.Settings;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using Serilog;

namespace DigiTransac.Api.Extensions;

/// <summary>
/// Extension methods for configuring the HTTP request pipeline: middleware, health checks, and endpoint mapping.
/// </summary>
public static class MiddlewareExtensions
{
    /// <summary>
    /// Configures the full HTTP request pipeline including security, compression, auth, caching, health checks, and endpoints.
    /// </summary>
    public static WebApplication UseApplicationPipeline(this WebApplication app)
    {
        app.UseGlobalExceptionHandler();
        app.UseRequestLogging();
        ConfigureSecurityMiddleware(app);
        app.UseResponseCompression();
        ConfigureSwagger(app);
        ConfigureRateLimiting(app);

        app.UseCors("AllowFrontend");
        app.UseAuthentication();
        app.UseAuthorization();
        app.UseOutputCache();

        MapHealthChecks(app);
        MapEndpoints(app);

        return app;
    }

    private static void ConfigureSecurityMiddleware(WebApplication app)
    {
        var securitySettings = app.Configuration.GetSection("Security").Get<SecuritySettings>() ?? new SecuritySettings();

        if (!app.Environment.IsDevelopment() && securitySettings.UseHttps)
        {
            app.UseHttpsRedirection();
        }

        if (!app.Environment.IsDevelopment())
        {
            app.UseHsts();
        }
    }

    private static void ConfigureSwagger(WebApplication app)
    {
        if (app.Environment.IsDevelopment())
        {
            app.UseSwagger(c =>
            {
                c.RouteTemplate = "api-docs/{documentName}/swagger.json";
            });

            app.UseSwaggerUI(c =>
            {
                c.SwaggerEndpoint("/api-docs/v1/swagger.json", "DigiTransac API v1");
                c.RoutePrefix = "api-docs";
                c.DocumentTitle = "DigiTransac API Documentation";
                c.DefaultModelsExpandDepth(2);
                c.DefaultModelRendering(Swashbuckle.AspNetCore.SwaggerUI.ModelRendering.Model);
                c.DocExpansion(Swashbuckle.AspNetCore.SwaggerUI.DocExpansion.List);
                c.EnableDeepLinking();
                c.DisplayOperationId();
                c.ShowExtensions();
                c.EnableFilter();
                c.EnableTryItOutByDefault();
            });
        }
    }

    private static void ConfigureRateLimiting(WebApplication app)
    {
        var disableRateLimiting = Environment.GetEnvironmentVariable("DISABLE_RATE_LIMITING");
        if (!string.Equals(disableRateLimiting, "true", StringComparison.OrdinalIgnoreCase))
        {
            app.UseRateLimiter();
        }
        else
        {
            Log.Information("Rate limiting is disabled via DISABLE_RATE_LIMITING environment variable");
        }
    }

    private static void MapHealthChecks(WebApplication app)
    {
        // Full health check with detailed report
        app.MapHealthChecks("/api/health", new HealthCheckOptions
        {
            ResponseWriter = async (context, report) =>
            {
                context.Response.ContentType = "application/json";
                var result = new
                {
                    status = report.Status.ToString(),
                    timestamp = DateTime.UtcNow,
                    totalDuration = report.TotalDuration.TotalMilliseconds,
                    checks = report.Entries.Select(e => new
                    {
                        name = e.Key,
                        status = e.Value.Status.ToString(),
                        duration = e.Value.Duration.TotalMilliseconds,
                        description = e.Value.Description,
                        tags = e.Value.Tags
                    })
                };
                await context.Response.WriteAsJsonAsync(result);
            }
        });

        // Liveness probe (just checks if app is running)
        app.MapHealthChecks("/api/health/live", new HealthCheckOptions
        {
            Predicate = _ => false,
            ResponseWriter = async (context, _) =>
            {
                context.Response.ContentType = "application/json";
                await context.Response.WriteAsJsonAsync(new { status = "Healthy", timestamp = DateTime.UtcNow });
            }
        });

        // Readiness probe (checks if app can serve requests)
        app.MapHealthChecks("/api/health/ready", new HealthCheckOptions
        {
            Predicate = check => check.Tags.Contains("db"),
            ResponseWriter = async (context, report) =>
            {
                context.Response.ContentType = "application/json";
                await context.Response.WriteAsJsonAsync(new
                {
                    status = report.Status.ToString(),
                    timestamp = DateTime.UtcNow,
                    database = report.Entries.FirstOrDefault().Value.Status.ToString()
                });
            }
        });
    }

    private static void MapEndpoints(WebApplication app)
    {
        app.MapAuthEndpoints();
        app.MapTwoFactorEndpoints();
        app.MapLabelEndpoints();
        app.MapTagEndpoints();
        app.MapAccountEndpoints();
        app.MapCurrencyEndpoints();
        app.MapTransactionEndpoints();
        app.MapConversationEndpoints();
        app.MapBudgetEndpoints();
        app.MapPushEndpoints();

        // SignalR hub
        app.MapHub<NotificationHub>("/hubs/notifications");
    }
}