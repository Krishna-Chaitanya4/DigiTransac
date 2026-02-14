using System.Text.Json;
using Microsoft.Extensions.Caching.Memory;
using DigiTransac.Api.Models;
using DigiTransac.Api.Models.Dto;
using DigiTransac.Api.Repositories;
using Microsoft.Extensions.Logging;

namespace DigiTransac.Api.Services;

public interface IExchangeRateService
{
    Task<ExchangeRateResponse> GetRatesAsync(string? baseCurrency = null, CancellationToken ct = default);
    Task<ExchangeRateResponse> RefreshRatesAsync(CancellationToken ct = default);
    decimal Convert(decimal amount, string fromCurrency, string toCurrency, Dictionary<string, decimal> rates);
    Task<List<CurrencyResponse>> GetSupportedCurrenciesAsync(CancellationToken ct = default);
}

public class ExchangeRateService : IExchangeRateService
{
    private readonly IExchangeRateRepository _exchangeRateRepository;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly IMemoryCache _cache;
    private readonly ILogger<ExchangeRateService> _logger;
    private readonly IHostEnvironment _environment;
    
    // Free tier: 1,500 requests/month - https://www.exchangerate-api.com/
    private const string ExchangeRateApiUrl = "https://open.er-api.com/v6/latest/USD";
    private const int CacheHours = 24; // Refresh once per day
    private const string RatesCacheKey = "exchange_rates";
    private const string CurrenciesCacheKey = "supported_currencies";
    private static readonly TimeSpan MemoryCacheDuration = TimeSpan.FromMinutes(30);
    
    // Rate limiting: prevent concurrent API calls (request coalescing)
    private static readonly SemaphoreSlim _refreshSemaphore = new(1, 1);
    private static Task<ExchangeRateResponse>? _refreshTask;
    private static DateTime _lastApiCall = DateTime.MinValue;
    private static readonly TimeSpan _minApiInterval = TimeSpan.FromMinutes(1); // Minimum 1 minute between API calls

    public ExchangeRateService(
        IExchangeRateRepository exchangeRateRepository,
        IHttpClientFactory httpClientFactory,
        IMemoryCache cache,
        ILogger<ExchangeRateService> logger,
        IHostEnvironment environment)
    {
        _exchangeRateRepository = exchangeRateRepository;
        _httpClientFactory = httpClientFactory;
        _cache = cache;
        _logger = logger;
        _environment = environment;
    }

    public async Task<ExchangeRateResponse> GetRatesAsync(string? baseCurrency = null, CancellationToken ct = default)
    {
        // Try memory cache first for fastest response
        var cacheKey = $"{RatesCacheKey}_{baseCurrency ?? "USD"}";
        if (_cache.TryGetValue(cacheKey, out ExchangeRateResponse? cachedResponse) && cachedResponse != null)
        {
            return cachedResponse;
        }

        var stored = await _exchangeRateRepository.GetLatestAsync();
        
        // If no rates or rates are stale, try to refresh
        if (stored == null || DateTime.UtcNow - stored.LastUpdated > TimeSpan.FromHours(CacheHours))
        {
            try
            {
                return await RefreshRatesAsync();
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to refresh exchange rates, using cached rates");
                
                // Return cached rates if available, even if stale
                if (stored != null)
                {
                    return MapToResponse(stored, baseCurrency);
                }
                
                // Return default rates if no cached data
                return GetDefaultRates();
            }
        }

        var response = MapToResponse(stored, baseCurrency);
        var cacheOptions = new MemoryCacheEntryOptions
        {
            AbsoluteExpirationRelativeToNow = MemoryCacheDuration,
            Size = 1 // Each exchange rate response counts as 1 unit
        };
        _cache.Set(cacheKey, response, cacheOptions);
        return response;
    }

    public async Task<ExchangeRateResponse> RefreshRatesAsync(CancellationToken ct = default)
    {
        // Rate limiting with request coalescing
        // If a refresh is already in progress, wait for it instead of making another API call
        await _refreshSemaphore.WaitAsync();
        try
        {
            // Check if we're being rate limited
            var timeSinceLastCall = DateTime.UtcNow - _lastApiCall;
            if (timeSinceLastCall < _minApiInterval)
            {
                _logger.LogInformation("Rate limited: waiting for {Seconds}s before next API call",
                    (_minApiInterval - timeSinceLastCall).TotalSeconds);
                
                // Return cached data if available
                var stored = await _exchangeRateRepository.GetLatestAsync();
                if (stored != null)
                {
                    return MapToResponse(stored, null);
                }
                
                // If no cached data, wait and retry
                await Task.Delay(_minApiInterval - timeSinceLastCall);
            }
            
            // If there's already a refresh in progress, reuse it
            if (_refreshTask != null && !_refreshTask.IsCompleted)
            {
                _logger.LogDebug("Reusing in-progress refresh task");
                return await _refreshTask;
            }
            
            // Start a new refresh task
            _refreshTask = RefreshRatesInternalAsync();
            return await _refreshTask;
        }
        finally
        {
            _refreshSemaphore.Release();
        }
    }
    
    private async Task<ExchangeRateResponse> RefreshRatesInternalAsync()
    {
        _logger.LogInformation("Fetching fresh exchange rates from API");
        _lastApiCall = DateTime.UtcNow;
        
        string? json = null;
        
        // Try HttpClient first (standard approach)
        try
        {
            var httpClient = _httpClientFactory.CreateClient("ExchangeRates");
            var response = await httpClient.GetAsync(ExchangeRateApiUrl);
            response.EnsureSuccessStatusCode();
            json = await response.Content.ReadAsStringAsync();
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "HttpClient failed, falling back to curl");
        }
        
        // Fallback to curl if HttpClient fails (handles proxy/firewall issues on some systems)
        // Only allowed in Development to avoid spawning system processes in production
        if (string.IsNullOrEmpty(json))
        {
            if (!_environment.IsDevelopment())
            {
                _logger.LogError("HttpClient failed and curl fallback is disabled in production");
                throw new InvalidOperationException("Unable to fetch exchange rates. Please check your internet connection.");
            }

            try
            {
                _logger.LogWarning("Using curl fallback for exchange rates (Development only)");
                json = await FetchWithCurlAsync(ExchangeRateApiUrl);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Curl fallback also failed");
                throw new InvalidOperationException("Unable to fetch exchange rates. Please check your internet connection.", ex);
            }
        }
        
        try
        {
            var apiResponse = JsonSerializer.Deserialize<ExchangeRateApiResponse>(json, new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true
            });

            if (apiResponse?.Result != "success" || apiResponse.Rates == null)
            {
                throw new InvalidOperationException("Invalid response from exchange rate API");
            }

            var exchangeRate = new ExchangeRate
            {
                BaseCurrency = "USD",
                Rates = apiResponse.Rates,
                LastUpdated = DateTime.UtcNow,
                Source = "open.er-api.com"
            };

            await _exchangeRateRepository.CreateOrUpdateAsync(exchangeRate);
            
            // Clear memory cache to force refresh
            InvalidateCache();
            
            _logger.LogInformation("Successfully updated exchange rates with {Count} currencies", exchangeRate.Rates.Count);
            
            var result = MapToResponse(exchangeRate, null);
            var cacheOptions = new MemoryCacheEntryOptions
            {
                AbsoluteExpirationRelativeToNow = MemoryCacheDuration,
                Size = 1 // Each exchange rate response counts as 1 unit
            };
            _cache.Set($"{RatesCacheKey}_USD", result, cacheOptions);
            return result;
        }
        catch (JsonException ex)
        {
            _logger.LogError(ex, "Failed to parse exchange rate API response");
            throw new InvalidOperationException("Invalid response from exchange rate service.", ex);
        }
    }
    
    private async Task<string> FetchWithCurlAsync(string url)
    {
        using var process = new System.Diagnostics.Process();
        process.StartInfo = new System.Diagnostics.ProcessStartInfo
        {
            FileName = "curl",
            Arguments = $"-s \"{url}\" -m 15",
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false,
            CreateNoWindow = true
        };
        
        process.Start();
        var output = await process.StandardOutput.ReadToEndAsync();
        await process.WaitForExitAsync();
        
        if (process.ExitCode != 0 || string.IsNullOrWhiteSpace(output))
        {
            var error = await process.StandardError.ReadToEndAsync();
            throw new InvalidOperationException($"Curl failed with exit code {process.ExitCode}: {error}");
        }
        
        return output;
    }

    public decimal Convert(decimal amount, string fromCurrency, string toCurrency, Dictionary<string, decimal> rates)
    {
        if (fromCurrency.Equals(toCurrency, StringComparison.OrdinalIgnoreCase))
        {
            return amount;
        }

        // All rates are relative to USD
        // To convert: First convert from source to USD, then from USD to target
        
        if (!rates.TryGetValue(fromCurrency.ToUpperInvariant(), out var fromRate))
        {
            _logger.LogWarning("Exchange rate not found for currency: {Currency}", fromCurrency);
            fromRate = 1m;
        }

        if (!rates.TryGetValue(toCurrency.ToUpperInvariant(), out var toRate))
        {
            _logger.LogWarning("Exchange rate not found for currency: {Currency}", toCurrency);
            toRate = 1m;
        }

        // Convert: amount in fromCurrency -> USD -> toCurrency
        // USD amount = amount / fromRate
        // Target amount = USD amount * toRate
        var usdAmount = amount / fromRate;
        var result = usdAmount * toRate;

        return Math.Round(result, 2);
    }

    public Task<List<CurrencyResponse>> GetSupportedCurrenciesAsync(CancellationToken ct = default)
    {
        var currencies = CurrencyConfig.Currencies
            .Select(kvp => new CurrencyResponse(kvp.Key, kvp.Value.Name, kvp.Value.Symbol))
            .OrderBy(c => c.Code)
            .ToList();

        return Task.FromResult(currencies);
    }

    private static ExchangeRateResponse MapToResponse(ExchangeRate exchangeRate, string? baseCurrency)
    {
        // If a different base currency is requested, we could recalculate rates
        // For simplicity, we always return USD-based rates
        return new ExchangeRateResponse(
            BaseCurrency: exchangeRate.BaseCurrency,
            Rates: exchangeRate.Rates,
            LastUpdated: exchangeRate.LastUpdated,
            Source: exchangeRate.Source
        );
    }

    private static ExchangeRateResponse GetDefaultRates()
    {
        // Fallback rates when API is unavailable and no cache exists
        return new ExchangeRateResponse(
            BaseCurrency: "USD",
            Rates: new Dictionary<string, decimal>
            {
                { "USD", 1m },
                { "INR", 83.5m },
                { "EUR", 0.92m },
                { "GBP", 0.79m },
                { "AED", 3.67m },
                { "SGD", 1.34m },
                { "AUD", 1.53m },
                { "CAD", 1.36m },
                { "JPY", 149.5m },
                { "CNY", 7.24m },
            },
            LastUpdated: DateTime.UtcNow,
            Source: "default"
        );
    }

    private void InvalidateCache()
    {
        // Remove all cached exchange rates
        foreach (var currency in CurrencyConfig.Currencies.Keys)
        {
            _cache.Remove($"{RatesCacheKey}_{currency}");
        }
        _cache.Remove(CurrenciesCacheKey);
    }
}

// Response from exchange rate API
internal class ExchangeRateApiResponse
{
    public string? Result { get; set; }
    public string? Base_Code { get; set; }
    public Dictionary<string, decimal>? Rates { get; set; }
}
