using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.DependencyInjection;
using DigiTransac.Api.Repositories;

namespace DigiTransac.Api.Services;

/// <summary>
/// Background service that permanently purges soft-deleted transactions
/// after the undo window (24 hours) has expired.
/// Runs every hour to check for expired soft-deleted transactions.
/// </summary>
public class DeletedTransactionCleanupService : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<DeletedTransactionCleanupService> _logger;
    private readonly TimeSpan _checkInterval = TimeSpan.FromHours(1);

    public DeletedTransactionCleanupService(
        IServiceScopeFactory scopeFactory,
        ILogger<DeletedTransactionCleanupService> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("Deleted Transaction Cleanup Service started");

        // Run immediately on startup, then every hour
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await PurgeExpiredDeletedTransactionsAsync(stoppingToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error purging expired deleted transactions");
            }

            await Task.Delay(_checkInterval, stoppingToken);
        }

        _logger.LogInformation("Deleted Transaction Cleanup Service stopped");
    }

    private async Task PurgeExpiredDeletedTransactionsAsync(CancellationToken ct)
    {
        _logger.LogInformation("Purging expired deleted transactions...");

        using var scope = _scopeFactory.CreateScope();
        var transactionRepository = scope.ServiceProvider.GetRequiredService<ITransactionRepository>();

        var undoWindow = TimeSpan.FromMinutes(ConversationConstants.UndoDeleteWindowMinutes);
        var purgedCount = await transactionRepository.PurgeExpiredDeletedTransactionsAsync(undoWindow, ct);

        if (purgedCount > 0)
        {
            _logger.LogInformation("Permanently purged {Count} expired deleted transactions", purgedCount);
        }
        else
        {
            _logger.LogInformation("No expired deleted transactions to purge");
        }
    }
}
