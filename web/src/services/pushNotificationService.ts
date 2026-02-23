import { apiClient } from './apiClient';
import { getErrorMessage } from '../lib/queryClient';
import { logger } from './logger';

/**
 * Check if push notifications are supported in this browser
 */
export function isPushSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

/**
 * Get the current notification permission status
 */
export function getNotificationPermission(): NotificationPermission {
  if (!('Notification' in window)) {
    return 'denied';
  }
  return Notification.permission;
}

/**
 * Request notification permission from the user
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) {
    logger.warn('Notifications not supported in this browser');
    return 'denied';
  }

  if (Notification.permission === 'granted') {
    return 'granted';
  }

  if (Notification.permission === 'denied') {
    logger.warn('Notification permission was previously denied');
    return 'denied';
  }

  // Request permission
  const permission = await Notification.requestPermission();
  return permission;
}

/**
 * Get the VAPID public key from the server
 */
export async function getVapidPublicKey(): Promise<string | null> {
  try {
    const response = await apiClient.get<{ publicKey: string | null; message?: string }>('/push/vapid-public-key');
    return response.publicKey;
  } catch (error) {
    logger.error('Failed to fetch VAPID public key', { error: error instanceof Error ? error.message : String(error) });
    return null;
  }
}

/**
 * Convert a base64 string to a Uint8Array (for applicationServerKey)
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');

  const rawData = window.atob(base64);
  const buffer = new ArrayBuffer(rawData.length);
  const outputArray = new Uint8Array(buffer);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Subscribe to push notifications
 */
export async function subscribeToPush(): Promise<{ success: boolean; message: string }> {
  if (!isPushSupported()) {
    return { success: false, message: 'Push notifications are not supported in this browser' };
  }

  // Request permission first
  const permission = await requestNotificationPermission();
  if (permission !== 'granted') {
    return { success: false, message: 'Notification permission denied' };
  }

  // Get VAPID public key
  const vapidKey = await getVapidPublicKey();
  if (!vapidKey) {
    return { success: false, message: 'Push notifications are not configured on the server' };
  }

  try {
    // Get service worker registration
    const registration = await navigator.serviceWorker.ready;

    // Check for existing subscription
    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      // Create new subscription
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });
    }

    // Get subscription details
    const subscriptionJson = subscription.toJSON();
    const keys = subscriptionJson.keys as { p256dh: string; auth: string } | undefined;

    if (!keys) {
      throw new Error('Failed to get subscription keys');
    }

    // Send subscription to server
    await apiClient.post<{ message: string; subscriptionId: string }>('/push/subscribe', {
      endpoint: subscription.endpoint,
      keys: {
        p256dh: keys.p256dh,
        auth: keys.auth,
      },
      deviceName: getDeviceName(),
    });

    return { success: true, message: 'Successfully subscribed to push notifications' };
  } catch (error) {
    logger.error('Failed to subscribe to push notifications', { error: error instanceof Error ? error.message : String(error) });
    return { success: false, message: getErrorMessage(error) };
  }
}

/**
 * Unsubscribe from push notifications
 */
export async function unsubscribeFromPush(): Promise<{ success: boolean; message: string }> {
  if (!isPushSupported()) {
    return { success: false, message: 'Push notifications are not supported' };
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      return { success: true, message: 'Not subscribed to push notifications' };
    }

    // Unsubscribe from browser
    await subscription.unsubscribe();

    // Remove from server - send endpoint as query param since delete doesn't support body
    await apiClient.post('/push/unsubscribe', {
      endpoint: subscription.endpoint,
    });

    return { success: true, message: 'Successfully unsubscribed from push notifications' };
  } catch (error) {
    logger.error('Failed to unsubscribe from push notifications', { error: error instanceof Error ? error.message : String(error) });
    return { success: false, message: getErrorMessage(error) };
  }
}

/**
 * Check if currently subscribed to push notifications
 */
export async function isPushSubscribed(): Promise<boolean> {
  if (!isPushSupported()) {
    return false;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    return subscription !== null;
  } catch {
    return false;
  }
}

/**
 * Send a test push notification
 */
export async function sendTestNotification(): Promise<{ success: boolean; message: string }> {
  try {
    const response = await apiClient.post<{ message: string }>('/push/test', {});
    return { success: true, message: response.message };
  } catch (error) {
    logger.error('Failed to send test notification', { error: error instanceof Error ? error.message : String(error) });
    return { success: false, message: getErrorMessage(error) };
  }
}

/**
 * Get a friendly device name based on user agent
 */
function getDeviceName(): string {
  const ua = navigator.userAgent;

  // Check for mobile devices
  if (/iPhone/.test(ua)) return 'iPhone';
  if (/iPad/.test(ua)) return 'iPad';
  if (/Android/.test(ua)) {
    if (/Mobile/.test(ua)) return 'Android Phone';
    return 'Android Tablet';
  }

  // Check for desktop browsers
  if (/Windows/.test(ua)) {
    if (/Edge/.test(ua)) return 'Windows (Edge)';
    if (/Chrome/.test(ua)) return 'Windows (Chrome)';
    if (/Firefox/.test(ua)) return 'Windows (Firefox)';
    return 'Windows';
  }

  if (/Mac OS X/.test(ua)) {
    if (/Chrome/.test(ua)) return 'Mac (Chrome)';
    if (/Firefox/.test(ua)) return 'Mac (Firefox)';
    if (/Safari/.test(ua)) return 'Mac (Safari)';
    return 'Mac';
  }

  if (/Linux/.test(ua)) {
    if (/Chrome/.test(ua)) return 'Linux (Chrome)';
    if (/Firefox/.test(ua)) return 'Linux (Firefox)';
    return 'Linux';
  }

  return 'Unknown Device';
}