using DigiTransac.Api.Common;
using DigiTransac.Api.Models.Dto;

namespace DigiTransac.Api.Services.Transactions;

/// <summary>
/// Facade service that implements ITransactionService for backward compatibility.
/// Delegates all calls to the focused transaction services.
/// This allows gradual migration of endpoints to use the focused services directly.
/// </summary>
public class TransactionServiceFacade : ITransactionService
{
    private readonly ITransactionCoreService _coreService;
    private readonly IRecurringTransactionService _recurringService;
    private readonly ITransactionAnalyticsService _analyticsService;
    private readonly ITransactionExportService _exportService;
    private readonly ITransactionBatchService _batchService;
    private readonly IP2PTransactionService _p2pService;

    public TransactionServiceFacade(
        ITransactionCoreService coreService,
        IRecurringTransactionService recurringService,
        ITransactionAnalyticsService analyticsService,
        ITransactionExportService exportService,
        ITransactionBatchService batchService,
        IP2PTransactionService p2pService)
    {
        _coreService = coreService;
        _recurringService = recurringService;
        _analyticsService = analyticsService;
        _exportService = exportService;
        _batchService = batchService;
        _p2pService = p2pService;
    }

    // Core Service Methods
    public Task<TransactionListResponse> GetAllAsync(string userId, TransactionFilterRequest filter, CancellationToken ct = default)
        => _coreService.GetAllAsync(userId, filter, ct);

    public Task<TransactionResponse?> GetByIdAsync(string id, string userId, CancellationToken ct = default)
        => _coreService.GetByIdAsync(id, userId, ct);

    public Task<Result<TransactionResponse>> CreateAsync(
        string userId, CreateTransactionRequest request, CancellationToken ct = default)
        => _coreService.CreateAsync(userId, request, ct);

    public Task<Result<TransactionResponse>> UpdateAsync(
        string id, string userId, UpdateTransactionRequest request, CancellationToken ct = default)
        => _coreService.UpdateAsync(id, userId, request, ct);

    public Task<Result> DeleteAsync(string id, string userId, CancellationToken ct = default)
        => _coreService.DeleteAsync(id, userId, ct);

    public Task<int> GetPendingCountAsync(string userId, CancellationToken ct = default)
        => _coreService.GetPendingCountAsync(userId, ct);

    // Recurring Service Methods
    public Task<List<RecurringTransactionResponse>> GetRecurringAsync(string userId, CancellationToken ct = default)
        => _recurringService.GetRecurringAsync(userId, ct);

    public Task<(bool Success, string Message)> DeleteRecurringAsync(string id, string userId, bool deleteFutureInstances, CancellationToken ct = default)
        => _recurringService.DeleteRecurringAsync(id, userId, deleteFutureInstances, ct);

    public Task ProcessRecurringTransactionsAsync()
        => _recurringService.ProcessRecurringTransactionsAsync();

    // Analytics Service Methods
    public Task<TransactionSummaryResponse> GetSummaryAsync(string userId, TransactionFilterRequest filter, CancellationToken ct = default)
        => _analyticsService.GetSummaryAsync(userId, filter, ct);

    public Task<TransactionAnalyticsResponse> GetAnalyticsAsync(
        string userId, DateTime? startDate, DateTime? endDate, string? accountId, CancellationToken ct = default)
        => _analyticsService.GetAnalyticsAsync(userId, startDate, endDate, accountId, ct);

    // Export Service Methods
    public Task<List<TransactionResponse>> GetAllForExportAsync(string userId, TransactionFilterRequest filter, CancellationToken ct = default)
        => _exportService.GetAllForExportAsync(userId, filter, ct);

    // Batch Service Methods
    public Task<BatchOperationResponse> BatchDeleteAsync(string userId, List<string> ids, CancellationToken ct = default)
        => _batchService.BatchDeleteAsync(userId, ids, ct);

    public Task<BatchOperationResponse> BatchUpdateStatusAsync(string userId, List<string> ids, string status, CancellationToken ct = default)
        => _batchService.BatchUpdateStatusAsync(userId, ids, status, ct);

    // P2P Service Methods
    public Task<List<CounterpartyInfo>> GetCounterpartiesAsync(string userId, CancellationToken ct = default)
        => _p2pService.GetCounterpartiesAsync(userId, ct);

    public Task<(bool Success, string Message, TransactionResponse? Transaction)> AcceptP2PTransactionAsync(
        string transactionId, string userId, string accountId, CancellationToken ct = default)
        => _p2pService.AcceptP2PTransactionAsync(transactionId, userId, accountId, ct);

    public Task<(bool Success, string Message)> RejectP2PTransactionAsync(
        string transactionId, string userId, string? reason, CancellationToken ct = default)
        => _p2pService.RejectP2PTransactionAsync(transactionId, userId, reason, ct);
}