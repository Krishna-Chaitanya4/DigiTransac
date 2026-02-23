/**
 * Shared application constants
 */

/**
 * SignalR and real-time notification settings
 */
export const NOTIFICATION_CONSTANTS = {
  /** Ping interval in milliseconds to keep SignalR connection alive */
  PING_INTERVAL_MS: 30000,
  /** Maximum number of reconnection attempts */
  MAX_RECONNECT_ATTEMPTS: 5,
  /** Maximum delay between reconnection attempts in milliseconds */
  MAX_RECONNECT_DELAY_MS: 30000,
} as const;

/**
 * Chat and messaging settings
 */
export const CHAT_CONSTANTS = {
  /** Maximum message content length */
  MAX_MESSAGE_LENGTH: 1000,
  /** Message preview truncation length in conversation list */
  PREVIEW_TRUNCATE_LENGTH: 50,
  /** Reply preview truncation length */
  REPLY_PREVIEW_TRUNCATE_LENGTH: 30,
  /** Default number of messages to load */
  DEFAULT_MESSAGE_LIMIT: 50,
  /** Time window in minutes for editing messages */
  EDIT_WINDOW_MINUTES: 15,
  /** Time window in minutes for deleting messages */
  DELETE_WINDOW_MINUTES: 60,
  /** Display name for self-chat/personal transactions */
  SELF_CHAT_DISPLAY_NAME: 'Personal',
} as const;

/**
 * Sidebar resize settings
 */
export const SIDEBAR_CONSTANTS = {
  /** Default sidebar width in pixels */
  DEFAULT_WIDTH: 320,
  /** Minimum sidebar width in pixels */
  MIN_WIDTH: 280,
  /** Maximum sidebar width in pixels */
  MAX_WIDTH: 500,
} as const;

/**
 * Transaction display settings
 */
export const TRANSACTION_CONSTANTS = {
  /** Default page size for transaction lists */
  DEFAULT_PAGE_SIZE: 50,
} as const;

/**
 * Map display settings
 */
export const MAP_CONSTANTS = {
  /** Default zoom level */
  DEFAULT_ZOOM: 10,
  /** Maximum zoom level */
  MAX_ZOOM: 18,
  /** Minimum zoom level */
  MIN_ZOOM: 3,
  /** Default center (India) when no transactions */
  DEFAULT_CENTER: { lat: 20.5937, lng: 78.9629 } as const,
  /** Trip detection distance in km */
  TRIP_DETECTION_DISTANCE_KM: 50,
  /** Nearby spending radius in km */
  NEARBY_RADIUS_KM: 1.0,
  /** Tile URLs for different themes */
  TILES: {
    light: {
      url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    },
    dark: {
      url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    },
  },
} as const;

/**
 * Budget settings
 */
export const BUDGET_CONSTANTS = {
  /** Warning threshold percentage (show warning when budget is X% used) */
  WARNING_THRESHOLD_PERCENT: 80,
  /** Critical threshold percentage (show critical when budget is X% used) */
  CRITICAL_THRESHOLD_PERCENT: 100,
  /** Default number of top budgets to show on insights page */
  TOP_BUDGETS_COUNT: 3,
} as const;

/**
 * Insights/Analytics settings
 */
export const INSIGHTS_CONSTANTS = {
  /** Number of top categories to display */
  TOP_CATEGORIES_COUNT: 6,
  /** Number of months to show in trend chart */
  TREND_MONTHS: 6,
  /** Number of top counterparties to show */
  TOP_COUNTERPARTIES_COUNT: 10,
} as const;

// NOTE: Currency symbols and formatting functions are in web/src/services/currencyService.ts