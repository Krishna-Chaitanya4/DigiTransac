using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace DigiTransac.Api.Models;

/// <summary>
/// Stores exchange rates with a base currency.
/// All rates are stored relative to a single base currency (USD by default from the API).
/// </summary>
[BsonIgnoreExtraElements]
public class ExchangeRate
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string Id { get; set; } = null!;

    /// <summary>
    /// The base currency code (e.g., "USD").
    /// All rates are relative to this currency.
    /// </summary>
    [BsonElement("baseCurrency")]
    public string BaseCurrency { get; set; } = "USD";

    /// <summary>
    /// Dictionary of currency codes to their rates.
    /// Rate represents: 1 BaseCurrency = Rate TargetCurrency
    /// E.g., if BaseCurrency is USD and rates["INR"] = 83.5, then 1 USD = 83.5 INR
    /// </summary>
    [BsonElement("rates")]
    public Dictionary<string, decimal> Rates { get; set; } = new();

    /// <summary>
    /// When these rates were last fetched from the API.
    /// </summary>
    [BsonElement("lastUpdated")]
    public DateTime LastUpdated { get; set; } = DateTime.UtcNow;

    /// <summary>
    /// Source of the exchange rates (e.g., "exchangerate-api.com").
    /// </summary>
    [BsonElement("source")]
    public string Source { get; set; } = "exchangerate-api.com";
}

/// <summary>
/// Currency configuration with display information.
/// </summary>
public static class CurrencyConfig
{
    public static readonly Dictionary<string, CurrencyInfo> Currencies = new()
    {
        { "INR", new CurrencyInfo("INR", "Indian Rupee", "₹", "en-IN") },
        { "USD", new CurrencyInfo("USD", "US Dollar", "$", "en-US") },
        { "EUR", new CurrencyInfo("EUR", "Euro", "€", "de-DE") },
        { "GBP", new CurrencyInfo("GBP", "British Pound", "£", "en-GB") },
        { "AED", new CurrencyInfo("AED", "UAE Dirham", "د.إ", "ar-AE") },
        { "SGD", new CurrencyInfo("SGD", "Singapore Dollar", "S$", "en-SG") },
        { "AUD", new CurrencyInfo("AUD", "Australian Dollar", "A$", "en-AU") },
        { "CAD", new CurrencyInfo("CAD", "Canadian Dollar", "C$", "en-CA") },
        { "JPY", new CurrencyInfo("JPY", "Japanese Yen", "¥", "ja-JP") },
        { "CNY", new CurrencyInfo("CNY", "Chinese Yuan", "¥", "zh-CN") },
        { "CHF", new CurrencyInfo("CHF", "Swiss Franc", "CHF", "de-CH") },
        { "HKD", new CurrencyInfo("HKD", "Hong Kong Dollar", "HK$", "zh-HK") },
        { "NZD", new CurrencyInfo("NZD", "New Zealand Dollar", "NZ$", "en-NZ") },
        { "SEK", new CurrencyInfo("SEK", "Swedish Krona", "kr", "sv-SE") },
        { "KRW", new CurrencyInfo("KRW", "South Korean Won", "₩", "ko-KR") },
        { "MXN", new CurrencyInfo("MXN", "Mexican Peso", "$", "es-MX") },
        { "BRL", new CurrencyInfo("BRL", "Brazilian Real", "R$", "pt-BR") },
        { "ZAR", new CurrencyInfo("ZAR", "South African Rand", "R", "en-ZA") },
        { "RUB", new CurrencyInfo("RUB", "Russian Ruble", "₽", "ru-RU") },
        { "THB", new CurrencyInfo("THB", "Thai Baht", "฿", "th-TH") },
        { "MYR", new CurrencyInfo("MYR", "Malaysian Ringgit", "RM", "ms-MY") },
        { "IDR", new CurrencyInfo("IDR", "Indonesian Rupiah", "Rp", "id-ID") },
        { "PHP", new CurrencyInfo("PHP", "Philippine Peso", "₱", "en-PH") },
        { "VND", new CurrencyInfo("VND", "Vietnamese Dong", "₫", "vi-VN") },
        { "PKR", new CurrencyInfo("PKR", "Pakistani Rupee", "₨", "ur-PK") },
        { "BDT", new CurrencyInfo("BDT", "Bangladeshi Taka", "৳", "bn-BD") },
        { "LKR", new CurrencyInfo("LKR", "Sri Lankan Rupee", "Rs", "si-LK") },
        { "NPR", new CurrencyInfo("NPR", "Nepalese Rupee", "रू", "ne-NP") },
    };

    public static CurrencyInfo GetCurrency(string code)
    {
        return Currencies.TryGetValue(code.ToUpperInvariant(), out var info)
            ? info
            : new CurrencyInfo(code, code, code, "en-US");
    }

    public static bool IsValidCurrency(string code)
    {
        return Currencies.ContainsKey(code.ToUpperInvariant());
    }
}

public record CurrencyInfo(
    string Code,
    string Name,
    string Symbol,
    string Locale
);
