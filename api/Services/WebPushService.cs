using System.Text.Json;
using DigiTransac.Api.Repositories;
using Lib.Net.Http.WebPush;
using Lib.Net.Http.WebPush.Authentication;

namespace DigiTransac.Api.Services;

// Type alias to avoid ambiguity with Lib.Net.Http.WebPush.PushSubscription
using AppPushSubscription = DigiTransac.Api.Models.PushSubscription;

/// <summary>
/// Configuration for Web Push (VAPID)
/// </summary>
public class WebPushSettings
{
    /// <summary>
    /// VAPID public key - shared with the frontend for subscription
    /// </summary>
    public string PublicKey { get; set; } = string.Empty;

    /// <summary>
    /// VAPID private key - kept secret on the server
    /// </summary>
    public string PrivateKey { get; set; } = string.Empty;

    /// <summary>
    /// Contact email for the VAPID subject (e.g., "mailto:admin@example.com")
    /// </summary>
    public string Subject { get; set; } = string.Empty;
}

/// <summary>
/// Interface for sending Web Push notifications
/// </summary>
public interface IWebPushService
{
    /// <summary>
    /// Get the VAPID public key for frontend subscription
    /// </summary>
    string GetPublicKey();

    /// <summary>
    /// Send a push notification to all subscriptions for a user
    /// </summary>
    Task<int> SendToUserAsync(string userId, PushNotificationPayload payload);

    /// <summary>
    /// Send a push notification to a specific subscription
    /// </summary>
    Task<bool> SendToSubscriptionAsync(AppPushSubscription subscription, PushNotificationPayload payload);
}

/// <summary>
/// Payload for push notifications
/// </summary>
public record PushNotificationPayload(
    string Title,
    string Body,
    string? Icon = null,
    string? Badge = null,
    string? Tag = null,
    string? Url = null,
    Dictionary<string, object>? Data = null
);

public class WebPushService : IWebPushService
{
    private readonly PushServiceClient _pushClient;
    private readonly IPushSubscriptionRepository _subscriptionRepository;
    private readonly ILogger<WebPushService> _logger;
    private readonly WebPushSettings _settings;

    public WebPushService(
        IConfiguration configuration,
        IPushSubscriptionRepository subscriptionRepository,
        ILogger<WebPushService> logger)
    {
        _subscriptionRepository = subscriptionRepository;
        _logger = logger;

        // Load settings from configuration
        _settings = new WebPushSettings();
        configuration.GetSection("WebPush").Bind(_settings);

        // Validate configuration
        if (string.IsNullOrEmpty(_settings.PublicKey) || string.IsNullOrEmpty(_settings.PrivateKey))
        {
            _logger.LogWarning("WebPush VAPID keys not configured. Push notifications will be disabled.");
            _pushClient = null!;
            return;
        }

        // Initialize the push client with VAPID authentication
        _pushClient = new PushServiceClient();
        _pushClient.DefaultAuthentication = new VapidAuthentication(
            _settings.PublicKey,
            _settings.PrivateKey)
        {
            Subject = _settings.Subject
        };

        _logger.LogInformation("WebPush service initialized with VAPID authentication");
    }

    public string GetPublicKey()
    {
        return _settings.PublicKey;
    }

    public async Task<int> SendToUserAsync(string userId, PushNotificationPayload payload)
    {
        if (_pushClient == null)
        {
            _logger.LogDebug("WebPush is not configured, skipping notification to user {UserId}", userId);
            return 0;
        }

        var subscriptions = await _subscriptionRepository.GetByUserIdAsync(userId);
        if (subscriptions.Count == 0)
        {
            _logger.LogDebug("No push subscriptions found for user {UserId}", userId);
            return 0;
        }

        var successCount = 0;
        var failedSubscriptionIds = new List<string>();

        foreach (var subscription in subscriptions)
        {
            try
            {
                var success = await SendToSubscriptionAsync(subscription, payload);
                if (success)
                {
                    successCount++;
                    await _subscriptionRepository.UpdateLastUsedAsync(subscription.Id);
                }
                else
                {
                    failedSubscriptionIds.Add(subscription.Id);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error sending push notification to subscription {SubscriptionId}", subscription.Id);
                failedSubscriptionIds.Add(subscription.Id);
            }
        }

        // Clean up failed subscriptions (they might be expired)
        foreach (var id in failedSubscriptionIds)
        {
            _logger.LogInformation("Removing failed push subscription {SubscriptionId}", id);
            await _subscriptionRepository.DeleteAsync(id);
        }

        _logger.LogInformation("Sent push notification to {SuccessCount}/{TotalCount} subscriptions for user {UserId}",
            successCount, subscriptions.Count, userId);

        return successCount;
    }

    public async Task<bool> SendToSubscriptionAsync(AppPushSubscription subscription, PushNotificationPayload payload)
    {
        if (_pushClient == null)
        {
            return false;
        }

        try
        {
            // Create the push subscription object for the library
            var pushSubscription = new Lib.Net.Http.WebPush.PushSubscription
            {
                Endpoint = subscription.Endpoint,
                Keys = new Dictionary<string, string>
                {
                    ["p256dh"] = subscription.P256dh,
                    ["auth"] = subscription.Auth
                }
            };

            // Serialize the payload
            var payloadJson = JsonSerializer.Serialize(new
            {
                title = payload.Title,
                body = payload.Body,
                icon = payload.Icon ?? "/icons/icon-192x192.png",
                badge = payload.Badge ?? "/icons/icon-72x72.png",
                tag = payload.Tag,
                data = new
                {
                    url = payload.Url ?? "/",
                    payload.Data
                }
            }, new JsonSerializerOptions
            {
                PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
                DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull
            });

            // Create and send the push message
            var pushMessage = new PushMessage(payloadJson)
            {
                Topic = payload.Tag,
                Urgency = PushMessageUrgency.High
            };

            await _pushClient.RequestPushMessageDeliveryAsync(pushSubscription, pushMessage);

            _logger.LogDebug("Push notification sent successfully to subscription {SubscriptionId}", subscription.Id);
            return true;
        }
        catch (PushServiceClientException ex) when (ex.StatusCode == System.Net.HttpStatusCode.Gone)
        {
            // Subscription has expired or been unsubscribed
            _logger.LogInformation("Push subscription {SubscriptionId} has expired (410 Gone)", subscription.Id);
            return false;
        }
        catch (PushServiceClientException ex) when (ex.StatusCode == System.Net.HttpStatusCode.NotFound)
        {
            // Subscription not found
            _logger.LogInformation("Push subscription {SubscriptionId} not found (404)", subscription.Id);
            return false;
        }
        catch (PushServiceClientException ex)
        {
            _logger.LogError(ex, "Push service error for subscription {SubscriptionId}: {StatusCode}",
                subscription.Id, ex.StatusCode);
            return false;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to send push notification to subscription {SubscriptionId}", subscription.Id);
            return false;
        }
    }
}