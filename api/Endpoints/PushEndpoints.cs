using System.Security.Claims;
using DigiTransac.Api.Models;
using DigiTransac.Api.Repositories;
using DigiTransac.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace DigiTransac.Api.Endpoints;

public static class PushEndpoints
{
    public static void MapPushEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/push").WithTags("Push Notifications");

        // Get VAPID public key for frontend subscription
        group.MapGet("/vapid-public-key", (IWebPushService webPushService) =>
        {
            var publicKey = webPushService.GetPublicKey();
            
            if (string.IsNullOrEmpty(publicKey))
            {
                return Results.Ok(new { publicKey = (string?)null, message = "Push notifications are not configured" });
            }
            
            return Results.Ok(new { publicKey });
        })
        .WithName("GetVapidPublicKey")
        .Produces(200)
        .AllowAnonymous();

        // Subscribe to push notifications
        group.MapPost("/subscribe", [Authorize] async (
            [FromBody] PushSubscriptionRequest request,
            ClaimsPrincipal user,
            IPushSubscriptionRepository subscriptionRepository,
            HttpContext httpContext) =>
        {
            var userId = user.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (userId == null)
            {
                return Results.Unauthorized();
            }

            // Validate request
            if (string.IsNullOrEmpty(request.Endpoint) ||
                string.IsNullOrEmpty(request.Keys?.P256dh) ||
                string.IsNullOrEmpty(request.Keys?.Auth))
            {
                return Results.BadRequest(new { message = "Invalid push subscription data" });
            }

            // Check if subscription already exists
            var existing = await subscriptionRepository.GetByEndpointAsync(request.Endpoint);
            if (existing != null)
            {
                // Update the existing subscription if it belongs to this user
                if (existing.UserId == userId)
                {
                    existing.P256dh = request.Keys.P256dh;
                    existing.Auth = request.Keys.Auth;
                    existing.UserAgent = httpContext.Request.Headers.UserAgent.ToString();
                    existing.DeviceName = request.DeviceName;
                    existing.IsEnabled = true;
                    await subscriptionRepository.UpdateAsync(existing);
                    return Results.Ok(new { message = "Subscription updated", subscriptionId = existing.Id });
                }
                else
                {
                    // Endpoint belongs to another user - remove it and create new
                    await subscriptionRepository.DeleteByEndpointAsync(request.Endpoint);
                }
            }

            // Create new subscription
            var subscription = new PushSubscription
            {
                UserId = userId,
                Endpoint = request.Endpoint,
                P256dh = request.Keys.P256dh,
                Auth = request.Keys.Auth,
                UserAgent = httpContext.Request.Headers.UserAgent.ToString(),
                DeviceName = request.DeviceName,
                CreatedAt = DateTime.UtcNow,
                IsEnabled = true
            };

            await subscriptionRepository.CreateAsync(subscription);

            return Results.Ok(new { message = "Subscribed to push notifications", subscriptionId = subscription.Id });
        })
        .WithName("SubscribePush")
        .Produces(200)
        .Produces(400)
        .Produces(401);

        // Unsubscribe from push notifications (POST because some clients don't support DELETE with body)
        group.MapPost("/unsubscribe", [Authorize] async (
            [FromBody] UnsubscribeRequest request,
            ClaimsPrincipal user,
            IPushSubscriptionRepository subscriptionRepository) =>
        {
            var userId = user.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (userId == null)
            {
                return Results.Unauthorized();
            }

            if (string.IsNullOrEmpty(request.Endpoint))
            {
                return Results.BadRequest(new { message = "Endpoint is required" });
            }

            var subscription = await subscriptionRepository.GetByEndpointAsync(request.Endpoint);
            if (subscription == null || subscription.UserId != userId)
            {
                return Results.NotFound(new { message = "Subscription not found" });
            }

            await subscriptionRepository.DeleteByEndpointAsync(request.Endpoint);

            return Results.Ok(new { message = "Unsubscribed from push notifications" });
        })
        .WithName("UnsubscribePush")
        .Produces(200)
        .Produces(400)
        .Produces(401)
        .Produces(404);

        // Get user's push subscriptions
        group.MapGet("/subscriptions", [Authorize] async (
            ClaimsPrincipal user,
            IPushSubscriptionRepository subscriptionRepository) =>
        {
            var userId = user.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (userId == null)
            {
                return Results.Unauthorized();
            }

            var subscriptions = await subscriptionRepository.GetByUserIdAsync(userId);
            
            return Results.Ok(subscriptions.Select(s => new
            {
                s.Id,
                s.DeviceName,
                s.UserAgent,
                s.CreatedAt,
                s.LastUsedAt,
                s.IsEnabled
            }));
        })
        .WithName("GetPushSubscriptions")
        .Produces(200)
        .Produces(401);

        // Delete a specific subscription
        group.MapDelete("/subscriptions/{id}", [Authorize] async (
            string id,
            ClaimsPrincipal user,
            IPushSubscriptionRepository subscriptionRepository) =>
        {
            var userId = user.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (userId == null)
            {
                return Results.Unauthorized();
            }

            // Verify the subscription belongs to this user by fetching all user subscriptions
            var subscriptions = await subscriptionRepository.GetByUserIdAsync(userId);
            if (!subscriptions.Any(s => s.Id == id))
            {
                return Results.NotFound(new { message = "Subscription not found" });
            }

            await subscriptionRepository.DeleteAsync(id);

            return Results.Ok(new { message = "Subscription deleted" });
        })
        .WithName("DeletePushSubscription")
        .Produces(200)
        .Produces(401)
        .Produces(404);

        // Test push notification (for debugging - send a test notification to self)
        group.MapPost("/test", [Authorize] async (
            ClaimsPrincipal user,
            IWebPushService webPushService) =>
        {
            var userId = user.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (userId == null)
            {
                return Results.Unauthorized();
            }

            var payload = new PushNotificationPayload(
                Title: "DigiTransac Test",
                Body: "Push notifications are working! 🎉",
                Tag: "test",
                Url: "/"
            );

            var sentCount = await webPushService.SendToUserAsync(userId, payload);

            return Results.Ok(new { message = $"Test notification sent to {sentCount} device(s)" });
        })
        .WithName("TestPushNotification")
        .Produces(200)
        .Produces(401);
    }
}

#region Request/Response DTOs

public record PushSubscriptionRequest(
    string Endpoint,
    PushKeys Keys,
    string? DeviceName
);

public record PushKeys(
    string P256dh,
    string Auth
);

public record UnsubscribeRequest(
    string Endpoint
);

#endregion