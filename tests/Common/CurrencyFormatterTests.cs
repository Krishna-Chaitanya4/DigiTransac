using DigiTransac.Api.Common;
using DigiTransac.Api.Models;
using FluentAssertions;

namespace DigiTransac.Tests.Common;

public class CurrencyFormatterTests
{
    // ========================================================================
    // GetSymbol
    // ========================================================================

    [Theory]
    [InlineData("USD", "$")]
    [InlineData("INR", "₹")]
    [InlineData("EUR", "€")]
    [InlineData("GBP", "£")]
    [InlineData("JPY", "¥")]
    public void GetSymbol_KnownCurrency_ReturnsCorrectSymbol(string code, string expected)
    {
        CurrencyFormatter.GetSymbol(code).Should().Be(expected);
    }

    [Theory]
    [InlineData("usd", "$")]
    [InlineData("inr", "₹")]
    public void GetSymbol_LowercaseCode_ReturnsCorrectSymbol(string code, string expected)
    {
        // CurrencyConfig.GetCurrency does ToUpperInvariant
        CurrencyFormatter.GetSymbol(code).Should().Be(expected);
    }

    [Fact]
    public void GetSymbol_UnknownCurrency_ReturnsCurrencyCodeAsSymbol()
    {
        // CurrencyConfig returns a fallback with code as symbol
        CurrencyFormatter.GetSymbol("XYZ").Should().Be("XYZ");
    }

    [Fact]
    public void GetSymbol_EmptyString_ReturnsEmpty()
    {
        CurrencyFormatter.GetSymbol("").Should().BeEmpty();
    }

    [Fact]
    public void GetSymbol_Null_ReturnsEmpty()
    {
        CurrencyFormatter.GetSymbol(null!).Should().BeEmpty();
    }

    // ========================================================================
    // Format
    // ========================================================================

    [Fact]
    public void Format_BasicAmount_ReturnsFormattedWithSymbol()
    {
        CurrencyFormatter.Format(1000m, "USD").Should().Be("$1,000.00");
    }

    [Fact]
    public void Format_INR_ReturnsRupeeSymbol()
    {
        var result = CurrencyFormatter.Format(500m, "INR");
        result.Should().StartWith("₹");
        result.Should().Contain("500.00");
    }

    [Fact]
    public void Format_ZeroAmount_FormatsCorrectly()
    {
        CurrencyFormatter.Format(0m, "USD").Should().Be("$0.00");
    }

    [Fact]
    public void Format_NegativeAmount_FormatsCorrectly()
    {
        var result = CurrencyFormatter.Format(-250.50m, "USD");
        result.Should().Contain("250.50");
    }

    [Fact]
    public void Format_LargeAmount_IncludesThousandSeparators()
    {
        var result = CurrencyFormatter.Format(1234567.89m, "USD");
        result.Should().StartWith("$");
        result.Should().Contain(","); // has thousand separators
        result.Should().EndWith("567.89"); // preserves decimal portion
    }

    // ========================================================================
    // FormatTransactionPreview
    // ========================================================================

    [Fact]
    public void FormatTransactionPreview_Send_StartWithSent()
    {
        var result = CurrencyFormatter.FormatTransactionPreview(TransactionType.Send, 1000m, "INR");
        result.Should().StartWith("Sent");
        result.Should().Contain("₹");
        result.Should().Contain("1,000.00");
    }

    [Fact]
    public void FormatTransactionPreview_Receive_StartWithReceived()
    {
        var result = CurrencyFormatter.FormatTransactionPreview(TransactionType.Receive, 500m, "USD");
        result.Should().Be("Received $500.00");
    }
}
