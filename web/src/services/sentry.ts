/**
 * Sentry Error Monitoring Configuration
 * 
 * Sentry captures errors, exceptions, and performance data
 * to help debug production issues.
 */

import * as Sentry from '@sentry/react';

const SENTRY_DSN = 'https://27c0189a0b9892955fb4b97a67092959@o4510730086645760.ingest.us.sentry.io/4510730108993536';

/**
 * Initialize Sentry - call this before rendering the app
 */
export function initSentry(): void {
  // Only initialize in production, or if explicitly enabled in dev
  if (!import.meta.env.PROD && !import.meta.env.VITE_ENABLE_SENTRY) {
    console.info('[Sentry] Disabled in development mode');
    return;
  }

  Sentry.init({
    dsn: SENTRY_DSN,
    
    // Environment: 'production' or 'development'
    environment: import.meta.env.MODE,
    
    // Sample rate for performance monitoring (0.0 to 1.0)
    // Start with 10% of transactions to avoid quota issues
    tracesSampleRate: 0.1,
    
    // Capture 100% of errors (recommended)
    // Adjust if you hit quota limits
    sampleRate: 1.0,

    // Only send errors from your domain, not third-party scripts
    allowUrls: [
      /localhost/,
      /digitransac\.com/,  // Update with your actual domain when deployed
    ],

    // Filter out known noise
    ignoreErrors: [
      // Browser extensions
      /ResizeObserver loop/,
      /Non-Error exception captured/,
      // Network errors that users can't control
      'Network Error',
      'Failed to fetch',
      'Load failed',
      // User cancelled actions
      'AbortError',
    ],

    // Add context before sending
    beforeSend(event, _hint) {
      // Don't send errors in development unless explicitly enabled
      if (!import.meta.env.PROD && !import.meta.env.VITE_ENABLE_SENTRY) {
        return null;
      }

      // You can modify the event here or filter it out
      // For example, strip sensitive data:
      if (event.request?.data) {
        // Remove password fields from request data
        const data = event.request.data as Record<string, unknown>;
        if (typeof data === 'object') {
          delete data.password;
          delete data.currentPassword;
          delete data.newPassword;
        }
      }

      return event;
    },
  });

  console.info('[Sentry] Initialized successfully');
}

/**
 * Set the current user for error tracking
 * Call this after login
 */
export function setSentryUser(user: { id: string; email: string; name?: string }): void {
  Sentry.setUser({
    id: user.id,
    email: user.email,
    username: user.name,
  });
}

/**
 * Clear user data on logout
 */
export function clearSentryUser(): void {
  Sentry.setUser(null);
}

/**
 * Capture an exception manually
 */
export function captureException(error: Error | unknown, context?: Record<string, unknown>): void {
  if (context) {
    Sentry.withScope((scope) => {
      scope.setExtras(context);
      Sentry.captureException(error);
    });
  } else {
    Sentry.captureException(error);
  }
}

/**
 * Add breadcrumb for debugging
 * Breadcrumbs show the trail of events before an error
 */
export function addBreadcrumb(
  message: string, 
  category: string = 'app', 
  data?: Record<string, unknown>
): void {
  Sentry.addBreadcrumb({
    message,
    category,
    data,
    level: 'info',
  });
}

