using DigiTransac.Api.Models;

namespace DigiTransac.Api.Common;

/// <summary>
/// Shared utility class for formatting currency amounts with symbols.
/// Uses <see cref="CurrencyConfig"/> from ExchangeRate.cs as the single source of truth.
/// </summary>
public static class CurrencyFormatter
{
    /// <summary>
    /// Get the symbol for a currency code (e.g., "USD" → "$", "INR" → "₹").
    /// </summary>
    public static string GetSymbol(string currencyCode)
    {
        if (string.IsNullOrEmpty(currencyCode))
            return "";

        var currencyInfo = CurrencyConfig.GetCurrency(currencyCode);
        return currencyInfo.Symbol;
    }

    /// <summary>
    /// Format an amount with its currency symbol (e.g., "$1,000.00", "₹500.00").
    /// </summary>
    public static string Format(decimal amount, string currencyCode)
    {
        var symbol = GetSymbol(currencyCode);
        return $"{symbol}{amount:N2}";
    }

    /// <summary>
    /// Format a transaction preview (e.g., "Sent ₹1,000.00", "Received $500.00").
    /// </summary>
    public static string FormatTransactionPreview(TransactionType type, decimal amount, string currencyCode)
    {
        var direction = type == TransactionType.Send ? "Sent" : "Received";
        return $"{direction} {Format(amount, currencyCode)}";
    }
}