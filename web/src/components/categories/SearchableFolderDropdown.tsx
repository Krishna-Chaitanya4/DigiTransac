import { useState, useEffect, useMemo, useRef } from 'react';
import { Label } from '../../types/labels';
import { getLabelPath } from './utils';

interface SearchableFolderDropdownProps {
  value: string | null;
  onChange: (value: string | null) => void;
  folders: Label[];
  allLabels: Label[];
  placeholder?: string;
  disabled?: boolean;
}

export function SearchableFolderDropdown({ value, onChange, folders, allLabels, disabled }: SearchableFolderDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearch('');
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter folders based on search
  const filteredFolders = useMemo(() => {
    if (!search.trim()) return folders;
    const searchLower = search.toLowerCase();
    return folders.filter(folder => {
      const path = getLabelPath(folder.id, allLabels).toLowerCase();
      return folder.name.toLowerCase().includes(searchLower) || path.includes(searchLower);
    });
  }, [folders, search, allLabels]);

  // Get selected folder info
  const selectedFolder = value ? folders.find(f => f.id === value) : null;
  const selectedPath = selectedFolder ? getLabelPath(selectedFolder.id, allLabels) : null;

  const handleSelect = (folderId: string | null) => {
    onChange(folderId);
    setIsOpen(false);
    setSearch('');
  };

  return (
    <div ref={containerRef} className="relative">
      {/* Selected value display / trigger */}
      <button
        type="button"
        onClick={() => {
          if (disabled) return;
          setIsOpen(!isOpen);
          if (!isOpen) {
            setTimeout(() => inputRef.current?.focus(), 0);
          }
        }}
        disabled={disabled}
        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-left flex items-center gap-2 ${
          disabled 
            ? 'bg-gray-100 dark:bg-gray-700 border-gray-200 dark:border-gray-700 cursor-not-allowed text-gray-500 dark:text-gray-400' 
            : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800'
        }`}
      >
        {selectedFolder ? (
          <>
            <span>{selectedFolder.icon || '📁'}</span>
            <div className="flex-1 min-w-0">
              <span className="text-gray-900 dark:text-gray-100">{selectedFolder.name}</span>
              {selectedPath && selectedPath !== selectedFolder.name && (
                <span className="text-xs text-gray-400 dark:text-gray-500 ml-2 truncate">({selectedPath})</span>
              )}
            </div>
          </>
        ) : (
          <span className="text-gray-500 dark:text-gray-400">None (Root level)</span>
        )}
        <svg className="w-4 h-4 text-gray-400 dark:text-gray-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
        </svg>
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg">
          {/* Search input */}
          <div className="p-2 border-b border-gray-100 dark:border-gray-700">
            <div className="relative">
              <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
              </svg>
              <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search folders..."
                className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              />
            </div>
          </div>

          {/* Options list */}
          <div className="max-h-60 overflow-y-auto">
            {/* Root option */}
            <button
              type="button"
              onClick={() => handleSelect(null)}
              className={`w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-gray-50 dark:hover:bg-gray-700 ${
                value === null ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' : 'text-gray-700 dark:text-gray-300'
              }`}
            >
              <span className="text-gray-400 dark:text-gray-500">—</span>
              <span>None (Root level)</span>
            </button>

            {/* Folder options */}
            {filteredFolders.length > 0 ? (
              filteredFolders.map(folder => {
                const path = getLabelPath(folder.id, allLabels);
                const isSelected = value === folder.id;
                return (
                  <button
                    key={folder.id}
                    type="button"
                    onClick={() => handleSelect(folder.id)}
                    className={`w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-gray-50 dark:hover:bg-gray-700 ${
                      isSelected ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' : 'text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    <span>{folder.icon || '📁'}</span>
                    <div className="flex-1 min-w-0">
                      <span className={isSelected ? 'font-medium' : ''}>{folder.name}</span>
                      {path !== folder.name && (
                        <p className="text-xs text-gray-400 dark:text-gray-500 truncate">{path}</p>
                      )}
                    </div>
                    {isSelected && (
                      <svg className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                      </svg>
                    )}
                  </button>
                );
              })
            ) : (
              <div className="px-3 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
                No folders found matching "{search}"
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
