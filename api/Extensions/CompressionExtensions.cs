using System.IO.Compression;
using Asp.Versioning;
using Microsoft.AspNetCore.ResponseCompression;

namespace DigiTransac.Api.Extensions;

/// <summary>
/// Extension methods for configuring response compression, output caching, and API versioning.
/// </summary>
public static class CompressionExtensions
{
    /// <summary>
    /// Adds output caching policies, response compression (Brotli + Gzip), and API versioning.
    /// </summary>
    public static WebApplicationBuilder AddCachingAndCompression(this WebApplicationBuilder builder)
    {
        AddOutputCaching(builder);
        AddResponseCompression(builder);
        AddApiVersioning(builder);

        return builder;
    }

    private static void AddOutputCaching(WebApplicationBuilder builder)
    {
        builder.Services.AddOutputCache(options =>
        {
            options.AddPolicy("Default", b =>
                b.Expire(TimeSpan.FromSeconds(30)));

            options.AddPolicy("ExchangeRates", b =>
                b.Expire(TimeSpan.FromMinutes(5))
                 .Tag("exchange-rates"));

            options.AddPolicy("AccountSummary", b =>
                b.Expire(TimeSpan.FromSeconds(60))
                 .SetVaryByHeader("Authorization")
                 .Tag("accounts"));

            options.AddPolicy("StaticData", b =>
                b.Expire(TimeSpan.FromMinutes(2))
                 .SetVaryByHeader("Authorization")
                 .Tag("static-data"));
        });
    }

    private static void AddResponseCompression(WebApplicationBuilder builder)
    {
        builder.Services.AddResponseCompression(options =>
        {
            options.EnableForHttps = true;
            options.Providers.Add<BrotliCompressionProvider>();
            options.Providers.Add<GzipCompressionProvider>();
            options.MimeTypes = ResponseCompressionDefaults.MimeTypes.Concat(new[]
            {
                "application/json",
                "text/json"
            });
        });

        builder.Services.Configure<BrotliCompressionProviderOptions>(options =>
        {
            options.Level = CompressionLevel.Fastest;
        });

        builder.Services.Configure<GzipCompressionProviderOptions>(options =>
        {
            options.Level = CompressionLevel.SmallestSize;
        });
    }

    private static void AddApiVersioning(WebApplicationBuilder builder)
    {
        builder.Services.AddApiVersioning(options =>
        {
            options.DefaultApiVersion = new ApiVersion(1, 0);
            options.AssumeDefaultVersionWhenUnspecified = true;
            options.ReportApiVersions = true;
            options.ApiVersionReader = ApiVersionReader.Combine(
                new UrlSegmentApiVersionReader(),
                new HeaderApiVersionReader("X-API-Version"),
                new QueryStringApiVersionReader("api-version")
            );
        })
        .AddApiExplorer(options =>
        {
            options.GroupNameFormat = "'v'VVV";
            options.SubstituteApiVersionInUrl = true;
        });
    }
}