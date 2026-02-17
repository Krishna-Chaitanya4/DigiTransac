using DigiTransac.Api.Models;
using DigiTransac.Api.Services;
using MongoDB.Driver;

namespace DigiTransac.Api.Repositories;

public interface IExchangeRateRepository
{
    Task<ExchangeRate?> GetLatestAsync(CancellationToken ct = default);
    Task<ExchangeRate> CreateOrUpdateAsync(ExchangeRate exchangeRate, CancellationToken ct = default);
}

public class ExchangeRateRepository : IExchangeRateRepository
{
    private readonly IMongoCollection<ExchangeRate> _exchangeRates;

    public ExchangeRateRepository(IMongoDbService mongoDbService)
    {
        _exchangeRates = mongoDbService.GetCollection<ExchangeRate>("exchangeRates");
    }

    public async Task<ExchangeRate?> GetLatestAsync(CancellationToken ct = default)
    {
        return await _exchangeRates
            .Find(_ => true)
            .SortByDescending(e => e.LastUpdated)
            .FirstOrDefaultAsync(ct);
    }

    public async Task<ExchangeRate> CreateOrUpdateAsync(ExchangeRate exchangeRate, CancellationToken ct = default)
    {
        var existing = await GetLatestAsync(ct);
        
        if (existing != null)
        {
            exchangeRate.Id = existing.Id;
            await _exchangeRates.ReplaceOneAsync(e => e.Id == existing.Id, exchangeRate, options: (ReplaceOptions?)null, ct);
        }
        else
        {
            await _exchangeRates.InsertOneAsync(exchangeRate, options: null, ct);
        }
        
        return exchangeRate;
    }
}
