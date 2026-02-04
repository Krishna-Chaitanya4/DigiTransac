import { DragEvent, ReactNode } from 'react';
import { DragHandle } from './DragHandle';
import type { SectionId } from './types';

export interface CollapsibleSectionProps {
  id: SectionId;
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  headerRight?: ReactNode;
  isCollapsed: boolean;
  onToggle: (id: SectionId) => void;
  children: ReactNode;
  className?: string;
  // Drag props
  draggable?: boolean;
  onDragStart?: (e: DragEvent) => void;
  onDragOver?: (e: DragEvent) => void;
  onDragEnd?: (e: DragEvent) => void;
  onDrop?: (e: DragEvent) => void;
  isDragOver?: boolean;
}

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
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDrop={onDrop}
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