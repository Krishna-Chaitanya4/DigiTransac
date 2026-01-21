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
    
    // Count methods for validation before deletion
    Task<int> GetCountByAccountIdAsync(string accountId, string userId);
    Task<Dictionary<string, int>> GetCountsByAccountIdsAsync(IEnumerable<string> accountIds, string userId);
    Task<int> GetCountByLabelIdAsync(string labelId, string userId);
    Task<int> GetCountByTagIdAsync(string tagId, string userId);
    
    // Reassignment methods
    Task ReassignLabelAsync(string fromLabelId, string toLabelId, string userId);
    Task RemoveTagFromAllAsync(string tagId, string userId);
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

        // Filter by multiple accounts (OR logic)
        if (filter.AccountIds?.Count > 0)
        {
            filters.Add(filterBuilder.In(t => t.AccountId, filter.AccountIds));
        }

        // Filter by multiple types (OR logic)
        if (filter.Types?.Count > 0)
        {
            var parsedTypes = filter.Types
                .Where(t => Enum.TryParse<TransactionType>(t, true, out _))
                .Select(t => Enum.Parse<TransactionType>(t, true))
                .ToList();
            if (parsedTypes.Count > 0)
            {
                filters.Add(filterBuilder.In(t => t.Type, parsedTypes));
            }
        }

        // Filter by multiple labels/categories (OR logic)
        if (filter.LabelIds?.Count > 0)
        {
            filters.Add(filterBuilder.ElemMatch(t => t.Splits, 
                Builders<TransactionSplit>.Filter.In(s => s.LabelId, filter.LabelIds)));
        }

        // Filter by multiple tags (OR logic - match any of the selected tags)
        if (filter.TagIds?.Count > 0)
        {
            filters.Add(filterBuilder.AnyIn(t => t.TagIds, filter.TagIds));
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

        // Text search on title (not encrypted) OR matching labels/tags by name OR city/country
        if (!string.IsNullOrEmpty(filter.SearchText))
        {
            var searchRegex = new BsonRegularExpression(filter.SearchText, "i");
            var searchFilters = new List<FilterDefinition<Transaction>>
            {
                filterBuilder.Regex(t => t.Title, searchRegex),
                // Search by city (unencrypted)
                filterBuilder.Regex(t => t.Location!.City, searchRegex),
                // Search by country (unencrypted)
                filterBuilder.Regex(t => t.Location!.Country, searchRegex)
            };
            
            // Add label name matches (if service provided matching IDs)
            if (filter.SearchLabelIds?.Count > 0)
            {
                searchFilters.Add(filterBuilder.ElemMatch(t => t.Splits, 
                    Builders<TransactionSplit>.Filter.In(s => s.LabelId, filter.SearchLabelIds)));
            }
            
            // Add tag name matches (if service provided matching IDs)
            if (filter.SearchTagIds?.Count > 0)
            {
                searchFilters.Add(filterBuilder.AnyIn(t => t.TagIds, filter.SearchTagIds));
            }
            
            // Add account name matches (if service provided matching IDs)
            if (filter.SearchAccountIds?.Count > 0)
            {
                searchFilters.Add(filterBuilder.In(t => t.AccountId, filter.SearchAccountIds));
            }
            
            // Use OR - match any of title, label, tag, city, country, or account
            filters.Add(filterBuilder.Or(searchFilters));
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
        return results
            .Where(r => !r["_id"].IsBsonNull)
            .ToDictionary(
                r => r["_id"].IsString ? r["_id"].AsString : r["_id"].AsObjectId.ToString(),
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
        return results
            .Where(r => !r["_id"].IsBsonNull)
            .ToDictionary(
                r => r["_id"].IsString ? r["_id"].AsString : r["_id"].AsObjectId.ToString(),
                r => r["total"].ToDecimal());
    }

    public async Task<int> GetCountByAccountIdAsync(string accountId, string userId)
    {
        var filter = Builders<Transaction>.Filter.And(
            Builders<Transaction>.Filter.Eq(t => t.AccountId, accountId),
            Builders<Transaction>.Filter.Eq(t => t.UserId, userId),
            Builders<Transaction>.Filter.Eq(t => t.IsRecurringTemplate, false)
        );
        return (int)await _transactions.CountDocumentsAsync(filter);
    }

    public async Task<Dictionary<string, int>> GetCountsByAccountIdsAsync(IEnumerable<string> accountIds, string userId)
    {
        var accountIdList = accountIds.ToList();
        if (accountIdList.Count == 0)
        {
            return new Dictionary<string, int>();
        }

        var filter = Builders<Transaction>.Filter.And(
            Builders<Transaction>.Filter.In(t => t.AccountId, accountIdList),
            Builders<Transaction>.Filter.Eq(t => t.UserId, userId),
            Builders<Transaction>.Filter.Eq(t => t.IsRecurringTemplate, false)
        );

        var pipeline = new[]
        {
            new BsonDocument("$match", filter.ToBsonDocument()),
            new BsonDocument("$group", new BsonDocument
            {
                { "_id", "$AccountId" },
                { "count", new BsonDocument("$sum", 1) }
            })
        };

        var results = await _transactions.Aggregate<BsonDocument>(pipeline).ToListAsync();
        
        // Initialize with zero for all account IDs
        var counts = accountIdList.ToDictionary(id => id, _ => 0);
        
        // Update with actual counts
        foreach (var result in results)
        {
            var accountId = result["_id"].AsString;
            var count = result["count"].ToInt32();
            counts[accountId] = count;
        }

        return counts;
    }

    public async Task<int> GetCountByLabelIdAsync(string labelId, string userId)
    {
        // Count transactions that have this label in any of their splits
        var filter = Builders<Transaction>.Filter.And(
            Builders<Transaction>.Filter.Eq(t => t.UserId, userId),
            Builders<Transaction>.Filter.Eq(t => t.IsRecurringTemplate, false),
            Builders<Transaction>.Filter.ElemMatch(t => t.Splits, s => s.LabelId == labelId)
        );
        return (int)await _transactions.CountDocumentsAsync(filter);
    }

    public async Task<int> GetCountByTagIdAsync(string tagId, string userId)
    {
        var filter = Builders<Transaction>.Filter.And(
            Builders<Transaction>.Filter.Eq(t => t.UserId, userId),
            Builders<Transaction>.Filter.Eq(t => t.IsRecurringTemplate, false),
            Builders<Transaction>.Filter.AnyEq(t => t.TagIds, tagId)
        );
        return (int)await _transactions.CountDocumentsAsync(filter);
    }

    public async Task ReassignLabelAsync(string fromLabelId, string toLabelId, string userId)
    {
        // Update all splits that use fromLabelId to use toLabelId instead
        var filter = Builders<Transaction>.Filter.And(
            Builders<Transaction>.Filter.Eq(t => t.UserId, userId),
            Builders<Transaction>.Filter.ElemMatch(t => t.Splits, s => s.LabelId == fromLabelId)
        );
        
        // Use ObjectId for the update since LabelId is stored as ObjectId in MongoDB
        var update = Builders<Transaction>.Update.Set("splits.$[elem].labelId", new ObjectId(toLabelId));
        var arrayFilters = new List<ArrayFilterDefinition>
        {
            new BsonDocumentArrayFilterDefinition<BsonDocument>(
                new BsonDocument("elem.labelId", new ObjectId(fromLabelId)))
        };
        
        await _transactions.UpdateManyAsync(filter, update, new UpdateOptions { ArrayFilters = arrayFilters });
    }

    public async Task RemoveTagFromAllAsync(string tagId, string userId)
    {
        var filter = Builders<Transaction>.Filter.And(
            Builders<Transaction>.Filter.Eq(t => t.UserId, userId),
            Builders<Transaction>.Filter.AnyEq(t => t.TagIds, tagId)
        );
        
        var update = Builders<Transaction>.Update.Pull(t => t.TagIds, tagId);
        await _transactions.UpdateManyAsync(filter, update);
    }
}
