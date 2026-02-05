using System.Globalization;
using DigiTransac.Api.Models;
using DigiTransac.Api.Models.Dto;
using DigiTransac.Api.Repositories;

namespace DigiTransac.Api.Services;

/// <summary>
/// Service for bulk importing transactions from CSV/Excel files.
/// Handles validation, duplicate detection, and label/tag mapping.
/// </summary>
public interface ITransactionImportService
{
    /// <summary>
    /// Preview import to show validation results before committing
    /// </summary>
    Task<ImportPreviewResponse> PreviewImportAsync(string userId, ImportPreviewRequest request);
    
    /// <summary>
    /// Execute the actual import
    /// </summary>
    Task<BulkImportResponse> ImportAsync(string userId, BulkImportRequest request);
    
    /// <summary>
    /// Parse CSV content into transaction requests
    /// </summary>
    List<ImportTransactionRequest> ParseCsv(string csvContent);
    
    /// <summary>
    /// Parse CSV from raw content (text or base64) and preview results
    /// </summary>
    Task<ImportPreviewResponse> ParseAndPreviewAsync(string userId, CsvParseRequest request);
}

public class TransactionImportService : ITransactionImportService
{
    private readonly ITransactionRepository _transactionRepository;
    private readonly IAccountRepository _accountRepository;
    private readonly ILabelRepository _labelRepository;
    private readonly ITagRepository _tagRepository;
    private readonly ILabelService _labelService;
    private readonly ITagService _tagService;
    private readonly IEncryptionService _encryptionService;
    private readonly IKeyManagementService _keyManagementService;
    private readonly IUserRepository _userRepository;
    private readonly ILogger<TransactionImportService> _logger;

    // Constants for import limits
    private const int MaxImportRows = 1000;
    private const int MaxTitleLength = 200;
    private const int MaxPayeeLength = 200;
    private const int MaxNotesLength = 2000;

    public TransactionImportService(
        ITransactionRepository transactionRepository,
        IAccountRepository accountRepository,
        ILabelRepository labelRepository,
        ITagRepository tagRepository,
        ILabelService labelService,
        ITagService tagService,
        IEncryptionService encryptionService,
        IKeyManagementService keyManagementService,
        IUserRepository userRepository,
        ILogger<TransactionImportService> logger)
    {
        _transactionRepository = transactionRepository;
        _accountRepository = accountRepository;
        _labelRepository = labelRepository;
        _tagRepository = tagRepository;
        _labelService = labelService;
        _tagService = tagService;
        _encryptionService = encryptionService;
        _keyManagementService = keyManagementService;
        _userRepository = userRepository;
        _logger = logger;
    }

    public async Task<ImportPreviewResponse> PreviewImportAsync(string userId, ImportPreviewRequest request)
    {
        _logger.LogInformation("Previewing import of {Count} transactions for user {UserId}", 
            request.Transactions.Count, userId);

        // Validate account
        var account = await _accountRepository.GetByIdAndUserIdAsync(request.AccountId, userId);
        if (account == null)
        {
            return new ImportPreviewResponse(
                TotalRows: request.Transactions.Count,
                ValidRows: 0,
                InvalidRows: request.Transactions.Count,
                DuplicateRows: 0,
                Rows: request.Transactions.Select((t, i) => new ImportPreviewRow(
                    RowNumber: i + 1,
                    IsValid: false,
                    IsDuplicate: false,
                    Data: t,
                    LabelId: null,
                    TagIds: new List<string>(),
                    Errors: new List<string> { "Invalid account ID" }
                )).ToList(),
                MissingLabels: new List<string>(),
                MissingTags: new List<string>()
            );
        }

        // Get existing labels and tags
        var existingLabels = await _labelRepository.GetByUserIdAsync(userId);
        var existingTags = await _tagRepository.GetByUserIdAsync(userId);
        var labelMap = existingLabels.ToDictionary(l => l.Name.ToLowerInvariant(), l => l.Id);
        var tagMap = existingTags.ToDictionary(t => t.Name.ToLowerInvariant(), t => t.Id);

        // Get existing transactions for duplicate detection
        var existingTransactions = await GetExistingTransactionsForDuplicateCheck(userId, request.AccountId);

        var previewRows = new List<ImportPreviewRow>();
        var missingLabels = new HashSet<string>();
        var missingTags = new HashSet<string>();
        int validRows = 0;
        int invalidRows = 0;
        int duplicateRows = 0;

        for (int i = 0; i < request.Transactions.Count; i++)
        {
            var row = request.Transactions[i];
            var errors = ValidateRow(row, i + 1);
            
            // Check for label mapping
            string? labelId = null;
            if (!string.IsNullOrWhiteSpace(row.LabelName))
            {
                var labelNameLower = row.LabelName.Trim().ToLowerInvariant();
                if (labelMap.TryGetValue(labelNameLower, out var mappedLabelId))
                {
                    labelId = mappedLabelId;
                }
                else
                {
                    missingLabels.Add(row.LabelName.Trim());
                    if (!request.CreateMissingLabels)
                    {
                        errors.Add($"Label '{row.LabelName}' not found");
                    }
                }
            }

            // Check for tag mapping
            var tagIds = new List<string>();
            if (row.TagNames?.Any() == true)
            {
                foreach (var tagName in row.TagNames.Where(t => !string.IsNullOrWhiteSpace(t)))
                {
                    var tagNameLower = tagName.Trim().ToLowerInvariant();
                    if (tagMap.TryGetValue(tagNameLower, out var mappedTagId))
                    {
                        tagIds.Add(mappedTagId);
                    }
                    else
                    {
                        missingTags.Add(tagName.Trim());
                        if (!request.CreateMissingTags)
                        {
                            errors.Add($"Tag '{tagName}' not found");
                        }
                    }
                }
            }

            // Check for duplicates
            bool isDuplicate = false;
            if (request.SkipDuplicates && errors.Count == 0)
            {
                isDuplicate = IsDuplicate(row, existingTransactions, account.Currency);
                if (isDuplicate)
                {
                    duplicateRows++;
                }
            }

            bool isValid = errors.Count == 0 && !isDuplicate;
            if (isValid)
            {
                validRows++;
            }
            else if (!isDuplicate)
            {
                invalidRows++;
            }

            previewRows.Add(new ImportPreviewRow(
                RowNumber: i + 1,
                IsValid: isValid,
                IsDuplicate: isDuplicate,
                Data: row,
                LabelId: labelId,
                TagIds: tagIds,
                Errors: errors
            ));
        }

        return new ImportPreviewResponse(
            TotalRows: request.Transactions.Count,
            ValidRows: validRows,
            InvalidRows: invalidRows,
            DuplicateRows: duplicateRows,
            Rows: previewRows,
            MissingLabels: missingLabels.ToList(),
            MissingTags: missingTags.ToList()
        );
    }

    public async Task<BulkImportResponse> ImportAsync(string userId, BulkImportRequest request)
    {
        _logger.LogInformation("Importing {Count} transactions for user {UserId}", 
            request.Transactions.Count, userId);

        if (request.Transactions.Count > MaxImportRows)
        {
            return new BulkImportResponse(
                TotalRows: request.Transactions.Count,
                SuccessCount: 0,
                FailedCount: request.Transactions.Count,
                SkippedDuplicates: 0,
                Results: new List<ImportResult> 
                { 
                    new ImportResult(0, false, null, $"Too many rows. Maximum is {MaxImportRows}") 
                },
                CreatedLabels: new List<string>(),
                CreatedTags: new List<string>()
            );
        }

        // Validate account
        var account = await _accountRepository.GetByIdAndUserIdAsync(request.AccountId, userId);
        if (account == null)
        {
            return new BulkImportResponse(
                TotalRows: request.Transactions.Count,
                SuccessCount: 0,
                FailedCount: request.Transactions.Count,
                SkippedDuplicates: 0,
                Results: new List<ImportResult> 
                { 
                    new ImportResult(0, false, null, "Invalid account ID") 
                },
                CreatedLabels: new List<string>(),
                CreatedTags: new List<string>()
            );
        }

        // Get existing labels and tags
        var existingLabels = await _labelRepository.GetByUserIdAsync(userId);
        var existingTags = await _tagRepository.GetByUserIdAsync(userId);
        var labelMap = existingLabels.ToDictionary(l => l.Name.ToLowerInvariant(), l => l.Id);
        var tagMap = existingTags.ToDictionary(t => t.Name.ToLowerInvariant(), t => t.Id);

        // Create missing labels if requested
        var createdLabels = new List<string>();
        if (request.CreateMissingLabels)
        {
            var missingLabelNames = request.Transactions
                .Where(t => !string.IsNullOrWhiteSpace(t.LabelName))
                .Select(t => t.LabelName!.Trim())
                .Distinct()
                .Where(name => !labelMap.ContainsKey(name.ToLowerInvariant()))
                .ToList();

            foreach (var labelName in missingLabelNames)
            {
                var result = await _labelService.CreateAsync(userId, new CreateLabelRequest(
                    Name: labelName,
                    ParentId: null,
                    Type: "Category",
                    Icon: "📁",
                    Color: "#6B7280"
                ));
                if (result.Success && result.Label != null)
                {
                    labelMap[labelName.ToLowerInvariant()] = result.Label.Id;
                    createdLabels.Add(labelName);
                }
            }
        }

        // Create missing tags if requested
        var createdTags = new List<string>();
        if (request.CreateMissingTags)
        {
            var missingTagNames = request.Transactions
                .SelectMany(t => t.TagNames ?? new List<string>())
                .Where(t => !string.IsNullOrWhiteSpace(t))
                .Select(t => t.Trim())
                .Distinct()
                .Where(name => !tagMap.ContainsKey(name.ToLowerInvariant()))
                .ToList();

            foreach (var tagName in missingTagNames)
            {
                var result = await _tagService.CreateAsync(userId, new CreateTagRequest(
                    Name: tagName,
                    Color: "#6B7280"
                ));
                if (result.Success && result.Tag != null)
                {
                    tagMap[tagName.ToLowerInvariant()] = result.Tag.Id;
                    createdTags.Add(tagName);
                }
            }
        }

        // Get existing transactions for duplicate detection
        var existingTransactions = request.SkipDuplicates 
            ? await GetExistingTransactionsForDuplicateCheck(userId, request.AccountId)
            : new List<Transaction>();

        // Get user's DEK for encryption
        var user = await _userRepository.GetByIdAsync(userId);
        byte[]? dek = null;
        if (user?.WrappedDek != null)
        {
            dek = await _keyManagementService.UnwrapKeyAsync(user.WrappedDek);
        }

        var results = new List<ImportResult>();
        int successCount = 0;
        int failedCount = 0;
        int skippedDuplicates = 0;

        for (int i = 0; i < request.Transactions.Count; i++)
        {
            var row = request.Transactions[i];
            var rowNumber = i + 1;
            var errors = ValidateRow(row, rowNumber);

            if (errors.Any())
            {
                failedCount++;
                results.Add(new ImportResult(rowNumber, false, null, string.Join("; ", errors)));
                continue;
            }

            // Check for duplicate
            if (request.SkipDuplicates && IsDuplicate(row, existingTransactions, account.Currency))
            {
                skippedDuplicates++;
                results.Add(new ImportResult(rowNumber, true, null, "Skipped as duplicate"));
                continue;
            }

            try
            {
                var transaction = await CreateTransaction(userId, request.AccountId, account.Currency, 
                    row, labelMap, tagMap, dek, request.DateTimezone);
                
                successCount++;
                results.Add(new ImportResult(rowNumber, true, transaction.Id, null));
                
                // Add to existing transactions for duplicate detection of subsequent rows
                existingTransactions.Add(transaction);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error importing row {RowNumber}", rowNumber);
                failedCount++;
                results.Add(new ImportResult(rowNumber, false, null, ex.Message));
            }
        }

        _logger.LogInformation("Import completed: {Success} succeeded, {Failed} failed, {Skipped} skipped duplicates",
            successCount, failedCount, skippedDuplicates);

        return new BulkImportResponse(
            TotalRows: request.Transactions.Count,
            SuccessCount: successCount,
            FailedCount: failedCount,
            SkippedDuplicates: skippedDuplicates,
            Results: results,
            CreatedLabels: createdLabels,
            CreatedTags: createdTags
        );
    }

    public async Task<ImportPreviewResponse> ParseAndPreviewAsync(string userId, CsvParseRequest request)
    {
        // Extract CSV content from request
        string csvContent;
        if (!string.IsNullOrWhiteSpace(request.CsvContent))
        {
            csvContent = request.CsvContent;
        }
        else if (!string.IsNullOrWhiteSpace(request.Base64Content))
        {
            try
            {
                var bytes = Convert.FromBase64String(request.Base64Content);
                csvContent = System.Text.Encoding.UTF8.GetString(bytes);
            }
            catch (FormatException)
            {
                return new ImportPreviewResponse(
                    TotalRows: 0,
                    ValidRows: 0,
                    InvalidRows: 0,
                    DuplicateRows: 0,
                    Rows: new List<ImportPreviewRow>(),
                    MissingLabels: new List<string>(),
                    MissingTags: new List<string>()
                );
            }
        }
        else
        {
            return new ImportPreviewResponse(
                TotalRows: 0,
                ValidRows: 0,
                InvalidRows: 0,
                DuplicateRows: 0,
                Rows: new List<ImportPreviewRow>(),
                MissingLabels: new List<string>(),
                MissingTags: new List<string>()
            );
        }

        // Parse CSV to transactions
        var transactions = ParseCsv(csvContent);
        
        if (transactions.Count == 0)
        {
            return new ImportPreviewResponse(
                TotalRows: 0,
                ValidRows: 0,
                InvalidRows: 0,
                DuplicateRows: 0,
                Rows: new List<ImportPreviewRow>(),
                MissingLabels: new List<string>(),
                MissingTags: new List<string>()
            );
        }

        // Create preview request and delegate to existing method
        var previewRequest = new ImportPreviewRequest(
            AccountId: request.AccountId,
            Transactions: transactions,
            CreateMissingLabels: request.CreateMissingLabels,
            CreateMissingTags: request.CreateMissingTags,
            SkipDuplicates: request.SkipDuplicates
        );

        return await PreviewImportAsync(userId, previewRequest);
    }

    public List<ImportTransactionRequest> ParseCsv(string csvContent)
    {
        var transactions = new List<ImportTransactionRequest>();
        var lines = csvContent.Split(new[] { "\r\n", "\r", "\n" }, StringSplitOptions.RemoveEmptyEntries);
        
        if (lines.Length < 2)
        {
            return transactions; // Need at least header + 1 data row
        }

        // Parse header to find column indices
        var headerLine = lines[0];
        var headers = ParseCsvLine(headerLine);
        var columnMap = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
        
        for (int i = 0; i < headers.Count; i++)
        {
            var header = headers[i].Trim().ToLowerInvariant();
            columnMap[header] = i;
        }

        // Required columns
        if (!columnMap.ContainsKey("date") || 
            (!columnMap.ContainsKey("amount") && !columnMap.ContainsKey("credit") && !columnMap.ContainsKey("debit")))
        {
            throw new ArgumentException("CSV must contain 'date' and either 'amount' or 'credit'/'debit' columns");
        }

        // Parse data rows
        for (int lineNum = 1; lineNum < lines.Length; lineNum++)
        {
            var line = lines[lineNum].Trim();
            if (string.IsNullOrWhiteSpace(line))
            {
                continue;
            }

            var values = ParseCsvLine(line);
            
            try
            {
                var transaction = ParseRowToDtoFromCsv(values, columnMap);
                if (transaction != null)
                {
                    transactions.Add(transaction);
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to parse CSV line {LineNum}: {Line}", lineNum + 1, line);
                // Continue with other rows
            }
        }

        return transactions;
    }

    private ImportTransactionRequest? ParseRowToDtoFromCsv(List<string> values, Dictionary<string, int> columnMap)
    {
        string GetValue(string columnName) => 
            columnMap.TryGetValue(columnName, out var idx) && idx < values.Count 
                ? values[idx].Trim() 
                : string.Empty;

        // Parse date
        var dateStr = GetValue("date");
        if (string.IsNullOrWhiteSpace(dateStr))
        {
            return null;
        }

        // Try to parse date in various formats
        if (!TryParseDate(dateStr, out var parsedDate))
        {
            return null;
        }

        // Parse amount - handle credit/debit columns
        decimal amount;
        string type;
        
        var amountStr = GetValue("amount");
        var creditStr = GetValue("credit");
        var debitStr = GetValue("debit");

        if (!string.IsNullOrWhiteSpace(amountStr))
        {
            // Single amount column - positive = credit, negative = debit
            if (!TryParseAmount(amountStr, out amount))
            {
                return null;
            }
            type = amount >= 0 ? "Receive" : "Send";
            amount = Math.Abs(amount);
        }
        else if (!string.IsNullOrWhiteSpace(creditStr) || !string.IsNullOrWhiteSpace(debitStr))
        {
            // Separate credit/debit columns
            if (!string.IsNullOrWhiteSpace(creditStr) && TryParseAmount(creditStr, out var credit) && credit > 0)
            {
                amount = credit;
                type = "Receive";
            }
            else if (!string.IsNullOrWhiteSpace(debitStr) && TryParseAmount(debitStr, out var debit) && debit > 0)
            {
                amount = debit;
                type = "Send";
            }
            else
            {
                return null;
            }
        }
        else
        {
            return null;
        }

        // Get optional fields
        var title = GetValue("title");
        if (string.IsNullOrWhiteSpace(title)) title = GetValue("description");
        if (string.IsNullOrWhiteSpace(title)) title = GetValue("memo");
        
        var payee = GetValue("payee");
        if (string.IsNullOrWhiteSpace(payee)) payee = GetValue("merchant");
        if (string.IsNullOrWhiteSpace(payee)) payee = GetValue("vendor");
        if (string.IsNullOrWhiteSpace(payee)) payee = GetValue("name");
        
        var notes = GetValue("notes");
        if (string.IsNullOrWhiteSpace(notes)) notes = GetValue("memo");
        
        var labelName = GetValue("category");
        if (string.IsNullOrWhiteSpace(labelName)) labelName = GetValue("label");
        
        var tagStr = GetValue("tags");
        var tagNames = string.IsNullOrWhiteSpace(tagStr) 
            ? null 
            : tagStr.Split(new[] { ',', ';' }, StringSplitOptions.RemoveEmptyEntries)
                    .Select(t => t.Trim())
                    .Where(t => !string.IsNullOrWhiteSpace(t))
                    .ToList();

        return new ImportTransactionRequest(
            Type: type,
            Amount: amount,
            Date: parsedDate.ToString("yyyy-MM-dd"),
            Title: string.IsNullOrWhiteSpace(title) ? null : title.Substring(0, Math.Min(title.Length, MaxTitleLength)),
            Payee: string.IsNullOrWhiteSpace(payee) ? null : payee.Substring(0, Math.Min(payee.Length, MaxPayeeLength)),
            Notes: string.IsNullOrWhiteSpace(notes) ? null : notes.Substring(0, Math.Min(notes.Length, MaxNotesLength)),
            LabelName: string.IsNullOrWhiteSpace(labelName) ? null : labelName,
            TagNames: tagNames
        );
    }

    private List<string> ParseCsvLine(string line)
    {
        var values = new List<string>();
        var current = new System.Text.StringBuilder();
        bool inQuotes = false;

        for (int i = 0; i < line.Length; i++)
        {
            char c = line[i];

            if (c == '"')
            {
                if (inQuotes && i + 1 < line.Length && line[i + 1] == '"')
                {
                    // Escaped quote
                    current.Append('"');
                    i++;
                }
                else
                {
                    inQuotes = !inQuotes;
                }
            }
            else if (c == ',' && !inQuotes)
            {
                values.Add(current.ToString().Trim());
                current.Clear();
            }
            else
            {
                current.Append(c);
            }
        }

        values.Add(current.ToString().Trim());
        return values;
    }

    private bool TryParseDate(string dateStr, out DateTime result)
    {
        result = default;
        
        // Try common date formats
        var formats = new[]
        {
            "yyyy-MM-dd",
            "MM/dd/yyyy",
            "dd/MM/yyyy",
            "MM-dd-yyyy",
            "dd-MM-yyyy",
            "M/d/yyyy",
            "d/M/yyyy",
            "yyyy/MM/dd",
            "yyyyMMdd"
        };

        foreach (var format in formats)
        {
            if (DateTime.TryParseExact(dateStr, format, CultureInfo.InvariantCulture, 
                DateTimeStyles.None, out result))
            {
                return true;
            }
        }

        // Try general parse as fallback
        return DateTime.TryParse(dateStr, CultureInfo.InvariantCulture, DateTimeStyles.None, out result);
    }

    private bool TryParseAmount(string amountStr, out decimal result)
    {
        result = 0;
        
        // Remove currency symbols and whitespace
        amountStr = amountStr
            .Replace("$", "")
            .Replace("€", "")
            .Replace("£", "")
            .Replace("₹", "")
            .Replace("¥", "")
            .Replace(" ", "")
            .Trim();

        // Handle parentheses for negative (common in accounting)
        bool isNegative = false;
        if (amountStr.StartsWith("(") && amountStr.EndsWith(")"))
        {
            isNegative = true;
            amountStr = amountStr.TrimStart('(').TrimEnd(')');
        }
        else if (amountStr.StartsWith("-"))
        {
            isNegative = true;
            amountStr = amountStr.TrimStart('-');
        }

        if (decimal.TryParse(amountStr, NumberStyles.Number | NumberStyles.AllowDecimalPoint, 
            CultureInfo.InvariantCulture, out result))
        {
            if (isNegative) result = -result;
            return true;
        }

        // Try with different culture
        if (decimal.TryParse(amountStr, NumberStyles.Number | NumberStyles.AllowDecimalPoint, 
            CultureInfo.CurrentCulture, out result))
        {
            if (isNegative) result = -result;
            return true;
        }

        return false;
    }

    private List<string> ValidateRow(ImportTransactionRequest row, int rowNumber)
    {
        var errors = new List<string>();

        // Validate type
        if (string.IsNullOrWhiteSpace(row.Type) || 
            (row.Type != "Receive" && row.Type != "Send"))
        {
            errors.Add($"Type must be 'Receive' or 'Send'");
        }

        // Validate amount
        if (row.Amount <= 0)
        {
            errors.Add("Amount must be greater than 0");
        }

        // Validate date
        if (string.IsNullOrWhiteSpace(row.Date))
        {
            errors.Add("Date is required");
        }
        else if (!DateTime.TryParseExact(row.Date, "yyyy-MM-dd", CultureInfo.InvariantCulture, 
            DateTimeStyles.None, out _))
        {
            errors.Add("Date must be in YYYY-MM-DD format");
        }

        // Validate title length
        if (!string.IsNullOrWhiteSpace(row.Title) && row.Title.Length > MaxTitleLength)
        {
            errors.Add($"Title exceeds {MaxTitleLength} characters");
        }

        // Validate payee length
        if (!string.IsNullOrWhiteSpace(row.Payee) && row.Payee.Length > MaxPayeeLength)
        {
            errors.Add($"Payee exceeds {MaxPayeeLength} characters");
        }

        // Validate notes length
        if (!string.IsNullOrWhiteSpace(row.Notes) && row.Notes.Length > MaxNotesLength)
        {
            errors.Add($"Notes exceeds {MaxNotesLength} characters");
        }

        return errors;
    }

    private async Task<List<Transaction>> GetExistingTransactionsForDuplicateCheck(string userId, string accountId)
    {
        // Get last 90 days of transactions for duplicate checking
        var startDate = DateTime.UtcNow.AddDays(-90);
        var filter = new TransactionFilterRequest(
            StartDate: startDate,
            EndDate: null,
            AccountIds: new List<string> { accountId },
            Types: null,
            LabelIds: null,
            TagIds: null,
            MinAmount: null,
            MaxAmount: null,
            SearchText: null,
            Status: null,
            IsRecurring: false,
            Page: 1,
            PageSize: 10000 // Get all for duplicate checking
        );

        var (transactions, _) = await _transactionRepository.GetFilteredAsync(userId, filter);
        return transactions;
    }

    private bool IsDuplicate(ImportTransactionRequest row, List<Transaction> existingTransactions, string currency)
    {
        if (!DateTime.TryParseExact(row.Date, "yyyy-MM-dd", CultureInfo.InvariantCulture, 
            DateTimeStyles.None, out var date))
        {
            return false;
        }

        // Check for same date, amount, and type
        return existingTransactions.Any(t =>
            t.Date.Date == date.Date &&
            Math.Abs(t.Amount - row.Amount) < 0.01m &&
            t.Type.ToString() == row.Type);
    }

    private async Task<Transaction> CreateTransaction(
        string userId, 
        string accountId, 
        string currency,
        ImportTransactionRequest row,
        Dictionary<string, string> labelMap,
        Dictionary<string, string> tagMap,
        byte[]? dek,
        string? timezone)
    {
        var date = DateTime.ParseExact(row.Date, "yyyy-MM-dd", CultureInfo.InvariantCulture);
        
        // Map transaction type
        var type = row.Type == "Receive" ? TransactionType.Receive : TransactionType.Send;

        // Map label to split
        var splits = new List<TransactionSplit>();
        if (!string.IsNullOrWhiteSpace(row.LabelName))
        {
            var labelNameLower = row.LabelName.Trim().ToLowerInvariant();
            if (labelMap.TryGetValue(labelNameLower, out var labelId))
            {
                splits.Add(new TransactionSplit
                {
                    LabelId = labelId,
                    Amount = row.Amount,
                    Notes = null
                });
            }
        }

        // If no label mapped, get or create a default one
        if (splits.Count == 0)
        {
            var labels = await _labelRepository.GetByUserIdAsync(userId);
            var defaultLabel = labels.FirstOrDefault(l => l.Type == LabelType.Category);
            if (defaultLabel != null)
            {
                splits.Add(new TransactionSplit
                {
                    LabelId = defaultLabel.Id,
                    Amount = row.Amount,
                    Notes = null
                });
            }
        }

        // Map tags
        var tagIds = new List<string>();
        if (row.TagNames?.Any() == true)
        {
            foreach (var tagName in row.TagNames.Where(t => !string.IsNullOrWhiteSpace(t)))
            {
                var tagNameLower = tagName.Trim().ToLowerInvariant();
                if (tagMap.TryGetValue(tagNameLower, out var tagId))
                {
                    tagIds.Add(tagId);
                }
            }
        }

        // Encrypt sensitive fields if DEK is available
        string? encryptedPayee = null;
        string? encryptedNotes = null;
        
        if (dek != null)
        {
            encryptedPayee = _encryptionService.EncryptIfNotEmpty(row.Payee, dek);
            encryptedNotes = _encryptionService.EncryptIfNotEmpty(row.Notes, dek);
        }

        // Create transaction
        var transaction = new Transaction
        {
            UserId = userId,
            AccountId = accountId,
            Type = type,
            Amount = row.Amount,
            Currency = currency,
            Date = date,
            DateLocal = row.Date,
            DateTimezone = timezone,
            Title = row.Title,
            EncryptedPayee = encryptedPayee,
            EncryptedNotes = encryptedNotes,
            Splits = splits,
            TagIds = tagIds,
            Source = TransactionSource.Import,
            Status = TransactionStatus.Confirmed,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        await _transactionRepository.CreateAsync(transaction);
        return transaction;
    }
}