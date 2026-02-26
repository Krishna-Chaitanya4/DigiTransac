using DigiTransac.Api.Models;
using DigiTransac.Api.Models.Dto;
using DigiTransac.Api.Services;
using MongoDB.Bson;
using MongoDB.Driver;

namespace DigiTransac.Api.Repositories;

public interface ITransactionRepository
{
    Task<Transaction?> GetByIdAsync(string id, CancellationToken ct = default);
    Task<Transaction?> GetByIdAndUserIdAsync(string id, string userId, CancellationToken ct = default);
    Task<(List<Transaction> Transactions, int TotalCount)> GetFilteredAsync(string userId, TransactionFilterRequest filter, CancellationToken ct = default);
    Task<List<Transaction>> GetByAccountIdAsync(string accountId, string userId, CancellationToken ct = default);
    Task<List<Transaction>> GetRecurringTemplatesAsync(string userId, CancellationToken ct = default);
    Task<List<Transaction>> GetPendingRecurringAsync(DateTime beforeDate, CancellationToken ct = default);
    Task<Transaction> CreateAsync(Transaction transaction, IClientSessionHandle? session = null, CancellationToken ct = default);
    Task CreateManyAsync(List<Transaction> transactions, IClientSessionHandle? session = null, CancellationToken ct = default);
    Task UpdateAsync(Transaction transaction, IClientSessionHandle? session = null, CancellationToken ct = default);
    Task<bool> DeleteAsync(string id, string userId, IClientSessionHandle? session = null, CancellationToken ct = default);
    Task<bool> DeleteByIdAsync(string id, IClientSessionHandle? session = null, CancellationToken ct = default);
    Task<bool> DeleteAllByUserIdAsync(string userId, CancellationToken ct = default);
    Task<int> NullifyCounterpartyReferencesAsync(string deletedUserId, CancellationToken ct = default);
    Task<bool> DeleteAllByAccountIdAsync(string accountId, string userId, CancellationToken ct = default);

    
    // Count methods for validation before deletion
    Task<int> GetCountByAccountIdAsync(string accountId, string userId, CancellationToken ct = default);
    Task<Dictionary<string, int>> GetCountsByAccountIdsAsync(IEnumerable<string> accountIds, string userId, CancellationToken ct = default);
    Task<int> GetCountByLabelIdAsync(string labelId, string userId, CancellationToken ct = default);
    Task<int> GetCountByTagIdAsync(string tagId, string userId, CancellationToken ct = default);
    
    // Reassignment methods
    Task ReassignLabelAsync(string fromLabelId, string toLabelId, string userId, CancellationToken ct = default);
    Task RemoveTagFromAllAsync(string tagId, string userId, CancellationToken ct = default);
    
    // Pending transactions
    Task<int> GetPendingCountAsync(string userId, CancellationToken ct = default);
    Task<Transaction?> GetLinkedP2PTransactionAsync(Guid transactionLinkId, string excludeUserId, CancellationToken ct = default);
    
    // P2P conversation queries
    Task<List<Transaction>> GetP2PTransactionsAsync(string userId, CancellationToken ct = default);
    Task<List<Transaction>> GetP2PTransactionsWithCounterpartyAsync(string userId, string counterpartyUserId, CancellationToken ct = default);
    
    // Get transactions by IDs (for chat message resolution)
    Task<List<Transaction>> GetByIdsAsync(IEnumerable<string> ids, string userId, CancellationToken ct = default);
    
    // Get transactions by IDs without userId filter (for cross-user P2P link resolution)
    Task<List<Transaction>> GetByIdsAsync(IEnumerable<string> ids, CancellationToken ct = default);
    
    // Soft delete / restore
    Task<bool> SoftDeleteAsync(string id, string userId, IClientSessionHandle? session = null, CancellationToken ct = default);
    Task<bool> RestoreAsync(string id, string userId, IClientSessionHandle? session = null, CancellationToken ct = default);
    Task<Transaction?> GetDeletedByIdAndUserIdAsync(string id, string userId, CancellationToken ct = default);
    Task<List<string>> GetExpiredDeletedTransactionIdsAsync(TimeSpan undoWindow, CancellationToken ct = default);
    Task<int> PurgeExpiredDeletedTransactionsAsync(TimeSpan undoWindow, CancellationToken ct = default);
}

public class TransactionRepository : ITransactionRepository
{
    private readonly IMongoCollection<Transaction> _transactions;
    private static bool _indexesCreated;
    private static readonly object _indexLock = new();

    public TransactionRepository(IMongoDbService mongoDbService)
    {
        _transactions = mongoDbService.GetCollection<Transaction>("transactions");

        // Create indexes once per application lifecycle (idempotent but avoids per-request round-trip)
        if (!_indexesCreated)
        {
            lock (_indexLock)
            {
                if (!_indexesCreated)
                {
                    try
                    {
            var indexModels = new List<CreateIndexModel<Transaction>>
            {
                // User + Date for listing transactions
                new(Builders<Transaction>.IndexKeys
                    .Ascending(t => t.UserId)
                    .Descending(t => t.Date),
                    new CreateIndexOptions { Name = "idx_userId_date" }),
                
                // Account + Date for account-specific queries
                new(Builders<Transaction>.IndexKeys
                    .Ascending(t => t.AccountId)
                    .Descending(t => t.Date),
                    new CreateIndexOptions { Name = "idx_accountId_date" }),
                
                // User + Type for filtering
                new(Builders<Transaction>.IndexKeys
                    .Ascending(t => t.UserId)
                    .Ascending(t => t.Type),
                    new CreateIndexOptions { Name = "idx_userId_type" }),
                
                // User + Status for pending/confirmed filtering
                new(Builders<Transaction>.IndexKeys
                    .Ascending(t => t.UserId)
                    .Ascending(t => t.Status)
                    .Descending(t => t.Date),
                    new CreateIndexOptions { Name = "idx_userId_status_date" }),
                
                // User + Account + Date for account-filtered listings
                new(Builders<Transaction>.IndexKeys
                    .Ascending(t => t.UserId)
                    .Ascending(t => t.AccountId)
                    .Descending(t => t.Date),
                    new CreateIndexOptions { Name = "idx_userId_accountId_date" }),
                
                // User + CounterpartyUserId for P2P queries
                new(Builders<Transaction>.IndexKeys
                    .Ascending(t => t.UserId)
                    .Ascending(t => t.CounterpartyUserId)
                    .Descending(t => t.Date),
                    new CreateIndexOptions { Name = "idx_userId_counterparty_date" }),
                
                // Recurring template lookup
                new(Builders<Transaction>.IndexKeys
                    .Ascending(t => t.IsRecurringTemplate)
                    .Ascending(t => t.RecurringRule!.NextOccurrence),
                    new CreateIndexOptions { Name = "idx_recurring_nextOccurrence" }),
                
                // Linked transactions for transfers
                new(Builders<Transaction>.IndexKeys.Ascending(t => t.LinkedTransactionId),
                    new CreateIndexOptions { Name = "idx_linkedTransactionId" }),
                
                // TransactionLinkId for P2P linking
                new(Builders<Transaction>.IndexKeys.Ascending(t => t.TransactionLinkId),
                    new CreateIndexOptions { Name = "idx_transactionLinkId" }),
                
                // Location.City for map queries (sparse - only indexed when location exists)
                new(Builders<Transaction>.IndexKeys
                    .Ascending(t => t.UserId)
                    .Ascending("Location.City"),
                    new CreateIndexOptions { Name = "idx_userId_location_city", Sparse = true }),
                
                // Soft-delete purge query (IsDeleted + DeletedAt)
                new(Builders<Transaction>.IndexKeys
                    .Ascending(t => t.IsDeleted)
                    .Ascending(t => t.DeletedAt),
                    new CreateIndexOptions { Name = "idx_isDeleted_deletedAt", Sparse = true })
            };

            _transactions.Indexes.CreateMany(indexModels);
        }
        catch (MongoCommandException)
        {
            // Indexes may already exist with different names - this is OK
        }
        _indexesCreated = true;
                }
            }
        }
    }

    public async Task<Transaction?> GetByIdAsync(string id, CancellationToken ct = default)
    {
        return await _transactions.Find(t => t.Id == id).FirstOrDefaultAsync(ct);
    }

    public async Task<Transaction?> GetByIdAndUserIdAsync(string id, string userId, CancellationToken ct = default)
    {
        return await _transactions.Find(t => t.Id == id && t.UserId == userId && !t.IsDeleted).FirstOrDefaultAsync(ct);
    }

    public async Task<(List<Transaction> Transactions, int TotalCount)> GetFilteredAsync(
        string userId, 
        TransactionFilterRequest filter,
        CancellationToken ct = default)
    {
        var filterBuilder = Builders<Transaction>.Filter;
        var filters = new List<FilterDefinition<Transaction>>
        {
            filterBuilder.Eq(t => t.UserId, userId),
            filterBuilder.Eq(t => t.IsRecurringTemplate, false), // Exclude templates from normal listings
            filterBuilder.Ne(t => t.IsDeleted, true), // Exclude soft-deleted transactions (Ne(true) matches both false and missing field)
        };
        
        // P2P transactions start with AccountId = null (assigned on accept).
        // Only exclude them when explicitly filtering for Confirmed status,
        // since confirmed transactions must always have an account.
        // For Pending, Declined, or All (no status filter) we want to see them.
        if (string.Equals(filter.Status, "Confirmed", StringComparison.OrdinalIgnoreCase))
        {
            filters.Add(filterBuilder.Ne(t => t.AccountId, null));
        }

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

        if (!string.IsNullOrEmpty(filter.Status))
        {
            if (Enum.TryParse<TransactionStatus>(filter.Status, true, out var status))
            {
                filters.Add(filterBuilder.Eq(t => t.Status, status));
            }
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
            var searchRegex = new BsonRegularExpression(System.Text.RegularExpressions.Regex.Escape(filter.SearchText), "i");
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
            
            // Add counterparty matches (if service provided matching IDs from search)
            if (filter.SearchCounterpartyUserIds?.Count > 0)
            {
                searchFilters.Add(filterBuilder.In(t => t.CounterpartyUserId, filter.SearchCounterpartyUserIds));
            }
            
            // Use OR - match any of title, label, tag, city, country, account, or counterparty
            filters.Add(filterBuilder.Or(searchFilters));
        }

        // Filter by counterparty users (explicit filter, not search)
        if (filter.CounterpartyUserIds?.Count > 0)
        {
            filters.Add(filterBuilder.In(t => t.CounterpartyUserId, filter.CounterpartyUserIds));
        }

        // Filter for linked transactions (transfers)
        if (filter.HasLinkedTransaction.HasValue && filter.HasLinkedTransaction.Value)
        {
            filters.Add(filterBuilder.Ne(t => t.LinkedTransactionId, null));
        }

        var combinedFilter = filterBuilder.And(filters);

        var page = filter.Page ?? 1;
        var pageSize = filter.PageSize ?? 50;
        var skip = (page - 1) * pageSize;

        var totalCount = await _transactions.CountDocumentsAsync(combinedFilter, options: null, ct);
        var transactions = await _transactions
            .Find(combinedFilter)
            .SortByDescending(t => t.Date)
            .ThenByDescending(t => t.CreatedAt)
            .Skip(skip)
            .Limit(pageSize)
            .ToListAsync(ct);

        return (transactions, (int)totalCount);
    }

    public async Task<List<Transaction>> GetByAccountIdAsync(string accountId, string userId, CancellationToken ct = default)
    {
        return await _transactions
            .Find(t => t.AccountId == accountId && t.UserId == userId && !t.IsRecurringTemplate && !t.IsDeleted)
            .SortByDescending(t => t.Date)
            .ToListAsync(ct);
    }

    public async Task<List<Transaction>> GetRecurringTemplatesAsync(string userId, CancellationToken ct = default)
    {
        return await _transactions
            .Find(t => t.UserId == userId && t.IsRecurringTemplate)
            .SortBy(t => t.RecurringRule!.NextOccurrence)
            .ToListAsync(ct);
    }

    public async Task<List<Transaction>> GetPendingRecurringAsync(DateTime beforeDate, CancellationToken ct = default)
    {
        return await _transactions
            .Find(t => t.IsRecurringTemplate && 
                       t.RecurringRule != null && 
                       t.RecurringRule.NextOccurrence <= beforeDate &&
                       (t.RecurringRule.EndDate == null || t.RecurringRule.EndDate >= beforeDate))
            .ToListAsync(ct);
    }

    public async Task<Transaction> CreateAsync(Transaction transaction, IClientSessionHandle? session = null, CancellationToken ct = default)
    {
        if (session != null)
            await _transactions.InsertOneAsync(session, transaction, options: null, ct);
        else
            await _transactions.InsertOneAsync(transaction, options: null, ct);
        return transaction;
    }

    public async Task CreateManyAsync(List<Transaction> transactions, IClientSessionHandle? session = null, CancellationToken ct = default)
    {
        if (transactions.Count > 0)
        {
            if (session != null)
                await _transactions.InsertManyAsync(session, transactions, options: null, ct);
            else
                await _transactions.InsertManyAsync(transactions, options: null, ct);
        }
    }

    public async Task UpdateAsync(Transaction transaction, IClientSessionHandle? session = null, CancellationToken ct = default)
    {
        transaction.UpdatedAt = DateTime.UtcNow;
        if (session != null)
            await _transactions.ReplaceOneAsync(
                session,
                t => t.Id == transaction.Id && t.UserId == transaction.UserId,
                transaction, options: (ReplaceOptions?)null, ct);
        else
            await _transactions.ReplaceOneAsync(
                t => t.Id == transaction.Id && t.UserId == transaction.UserId,
                transaction, options: (ReplaceOptions?)null, ct);
    }

    public async Task<bool> DeleteAsync(string id, string userId, IClientSessionHandle? session = null, CancellationToken ct = default)
    {
        DeleteResult result;
        if (session != null)
            result = await _transactions.DeleteOneAsync(session, t => t.Id == id && t.UserId == userId, options: null, ct);
        else
            result = await _transactions.DeleteOneAsync(t => t.Id == id && t.UserId == userId, ct);
        return result.DeletedCount > 0;
    }

    public async Task<bool> DeleteByIdAsync(string id, IClientSessionHandle? session = null, CancellationToken ct = default)
    {
        DeleteResult result;
        if (session != null)
            result = await _transactions.DeleteOneAsync(session, t => t.Id == id, options: null, ct);
        else
            result = await _transactions.DeleteOneAsync(t => t.Id == id, ct);
        return result.DeletedCount > 0;
    }

    public async Task<bool> DeleteAllByUserIdAsync(string userId, CancellationToken ct = default)
    {
        var result = await _transactions.DeleteManyAsync(t => t.UserId == userId, ct);
        return result.DeletedCount > 0;
    }

    public async Task<int> NullifyCounterpartyReferencesAsync(string deletedUserId, CancellationToken ct = default)
    {
        // Find transactions belonging to OTHER users that reference the deleted user as counterparty
        var filter = Builders<Transaction>.Filter.Eq(t => t.CounterpartyUserId, deletedUserId);

        var update = Builders<Transaction>.Update
            .Set(t => t.CounterpartyUserId, (string?)null)
            .Set(t => t.LinkedTransactionId, (string?)null)
            .Set(t => t.TransactionLinkId, (Guid?)null);

        var result = await _transactions.UpdateManyAsync(filter, update, options: null, ct);
        return (int)result.ModifiedCount;
    }

    public async Task<bool> DeleteAllByAccountIdAsync(string accountId, string userId, CancellationToken ct = default)
    {
        var result = await _transactions.DeleteManyAsync(t => t.AccountId == accountId && t.UserId == userId, ct);
        return result.DeletedCount > 0;
    }



    public async Task<int> GetCountByAccountIdAsync(string accountId, string userId, CancellationToken ct = default)
    {
        var filter = Builders<Transaction>.Filter.And(
            Builders<Transaction>.Filter.Eq(t => t.AccountId, accountId),
            Builders<Transaction>.Filter.Eq(t => t.UserId, userId),
            Builders<Transaction>.Filter.Eq(t => t.IsRecurringTemplate, false),
            Builders<Transaction>.Filter.Ne(t => t.IsDeleted, true)
        );
        return (int)await _transactions.CountDocumentsAsync(filter, options: null, ct);
    }

    public async Task<Dictionary<string, int>> GetCountsByAccountIdsAsync(IEnumerable<string> accountIds, string userId, CancellationToken ct = default)
    {
        var accountIdList = accountIds.ToList();
        if (accountIdList.Count == 0)
        {
            return new Dictionary<string, int>();
        }

        var filter = Builders<Transaction>.Filter.And(
            Builders<Transaction>.Filter.In(t => t.AccountId, accountIdList),
            Builders<Transaction>.Filter.Eq(t => t.UserId, userId),
            Builders<Transaction>.Filter.Eq(t => t.IsRecurringTemplate, false),
            Builders<Transaction>.Filter.Ne(t => t.IsDeleted, true)
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

        var results = await _transactions.Aggregate<BsonDocument>(pipeline).ToListAsync(ct);
        
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

    public async Task<int> GetCountByLabelIdAsync(string labelId, string userId, CancellationToken ct = default)
    {
        // Count transactions that have this label in any of their splits
        var filter = Builders<Transaction>.Filter.And(
            Builders<Transaction>.Filter.Eq(t => t.UserId, userId),
            Builders<Transaction>.Filter.Eq(t => t.IsRecurringTemplate, false),
            Builders<Transaction>.Filter.Ne(t => t.IsDeleted, true),
            Builders<Transaction>.Filter.ElemMatch(t => t.Splits, s => s.LabelId == labelId)
        );
        return (int)await _transactions.CountDocumentsAsync(filter, options: null, ct);
    }

    public async Task<int> GetCountByTagIdAsync(string tagId, string userId, CancellationToken ct = default)
    {
        var filter = Builders<Transaction>.Filter.And(
            Builders<Transaction>.Filter.Eq(t => t.UserId, userId),
            Builders<Transaction>.Filter.Eq(t => t.IsRecurringTemplate, false),
            Builders<Transaction>.Filter.Ne(t => t.IsDeleted, true),
            Builders<Transaction>.Filter.AnyEq(t => t.TagIds, tagId)
        );
        return (int)await _transactions.CountDocumentsAsync(filter, options: null, ct);
    }

    public async Task ReassignLabelAsync(string fromLabelId, string toLabelId, string userId, CancellationToken ct = default)
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
        
        await _transactions.UpdateManyAsync(filter, update, new UpdateOptions { ArrayFilters = arrayFilters }, ct);
    }

    public async Task RemoveTagFromAllAsync(string tagId, string userId, CancellationToken ct = default)
    {
        var filter = Builders<Transaction>.Filter.And(
            Builders<Transaction>.Filter.Eq(t => t.UserId, userId),
            Builders<Transaction>.Filter.AnyEq(t => t.TagIds, tagId)
        );
        
        var update = Builders<Transaction>.Update.Pull(t => t.TagIds, tagId);
        await _transactions.UpdateManyAsync(filter, update, options: null, ct);
    }

    public async Task<int> GetPendingCountAsync(string userId, CancellationToken ct = default)
    {
        // Count ALL pending transactions (not just P2P)
        var filter = Builders<Transaction>.Filter.And(
            Builders<Transaction>.Filter.Eq(t => t.UserId, userId),
            Builders<Transaction>.Filter.Eq(t => t.Status, TransactionStatus.Pending),
            Builders<Transaction>.Filter.Ne(t => t.IsDeleted, true)
        );
        
        return (int)await _transactions.CountDocumentsAsync(filter, options: null, ct);
    }

    public async Task<Transaction?> GetLinkedP2PTransactionAsync(Guid transactionLinkId, string excludeUserId, CancellationToken ct = default)
    {
        // Find the linked transaction (same TransactionLinkId but different user)
        var filter = Builders<Transaction>.Filter.And(
            Builders<Transaction>.Filter.Eq(t => t.TransactionLinkId, transactionLinkId),
            Builders<Transaction>.Filter.Ne(t => t.UserId, excludeUserId)
        );
        
        return await _transactions.Find(filter).FirstOrDefaultAsync(ct);
    }

    public async Task<List<Transaction>> GetP2PTransactionsAsync(string userId, CancellationToken ct = default)
    {
        // Get all P2P transactions (those with CounterpartyUserId set)
        var filter = Builders<Transaction>.Filter.And(
            Builders<Transaction>.Filter.Eq(t => t.UserId, userId),
            Builders<Transaction>.Filter.Ne(t => t.CounterpartyUserId, null),
            Builders<Transaction>.Filter.Eq(t => t.IsRecurringTemplate, false),
            Builders<Transaction>.Filter.Ne(t => t.IsDeleted, true)
        );
        
        return await _transactions.Find(filter)
            .SortByDescending(t => t.Date)
            .ToListAsync(ct);
    }

    public async Task<List<Transaction>> GetP2PTransactionsWithCounterpartyAsync(string userId, string counterpartyUserId, CancellationToken ct = default)
    {
        // Get all P2P transactions with a specific counterparty (including soft-deleted for chat undo)
        var filter = Builders<Transaction>.Filter.And(
            Builders<Transaction>.Filter.Eq(t => t.UserId, userId),
            Builders<Transaction>.Filter.Eq(t => t.CounterpartyUserId, counterpartyUserId),
            Builders<Transaction>.Filter.Eq(t => t.IsRecurringTemplate, false)
        );
        
        return await _transactions.Find(filter)
            .SortByDescending(t => t.Date)
            .ToListAsync(ct);
    }

    public async Task<List<Transaction>> GetByIdsAsync(IEnumerable<string> ids, string userId, CancellationToken ct = default)
    {
        var idsList = ids.ToList();
        if (idsList.Count == 0)
            return new List<Transaction>();
            
        var filter = Builders<Transaction>.Filter.And(
            Builders<Transaction>.Filter.In(t => t.Id, idsList),
            Builders<Transaction>.Filter.Eq(t => t.UserId, userId)
        );
        
        return await _transactions.Find(filter).ToListAsync(ct);
    }
    
    public async Task<List<Transaction>> GetByIdsAsync(IEnumerable<string> ids, CancellationToken ct = default)
    {
        var idsList = ids.ToList();
        if (idsList.Count == 0)
            return new List<Transaction>();
            
        var filter = Builders<Transaction>.Filter.In(t => t.Id, idsList);
        
        return await _transactions.Find(filter).ToListAsync(ct);
    }

    public async Task<bool> SoftDeleteAsync(string id, string userId, IClientSessionHandle? session = null, CancellationToken ct = default)
    {
        var filter = Builders<Transaction>.Filter.And(
            Builders<Transaction>.Filter.Eq(t => t.Id, id),
            Builders<Transaction>.Filter.Eq(t => t.UserId, userId),
            Builders<Transaction>.Filter.Ne(t => t.IsDeleted, true)
        );

        var update = Builders<Transaction>.Update
            .Set(t => t.IsDeleted, true)
            .Set(t => t.DeletedAt, DateTime.UtcNow);

        UpdateResult result;
        if (session != null)
            result = await _transactions.UpdateOneAsync(session, filter, update, options: null, ct);
        else
            result = await _transactions.UpdateOneAsync(filter, update, options: null, ct);
        return result.ModifiedCount > 0;
    }

    public async Task<Transaction?> GetDeletedByIdAndUserIdAsync(string id, string userId, CancellationToken ct = default)
    {
        return await _transactions.Find(t => t.Id == id && t.UserId == userId && t.IsDeleted).FirstOrDefaultAsync(ct);
    }

    public async Task<bool> RestoreAsync(string id, string userId, IClientSessionHandle? session = null, CancellationToken ct = default)
    {
        var filter = Builders<Transaction>.Filter.And(
            Builders<Transaction>.Filter.Eq(t => t.Id, id),
            Builders<Transaction>.Filter.Eq(t => t.UserId, userId),
            Builders<Transaction>.Filter.Eq(t => t.IsDeleted, true)
        );

        var update = Builders<Transaction>.Update
            .Set(t => t.IsDeleted, false)
            .Set(t => t.DeletedAt, (DateTime?)null);

        UpdateResult result;
        if (session != null)
            result = await _transactions.UpdateOneAsync(session, filter, update, options: null, ct);
        else
            result = await _transactions.UpdateOneAsync(filter, update, options: null, ct);
        return result.ModifiedCount > 0;
    }

    public async Task<List<string>> GetExpiredDeletedTransactionIdsAsync(TimeSpan undoWindow, CancellationToken ct = default)
    {
        var cutoff = DateTime.UtcNow - undoWindow;

        var filter = Builders<Transaction>.Filter.And(
            Builders<Transaction>.Filter.Eq(t => t.IsDeleted, true),
            Builders<Transaction>.Filter.Lt(t => t.DeletedAt, cutoff)
        );

        return await _transactions.Find(filter)
            .Project(t => t.Id)
            .ToListAsync(ct);
    }

    public async Task<int> PurgeExpiredDeletedTransactionsAsync(TimeSpan undoWindow, CancellationToken ct = default)
    {
        var cutoff = DateTime.UtcNow - undoWindow;

        // Permanently delete transactions that have been soft-deleted past the undo window
        var filter = Builders<Transaction>.Filter.And(
            Builders<Transaction>.Filter.Eq(t => t.IsDeleted, true),
            Builders<Transaction>.Filter.Lt(t => t.DeletedAt, cutoff)
        );

        var result = await _transactions.DeleteManyAsync(filter, ct);
        return (int)result.DeletedCount;
    }
}
