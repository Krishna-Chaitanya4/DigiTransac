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
            var categoryName = SanitizeCsvField(t.Splits.FirstOrDefault()?.LabelName ?? "");
            var tagNames = SanitizeCsvField(string.Join(";", t.Tags.Select(tag => tag.Name)));
            var notes = SanitizeCsvField(t.Notes ?? "");
            var title = SanitizeCsvField(t.Title ?? "");
            var payee = SanitizeCsvField(t.Payee ?? "");
            var accountName = SanitizeCsvField(t.AccountName ?? "");

            csv.AppendLine(
                $"{t.Date:yyyy-MM-dd},{t.Type},{t.Amount},{t.Currency},\"{title}\",\"{payee}\",\"{accountName}\",\"{categoryName}\",\"{tagNames}\",{t.Status},\"{notes}\"");
        }

        return csv.ToString();
    }

    /// <summary>
    /// Sanitizes a string for safe CSV output:
    /// 1. Escapes double quotes by doubling them
    /// 2. Prefixes formula injection characters (=, +, -, @, \t, \r) with a single quote
    /// </summary>
    private static string SanitizeCsvField(string value)
    {
        // Escape double quotes for CSV
        var escaped = value.Replace("\"", "\"\"");

        // Prevent CSV injection / formula injection in spreadsheet applications
        if (escaped.Length > 0 && "=+-@".Contains(escaped[0]))
        {
            escaped = "'" + escaped;
        }
        else if (escaped.StartsWith("\t") || escaped.StartsWith("\r"))
        {
            escaped = "'" + escaped;
        }

        return escaped;
    }
}