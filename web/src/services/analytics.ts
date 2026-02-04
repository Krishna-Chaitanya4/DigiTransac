/**
 * Analytics Service for DigiTransac
 * 
 * This module provides a unified analytics interface using PostHog.
 * It handles event tracking, user identification, feature flags, and session recording.
 * 
 * INSTALLATION:
 *   npm install posthog-js
 * 
 * CONFIGURATION:
 *   Set VITE_POSTHOG_KEY and VITE_POSTHOG_HOST in your .env file
 * 
 * Usage:
 *   import { analytics } from '@/services/analytics';
 *   
 *   // Track an event
 *   analytics.track('transaction_created', { amount: 100, type: 'Send' });
 *   
 *   // Identify a user
 *   analytics.identify('user-id', { email: 'user@example.com' });
 */

// Types for analytics events
export interface AnalyticsUser {
  id: string;
  email: string;
  fullName?: string;
  primaryCurrency?: string;
  createdAt?: string;
}

export interface TransactionEvent {
  transactionId?: string;
  amount: number;
  currency: string;
  type: 'Send' | 'Receive' | 'Transfer';
  hasLocation?: boolean;
  hasCategory?: boolean;
  isRecurring?: boolean;
  isP2P?: boolean;
}

export interface BudgetEvent {
  budgetId?: string;
  amount: number;
  period: string;
  categoryCount: number;
  alertsEnabled?: boolean;
}

export interface PageViewEvent {
  path: string;
  title?: string;
  referrer?: string;
}

// Event names as constants for type safety
export const AnalyticsEvents = {
  // Auth events
  SIGN_UP_STARTED: 'sign_up_started',
  SIGN_UP_COMPLETED: 'sign_up_completed',
  SIGN_IN: 'sign_in',
  SIGN_OUT: 'sign_out',
  PASSWORD_RESET_REQUESTED: 'password_reset_requested',
  TWO_FACTOR_ENABLED: 'two_factor_enabled',
  TWO_FACTOR_DISABLED: 'two_factor_disabled',

  // Transaction events
  TRANSACTION_CREATED: 'transaction_created',
  TRANSACTION_UPDATED: 'transaction_updated',
  TRANSACTION_DELETED: 'transaction_deleted',
  TRANSACTION_BATCH_IMPORTED: 'transaction_batch_imported',
  TRANSFER_CREATED: 'transfer_created',

  // Account events
  ACCOUNT_CREATED: 'account_created',
  ACCOUNT_UPDATED: 'account_updated',
  ACCOUNT_DELETED: 'account_deleted',

  // Budget events
  BUDGET_CREATED: 'budget_created',
  BUDGET_UPDATED: 'budget_updated',
  BUDGET_EXCEEDED: 'budget_exceeded',
  BUDGET_ALERT_TRIGGERED: 'budget_alert_triggered',

  // Category/Label events
  LABEL_CREATED: 'label_created',
  LABEL_UPDATED: 'label_updated',
  TAG_CREATED: 'tag_created',

  // Chat events
  CONVERSATION_STARTED: 'conversation_started',
  MESSAGE_SENT: 'message_sent',
  P2P_TRANSACTION_SENT: 'p2p_transaction_sent',
  P2P_TRANSACTION_RECEIVED: 'p2p_transaction_received',

  // Feature usage
  INSIGHTS_VIEWED: 'insights_viewed',
  MAP_VIEWED: 'map_viewed',
  EXPORT_REQUESTED: 'export_requested',
  FILTER_APPLIED: 'filter_applied',
  SEARCH_PERFORMED: 'search_performed',
  DARK_MODE_TOGGLED: 'dark_mode_toggled',
  CURRENCY_CHANGED: 'currency_changed',

  // Errors
  ERROR_OCCURRED: 'error_occurred',
  API_ERROR: 'api_error',
} as const;

// PostHog type placeholder (will be replaced when package is installed)
type PostHogInstance = {
  init: (apiKey: string, options: Record<string, unknown>) => void;
  identify: (userId: string, traits?: Record<string, unknown>) => void;
  reset: () => void;
  capture: (event: string, properties?: Record<string, unknown>) => void;
  isFeatureEnabled: (flagName: string) => boolean | undefined;
  getFeatureFlag: (flagName: string) => string | boolean | undefined;
  people: {
    set: (properties: Record<string, unknown>) => void;
    set_once: (properties: Record<string, unknown>) => void;
    increment: (property: string, value: number) => void;
  };
  opt_out_capturing: () => void;
  opt_in_capturing: () => void;
  has_opted_out_capturing: () => boolean;
};

// Analytics class for managing PostHog
class AnalyticsService {
  private initialized = false;
  private posthog: PostHogInstance | null = null;
  private queue: Array<() => void> = [];

  /**
   * Initialize PostHog analytics
   * Call this once in your app entry point (main.tsx)
   */
  async init() {
    // Skip in test environment
    if (import.meta.env.MODE === 'test') {
      console.log('[Analytics] Skipping initialization in test mode');
      return;
    }

    const apiKey = import.meta.env.VITE_POSTHOG_KEY;
    const apiHost = import.meta.env.VITE_POSTHOG_HOST || 'https://app.posthog.com';

    if (!apiKey) {
      console.warn('[Analytics] PostHog API key not configured. Analytics disabled.');
      return;
    }

    try {
      // Dynamic import for code splitting
      // NOTE: Install posthog-js before uncommenting: npm install posthog-js
      // const posthogModule = await import('posthog-js');
      // this.posthog = posthogModule.default as unknown as PostHogInstance;
      
      // Placeholder until PostHog is installed
      console.warn('[Analytics] PostHog is not installed. Run: npm install posthog-js');
      
      // Mock implementation for development
      this.posthog = this.createMockPostHog();
      
      this.posthog.init(apiKey, {
        api_host: apiHost,
        // Capture page views automatically
        capture_pageview: true,
        // Enable session recording
        capture_pageleave: true,
        // Respect Do Not Track
        respect_dnt: true,
        // Disable in development by default
        loaded: (_posthog: unknown) => {
          if (import.meta.env.DEV) {
            // Disable capture in development
            // posthog.opt_out_capturing();
            console.log('[Analytics] PostHog initialized in development mode');
          }
        },
        // Persistence for cross-session tracking
        persistence: 'localStorage+cookie',
        // Bootstrap feature flags for faster access
        bootstrap: {
          distinctID: localStorage.getItem('posthog_distinct_id') || undefined,
        },
      });

      this.initialized = true;
      
      // Process queued events
      this.queue.forEach(fn => fn());
      this.queue = [];

      console.log('[Analytics] PostHog initialized successfully');
    } catch (error) {
      console.error('[Analytics] Failed to initialize PostHog:', error);
    }
  }

  /**
   * Queue an action if PostHog is not yet initialized
   */
  private queueOrExecute(action: () => void) {
    if (this.initialized && this.posthog) {
      action();
    } else {
      this.queue.push(action);
    }
  }

  /**
   * Identify a user for tracking
   */
  identify(userId: string, traits?: Partial<AnalyticsUser>) {
    this.queueOrExecute(() => {
      this.posthog?.identify(userId, {
        email: traits?.email,
        name: traits?.fullName,
        primaryCurrency: traits?.primaryCurrency,
        ...traits,
      });
    });
  }

  /**
   * Reset user identification (on logout)
   */
  reset() {
    this.queueOrExecute(() => {
      this.posthog?.reset();
    });
  }

  /**
   * Track a custom event
   */
  track(event: string, properties?: Record<string, unknown>) {
    this.queueOrExecute(() => {
      this.posthog?.capture(event, properties);
    });
  }

  /**
   * Track a page view
   */
  pageView(path: string, properties?: PageViewEvent) {
    this.queueOrExecute(() => {
      this.posthog?.capture('$pageview', {
        $current_url: path,
        ...properties,
      });
    });
  }

  /**
   * Track transaction creation
   */
  trackTransaction(event: TransactionEvent) {
    this.track(AnalyticsEvents.TRANSACTION_CREATED, {
      ...event,
      amountRange: this.getAmountRange(event.amount),
    });
  }

  /**
   * Track budget creation
   */
  trackBudget(event: BudgetEvent) {
    this.track(AnalyticsEvents.BUDGET_CREATED, { ...event });
  }

  /**
   * Track errors for monitoring
   */
  trackError(error: Error, context?: Record<string, unknown>) {
    this.track(AnalyticsEvents.ERROR_OCCURRED, {
      errorName: error.name,
      errorMessage: error.message,
      errorStack: error.stack?.substring(0, 500),
      ...context,
    });
  }

  /**
   * Check if a feature flag is enabled
   */
  isFeatureEnabled(flagName: string): boolean {
    if (!this.initialized || !this.posthog) {
      return false;
    }
    return this.posthog.isFeatureEnabled(flagName) ?? false;
  }

  /**
   * Get feature flag value
   */
  getFeatureFlag(flagName: string): string | boolean | undefined {
    if (!this.initialized || !this.posthog) {
      return undefined;
    }
    return this.posthog.getFeatureFlag(flagName);
  }

  /**
   * Set user properties
   */
  setUserProperties(properties: Record<string, unknown>) {
    this.queueOrExecute(() => {
      this.posthog?.people.set(properties);
    });
  }

  /**
   * Increment a numeric user property
   */
  incrementProperty(property: string, value = 1) {
    this.queueOrExecute(() => {
      this.posthog?.people.set_once({ [property]: 0 });
      this.posthog?.people.increment(property, value);
    });
  }

  /**
   * Opt user out of tracking
   */
  optOut() {
    this.posthog?.opt_out_capturing();
  }

  /**
   * Opt user in to tracking
   */
  optIn() {
    this.posthog?.opt_in_capturing();
  }

  /**
   * Check if user has opted out
   */
  hasOptedOut(): boolean {
    return this.posthog?.has_opted_out_capturing() ?? false;
  }

  /**
   * Helper to categorize amounts for analytics
   */
  private getAmountRange(amount: number): string {
    if (amount < 10) return 'under_10';
    if (amount < 50) return '10_to_50';
    if (amount < 100) return '50_to_100';
    if (amount < 500) return '100_to_500';
    if (amount < 1000) return '500_to_1000';
    return 'over_1000';
  }

  /**
   * Create a mock PostHog instance for development without the real package
   */
  private createMockPostHog(): PostHogInstance {
    const noop = () => {};
    return {
      init: (_apiKey: string, _options: Record<string, unknown>) => {
        console.log('[Analytics Mock] init called');
      },
      identify: (userId: string, traits?: Record<string, unknown>) => {
        console.log('[Analytics Mock] identify:', userId, traits);
      },
      reset: () => {
        console.log('[Analytics Mock] reset');
      },
      capture: (event: string, properties?: Record<string, unknown>) => {
        console.log('[Analytics Mock] capture:', event, properties);
      },
      isFeatureEnabled: (_flagName: string) => {
        return false;
      },
      getFeatureFlag: (_flagName: string) => {
        return undefined;
      },
      people: {
        set: (properties: Record<string, unknown>) => {
          console.log('[Analytics Mock] people.set:', properties);
        },
        set_once: (properties: Record<string, unknown>) => {
          console.log('[Analytics Mock] people.set_once:', properties);
        },
        increment: (property: string, value: number) => {
          console.log('[Analytics Mock] people.increment:', property, value);
        },
      },
      opt_out_capturing: noop,
      opt_in_capturing: noop,
      has_opted_out_capturing: () => false,
    };
  }
}

// Export singleton instance
export const analytics = new AnalyticsService();

// Initialize analytics (call this in main.tsx)
export const initAnalytics = () => analytics.init();

// React hook for analytics
export function useAnalytics() {
  return analytics;
}

// Component for tracking page views (use with React Router)
export function usePageTracking() {
  // This would be used with useLocation from react-router-dom
  // useEffect(() => {
  //   analytics.pageView(location.pathname);
  // }, [location.pathname]);
}