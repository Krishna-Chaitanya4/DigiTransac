using DigiTransac.Api.Models;
using DigiTransac.Api.Services;
using MongoDB.Driver;

namespace DigiTransac.Api.Repositories;

public interface IExchangeRateRepository
{
    Task<ExchangeRate?> GetLatestAsync();
    Task<ExchangeRate> CreateOrUpdateAsync(ExchangeRate exchangeRate);
}

public class ExchangeRateRepository : IExchangeRateRepository
{
    private readonly IMongoCollection<ExchangeRate> _exchangeRates;

    public ExchangeRateRepository(IMongoDbService mongoDbService)
    {
        _exchangeRates = mongoDbService.GetCollection<ExchangeRate>("exchangeRates");
    }

    public async Task<ExchangeRate?> GetLatestAsync()
    {
        return await _exchangeRates
            .Find(_ => true)
            .SortByDescending(e => e.LastUpdated)
            .FirstOrDefaultAsync();
    }

    public async Task<ExchangeRate> CreateOrUpdateAsync(ExchangeRate exchangeRate)
    {
        var existing = await GetLatestAsync();
        
        if (existing != null)
        {
            exchangeRate.Id = existing.Id;
            await _exchangeRates.ReplaceOneAsync(e => e.Id == existing.Id, exchangeRate);
        }
        else
        {
            await _exchangeRates.InsertOneAsync(exchangeRate);
        }
        
        return exchangeRate;
    }
}
