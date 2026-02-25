import { useState, useEffect, useMemo, useRef } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useIsMobile } from '../hooks/useMediaQuery';
import { useSwipeNavigation } from '../hooks/useSwipeNavigation';
import { useKeyboardAwareScroll } from '../hooks/useKeyboardAwareScroll';
import useNotifications from '../hooks/useNotifications';
import { usePresence } from '../context/PresenceContext';
import { BottomTabBar } from './mobile';
import { KeyboardShortcutsModal, useKeyboardShortcutsModal } from './KeyboardShortcutsModal';
import { OnboardingTour } from './OnboardingTour';

const navigation = [
  {
    name: 'Chats',
    href: '/chats',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 0 1-.825-.242m9.345-8.334a2.126 2.126 0 0 0-.476-.095 48.64 48.64 0 0 0-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0 0 11.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155" />
      </svg>
    )
  },
  {
    name: 'Accounts',
    href: '/accounts',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Z" />
      </svg>
    )
  },
  {
    name: 'Insights',
    href: '/insights',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 0 0 6 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0 1 18 16.5h-2.25m-7.5 0h7.5m-7.5 0-1 3m8.5-3 1 3m0 0 .5 1.5m-.5-1.5h-9.5m0 0-.5 1.5m.75-9 3-3 2.148 2.148A12.061 12.061 0 0 1 16.5 7.605" />
      </svg>
    )
  },
  {
    name: 'Budgets',
    href: '/budgets',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6a7.5 7.5 0 1 0 7.5 7.5h-7.5V6Z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 10.5H21A7.5 7.5 0 0 0 13.5 3v7.5Z" />
      </svg>
    )
  },
  {
    name: 'Map',
    href: '/map',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
      </svg>
    )
  },
  {
    name: 'Transactions',
    href: '/transactions',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
      </svg>
    )
  },
  {
    name: 'Labels',
    href: '/labels',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 0 0 3 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 0 0 5.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 0 0 9.568 3Z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6Z" />
      </svg>
    )
  },
  {
    name: 'Settings',
    href: '/settings',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
      </svg>
    )
  },
];

/** Map route paths to page titles for the mobile header */
const pageTitles: Record<string, string> = {
  '/insights': 'Insights',
  '/accounts': 'Accounts',
  '/transactions': 'Transactions',
  '/budgets': 'Budgets',
  '/chats': 'Chats',
  '/map': 'Map',
  '/labels': 'Labels',
  '/settings': 'Settings',
};

export default function Layout() {
  const { user, logout } = useAuth();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const location = useLocation();
  const isMobile = useIsMobile();
  const mainRef = useRef<HTMLElement>(null);

  const { setUserOnline, setUserOffline, registerQueryFn, setConnected } = usePresence();

  // Global SignalR connection for real-time notifications (chat messages, P2P transactions)
  // Must be at Layout level so it persists across page navigation
  const { getOnlineUsers, isConnected: signalRConnected } = useNotifications({
    presence: {
      onUserOnline: setUserOnline,
      onUserOffline: setUserOffline,
    },
  });

  // Register the SignalR query function so other components can query online status
  useEffect(() => {
    registerQueryFn(getOnlineUsers);
  }, [registerQueryFn, getOnlineUsers]);

  // Sync SignalR connection state into PresenceContext
  useEffect(() => {
    setConnected(signalRConnected);
  }, [signalRConnected, setConnected]);

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebarCollapsed');
    return saved ? JSON.parse(saved) : false;
  });

  // Persist sidebar state
  useEffect(() => {
    localStorage.setItem('sidebarCollapsed', JSON.stringify(sidebarCollapsed));
  }, [sidebarCollapsed]);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  // Derive current page title for mobile header
  const pageTitle = useMemo(() => {
    return pageTitles[location.pathname] || 'DigiTransac';
  }, [location.pathname]);

  // Mobile header is always visible (no auto-hide on scroll)
  const mobileHeaderHidden = false;

  // Swipe between tab pages on mobile
  useSwipeNavigation(mainRef, { enabled: isMobile });

  // Ensure focused inputs stay visible when mobile keyboard opens
  useKeyboardAwareScroll();

  // Keyboard shortcuts help modal (? or Ctrl+/)
  const { isOpen: shortcutsOpen, close: closeShortcuts } = useKeyboardShortcutsModal();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Mobile header — auto-hides on scroll down, reappears on scroll up */}
      {isMobile && (
        <header
          className={`
            fixed top-0 left-0 right-0 z-30
            bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm
            border-b border-gray-200 dark:border-gray-700
            transition-transform duration-300 ease-in-out safe-area-top
            ${mobileHeaderHidden ? '-translate-y-full' : 'translate-y-0'}
          `}
        >
          <div className="flex items-center justify-between h-12 px-4">
            <div className="flex items-center gap-2">
              <img
                src={isDark ? "/favicon-dark.svg" : "/favicon.svg"}
                alt="DigiTransac"
                className="w-6 h-6 flex-shrink-0"
              />
              <h1 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                {pageTitle}
              </h1>
            </div>
            <div className="w-7 h-7 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
              <span className="text-xs font-medium text-indigo-600 dark:text-indigo-400">
                {user?.fullName?.charAt(0).toUpperCase()}
              </span>
            </div>
          </div>
        </header>
      )}

      {/* Mobile sidebar backdrop — only for desktop-style sidebar on mobile (hidden when using bottom tab bar) */}
      {!isMobile && mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-gray-900/50 z-40 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar — desktop only (hidden on mobile, replaced by bottom tab bar) */}
      <aside className={`
        fixed top-0 left-0 z-50 h-full bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 
        transform transition-all duration-300 ease-in-out
        ${sidebarCollapsed ? 'lg:w-16' : 'lg:w-64'}
        -translate-x-full lg:translate-x-0
      `}>
        {/* Logo */}
        <div className={`flex items-center h-16 border-b border-gray-200 dark:border-gray-700 ${sidebarCollapsed ? 'lg:justify-center lg:px-0 px-4' : 'px-4'}`}>
          <Link to="/insights" className="flex items-center gap-3">
            <img 
              src={isDark ? "/favicon-dark.svg" : "/favicon.svg"} 
              alt="DigiTransac" 
              className="w-8 h-8 flex-shrink-0" 
            />
            <span className={`text-xl font-bold text-gray-900 dark:text-gray-100 transition-opacity duration-300 ${sidebarCollapsed ? 'lg:hidden' : ''}`}>
              DigiTransac
            </span>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1" role="navigation" aria-label="Main navigation" data-tour="sidebar">
          {navigation.map((item) => {
            const isActive = location.pathname === item.href;
            return (
              <Link
                key={item.name}
                to={item.href}
                title={sidebarCollapsed ? item.name : undefined}
                aria-current={isActive ? 'page' : undefined}
                data-tour={item.name.toLowerCase()}
                className={`
                  flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
                  ${sidebarCollapsed ? 'lg:justify-center' : ''}
                  ${isActive 
                    ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400' 
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-100'
                  }
                `}
              >
                <span className={`flex-shrink-0 ${isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-400'}`}>
                  {item.icon}
                </span>
                <span className={`transition-opacity duration-300 ${sidebarCollapsed ? 'lg:hidden' : ''}`}>
                  {item.name}
                </span>
              </Link>
            );
          })}
        </nav>

        {/* Sidebar toggle button (desktop only) */}
        <div className="hidden lg:block border-t border-gray-200 dark:border-gray-700 p-3">
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className={`
              flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium 
              text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors
              ${sidebarCollapsed ? 'justify-center' : ''}
            `}
            title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-expanded={!sidebarCollapsed}
          >
            <svg 
              className={`w-5 h-5 text-gray-400 transition-transform duration-300 ${sidebarCollapsed ? 'rotate-180' : ''}`} 
              fill="none" 
              viewBox="0 0 24 24" 
              strokeWidth={1.5} 
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M18.75 19.5l-7.5-7.5 7.5-7.5m-6 15L5.25 12l7.5-7.5" />
            </svg>
            <span className={`transition-opacity duration-300 ${sidebarCollapsed ? 'hidden' : ''}`}>
              Collapse
            </span>
          </button>
        </div>
      </aside>

      {/* Main content area */}
      <div className={`transition-all duration-300 ${sidebarCollapsed ? 'lg:pl-16' : 'lg:pl-64'}`}>
        {/* Top header — only show on desktop (mobile uses bottom tab bar) */}
        <header className="sticky top-0 z-30 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 hidden lg:block">
          <div className="flex items-center justify-between h-14 px-4 sm:px-6">
            {/* Spacer for desktop */}
            <div className="hidden lg:block" />

            {/* Right side - user menu (desktop only) */}
            <div className="hidden lg:flex items-center gap-4 ml-auto">
              <div className="relative">
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center gap-3 p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  aria-expanded={userMenuOpen}
                  aria-haspopup="true"
                  aria-label="User menu"
                >
                  <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                    <span className="text-sm font-medium text-indigo-600 dark:text-indigo-400">
                      {user?.fullName?.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-200 max-w-[150px] truncate">
                    {user?.fullName}
                  </span>
                  <svg className={`w-4 h-4 text-gray-400 transition-transform ${userMenuOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                  </svg>
                </button>

                {/* User dropdown menu */}
                {userMenuOpen && (
                  <>
                    <div 
                      className="fixed inset-0 z-10" 
                      onClick={() => setUserMenuOpen(false)}
                    />
                    <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-20">
                      <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{user?.fullName}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{user?.email}</p>
                      </div>
                      <Link
                        to="/settings"
                        onClick={() => setUserMenuOpen(false)}
                        className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
                      >
                        <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.24-.438.613-.43.992a6.759 6.759 0 0 1 0 .255c-.008.378.137.75.43.99l1.004.828c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                        </svg>
                        Settings
                      </Link>
                      <button
                        onClick={() => {
                          setUserMenuOpen(false);
                          logout();
                        }}
                        className="flex items-center gap-2 w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
                      >
                        <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9" />
                        </svg>
                        Sign out
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Page content — add top padding on mobile for auto-hide header, bottom padding for tab bar */}
        <main ref={mainRef} className={`p-4 sm:p-6 lg:p-8 pb-24 lg:pb-8 ${isMobile ? 'pt-16' : ''}`}>
          <Outlet />
        </main>
      </div>

      {/* Bottom Tab Bar — mobile only */}
      {isMobile && (
        <div data-tour="bottom-tabs">
          <BottomTabBar />
        </div>
      )}

      {/* Keyboard shortcuts help modal */}
      <KeyboardShortcutsModal isOpen={shortcutsOpen} onClose={closeShortcuts} />

      {/* Onboarding tour for new users */}
      <OnboardingTour />
    </div>
  );
}
