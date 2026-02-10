import { Label } from '../../types/labels';

interface SearchResultItemProps {
  label: Label;
  path: string;
  onEdit: (label: Label) => void;
  onDelete: (label: Label) => void;
}

export function SearchResultItem({ label, path, onEdit, onDelete }: SearchResultItemProps) {
  const isFolder = label.type === 'Folder';
  const isSystem = label.isSystem;
  
  return (
    <div className="flex items-center gap-2 py-2 px-3 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg group">
      <span className="text-lg">
        {label.icon || (isFolder ? '📁' : '🏷️')}
      </span>
      <div className="flex-1 min-w-0">
        <span className={`text-sm ${isFolder ? 'font-medium text-gray-900 dark:text-gray-100' : 'text-gray-700 dark:text-gray-300'}`}>
          {label.name}
        </span>
        <p className="text-xs text-gray-400 dark:text-gray-500 truncate">{path}</p>
      </div>
      {/* System label lock indicator */}
      {isSystem && (
        <span className="text-gray-400 dark:text-gray-500" title="System label - cannot be deleted or renamed">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
          </svg>
        </span>
      )}
      {label.color && (
        <span 
          className="w-3 h-3 rounded-full flex-shrink-0" 
          style={{ backgroundColor: label.color }}
        />
      )}
      {/* Only show edit/delete for non-system labels */}
      {!isSystem && (
        <div className="flex md:opacity-0 md:group-hover:opacity-100 items-center gap-1 transition-opacity">
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
        </div>
      )}
    </div>
  );
}
