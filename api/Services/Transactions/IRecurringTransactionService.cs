using DigiTransac.Api.Models;
using DigiTransac.Api.Models.Dto;

namespace DigiTransac.Api.Services.Transactions;

/// <summary>
/// Handles recurring transaction templates and processing.
/// Manages recurring rules, creates instances, and background processing.
/// </summary>
public interface IRecurringTransactionService
{
    /// <summary>
    /// Get all recurring transaction templates for a user
    /// </summary>
    Task<List<RecurringTransactionResponse>> GetRecurringAsync(string userId);
    
    /// <summary>
    /// Create a recurring transaction template and its first instance
    /// </summary>
    Task<(bool Success, string Message, Transaction? Template, Transaction? FirstInstance)> CreateRecurringTemplateAsync(
        string userId,
        CreateTransactionRequest request,
        Account account,
        byte[] dek);
    
    /// <summary>
    /// Delete a recurring template (optionally delete future instances)
    /// </summary>
    Task<(bool Success, string Message)> DeleteRecurringAsync(
        string id,
        string userId,
        bool deleteFutureInstances);
    
    /// <summary>
    /// Process all pending recurring transactions (called by background service)
    /// </summary>
    Task ProcessRecurringTransactionsAsync(CancellationToken ct = default);
    
    /// <summary>
    /// Calculate the next occurrence date based on the recurring rule
    /// </summary>
    DateTime CalculateNextOccurrence(RecurringRule rule);
}