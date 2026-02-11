using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.DependencyInjection;
using DigiTransac.Api.Services.Transactions;

namespace DigiTransac.Api.Services;

/// <summary>
/// Background service that processes recurring transactions periodically.
/// Runs every hour to check for transactions that need to be created.
/// </summary>
public class RecurringTransactionBackgroundService : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<RecurringTransactionBackgroundService> _logger;
    private readonly TimeSpan _checkInterval = TimeSpan.FromHours(1);

    public RecurringTransactionBackgroundService(
        IServiceScopeFactory scopeFactory,
        ILogger<RecurringTransactionBackgroundService> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("Recurring Transaction Background Service started");

        // Run immediately on startup, then every hour
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await ProcessRecurringTransactionsAsync(stoppingToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error processing recurring transactions");
            }

            await Task.Delay(_checkInterval, stoppingToken);
        }

        _logger.LogInformation("Recurring Transaction Background Service stopped");
    }

    private async Task ProcessRecurringTransactionsAsync(CancellationToken ct)
    {
        _logger.LogInformation("Processing recurring transactions...");

        using var scope = _scopeFactory.CreateScope();
        var recurringService = scope.ServiceProvider.GetRequiredService<IRecurringTransactionService>();

        await recurringService.ProcessRecurringTransactionsAsync(ct);

        _logger.LogInformation("Finished processing recurring transactions");
    }
}
