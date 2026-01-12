/**
 * Centralized Route Configuration
 * Single source of truth for all application routes
 */

import {
  Dashboard as DashboardIcon,
  SwapHoriz as TransactionsIcon,
  AccountBalanceWallet as AccountsIcon,
  Category as CategoryIcon,
  AccountBalance as BudgetIcon,
  Analytics as AnalyticsIcon,
  Person as PersonIcon,
} from '@mui/icons-material';

export interface RouteConfig {
  path: string;
  name: string;
  label: string;
  icon: any;
  showInSidebar: boolean;
  showInMobileNav: boolean;
  requiresAuth: boolean;
}

/**
 * Application Routes
 * Add new routes here and they'll automatically appear in navigation
 */
export const ROUTES = {
  // Public routes
  LOGIN: {
    path: '/login',
    name: 'login',
    label: 'Login',
    icon: null,
    showInSidebar: false,
    showInMobileNav: false,
    requiresAuth: false,
  },
  REGISTER: {
    path: '/register',
    name: 'register',
    label: 'Register',
    icon: null,
    showInSidebar: false,
    showInMobileNav: false,
    requiresAuth: false,
  },

  // Protected routes
  DASHBOARD: {
    path: '/dashboard',
    name: 'dashboard',
    label: 'Dashboard',
    icon: DashboardIcon,
    showInSidebar: true,
    showInMobileNav: true,
    requiresAuth: true,
  },
  TRANSACTIONS: {
    path: '/transactions',
    name: 'transactions',
    label: 'Transactions',
    icon: TransactionsIcon,
    showInSidebar: true,
    showInMobileNav: true,
    requiresAuth: true,
  },
  ACCOUNTS: {
    path: '/accounts',
    name: 'accounts',
    label: 'Accounts',
    icon: AccountsIcon,
    showInSidebar: true,
    showInMobileNav: false,
    requiresAuth: true,
  },
  CATEGORIES: {
    path: '/categories',
    name: 'categories',
    label: 'Categories',
    icon: CategoryIcon,
    showInSidebar: true,
    showInMobileNav: false,
    requiresAuth: true,
  },
  BUDGETS: {
    path: '/budgets',
    name: 'budgets',
    label: 'Budgets',
    icon: BudgetIcon,
    showInSidebar: true,
    showInMobileNav: true,
    requiresAuth: true,
  },
  ANALYTICS: {
    path: '/analytics',
    name: 'analytics',
    label: 'Analytics',
    icon: AnalyticsIcon,
    showInSidebar: true,
    showInMobileNav: true,
    requiresAuth: true,
  },
  PROFILE: {
    path: '/profile',
    name: 'profile',
    label: 'Profile',
    icon: PersonIcon,
    showInSidebar: false,
    showInMobileNav: true,
    requiresAuth: true,
  },
} as const;

/**
 * Helper functions
 */

// Get all sidebar navigation routes
export const getSidebarRoutes = (): RouteConfig[] => {
  return Object.values(ROUTES).filter((route) => route.showInSidebar);
};

// Get all mobile bottom navigation routes
export const getMobileNavRoutes = (): RouteConfig[] => {
  return Object.values(ROUTES).filter((route) => route.showInMobileNav);
};

// Get all protected routes
export const getProtectedRoutes = (): RouteConfig[] => {
  return Object.values(ROUTES).filter((route) => route.requiresAuth);
};

// Get all public routes
export const getPublicRoutes = (): RouteConfig[] => {
  return Object.values(ROUTES).filter((route) => !route.requiresAuth);
};

// Get route by path
export const getRouteByPath = (path: string): RouteConfig | undefined => {
  return Object.values(ROUTES).find((route) => route.path === path);
};

// Get route by name
export const getRouteByName = (name: string): RouteConfig | undefined => {
  return Object.values(ROUTES).find((route) => route.name === name);
};

/**
 * Route paths as constants for type-safe navigation
 */
export const ROUTE_PATHS = {
  LOGIN: ROUTES.LOGIN.path,
  REGISTER: ROUTES.REGISTER.path,
  DASHBOARD: ROUTES.DASHBOARD.path,
  TRANSACTIONS: ROUTES.TRANSACTIONS.path,
  ACCOUNTS: ROUTES.ACCOUNTS.path,
  CATEGORIES: ROUTES.CATEGORIES.path,
  BUDGETS: ROUTES.BUDGETS.path,
  ANALYTICS: ROUTES.ANALYTICS.path,
  PROFILE: ROUTES.PROFILE.path,
} as const;

export type RoutePath = (typeof ROUTE_PATHS)[keyof typeof ROUTE_PATHS];
