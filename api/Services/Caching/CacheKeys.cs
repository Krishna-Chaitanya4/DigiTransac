namespace DigiTransac.Api.Services.Caching;

/// <summary>
/// Centralized cache key definitions for consistent key naming across the application.
/// All cache keys should be defined here to avoid duplication and ensure invalidation correctness.
/// </summary>
public static class CacheKeys
{
    private const string Prefix = "digitransac";

    /// <summary>
    /// Cache key for a specific transaction by ID.
    /// </summary>
    public static string Transaction(string transactionId) =>
        $"{Prefix}:transaction:{transactionId}";

    /// <summary>
    /// Cache key for a user's accounts/balances.
    /// </summary>
    public static string UserAccounts(string userId) =>
        $"{Prefix}:user:{userId}:accounts";

    /// <summary>
    /// Cache key for a user's transaction list/summary.
    /// </summary>
    public static string UserTransactions(string userId) =>
        $"{Prefix}:user:{userId}:transactions";

    /// <summary>
    /// Cache key for a user's analytics/dashboard data.
    /// </summary>
    public static string UserAnalytics(string userId) =>
        $"{Prefix}:user:{userId}:analytics";

    /// <summary>
    /// Cache key for a user's budget data.
    /// </summary>
    public static string UserBudgets(string userId) =>
        $"{Prefix}:user:{userId}:budgets";

    /// <summary>
    /// Cache key for a user's category breakdown.
    /// </summary>
    public static string UserCategories(string userId) =>
        $"{Prefix}:user:{userId}:categories";
}