import { useState, useEffect, useCallback } from 'react';
import {
  isPushSupported,
  isPushSubscribed,
  requestNotificationPermission,
  subscribeToPush,
  sendTestNotification,
} from '../services/pushNotificationService';
import { logger } from '../services/logger';

/**
 * Push notification settings — auto-enables when permission is granted.
 * Shows "Enable" button if not yet permitted, status once active.
 */
export default function PushNotificationSettings() {
  const [isSupported, setIsSupported] = useState<boolean | null>(null);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [permissionState, setPermissionState] = useState<NotificationPermission>('default');
  const [isLoading, setIsLoading] = useState(true);
  const [isEnabling, setIsEnabling] = useState(false);
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Check support and auto-subscribe if permission already granted
  useEffect(() => {
    async function checkAndAutoSubscribe() {
      try {
        const supported = isPushSupported();
        setIsSupported(supported);
        
        if (supported) {
          const permission = Notification.permission;
          setPermissionState(permission);
          const subscribed = await isPushSubscribed();
          
          if (permission === 'granted' && !subscribed) {
            // Permission granted but not subscribed — auto-subscribe
            try {
              await subscribeToPush();
              setIsSubscribed(true);
            } catch (err) {
              logger.error('Auto-subscribe failed:', err);
              setIsSubscribed(false);
            }
          } else {
            setIsSubscribed(subscribed);
          }
        }
      } catch (err) {
        logger.error('Failed to check push notification status:', err);
        setError('Failed to check notification status');
      } finally {
        setIsLoading(false);
      }
    }
    checkAndAutoSubscribe();
  }, []);

  // Clear messages after delay
  useEffect(() => {
    if (error || successMessage) {
      const timer = setTimeout(() => {
        setError('');
        setSuccessMessage('');
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [error, successMessage]);

  const handleEnable = useCallback(async () => {
    setIsEnabling(true);
    setError('');

    try {
      const permission = await requestNotificationPermission();
      setPermissionState(Notification.permission);
      
      if (permission !== 'granted') {
        setError('Notification permission was denied. Please enable it in your browser settings.');
        return;
      }
      
      await subscribeToPush();
      setIsSubscribed(true);
      setSuccessMessage('Notifications enabled!');
    } catch (err) {
      logger.error('Failed to enable push notifications:', err);
      setError(err instanceof Error ? err.message : 'Failed to enable notifications');
    } finally {
      setIsEnabling(false);
    }
  }, []);

  const handleSendTest = useCallback(async () => {
    setIsSendingTest(true);
    setError('');
    setSuccessMessage('');

    try {
      await sendTestNotification();
      setSuccessMessage('Test notification sent!');
    } catch (err) {
      logger.error('Failed to send test notification:', err);
      setError(err instanceof Error ? err.message : 'Failed to send test notification');
    } finally {
      setIsSendingTest(false);
    }
  }, []);

  // Not supported
  if (isSupported === false) {
    return (
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
          <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0M3.124 7.5A8.969 8.969 0 0 1 5.292 3m13.416 0a8.969 8.969 0 0 1 2.168 4.5" />
          </svg>
        </div>
        <div>
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Push Notifications</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Not supported in this browser. Try Chrome, Firefox, Edge, or Safari.
          </p>
        </div>
      </div>
    );
  }

  // Loading
  if (isLoading || isSupported === null) {
    return (
      <div className="animate-pulse flex items-start gap-3">
        <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700" />
        <div>
          <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded mb-2" />
          <div className="h-3 w-48 bg-gray-200 dark:bg-gray-700 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-3">
        <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
          isSubscribed 
            ? 'bg-green-100 dark:bg-green-900/30' 
            : 'bg-gray-100 dark:bg-gray-700'
        }`}>
          <svg 
            className={`w-4 h-4 ${isSubscribed ? 'text-green-600 dark:text-green-400' : 'text-gray-400'}`} 
            fill="none" 
            viewBox="0 0 24 24" 
            strokeWidth={1.5} 
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
          </svg>
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Push Notifications</p>
          {isSubscribed ? (
            <p className="text-sm text-green-600 dark:text-green-400">
              Enabled — you'll receive notifications for new chat messages.
            </p>
          ) : permissionState === 'denied' ? (
            <p className="text-sm text-amber-600 dark:text-amber-400">
              Blocked by browser. Please allow notifications in your browser settings and reload.
            </p>
          ) : (
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                Get notified about new chat messages even when the app is closed.
              </p>
              <button
                type="button"
                onClick={handleEnable}
                disabled={isEnabling}
                className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50 transition-colors"
              >
                {isEnabling ? 'Enabling...' : 'Enable notifications'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Test notification - only when subscribed */}
      {isSubscribed && (
        <div className="pl-11">
          <button
            type="button"
            onClick={handleSendTest}
            disabled={isSendingTest}
            className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium disabled:opacity-50"
          >
            {isSendingTest ? 'Sending...' : 'Send test notification'}
          </button>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="pl-11">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Success */}
      {successMessage && (
        <div className="pl-11">
          <p className="text-sm text-green-600 dark:text-green-400">{successMessage}</p>
        </div>
      )}
    </div>
  );
}