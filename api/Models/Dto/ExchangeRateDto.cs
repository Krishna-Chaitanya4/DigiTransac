namespace DigiTransac.Api.Models.Dto;

// Exchange Rate DTOs
public record ExchangeRateResponse(
    string BaseCurrency,
    Dictionary<string, decimal> Rates,
    DateTime LastUpdated,
    string Source
);

public record CurrencyResponse(
    string Code,
    string Name,
    string Symbol
);

public record UpdatePrimaryCurrencyRequest(
    string Currency
);
