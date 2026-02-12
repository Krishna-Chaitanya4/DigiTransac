import { LabelTree, LabelUsageStat } from '../../types/labels';

interface LabelTreeItemProps {
  label: LabelTree;
  level: number;
  onEdit: (label: LabelTree) => void;
  onDelete: (label: LabelTree) => void;
  onAddChild: (parentId: string, type: 'Folder' | 'Category') => void;
  onToggleExclude: (label: LabelTree) => void;
  expandedIds: Set<string>;
  toggleExpand: (id: string) => void;
  parentExcluded?: boolean;
  usageStats?: Record<string, LabelUsageStat>;
  currency?: string;
}

function formatCompactAmount(amount: number, currency: string): string {
  const abs = Math.abs(amount);
  if (abs >= 1_000_000) return `${(amount / 1_000_000).toFixed(1)}M ${currency}`;
  if (abs >= 1_000) return `${(amount / 1_000).toFixed(1)}K ${currency}`;
  return `${amount.toFixed(0)} ${currency}`;
}

export function LabelTreeItem({ label, level, onEdit, onDelete, onAddChild, onToggleExclude, expandedIds, toggleExpand, parentExcluded = false, usageStats, currency = 'USD' }: LabelTreeItemProps) {
  const isExpanded = expandedIds.has(label.id);
  const hasChildren = label.children && label.children.length > 0;
  const isFolder = label.type === 'Folder';
  const isSystem = label.isSystem;
  const isExcluded = label.excludeFromAnalytics;
  const isInheritedExclude = parentExcluded && !isExcluded;
  const effectivelyExcluded = isExcluded || parentExcluded;

  return (
    <div>
      <div
        className={`flex items-center gap-2 py-2 px-3 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg group ${level > 0 ? 'ml-6' : ''}`}
        style={{ marginLeft: level * 24 }}
      >
        {/* Expand/Collapse button for folders */}
        {isFolder ? (
          <button
            onClick={() => toggleExpand(label.id)}
            className="w-5 h-5 flex items-center justify-center text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <svg
              className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </button>
        ) : (
          <div className="w-5 h-5" />
        )}

        {/* Icon */}
        <span className={`text-lg ${effectivelyExcluded ? 'opacity-50' : ''}`} title={label.type}>
          {label.icon || (isFolder ? '📁' : '🏷️')}
        </span>

        {/* Name */}
        <span className={`flex-1 text-sm ${isFolder ? 'font-medium text-gray-900 dark:text-gray-100' : 'text-gray-700 dark:text-gray-300'} ${effectivelyExcluded ? 'opacity-50' : ''}`}>
          {label.name}
        </span>

        {/* Usage statistics badges */}
        {usageStats && usageStats[label.id] && usageStats[label.id].transactionCount > 0 && (
          <div className={`flex items-center gap-1.5 ${effectivelyExcluded ? 'opacity-50' : ''}`}>
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400" title="Transaction count">
              <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
              </svg>
              {usageStats[label.id].transactionCount}
            </span>
            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400" title="Total amount">
              {formatCompactAmount(usageStats[label.id].totalAmount, currency)}
            </span>
          </div>
        )}

        {/* Exclude from calculations badge */}
        {effectivelyExcluded && (
          <span
            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${
              isInheritedExclude
                ? 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500'
                : 'bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400'
            }`}
            title={isInheritedExclude ? 'Inherited from parent folder' : 'Excluded from calculations'}
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />
            </svg>
            {isInheritedExclude ? 'inherited' : 'excluded'}
          </span>
        )}

        {/* System label lock indicator */}
        {isSystem && (
          <span className="text-gray-400 dark:text-gray-500" title="System label - cannot be deleted or renamed">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
            </svg>
          </span>
        )}

        {/* Color indicator */}
        {label.color && (
          <span
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: label.color }}
          />
        )}

        {/* Actions - visible on mobile, hover on desktop */}
        <div className="flex md:opacity-0 md:group-hover:opacity-100 items-center gap-1 transition-opacity">
          {/* Exclude from calculations toggle */}
          {!parentExcluded && (
            <button
              onClick={() => onToggleExclude(label)}
              className={`p-1 ${
                isExcluded
                  ? 'text-amber-500 dark:text-amber-400 hover:text-amber-600 dark:hover:text-amber-300'
                  : 'text-gray-400 dark:text-gray-500 hover:text-amber-500 dark:hover:text-amber-400'
              }`}
              title={isExcluded ? 'Include in calculations' : 'Exclude from calculations'}
            >
              {isExcluded ? (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                </svg>
              )}
            </button>
          )}

          {isFolder && (
            <>
              <button
                onClick={() => onAddChild(label.id, 'Folder')}
                className="p-1 text-gray-400 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400"
                title="Add sub-folder"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 10.5v6m3-3H9m4.06-7.19-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z" />
                </svg>
              </button>
              <button
                onClick={() => onAddChild(label.id, 'Category')}
                className="p-1 text-gray-400 dark:text-gray-500 hover:text-green-600 dark:hover:text-green-400"
                title="Add category"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
              </button>
            </>
          )}
          {/* Only show edit/delete for non-system labels */}
          {!isSystem && (
            <>
              <button
                onClick={() => onEdit(label)}
                className="p-1 text-gray-400 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400"
                title="Edit"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
                </svg>
              </button>
              <button
                onClick={() => onDelete(label)}
                className="p-1 text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400"
                title="Delete"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                </svg>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Children */}
      {isExpanded && hasChildren && (
        <div>
          {label.children.map(child => (
            <LabelTreeItem
              key={child.id}
              label={child}
              level={level + 1}
              onEdit={onEdit}
              onDelete={onDelete}
              onAddChild={onAddChild}
              onToggleExclude={onToggleExclude}
              expandedIds={expandedIds}
              toggleExpand={toggleExpand}
              parentExcluded={effectivelyExcluded}
              usageStats={usageStats}
              currency={currency}
            />
          ))}
        </div>
      )}
    </div>
  );
}
