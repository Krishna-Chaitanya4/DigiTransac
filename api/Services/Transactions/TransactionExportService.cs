using System.Text;
using DigiTransac.Api.Models;
using DigiTransac.Api.Models.Dto;
using DigiTransac.Api.Repositories;

namespace DigiTransac.Api.Services.Transactions;

/// <summary>
/// Handles transaction export functionality.
/// Supports multiple export formats (JSON, CSV).
/// </summary>
public class TransactionExportService : ITransactionExportService
{
    private readonly ITransactionRepository _transactionRepository;
    private readonly IAccountRepository _accountRepository;
    private readonly ILabelRepository _labelRepository;
    private readonly ITagRepository _tagRepository;
    private readonly IUserRepository _userRepository;
    private readonly ITransactionMapperService _mapperService;

    public TransactionExportService(
        ITransactionRepository transactionRepository,
        IAccountRepository accountRepository,
        ILabelRepository labelRepository,
        ITagRepository tagRepository,
        IUserRepository userRepository,
        ITransactionMapperService mapperService)
    {
        _transactionRepository = transactionRepository;
        _accountRepository = accountRepository;
        _labelRepository = labelRepository;
        _tagRepository = tagRepository;
        _userRepository = userRepository;
        _mapperService = mapperService;
    }

    public async Task<List<TransactionResponse>> GetAllForExportAsync(
        string userId,
        TransactionFilterRequest filter)
    {
        // Get unlimited transactions for export (no pagination)
        var exportFilter = filter with { Page = null, PageSize = null };

        var dek = await _mapperService.GetUserDekAsync(userId);
        var accounts = (await _accountRepository.GetByUserIdAsync(userId, true))
            .ToDictionary(a => a.Id);
        var labels = (await _labelRepository.GetByUserIdAsync(userId))
            .ToDictionary(l => l.Id);
        var tags = (await _tagRepository.GetByUserIdAsync(userId))
            .ToDictionary(t => t.Id);

        var (transactions, _) = await _transactionRepository.GetFilteredAsync(userId, exportFilter);

        // Fetch counterparty users for email resolution
        var counterpartyUserIds = transactions
            .Where(t => !string.IsNullOrEmpty(t.CounterpartyUserId))
            .Select(t => t.CounterpartyUserId!)
            .Distinct();
        var counterpartyUsers = await _userRepository.GetByIdsAsync(counterpartyUserIds);

        return transactions
            .Where(t => !t.IsRecurringTemplate)
            .Select(t => _mapperService.MapToResponse(t, dek, accounts, labels, tags, counterpartyUsers))
            .ToList();
    }

    public async Task<string> ExportToCsvAsync(
        string userId,
        TransactionFilterRequest filter)
    {
        var transactions = await GetAllForExportAsync(userId, filter);

        var csv = new StringBuilder();
        csv.AppendLine("Date,Type,Amount,Currency,Title,Payee,Account,Category,Tags,Status,Notes");

        foreach (var t in transactions)
        {
            var categoryName = t.Splits.FirstOrDefault()?.LabelName ?? "";
            var tagNames = string.Join(";", t.Tags.Select(tag => tag.Name));
            var notes = (t.Notes ?? "").Replace("\"", "\"\"");
            var title = (t.Title ?? "").Replace("\"", "\"\"");
            var payee = (t.Payee ?? "").Replace("\"", "\"\"");

            csv.AppendLine(
                $"{t.Date:yyyy-MM-dd},{t.Type},{t.Amount},{t.Currency},\"{title}\",\"{payee}\",\"{t.AccountName}\",\"{categoryName}\",\"{tagNames}\",{t.Status},\"{notes}\"");
        }

        return csv.ToString();
    }
}