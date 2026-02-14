import { useState, useEffect, useCallback } from 'react';
import {
  isPushSupported,
  isPushSubscribed,
  requestNotificationPermission,
  subscribeToPush,
  unsubscribeFromPush,
  sendTestNotification,
} from '../services/pushNotificationService';
import { logger } from '../services/logger';

/**
 * Component for managing push notification settings
 */
export default function PushNotificationSettings() {
  const [isSupported, setIsSupported] = useState<boolean | null>(null);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [permissionState, setPermissionState] = useState<NotificationPermission>('default');
  const [isLoading, setIsLoading] = useState(true);
  const [isToggling, setIsToggling] = useState(false);
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Check support and subscription status on mount
  useEffect(() => {
    async function checkStatus() {
      try {
        const supported = isPushSupported();
        setIsSupported(supported);
        
        if (supported) {
          setPermissionState(Notification.permission);
          const subscribed = await isPushSubscribed();
          setIsSubscribed(subscribed);
        }
      } catch (err) {
        logger.error('Failed to check push notification status:', err);
        setError('Failed to check notification status');
      } finally {
        setIsLoading(false);
      }
    }
    checkStatus();
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

  const handleToggle = useCallback(async () => {
    setIsToggling(true);
    setError('');
    setSuccessMessage('');

    try {
      if (isSubscribed) {
        // Unsubscribe
        await unsubscribeFromPush();
        setIsSubscribed(false);
        setSuccessMessage('Push notifications disabled');
      } else {
        // Request permission first
        const permission = await requestNotificationPermission();
        setPermissionState(Notification.permission);
        
        if (permission !== 'granted') {
          setError('Notification permission was denied. Please enable it in your browser settings.');
          return;
        }
        
        // Subscribe
        await subscribeToPush();
        setIsSubscribed(true);
        setSuccessMessage('Push notifications enabled! You will now receive notifications even when the app is closed.');
      }
    } catch (err) {
      logger.error('Failed to toggle push notifications:', err);
      setError(err instanceof Error ? err.message : 'Failed to update notification settings');
      // Re-check status in case of partial failure
      try {
        const subscribed = await isPushSubscribed();
        setIsSubscribed(subscribed);
      } catch {
        // Ignore re-check errors
      }
    } finally {
      setIsToggling(false);
    }
  }, [isSubscribed]);

  const handleSendTest = useCallback(async () => {
    setIsSendingTest(true);
    setError('');
    setSuccessMessage('');

    try {
      await sendTestNotification();
      setSuccessMessage('Test notification sent! It should appear in a few seconds.');
    } catch (err) {
      logger.error('Failed to send test notification:', err);
      setError(err instanceof Error ? err.message : 'Failed to send test notification');
    } finally {
      setIsSendingTest(false);
    }
  }, []);

  // Not supported - show info message
  if (isSupported === false) {
    return (
      <div>
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
            <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0M3.124 7.5A8.969 8.969 0 0 1 5.292 3m13.416 0a8.969 8.969 0 0 1 2.168 4.5" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Push Notifications</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Push notifications are not supported in this browser. Try using a modern browser like Chrome, Firefox, Edge, or Safari.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Loading state
  if (isLoading || isSupported === null) {
    return (
      <div className="animate-pulse">
        <div className="flex items-center justify-between">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700" />
            <div>
              <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded mb-2" />
              <div className="h-3 w-48 bg-gray-200 dark:bg-gray-700 rounded" />
            </div>
          </div>
          <div className="h-6 w-11 bg-gray-200 dark:bg-gray-700 rounded-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Main toggle */}
      <div className="flex items-start justify-between gap-4">
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
              {isSubscribed ? (
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.143 17.082a24.248 24.248 0 0 0 3.844.148m-3.844-.148a23.856 23.856 0 0 1-5.455-1.31 8.964 8.964 0 0 0 2.3-5.542m3.155 6.852a3 3 0 0 0 5.667 1.97m1.965-2.277L21 21m-4.225-4.225a23.81 23.81 0 0 0 3.536-1.003A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6.53 6.53m10.245 10.245L6.53 6.53M3 3l3.53 3.53" />
              )}
            </svg>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Push Notifications</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {isSubscribed
                ? 'You will receive notifications for new chat messages even when the app is closed.'
                : 'Enable to receive notifications for new chat messages when the app is closed or in the background.'
              }
            </p>
            {permissionState === 'denied' && !isSubscribed && (
              <p className="text-sm text-amber-600 dark:text-amber-400 mt-1">
                ⚠️ Notifications are blocked. Please allow them in your browser settings.
              </p>
            )}
          </div>
        </div>
        
        {/* Toggle switch */}
        <button
          type="button"
          onClick={handleToggle}
          disabled={isToggling || permissionState === 'denied'}
          className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 disabled:opacity-50 disabled:cursor-not-allowed ${
            isSubscribed ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-600'
          }`}
          role="switch"
          aria-checked={isSubscribed}
          aria-label="Toggle push notifications"
        >
          <span
            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
              isSubscribed ? 'translate-x-5' : 'translate-x-0'
            }`}
          >
            {isToggling && (
              <svg className="animate-spin h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            )}
          </span>
        </button>
      </div>

      {/* Test notification button - only show when subscribed */}
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

      {/* Error message */}
      {error && (
        <div className="pl-11">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Success message */}
      {successMessage && (
        <div className="pl-11">
          <p className="text-sm text-green-600 dark:text-green-400">{successMessage}</p>
        </div>
      )}
    </div>
  );
}