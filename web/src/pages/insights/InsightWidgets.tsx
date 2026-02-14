import { useState, useCallback } from 'react';
import { ErrorBoundary } from '../../components/ErrorBoundary';
import { calculatePercentChange, formatPercentChange, getPercentChangeColor } from './helpers';
import type {
  CollapsibleSectionProps,
  WidgetErrorFallbackProps,
  WidgetWithErrorBoundaryProps,
  ComparisonBadgeProps,
  MobileReorderProps,
} from './types';

// Drag Handle Component (desktop only)
export function DragHandle({ onMouseDown }: { onMouseDown?: (e: React.MouseEvent) => void }) {
  return (
    <div
      className="cursor-grab active:cursor-grabbing p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors hidden lg:block"
      onMouseDown={onMouseDown}
      title="Drag to reorder"
    >
      <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
        <path d="M7 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 2zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 14zm6-8a2 2 0 1 0-.001-4.001A2 2 0 0 0 13 6zm0 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 14z"/>
      </svg>
    </div>
  );
}

// Mobile Reorder Buttons (touch-friendly up/down arrows)
export function MobileReorderButtons({ onMoveUp, onMoveDown, canMoveUp, canMoveDown }: MobileReorderProps) {
  return (
    <div className="flex items-center gap-1 lg:hidden">
      <button
        onClick={(e) => { e.stopPropagation(); onMoveUp(); }}
        disabled={!canMoveUp}
        className="p-1.5 rounded-md touch-manipulation transition-colors disabled:opacity-30 hover:bg-gray-200 dark:hover:bg-gray-600"
        aria-label="Move up"
      >
        <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
        </svg>
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); onMoveDown(); }}
        disabled={!canMoveDown}
        className="p-1.5 rounded-md touch-manipulation transition-colors disabled:opacity-30 hover:bg-gray-200 dark:hover:bg-gray-600"
        aria-label="Move down"
      >
        <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
    </div>
  );
}

// Collapsible Section Component with drag support
export function CollapsibleSection({
  id,
  title,
  subtitle,
  icon,
  headerRight,
  isCollapsed,
  onToggle,
  children,
  className = '',
  draggable = false,
  onDragStart,
  onDragOver,
  onDragEnd,
  onDrop,
  isDragOver = false,
}: CollapsibleSectionProps) {
  return (
    <div
      className={`bg-white dark:bg-gray-800 rounded-lg border-2 transition-all duration-200 ${
        isDragOver
          ? 'border-blue-500 dark:border-blue-400 shadow-lg'
          : 'border-gray-200 dark:border-gray-700'
      } ${className}`}
      draggable={draggable}
      onDragStart={onDragStart as unknown as (e: React.DragEvent) => void}
      onDragOver={onDragOver as unknown as (e: React.DragEvent) => void}
      onDragEnd={onDragEnd as unknown as (e: React.DragEvent) => void}
      onDrop={onDrop as unknown as (e: React.DragEvent) => void}
    >
      <button
        onClick={() => onToggle(id)}
        className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors rounded-t-lg"
      >
        <div className="flex items-center gap-3">
          {draggable && <DragHandle />}
          {icon && (
            <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
              {icon}
            </div>
          )}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
            {subtitle && <p className="text-sm text-gray-500 dark:text-gray-400">{subtitle}</p>}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {headerRight}
          <svg
            className={`w-5 h-5 text-gray-500 transition-transform duration-200 ${isCollapsed ? '' : 'rotate-180'}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>
      {!isCollapsed && (
        <div className="p-4 pt-0 border-t border-gray-100 dark:border-gray-700">
          {children}
        </div>
      )}
    </div>
  );
}

// Widget Error Fallback Component
export function WidgetErrorFallback({ widgetName, onRetry }: WidgetErrorFallbackProps) {
  return (
    <div className="p-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-center">
      <svg
        className="w-12 h-12 mx-auto mb-3 text-red-400 dark:text-red-500"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
        />
      </svg>
      <h3 className="text-sm font-medium text-red-800 dark:text-red-300 mb-1">
        Failed to load {widgetName}
      </h3>
      <p className="text-sm text-red-600 dark:text-red-400 mb-3">
        Something went wrong while loading this widget.
      </p>
      <button
        onClick={onRetry}
        className="px-4 py-2 bg-red-100 dark:bg-red-800 text-red-700 dark:text-red-200 rounded-lg text-sm font-medium hover:bg-red-200 dark:hover:bg-red-700 transition-colors"
      >
        Try Again
      </button>
    </div>
  );
}

// Widget wrapper with error boundary
export function WidgetWithErrorBoundary({ name, children }: WidgetWithErrorBoundaryProps) {
  const [key, setKey] = useState(0);
  
  const handleRetry = useCallback(() => {
    setKey(k => k + 1);
  }, []);
  
  return (
    <ErrorBoundary
      key={key}
      name={`InsightsWidget-${name}`}
      fallback={<WidgetErrorFallback widgetName={name} onRetry={handleRetry} />}
    >
      {children}
    </ErrorBoundary>
  );
}

// Comparison Badge Component
export function ComparisonBadge({ current, previous, invertColors = false, label = 'vs last period' }: ComparisonBadgeProps) {
  const change = calculatePercentChange(current, previous);
  const colorClass = getPercentChangeColor(change, invertColors);
  
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${colorClass}`}>
      {formatPercentChange(change)} {label}
    </span>
  );
}
