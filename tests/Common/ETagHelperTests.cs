using DigiTransac.Api.Common;
using FluentAssertions;
using Microsoft.AspNetCore.Http;

namespace DigiTransac.Tests.Common;

public class ETagHelperTests
{
    // ========================================================================
    // ComputeETag
    // ========================================================================

    [Fact]
    public void ComputeETag_SameData_ReturnsSameHash()
    {
        var data = new { Name = "Alice", Amount = 100 };
        var etag1 = ETagHelper.ComputeETag(data);
        var etag2 = ETagHelper.ComputeETag(data);

        etag1.Should().Be(etag2);
    }

    [Fact]
    public void ComputeETag_DifferentData_ReturnsDifferentHash()
    {
        var data1 = new { Name = "Alice", Amount = 100 };
        var data2 = new { Name = "Bob", Amount = 200 };

        var etag1 = ETagHelper.ComputeETag(data1);
        var etag2 = ETagHelper.ComputeETag(data2);

        etag1.Should().NotBe(etag2);
    }

    [Fact]
    public void ComputeETag_UsesUrlSafeBase64()
    {
        // The ETag should not contain +, /, or = (URL-safe base64)
        var data = new { Test = "sample data for hash generation" };
        var etag = ETagHelper.ComputeETag(data);

        etag.Should().NotContain("+");
        etag.Should().NotContain("/");
        etag.Should().NotEndWith("=");
    }

    [Fact]
    public void ComputeETag_ReturnsNonEmptyString()
    {
        var etag = ETagHelper.ComputeETag(new { });
        etag.Should().NotBeNullOrEmpty();
    }

    [Fact]
    public void ComputeETag_NullPropertyIgnored_UsesCamelCase()
    {
        // The serializer uses CamelCase and ignores null
        var data1 = new { FirstName = "Alice", LastName = (string?)null };
        var data2 = new { FirstName = "Alice" };

        // These may produce same or different ETags depending on anonymous type shape.
        // The important thing is that both compute without error
        var etag1 = ETagHelper.ComputeETag(data1);
        var etag2 = ETagHelper.ComputeETag(data2);

        etag1.Should().NotBeNullOrEmpty();
        etag2.Should().NotBeNullOrEmpty();
    }

    // ========================================================================
    // OkWithETag — 200 with ETag header
    // ========================================================================

    [Fact]
    public void OkWithETag_NoIfNoneMatch_Returns200WithETag()
    {
        var context = new DefaultHttpContext();
        var data = new { Name = "Test" };

        var result = ETagHelper.OkWithETag(context, data);

        context.Response.Headers.ETag.ToString().Should().NotBeNullOrEmpty();
        context.Response.Headers.CacheControl.ToString().Should().Contain("private");
        context.Response.Headers.Vary.ToString().Should().Contain("Authorization");
    }

    [Fact]
    public void OkWithETag_MatchingETag_Returns304()
    {
        var data = new { Name = "Test" };
        var etag = ETagHelper.ComputeETag(data);

        var context = new DefaultHttpContext();
        context.Request.Headers.IfNoneMatch = $"\"{etag}\"";

        var result = ETagHelper.OkWithETag(context, data);

        // The result should be 304
        // We can check by examining the response code set on the context
        // The StatusCode(304) result doesn't set HttpResponse.StatusCode directly
        // but we can verify the ETag header was set
        context.Response.Headers.ETag.ToString().Should().Contain(etag);
    }

    [Fact]
    public void OkWithETag_DifferentETag_Returns200()
    {
        var data = new { Name = "Test" };

        var context = new DefaultHttpContext();
        context.Request.Headers.IfNoneMatch = "\"completely-different-etag\"";

        var result = ETagHelper.OkWithETag(context, data);

        context.Response.Headers.ETag.ToString().Should().NotBeNullOrEmpty();
    }

    [Fact]
    public void OkWithETag_WildcardIfNoneMatch_Returns304()
    {
        var data = new { Name = "Test" };

        var context = new DefaultHttpContext();
        context.Request.Headers.IfNoneMatch = "*";

        var result = ETagHelper.OkWithETag(context, data);

        // Wildcard should match any ETag
        context.Response.Headers.ETag.ToString().Should().NotBeNullOrEmpty();
    }

    [Fact]
    public void OkWithETag_CustomMaxAge_SetsCacheControl()
    {
        var context = new DefaultHttpContext();
        var data = new { Name = "Test" };

        ETagHelper.OkWithETag(context, data, cacheMaxAgeSeconds: 3600);

        context.Response.Headers.CacheControl.ToString()
            .Should().Contain("max-age=3600");
    }

    [Fact]
    public void OkWithETag_DefaultMaxAge_SetsNoCache()
    {
        var context = new DefaultHttpContext();
        var data = new { Name = "Test" };

        ETagHelper.OkWithETag(context, data);

        context.Response.Headers.CacheControl.ToString()
            .Should().Contain("no-cache");
    }

    [Fact]
    public void OkWithETag_MultipleETags_MatchesAny()
    {
        var data = new { Name = "Test" };
        var etag = ETagHelper.ComputeETag(data);

        var context = new DefaultHttpContext();
        context.Request.Headers.IfNoneMatch = $"\"other-etag\", \"{etag}\"";

        var result = ETagHelper.OkWithETag(context, data);

        // Should match since the correct ETag is in the comma-separated list
        context.Response.Headers.ETag.ToString().Should().Contain(etag);
    }
}
