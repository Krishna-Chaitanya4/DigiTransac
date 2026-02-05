using DigiTransac.Api.Models.Dto;

namespace DigiTransac.Api.Services.Transactions;

/// <summary>
/// Handles transaction export functionality.
/// Supports multiple export formats (JSON, CSV).
/// </summary>
public interface ITransactionExportService
{
    /// <summary>
    /// Get all transactions for export (no pagination limit)
    /// </summary>
    Task<List<TransactionResponse>> GetAllForExportAsync(
        string userId, 
        TransactionFilterRequest filter);
    
    /// <summary>
    /// Export transactions to CSV format
    /// </summary>
    Task<string> ExportToCsvAsync(
        string userId, 
        TransactionFilterRequest filter);
}