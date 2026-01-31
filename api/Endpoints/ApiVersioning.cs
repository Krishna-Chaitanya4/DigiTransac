using Asp.Versioning;
using Asp.Versioning.Builder;

namespace DigiTransac.Api.Endpoints;

/// <summary>
/// API versioning infrastructure and helpers
/// </summary>
public static class ApiVersioning
{
    /// <summary>
    /// API Version 1.0 - Initial release
    /// </summary>
    public static readonly ApiVersion V1 = new(1, 0);
    
    /// <summary>
    /// API Version 2.0 - Future breaking changes
    /// </summary>
    public static readonly ApiVersion V2 = new(2, 0);
    
    /// <summary>
    /// Creates a versioned API version set for the application
    /// </summary>
    public static ApiVersionSet CreateVersionSet(this WebApplication app)
    {
        return app.NewApiVersionSet()
            .HasApiVersion(V1)
            .HasApiVersion(V2)
            .ReportApiVersions()
            .Build();
    }
    
    /// <summary>
    /// Maps endpoints with versioning support.
    /// Call this after setting up versioned groups.
    /// </summary>
    public static void MapVersionedEndpoints(this WebApplication app)
    {
        var versionSet = app.CreateVersionSet();
        
        // V1 endpoints - /api/v1/...
        var v1 = app.MapGroup("/api/v{version:apiVersion}")
            .WithApiVersionSet(versionSet)
            .MapToApiVersion(V1);
        
        // Map V1 transaction endpoints as an example
        v1.MapTransactionEndpointsV1();
        
        // V2 endpoints would go here when needed
        // var v2 = app.MapGroup("/api/v{version:apiVersion}")
        //     .WithApiVersionSet(versionSet)
        //     .MapToApiVersion(V2);
        // v2.MapTransactionEndpointsV2();
    }
    
    /// <summary>
    /// Example of versioned transaction endpoints for V1.
    /// This demonstrates how to migrate existing endpoints to versioned routes.
    /// Note: The current non-versioned endpoints at /api/transactions remain unchanged
    /// for backward compatibility.
    /// </summary>
    private static void MapTransactionEndpointsV1(this RouteGroupBuilder group)
    {
        // V1 API info endpoint (demonstrates versioning is working)
        group.MapGet("/info", () => Results.Ok(new 
        {
            ApiVersion = "1.0",
            Description = "DigiTransac API v1",
            SupportedVersions = new[] { "1.0" }
        }))
        .WithName("GetApiInfoV1")
        .WithTags("API Info");
    }
}