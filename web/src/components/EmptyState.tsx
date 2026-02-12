import type { ReactNode } from 'react';

export type EmptyStateVariant =
  | 'transactions'
  | 'accounts'
  | 'budgets'
  | 'chats'
  | 'map'
  | 'insights'
  | 'categories'
  | 'generic';

interface EmptyStateProps {
  variant?: EmptyStateVariant;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
    icon?: ReactNode;
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  compact?: boolean;
  className?: string;
}

function EmptyStateIllustration({ variant }: { variant: EmptyStateVariant }) {
  const baseClass = "w-full h-full";

  switch (variant) {
    case 'transactions':
      return (
        <svg className={baseClass} viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Wallet */}
          <rect x="25" y="40" width="70" height="45" rx="8" className="fill-blue-100 dark:fill-blue-900/40 stroke-blue-300 dark:stroke-blue-700" strokeWidth="2" />
          <rect x="25" y="40" width="70" height="16" rx="8" className="fill-blue-200 dark:fill-blue-800/60" />
          <circle cx="78" cy="62" r="6" className="fill-blue-400 dark:fill-blue-500" />
          <circle cx="78" cy="62" r="3" className="fill-white dark:fill-gray-900" />
          {/* Coins */}
          <circle cx="42" cy="30" r="10" className="fill-amber-200 dark:fill-amber-800/60 stroke-amber-400 dark:stroke-amber-600" strokeWidth="1.5" />
          <text x="42" y="34" textAnchor="middle" className="fill-amber-600 dark:fill-amber-400" fontSize="10" fontWeight="bold">$</text>
          <circle cx="58" cy="25" r="8" className="fill-emerald-200 dark:fill-emerald-800/60 stroke-emerald-400 dark:stroke-emerald-600" strokeWidth="1.5" />
          <text x="58" y="29" textAnchor="middle" className="fill-emerald-600 dark:fill-emerald-400" fontSize="8" fontWeight="bold">$</text>
          {/* Arrow */}
          <path d="M60 90 L60 105 M52 98 L60 106 L68 98" className="stroke-blue-400 dark:stroke-blue-500" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );

    case 'accounts':
      return (
        <svg className={baseClass} viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Bank building */}
          <path d="M60 20 L95 40 L25 40 Z" className="fill-indigo-200 dark:fill-indigo-800/60 stroke-indigo-400 dark:stroke-indigo-600" strokeWidth="1.5" />
          <rect x="30" y="40" width="60" height="50" className="fill-indigo-100 dark:fill-indigo-900/40 stroke-indigo-300 dark:stroke-indigo-700" strokeWidth="1.5" />
          {/* Pillars */}
          <rect x="38" y="46" width="8" height="38" rx="2" className="fill-indigo-200 dark:fill-indigo-700/60" />
          <rect x="56" y="46" width="8" height="38" rx="2" className="fill-indigo-200 dark:fill-indigo-700/60" />
          <rect x="74" y="46" width="8" height="38" rx="2" className="fill-indigo-200 dark:fill-indigo-700/60" />
          {/* Base */}
          <rect x="25" y="88" width="70" height="6" rx="2" className="fill-indigo-300 dark:fill-indigo-600" />
          {/* Plus badge */}
          <circle cx="90" cy="30" r="12" className="fill-green-100 dark:fill-green-900/40 stroke-green-400 dark:stroke-green-600" strokeWidth="1.5" />
          <path d="M90 24 L90 36 M84 30 L96 30" className="stroke-green-500 dark:stroke-green-400" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );

    case 'budgets':
      return (
        <svg className={baseClass} viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Pie chart */}
          <circle cx="55" cy="55" r="32" className="fill-purple-100 dark:fill-purple-900/40 stroke-purple-300 dark:stroke-purple-700" strokeWidth="2" />
          <path d="M55 23 A32 32 0 0 1 87 55 L55 55 Z" className="fill-purple-400 dark:fill-purple-600" />
          <path d="M87 55 A32 32 0 0 1 55 87 L55 55 Z" className="fill-pink-300 dark:fill-pink-700" />
          <circle cx="55" cy="55" r="14" className="fill-white dark:fill-gray-800" />
          {/* Target icon */}
          <circle cx="90" cy="35" r="14" className="fill-orange-100 dark:fill-orange-900/40 stroke-orange-300 dark:stroke-orange-600" strokeWidth="1.5" />
          <circle cx="90" cy="35" r="8" className="stroke-orange-400 dark:stroke-orange-500" strokeWidth="1.5" fill="none" />
          <circle cx="90" cy="35" r="3" className="fill-orange-500 dark:fill-orange-400" />
          {/* Arrow line */}
          <path d="M35 100 L50 92 L65 96 L80 85 L95 88" className="stroke-purple-400 dark:stroke-purple-500" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </svg>
      );

    case 'chats':
      return (
        <svg className={baseClass} viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Chat bubble 1 */}
          <rect x="20" y="30" width="50" height="32" rx="12" className="fill-sky-200 dark:fill-sky-800/60 stroke-sky-400 dark:stroke-sky-600" strokeWidth="1.5" />
          <path d="M35 62 L30 72 L42 62" className="fill-sky-200 dark:fill-sky-800/60 stroke-sky-400 dark:stroke-sky-600" strokeWidth="1.5" />
          <circle cx="36" cy="46" r="3" className="fill-sky-400 dark:fill-sky-500" />
          <circle cx="45" cy="46" r="3" className="fill-sky-400 dark:fill-sky-500" />
          <circle cx="54" cy="46" r="3" className="fill-sky-400 dark:fill-sky-500" />
          {/* Chat bubble 2 */}
          <rect x="50" y="65" width="50" height="28" rx="10" className="fill-violet-200 dark:fill-violet-800/60 stroke-violet-400 dark:stroke-violet-600" strokeWidth="1.5" />
          <path d="M85 93 L90 102 L78 93" className="fill-violet-200 dark:fill-violet-800/60 stroke-violet-400 dark:stroke-violet-600" strokeWidth="1.5" />
          <rect x="60" y="75" width="20" height="3" rx="1.5" className="fill-violet-400 dark:fill-violet-500" />
          <rect x="60" y="82" width="30" height="3" rx="1.5" className="fill-violet-300 dark:fill-violet-600" />
        </svg>
      );

    case 'map':
      return (
        <svg className={baseClass} viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Map background */}
          <rect x="15" y="25" width="90" height="70" rx="8" className="fill-teal-100 dark:fill-teal-900/40 stroke-teal-300 dark:stroke-teal-700" strokeWidth="1.5" />
          {/* Roads */}
          <path d="M15 55 L105 55" className="stroke-teal-200 dark:stroke-teal-700" strokeWidth="4" />
          <path d="M60 25 L60 95" className="stroke-teal-200 dark:stroke-teal-700" strokeWidth="4" />
          {/* Pin 1 */}
          <path d="M45 40 C45 32 55 32 55 40 C55 48 50 52 50 52 C50 52 45 48 45 40Z" className="fill-red-400 dark:fill-red-500" />
          <circle cx="50" cy="40" r="3" className="fill-white dark:fill-gray-900" />
          {/* Pin 2 */}
          <path d="M70 60 C70 52 80 52 80 60 C80 68 75 72 75 72 C75 72 70 68 70 60Z" className="fill-blue-400 dark:fill-blue-500" />
          <circle cx="75" cy="60" r="3" className="fill-white dark:fill-gray-900" />
        </svg>
      );

    case 'insights':
      return (
        <svg className={baseClass} viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Chart bars */}
          <rect x="20" y="70" width="14" height="30" rx="3" className="fill-blue-200 dark:fill-blue-800/60" />
          <rect x="38" y="50" width="14" height="50" rx="3" className="fill-blue-300 dark:fill-blue-700/60" />
          <rect x="56" y="35" width="14" height="65" rx="3" className="fill-blue-400 dark:fill-blue-600" />
          <rect x="74" y="55" width="14" height="45" rx="3" className="fill-blue-300 dark:fill-blue-700/60" />
          <rect x="92" y="25" width="14" height="75" rx="3" className="fill-blue-500 dark:fill-blue-500" />
          {/* Trend line */}
          <path d="M27 68 L45 48 L63 33 L81 53 L99 23" className="stroke-emerald-500 dark:stroke-emerald-400" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          {/* Sparkle */}
          <circle cx="99" cy="23" r="4" className="fill-emerald-400 dark:fill-emerald-500" />
          {/* Base line */}
          <line x1="15" y1="100" x2="110" y2="100" className="stroke-gray-300 dark:stroke-gray-600" strokeWidth="1.5" />
        </svg>
      );

    case 'categories':
      return (
        <svg className={baseClass} viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Tag labels */}
          <rect x="20" y="30" width="80" height="18" rx="9" className="fill-purple-200 dark:fill-purple-800/60 stroke-purple-300 dark:stroke-purple-600" strokeWidth="1.5" />
          <circle cx="34" cy="39" r="4" className="fill-purple-400 dark:fill-purple-500" />
          <rect x="42" y="36" width="30" height="5" rx="2.5" className="fill-purple-300 dark:fill-purple-600" />
          <rect x="25" y="55" width="70" height="18" rx="9" className="fill-emerald-200 dark:fill-emerald-800/60 stroke-emerald-300 dark:stroke-emerald-600" strokeWidth="1.5" />
          <circle cx="39" cy="64" r="4" className="fill-emerald-400 dark:fill-emerald-500" />
          <rect x="47" y="61" width="25" height="5" rx="2.5" className="fill-emerald-300 dark:fill-emerald-600" />
          <rect x="30" y="80" width="60" height="18" rx="9" className="fill-amber-200 dark:fill-amber-800/60 stroke-amber-300 dark:stroke-amber-600" strokeWidth="1.5" />
          <circle cx="44" cy="89" r="4" className="fill-amber-400 dark:fill-amber-500" />
          <rect x="52" y="86" width="20" height="5" rx="2.5" className="fill-amber-300 dark:fill-amber-600" />
        </svg>
      );

    default:
      return (
        <svg className={baseClass} viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Empty box */}
          <path d="M60 20 L95 38 L95 82 L60 100 L25 82 L25 38 Z" className="fill-gray-100 dark:fill-gray-800 stroke-gray-300 dark:stroke-gray-600" strokeWidth="2" />
          <path d="M60 20 L60 100" className="stroke-gray-200 dark:stroke-gray-700" strokeWidth="1.5" />
          <path d="M25 38 L95 38" className="stroke-gray-200 dark:stroke-gray-700" strokeWidth="1.5" />
          <path d="M60 56 L60 20 M60 56 L95 38 M60 56 L25 38" className="stroke-gray-300 dark:stroke-gray-600" strokeWidth="1.5" />
          {/* Search icon */}
          <circle cx="87" cy="28" r="10" className="fill-blue-100 dark:fill-blue-900/30 stroke-blue-400 dark:stroke-blue-600" strokeWidth="1.5" />
          <path d="M83 28 L91 28 M87 24 L87 32" className="stroke-blue-500 dark:stroke-blue-400" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
  }
}

export default function EmptyState({
  variant = 'generic',
  title,
  description,
  action,
  secondaryAction,
  compact = false,
  className = '',
}: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center ${compact ? 'py-6' : 'py-12'} ${className}`}>
      <div className={`${compact ? 'w-20 h-20' : 'w-28 h-28'} mb-4`}>
        <EmptyStateIllustration variant={variant} />
      </div>
      <h3 className={`${compact ? 'text-base' : 'text-lg'} font-medium text-gray-900 dark:text-gray-100 mb-1 text-center`}>
        {title}
      </h3>
      {description && (
        <p className={`${compact ? 'text-xs' : 'text-sm'} text-gray-500 dark:text-gray-400 text-center max-w-sm mb-4`}>
          {description}
        </p>
      )}
      {(action || secondaryAction) && (
        <div className="flex items-center gap-3 mt-2">
          {action && (
            <button
              onClick={action.onClick}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-gradient-to-br from-blue-600 to-blue-700 dark:from-blue-900 dark:to-blue-950 rounded-lg hover:from-blue-700 hover:to-blue-800 dark:hover:from-blue-800 dark:hover:to-blue-900 transition-colors"
            >
              {action.icon}
              {action.label}
            </button>
          )}
          {secondaryAction && (
            <button
              onClick={secondaryAction.onClick}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              {secondaryAction.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
}