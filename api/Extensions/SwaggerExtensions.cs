using System.Reflection;
using Microsoft.OpenApi;
using Swashbuckle.AspNetCore.SwaggerGen;

namespace DigiTransac.Api.Extensions;

/// <summary>
/// Extension methods for configuring Swagger/OpenAPI documentation.
/// </summary>
public static class SwaggerExtensions
{
    /// <summary>
    /// Adds Swagger/OpenAPI documentation with JWT security, XML comments, and comprehensive API info.
    /// </summary>
    public static WebApplicationBuilder AddSwaggerDocumentation(this WebApplicationBuilder builder)
    {
        builder.Services.AddEndpointsApiExplorer();
        builder.Services.AddSwaggerGen(c =>
        {
            ConfigureApiInfo(c);
            ConfigureSecurityScheme(c);
            ConfigureXmlComments(c);
            ConfigureTagsAndOrdering(c);
        });

        return builder;
    }

    private static void ConfigureApiInfo(SwaggerGenOptions c)
    {
        c.SwaggerDoc("v1", new OpenApiInfo
        {
            Version = "v1",
            Title = "DigiTransac API",
            Description = @"
## DigiTransac - Personal Finance Management API

A comprehensive API for managing personal finances with WhatsApp-style P2P transaction tracking.

### Features
- **Authentication** - JWT-based auth with 2FA support
- **Accounts** - Multi-currency account management
- **Transactions** - Full CRUD with P2P, recurring, and bulk import
- **Labels & Tags** - Hierarchical categorization
- **Analytics** - Spending trends and insights
- **Real-time Updates** - SignalR notifications
- **Chat Integration** - Transaction messages with activity feed

### Authentication
All endpoints except `/api/auth/*` require JWT authentication.
Include the token in the Authorization header: `Bearer {token}`

### Rate Limits
- General API: 100 requests/minute
- Auth endpoints: 10 requests/minute
- Sensitive operations: 5 requests/5 minutes

### Response Codes
| Code | Description |
|------|-------------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request - validation error |
| 401 | Unauthorized - invalid/expired token |
| 403 | Forbidden - insufficient permissions |
| 404 | Not Found |
| 429 | Too Many Requests - rate limited |
| 500 | Internal Server Error |
",
            Contact = new OpenApiContact
            {
                Name = "DigiTransac Support",
                Email = "support@digitransac.app",
                Url = new Uri("https://github.com/digitransac/api")
            },
            License = new OpenApiLicense
            {
                Name = "MIT License",
                Url = new Uri("https://opensource.org/licenses/MIT")
            }
        });
    }

    private static void ConfigureSecurityScheme(SwaggerGenOptions c)
    {
        c.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
        {
            Name = "Authorization",
            Description = @"JWT Authorization header using the Bearer scheme.

Enter your token in the format: **Bearer {your_token}**

Example: `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`

To obtain a token:
1. Call `POST /api/auth/login` with valid credentials
2. Copy the `accessToken` from the response
3. Click the **Authorize** button and paste it",
            Type = SecuritySchemeType.Http,
            Scheme = "bearer",
            BearerFormat = "JWT",
            In = ParameterLocation.Header
        });

        c.AddSecurityRequirement((doc) =>
        {
            var requirement = new OpenApiSecurityRequirement();
            var schemeReference = new OpenApiSecuritySchemeReference("Bearer", doc);
            requirement[schemeReference] = new List<string>();
            return requirement;
        });
    }

    private static void ConfigureXmlComments(SwaggerGenOptions c)
    {
        var xmlFilename = $"{Assembly.GetExecutingAssembly().GetName().Name}.xml";
        var xmlPath = Path.Combine(AppContext.BaseDirectory, xmlFilename);
        if (File.Exists(xmlPath))
        {
            c.IncludeXmlComments(xmlPath);
        }
    }

    private static void ConfigureTagsAndOrdering(SwaggerGenOptions c)
    {
        c.TagActionsBy(api => new[] { api.GroupName ?? "Other" });
        c.OrderActionsBy(api => api.RelativePath);
        c.EnableAnnotations();
    }
}