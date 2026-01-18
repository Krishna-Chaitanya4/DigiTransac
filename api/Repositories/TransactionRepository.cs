using DigiTransac.Api.Models;
using DigiTransac.Api.Models.Dto;
using DigiTransac.Api.Settings;
using Microsoft.Extensions.Options;
using MongoDB.Bson;
using MongoDB.Driver;

namespace DigiTransac.Api.Repositories;

public interface ITransactionRepository
{
    Task<Transaction?> GetByIdAsync(string id);
    Task<Transaction?> GetByIdAndUserIdAsync(string id, string userId);
    Task<(List<Transaction> Transactions, int TotalCount)> GetFilteredAsync(string userId, TransactionFilterRequest filter);
    Task<List<Transaction>> GetByAccountIdAsync(string accountId, string userId);
    Task<List<Transaction>> GetRecurringTemplatesAsync(string userId);
    Task<List<Transaction>> GetPendingRecurringAsync(DateTime beforeDate);
    Task<Transaction> CreateAsync(Transaction transaction);
    Task CreateManyAsync(List<Transaction> transactions);
    Task UpdateAsync(Transaction transaction);
    Task<bool> DeleteAsync(string id, string userId);
    Task<bool> DeleteAllByUserIdAsync(string userId);
    Task<bool> DeleteAllByAccountIdAsync(string accountId, string userId);
    Task<decimal> GetSumByAccountIdAsync(string accountId, string userId, TransactionType? type = null);
    Task<Dictionary<string, decimal>> GetSumByLabelAsync(string userId, DateTime? startDate, DateTime? endDate);
    Task<Dictionary<string, decimal>> GetSumByTagAsync(string userId, DateTime? startDate, DateTime? endDate);
}

public class TransactionRepository : ITransactionRepository
{
    private readonly IMongoCollection<Transaction> _transactions;

    public TransactionRepository(IOptions<MongoDbSettings> settings)
    {
        var client = new MongoClient(settings.Value.ConnectionString);
        var database = client.GetDatabase(settings.Value.DatabaseName);
        _transactions = database.GetCollection<Transaction>("transactions");

        // Create indexes for efficient queries
        var indexModels = new List<CreateIndexModel<Transaction>>
        {
            // User + Date for listing transactions
            new(Builders<Transaction>.IndexKeys
                .Ascending(t => t.UserId)
                .Descending(t => t.Date)),
            
            // Account + Date for account-specific queries
            new(Builders<Transaction>.IndexKeys
                .Ascending(t => t.AccountId)
                .Descending(t => t.Date)),
            
            // User + Type for filtering
            new(Builders<Transaction>.IndexKeys
                .Ascending(t => t.UserId)
                .Ascending(t => t.Type)),
            
            // Recurring template lookup
            new(Builders<Transaction>.IndexKeys
                .Ascending(t => t.IsRecurringTemplate)
                .Ascending(t => t.RecurringRule!.NextOccurrence)),
            
            // Linked transactions for transfers
            new(Builders<Transaction>.IndexKeys.Ascending(t => t.LinkedTransactionId))
        };

        _transactions.Indexes.CreateMany(indexModels);
    }

    public async Task<Transaction?> GetByIdAsync(string id)
    {
        return await _transactions.Find(t => t.Id == id).FirstOrDefaultAsync();
    }

    public async Task<Transaction?> GetByIdAndUserIdAsync(string id, string userId)
    {
        return await _transactions.Find(t => t.Id == id && t.UserId == userId).FirstOrDefaultAsync();
    }

    public async Task<(List<Transaction> Transactions, int TotalCount)> GetFilteredAsync(
        string userId, 
        TransactionFilterRequest filter)
    {
        var filterBuilder = Builders<Transaction>.Filter;
        var filters = new List<FilterDefinition<Transaction>>
        {
            filterBuilder.Eq(t => t.UserId, userId),
            filterBuilder.Eq(t => t.IsRecurringTemplate, false) // Exclude templates from normal listings
        };

        if (filter.StartDate.HasValue)
        {
            filters.Add(filterBuilder.Gte(t => t.Date, filter.StartDate.Value));
        }

        if (filter.EndDate.HasValue)
        {
            filters.Add(filterBuilder.Lte(t => t.Date, filter.EndDate.Value));
        }

        if (!string.IsNullOrEmpty(filter.AccountId))
        {
            filters.Add(filterBuilder.Eq(t => t.AccountId, filter.AccountId));
        }

        if (!string.IsNullOrEmpty(filter.Type) && Enum.TryParse<TransactionType>(filter.Type, true, out var type))
        {
            filters.Add(filterBuilder.Eq(t => t.Type, type));
        }

        if (!string.IsNullOrEmpty(filter.LabelId))
        {
            filters.Add(filterBuilder.ElemMatch(t => t.Splits, s => s.LabelId == filter.LabelId));
        }

        if (!string.IsNullOrEmpty(filter.TagId))
        {
            filters.Add(filterBuilder.AnyEq(t => t.TagIds, filter.TagId));
        }

        if (filter.MinAmount.HasValue)
        {
            filters.Add(filterBuilder.Gte(t => t.Amount, filter.MinAmount.Value));
        }

        if (filter.MaxAmount.HasValue)
        {
            filters.Add(filterBuilder.Lte(t => t.Amount, filter.MaxAmount.Value));
        }

        if (filter.IsCleared.HasValue)
        {
            filters.Add(filterBuilder.Eq(t => t.IsCleared, filter.IsCleared.Value));
        }

        if (filter.IsRecurring.HasValue)
        {
            if (filter.IsRecurring.Value)
            {
                filters.Add(filterBuilder.Ne(t => t.ParentTransactionId, null));
            }
            else
            {
                filters.Add(filterBuilder.Eq(t => t.ParentTransactionId, null));
            }
        }

        // Text search on title (not encrypted)
        if (!string.IsNullOrEmpty(filter.SearchText))
        {
            var searchRegex = new BsonRegularExpression(filter.SearchText, "i");
            filters.Add(filterBuilder.Regex(t => t.Title, searchRegex));
        }

        var combinedFilter = filterBuilder.And(filters);

        var page = filter.Page ?? 1;
        var pageSize = filter.PageSize ?? 50;
        var skip = (page - 1) * pageSize;

        var totalCount = await _transactions.CountDocumentsAsync(combinedFilter);
        var transactions = await _transactions
            .Find(combinedFilter)
            .SortByDescending(t => t.Date)
            .ThenByDescending(t => t.CreatedAt)
            .Skip(skip)
            .Limit(pageSize)
            .ToListAsync();

        return (transactions, (int)totalCount);
    }

    public async Task<List<Transaction>> GetByAccountIdAsync(string accountId, string userId)
    {
        return await _transactions
            .Find(t => t.AccountId == accountId && t.UserId == userId && !t.IsRecurringTemplate)
            .SortByDescending(t => t.Date)
            .ToListAsync();
    }

    public async Task<List<Transaction>> GetRecurringTemplatesAsync(string userId)
    {
        return await _transactions
            .Find(t => t.UserId == userId && t.IsRecurringTemplate)
            .SortBy(t => t.RecurringRule!.NextOccurrence)
            .ToListAsync();
    }

    public async Task<List<Transaction>> GetPendingRecurringAsync(DateTime beforeDate)
    {
        return await _transactions
            .Find(t => t.IsRecurringTemplate && 
                       t.RecurringRule != null && 
                       t.RecurringRule.NextOccurrence <= beforeDate &&
                       (t.RecurringRule.EndDate == null || t.RecurringRule.EndDate >= beforeDate))
            .ToListAsync();
    }

    public async Task<Transaction> CreateAsync(Transaction transaction)
    {
        await _transactions.InsertOneAsync(transaction);
        return transaction;
    }

    public async Task CreateManyAsync(List<Transaction> transactions)
    {
        if (transactions.Count > 0)
        {
            await _transactions.InsertManyAsync(transactions);
        }
    }

    public async Task UpdateAsync(Transaction transaction)
    {
        transaction.UpdatedAt = DateTime.UtcNow;
        await _transactions.ReplaceOneAsync(
            t => t.Id == transaction.Id && t.UserId == transaction.UserId, 
            transaction);
    }

    public async Task<bool> DeleteAsync(string id, string userId)
    {
        var result = await _transactions.DeleteOneAsync(t => t.Id == id && t.UserId == userId);
        return result.DeletedCount > 0;
    }

    public async Task<bool> DeleteAllByUserIdAsync(string userId)
    {
        var result = await _transactions.DeleteManyAsync(t => t.UserId == userId);
        return result.DeletedCount > 0;
    }

    public async Task<bool> DeleteAllByAccountIdAsync(string accountId, string userId)
    {
        var result = await _transactions.DeleteManyAsync(t => t.AccountId == accountId && t.UserId == userId);
        return result.DeletedCount > 0;
    }

    public async Task<decimal> GetSumByAccountIdAsync(string accountId, string userId, TransactionType? type = null)
    {
        var filterBuilder = Builders<Transaction>.Filter;
        var filters = new List<FilterDefinition<Transaction>>
        {
            filterBuilder.Eq(t => t.AccountId, accountId),
            filterBuilder.Eq(t => t.UserId, userId),
            filterBuilder.Eq(t => t.IsRecurringTemplate, false)
        };

        if (type.HasValue)
        {
            filters.Add(filterBuilder.Eq(t => t.Type, type.Value));
        }

        var combinedFilter = filterBuilder.And(filters);

        var pipeline = _transactions.Aggregate()
            .Match(combinedFilter)
            .Group(new BsonDocument
            {
                { "_id", BsonNull.Value },
                { "total", new BsonDocument("$sum", "$amount") }
            });

        var result = await pipeline.FirstOrDefaultAsync();
        return result?["total"].ToDecimal() ?? 0m;
    }

    public async Task<Dictionary<string, decimal>> GetSumByLabelAsync(
        string userId, 
        DateTime? startDate, 
        DateTime? endDate)
    {
        var filterBuilder = Builders<Transaction>.Filter;
        var filters = new List<FilterDefinition<Transaction>>
        {
            filterBuilder.Eq(t => t.UserId, userId),
            filterBuilder.Eq(t => t.IsRecurringTemplate, false)
        };

        if (startDate.HasValue)
        {
            filters.Add(filterBuilder.Gte(t => t.Date, startDate.Value));
        }

        if (endDate.HasValue)
        {
            filters.Add(filterBuilder.Lte(t => t.Date, endDate.Value));
        }

        var pipeline = _transactions.Aggregate()
            .Match(filterBuilder.And(filters))
            .Unwind(t => t.Splits)
            .Group(new BsonDocument
            {
                { "_id", "$splits.labelId" },
                { "total", new BsonDocument("$sum", "$splits.amount") }
            });

        var results = await pipeline.ToListAsync();
        return results.ToDictionary(
            r => r["_id"].AsString,
            r => r["total"].ToDecimal());
    }

    public async Task<Dictionary<string, decimal>> GetSumByTagAsync(
        string userId, 
        DateTime? startDate, 
        DateTime? endDate)
    {
        var filterBuilder = Builders<Transaction>.Filter;
        var filters = new List<FilterDefinition<Transaction>>
        {
            filterBuilder.Eq(t => t.UserId, userId),
            filterBuilder.Eq(t => t.IsRecurringTemplate, false)
        };

        if (startDate.HasValue)
        {
            filters.Add(filterBuilder.Gte(t => t.Date, startDate.Value));
        }

        if (endDate.HasValue)
        {
            filters.Add(filterBuilder.Lte(t => t.Date, endDate.Value));
        }

        var pipeline = _transactions.Aggregate()
            .Match(filterBuilder.And(filters))
            .Unwind(t => t.TagIds)
            .Group(new BsonDocument
            {
                { "_id", "$tagIds" },
                { "total", new BsonDocument("$sum", "$amount") }
            });

        var results = await pipeline.ToListAsync();
        return results.ToDictionary(
            r => r["_id"].AsString,
            r => r["total"].ToDecimal());
    }
}
