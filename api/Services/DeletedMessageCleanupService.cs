using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.DependencyInjection;
using DigiTransac.Api.Repositories;

namespace DigiTransac.Api.Services;

/// <summary>
/// Background service that permanently purges content from deleted messages
/// after the undo window (24 hours) has expired.
/// Runs every hour to check for expired deleted messages.
/// </summary>
public class DeletedMessageCleanupService : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<DeletedMessageCleanupService> _logger;
    private readonly TimeSpan _checkInterval = TimeSpan.FromHours(1);

    public DeletedMessageCleanupService(
        IServiceScopeFactory scopeFactory,
        ILogger<DeletedMessageCleanupService> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("Deleted Message Cleanup Service started");

        // Run immediately on startup, then every hour
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await PurgeExpiredDeletedMessagesAsync(stoppingToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error purging expired deleted messages");
            }

            await Task.Delay(_checkInterval, stoppingToken);
        }

        _logger.LogInformation("Deleted Message Cleanup Service stopped");
    }

    private async Task PurgeExpiredDeletedMessagesAsync(CancellationToken ct)
    {
        _logger.LogInformation("Purging expired deleted messages...");

        using var scope = _scopeFactory.CreateScope();
        var chatMessageRepository = scope.ServiceProvider.GetRequiredService<IChatMessageRepository>();

        var undoWindow = TimeSpan.FromMinutes(ConversationConstants.UndoDeleteWindowMinutes);
        var purgedCount = await chatMessageRepository.PurgeExpiredDeletedMessagesAsync(undoWindow, ct);

        if (purgedCount > 0)
        {
            _logger.LogInformation("Purged content from {Count} expired deleted messages", purgedCount);
        }
        else
        {
            _logger.LogInformation("No expired deleted messages to purge");
        }
    }
}