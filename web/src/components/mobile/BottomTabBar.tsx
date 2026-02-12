import { useState, useCallback } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { MoreMenu } from './MoreMenu';
import { useHaptics } from '../../hooks/useHaptics';

interface TabItem {
  name: string;
  href: string;
  icon: React.ReactNode;
  activeIcon?: React.ReactNode;
}

const primaryTabs: TabItem[] = [
  {
    name: 'Insights',
    href: '/insights',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 0 0 6 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0 1 18 16.5h-2.25m-7.5 0h7.5m-7.5 0-1 3m8.5-3 1 3m0 0 .5 1.5m-.5-1.5h-9.5m0 0-.5 1.5m.75-9 3-3 2.148 2.148A12.061 12.061 0 0 1 16.5 7.605" />
      </svg>
    ),
  },
  {
    name: 'Accounts',
    href: '/accounts',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Z" />
      </svg>
    ),
  },
];

const transactionsTab: TabItem = {
  name: 'Transactions',
  href: '/transactions',
  icon: (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
    </svg>
  ),
};

// Pages accessible from the "More" menu
export const moreMenuItems = [
  {
    name: 'Chats',
    href: '/chats',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 0 1-.825-.242m9.345-8.334a2.126 2.126 0 0 0-.476-.095 48.64 48.64 0 0 0-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0 0 11.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155" />
      </svg>
    ),
    description: 'Messages & P2P payments',
  },
  {
    name: 'Budgets',
    href: '/budgets',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6a7.5 7.5 0 1 0 7.5 7.5h-7.5V6Z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 10.5H21A7.5 7.5 0 0 0 13.5 3v7.5Z" />
      </svg>
    ),
    description: 'Track spending limits',
  },
  {
    name: 'Map',
    href: '/map',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
      </svg>
    ),
    description: 'Spending map visualization',
  },
  {
    name: 'Labels',
    href: '/labels',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 0 0 3 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 0 0 5.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 0 0 9.568 3Z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6Z" />
      </svg>
    ),
    description: 'Categories & folders',
  },
  {
    name: 'Settings',
    href: '/settings',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
      </svg>
    ),
    description: 'App preferences',
  },
];

// All "more" menu hrefs for detecting active state on the "More" tab
const moreMenuHrefs = moreMenuItems.map(item => item.href);

interface BottomTabBarProps {
  onAddTransaction: () => void;
}

export function BottomTabBar({ onAddTransaction }: BottomTabBarProps) {
  const location = useLocation();
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const haptics = useHaptics();

  const isActive = useCallback((href: string) => {
    return location.pathname === href || location.pathname.startsWith(href + '/');
  }, [location.pathname]);

  const isMoreActive = moreMenuHrefs.some(href => isActive(href));

  return (
    <>
      <nav
        className="fixed bottom-0 left-0 right-0 z-40 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 lg:hidden"
        role="navigation"
        aria-label="Bottom navigation"
      >
        <div className="flex items-center justify-around h-16 px-1 pb-safe-bottom">
          {/* Insights tab */}
          {primaryTabs.map((tab) => (
            <Link
              key={tab.name}
              to={tab.href}
              onClick={() => haptics.light()}
              className={`flex flex-col items-center justify-center flex-1 h-full min-w-[64px] min-h-[48px] gap-0.5 transition-colors ${
                isActive(tab.href)
                  ? 'text-indigo-600 dark:text-indigo-400'
                  : 'text-gray-500 dark:text-gray-400'
              }`}
              aria-current={isActive(tab.href) ? 'page' : undefined}
            >
              <span className={isActive(tab.href) ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-400 dark:text-gray-500'}>
                {tab.icon}
              </span>
              <span className="text-[10px] font-medium leading-tight">{tab.name}</span>
            </Link>
          ))}

          {/* Center Add button — raised FAB */}
          <button
            onClick={() => { haptics.medium(); onAddTransaction(); }}
            className="flex flex-col items-center justify-center flex-1 h-full min-w-[64px] min-h-[48px] -mt-4"
            aria-label="Add transaction"
          >
            <span className="flex items-center justify-center w-14 h-14 rounded-full bg-gradient-to-br from-indigo-500 to-indigo-600 dark:from-indigo-600 dark:to-indigo-700 text-white shadow-lg shadow-indigo-500/30 active:scale-95 transition-transform">
              <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
            </span>
            <span className="text-[10px] font-medium leading-tight text-gray-500 dark:text-gray-400 mt-0.5">Add</span>
          </button>

          {/* Transactions tab */}
          <Link
            to={transactionsTab.href}
            onClick={() => haptics.light()}
            className={`flex flex-col items-center justify-center flex-1 h-full min-w-[64px] min-h-[48px] gap-0.5 transition-colors ${
              isActive(transactionsTab.href)
                ? 'text-indigo-600 dark:text-indigo-400'
                : 'text-gray-500 dark:text-gray-400'
            }`}
            aria-current={isActive(transactionsTab.href) ? 'page' : undefined}
          >
            <span className={isActive(transactionsTab.href) ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-400 dark:text-gray-500'}>
              {transactionsTab.icon}
            </span>
            <span className="text-[10px] font-medium leading-tight">{transactionsTab.name}</span>
          </Link>

          {/* More tab */}
          <button
            onClick={() => { haptics.light(); setMoreMenuOpen(true); }}
            className={`flex flex-col items-center justify-center flex-1 h-full min-w-[64px] min-h-[48px] gap-0.5 transition-colors ${
              isMoreActive || moreMenuOpen
                ? 'text-indigo-600 dark:text-indigo-400'
                : 'text-gray-500 dark:text-gray-400'
            }`}
            aria-label="More options"
            aria-expanded={moreMenuOpen}
          >
            <span className={isMoreActive || moreMenuOpen ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-400 dark:text-gray-500'}>
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
              </svg>
            </span>
            <span className="text-[10px] font-medium leading-tight">More</span>
          </button>
        </div>
      </nav>

      {/* More Menu bottom sheet */}
      <MoreMenu 
        isOpen={moreMenuOpen} 
        onClose={() => setMoreMenuOpen(false)} 
      />
    </>
  );
}