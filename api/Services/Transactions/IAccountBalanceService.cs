using DigiTransac.Api.Models;
using DigiTransac.Api.Repositories;
using MongoDB.Driver;

namespace DigiTransac.Api.Services.Transactions;

/// <summary>
/// Handles account balance updates for transactions.
/// Centralizes balance calculation logic.
/// </summary>
public interface IAccountBalanceService
{
    /// <summary>
    /// Update account balance based on transaction type and amount
    /// </summary>
    /// <param name="account">The account to update</param>
    /// <param name="type">Transaction type (Send decreases, Receive increases)</param>
    /// <param name="amount">Transaction amount</param>
    /// <param name="isAdding">True if adding transaction, false if removing</param>
    /// <param name="session">Optional MongoDB session for transactions</param>
    /// <param name="ct">Cancellation token</param>
    Task UpdateBalanceAsync(Account account, TransactionType type, decimal amount, bool isAdding, IClientSessionHandle? session = null, CancellationToken ct = default);
}

/// <summary>
/// Implementation of account balance service
/// </summary>
public class AccountBalanceService : IAccountBalanceService
{
    private readonly IAccountRepository _accountRepository;

    public AccountBalanceService(IAccountRepository accountRepository)
    {
        _accountRepository = accountRepository;
    }

    public async Task UpdateBalanceAsync(Account account, TransactionType type, decimal amount, bool isAdding, IClientSessionHandle? session = null, CancellationToken ct = default)
    {
        ApplyBalanceChange(account, type, amount, isAdding);
        await _accountRepository.UpdateAsync(account, session, ct);
    }

    private static void ApplyBalanceChange(Account account, TransactionType type, decimal amount, bool isAdding)
    {
        var change = type switch
        {
            TransactionType.Receive => amount,
            TransactionType.Send => -amount,
            _ => 0m
        };

        if (!isAdding) change = -change;

        account.CurrentBalance += change;
    }
}