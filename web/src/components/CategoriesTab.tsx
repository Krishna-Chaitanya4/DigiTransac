import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Label, LabelTree, CreateLabelRequest, UpdateLabelRequest } from '../types/labels';
import { getLabels, getLabelsTree, createLabel, updateLabel, deleteLabel } from '../services/labelService';

// Helper to get path for a label
function getLabelPath(labelId: string, allLabels: Label[]): string {
  const labelMap = new Map(allLabels.map(l => [l.id, l]));
  const path: string[] = [];
  let current = labelMap.get(labelId);
  
  while (current) {
    path.unshift(current.name);
    current = current.parentId ? labelMap.get(current.parentId) : undefined;
  }
  
  return path.join(' → ');
}

// Searchable folder dropdown component
interface SearchableFolderDropdownProps {
  value: string | null;
  onChange: (value: string | null) => void;
  folders: Label[];
  allLabels: Label[];
  placeholder?: string;
}

function SearchableFolderDropdown({ value, onChange, folders, allLabels }: SearchableFolderDropdownProps) {
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
          setIsOpen(!isOpen);
          if (!isOpen) {
            setTimeout(() => inputRef.current?.focus(), 0);
          }
        }}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-left flex items-center gap-2"
      >
        {selectedFolder ? (
          <>
            <span>{selectedFolder.icon || '📁'}</span>
            <div className="flex-1 min-w-0">
              <span className="text-gray-900">{selectedFolder.name}</span>
              {selectedPath && selectedPath !== selectedFolder.name && (
                <span className="text-xs text-gray-400 ml-2 truncate">({selectedPath})</span>
              )}
            </div>
          </>
        ) : (
          <span className="text-gray-500">None (Root level)</span>
        )}
        <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
        </svg>
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg">
          {/* Search input */}
          <div className="p-2 border-b border-gray-100">
            <div className="relative">
              <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
              </svg>
              <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search folders..."
                className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          {/* Options list */}
          <div className="max-h-60 overflow-y-auto">
            {/* Root option */}
            <button
              type="button"
              onClick={() => handleSelect(null)}
              className={`w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-gray-50 ${
                value === null ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
              }`}
            >
              <span className="text-gray-400">—</span>
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
                    className={`w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-gray-50 ${
                      isSelected ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
                    }`}
                  >
                    <span>{folder.icon || '📁'}</span>
                    <div className="flex-1 min-w-0">
                      <span className={isSelected ? 'font-medium' : ''}>{folder.name}</span>
                      {path !== folder.name && (
                        <p className="text-xs text-gray-400 truncate">{path}</p>
                      )}
                    </div>
                    {isSelected && (
                      <svg className="w-4 h-4 text-blue-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                      </svg>
                    )}
                  </button>
                );
              })
            ) : (
              <div className="px-3 py-4 text-center text-sm text-gray-500">
                No folders found matching "{search}"
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Search result item component
interface SearchResultItemProps {
  label: Label;
  path: string;
  onEdit: (label: Label) => void;
  onDelete: (label: Label) => void;
}

function SearchResultItem({ label, path, onEdit, onDelete }: SearchResultItemProps) {
  const isFolder = label.type === 'Folder';
  
  return (
    <div className="flex items-center gap-2 py-2 px-3 hover:bg-gray-50 rounded-lg group">
      <span className="text-lg">
        {label.icon || (isFolder ? '📁' : '🏷️')}
      </span>
      <div className="flex-1 min-w-0">
        <span className={`text-sm ${isFolder ? 'font-medium text-gray-900' : 'text-gray-700'}`}>
          {label.name}
        </span>
        <p className="text-xs text-gray-400 truncate">{path}</p>
      </div>
      {label.color && (
        <span 
          className="w-3 h-3 rounded-full flex-shrink-0" 
          style={{ backgroundColor: label.color }}
        />
      )}
      <div className="hidden group-hover:flex items-center gap-1">
        <button
          onClick={() => onEdit(label as unknown as Label)}
          className="p-1 text-gray-400 hover:text-blue-600"
          title="Edit"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
          </svg>
        </button>
        <button
          onClick={() => onDelete(label as unknown as Label)}
          className="p-1 text-gray-400 hover:text-red-600"
          title="Delete"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
          </svg>
        </button>
      </div>
    </div>
  );
}

interface LabelTreeItemProps {
  label: LabelTree;
  level: number;
  onEdit: (label: LabelTree) => void;
  onDelete: (label: LabelTree) => void;
  onAddChild: (parentId: string, type: 'Folder' | 'Category') => void;
  expandedIds: Set<string>;
  toggleExpand: (id: string) => void;
}

function LabelTreeItem({ label, level, onEdit, onDelete, onAddChild, expandedIds, toggleExpand }: LabelTreeItemProps) {
  const isExpanded = expandedIds.has(label.id);
  const hasChildren = label.children && label.children.length > 0;
  const isFolder = label.type === 'Folder';

  return (
    <div>
      <div 
        className={`flex items-center gap-2 py-2 px-3 hover:bg-gray-50 rounded-lg group ${level > 0 ? 'ml-6' : ''}`}
        style={{ marginLeft: level * 24 }}
      >
        {/* Expand/Collapse button for folders */}
        {isFolder ? (
          <button
            onClick={() => toggleExpand(label.id)}
            className="w-5 h-5 flex items-center justify-center text-gray-400 hover:text-gray-600"
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
        <span className="text-lg" title={label.type}>
          {label.icon || (isFolder ? '📁' : '🏷️')}
        </span>

        {/* Name */}
        <span className={`flex-1 text-sm ${isFolder ? 'font-medium text-gray-900' : 'text-gray-700'}`}>
          {label.name}
        </span>

        {/* Color indicator */}
        {label.color && (
          <span 
            className="w-3 h-3 rounded-full" 
            style={{ backgroundColor: label.color }}
          />
        )}

        {/* Actions */}
        <div className="hidden group-hover:flex items-center gap-1">
          {isFolder && (
            <>
              <button
                onClick={() => onAddChild(label.id, 'Folder')}
                className="p-1 text-gray-400 hover:text-blue-600"
                title="Add sub-folder"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 10.5v6m3-3H9m4.06-7.19-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z" />
                </svg>
              </button>
              <button
                onClick={() => onAddChild(label.id, 'Category')}
                className="p-1 text-gray-400 hover:text-green-600"
                title="Add category"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
              </button>
            </>
          )}
          <button
            onClick={() => onEdit(label)}
            className="p-1 text-gray-400 hover:text-blue-600"
            title="Edit"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
            </svg>
          </button>
          <button
            onClick={() => onDelete(label)}
            className="p-1 text-gray-400 hover:text-red-600"
            title="Delete"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
            </svg>
          </button>
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
              expandedIds={expandedIds}
              toggleExpand={toggleExpand}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface LabelModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CreateLabelRequest | UpdateLabelRequest) => void;
  editingLabel: LabelTree | null;
  parentId: string | null;
  labelType: 'Folder' | 'Category';
  isLoading: boolean;
  allLabels: Label[];  // For parent dropdown
}

function LabelModal({ isOpen, onClose, onSubmit, editingLabel, parentId, labelType, isLoading, allLabels }: LabelModalProps) {
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('');
  const [color, setColor] = useState('');
  const [selectedParentId, setSelectedParentId] = useState<string | null>(null);

  useEffect(() => {
    if (editingLabel) {
      setName(editingLabel.name);
      setIcon(editingLabel.icon || '');
      setColor(editingLabel.color || '');
      setSelectedParentId(editingLabel.parentId);
    } else {
      setName('');
      setIcon('');
      setColor('');
      setSelectedParentId(parentId);
    }
  }, [editingLabel, parentId, isOpen]);

  // Get available parents (only folders, and exclude self and descendants when editing)
  const getAvailableParents = (): Label[] => {
    const folders = allLabels.filter(l => l.type === 'Folder');
    
    if (!editingLabel) {
      return folders;
    }
    
    // When editing, exclude self and descendants
    const getDescendantIds = (parentId: string): Set<string> => {
      const ids = new Set<string>([parentId]);
      const children = allLabels.filter(l => l.parentId === parentId);
      children.forEach(child => {
        const childDescendants = getDescendantIds(child.id);
        childDescendants.forEach(id => ids.add(id));
      });
      return ids;
    };
    
    const excludeIds = getDescendantIds(editingLabel.id);
    return folders.filter(f => !excludeIds.has(f.id));
  };

  const availableParents = getAvailableParents();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingLabel) {
      onSubmit({
        name: name.trim(),
        icon: icon || null,
        color: color || null,
        parentId: selectedParentId,
      });
    } else {
      onSubmit({
        name: name.trim(),
        type: labelType,
        parentId: selectedParentId,
        icon: icon || null,
        color: color || null,
      });
    }
  };

  if (!isOpen) return null;

  const title = editingLabel 
    ? `Edit ${editingLabel.type}` 
    : `New ${labelType}`;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="fixed inset-0 bg-black/30" onClick={onClose} />
        <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>
          
          <form onSubmit={handleSubmit}>
            <div className="space-y-4">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                  Name
                </label>
                <input
                  type="text"
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder={`Enter ${labelType.toLowerCase()} name`}
                  required
                  autoFocus
                />
              </div>

              <div>
                <label htmlFor="parent" className="block text-sm font-medium text-gray-700 mb-1">
                  Parent Folder
                </label>
                <SearchableFolderDropdown
                  value={selectedParentId}
                  onChange={setSelectedParentId}
                  folders={availableParents}
                  allLabels={allLabels}
                />
                <p className="mt-1 text-xs text-gray-500">
                  {labelType === 'Category' 
                    ? 'Categories can be placed in folders or at root level'
                    : 'Folders can be nested inside other folders'}
                </p>
              </div>

              <div>
                <label htmlFor="icon" className="block text-sm font-medium text-gray-700 mb-1">
                  Icon (emoji)
                </label>
                <input
                  type="text"
                  id="icon"
                  value={icon}
                  onChange={(e) => setIcon(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., 🍕, 🚗, 💰"
                />
              </div>

              <div>
                <label htmlFor="color" className="block text-sm font-medium text-gray-700 mb-1">
                  Color
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    id="color"
                    value={color || '#6b7280'}
                    onChange={(e) => setColor(e.target.value)}
                    className="w-10 h-10 p-1 border border-gray-300 rounded cursor-pointer"
                  />
                  <input
                    type="text"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="#6b7280"
                  />
                  {color && (
                    <button
                      type="button"
                      onClick={() => setColor('')}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                disabled={isLoading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                disabled={isLoading || !name.trim()}
              >
                {isLoading ? 'Saving...' : editingLabel ? 'Update' : 'Create'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

interface DeleteConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  labelName: string;
  isLoading: boolean;
}

function DeleteConfirmModal({ isOpen, onClose, onConfirm, labelName, isLoading }: DeleteConfirmModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="fixed inset-0 bg-black/30" onClick={onClose} />
        <div className="relative bg-white rounded-lg shadow-xl max-w-sm w-full p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete Label</h3>
          <p className="text-gray-600 mb-6">
            Are you sure you want to delete "{labelName}"? This action cannot be undone.
          </p>
          
          <div className="flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              disabled={isLoading}
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50"
              disabled={isLoading}
            >
              {isLoading ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CategoriesTab() {
  const [labels, setLabels] = useState<LabelTree[]>([]);
  const [allLabels, setAllLabels] = useState<Label[]>([]);  // Flat list for parent dropdown
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLabel, setEditingLabel] = useState<LabelTree | null>(null);
  const [newLabelParentId, setNewLabelParentId] = useState<string | null>(null);
  const [newLabelType, setNewLabelType] = useState<'Folder' | 'Category'>('Folder');
  const [isSaving, setIsSaving] = useState(false);
  
  // Delete modal
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [labelToDelete, setLabelToDelete] = useState<LabelTree | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Search results
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const query = searchQuery.toLowerCase();
    return allLabels
      .filter(l => l.name.toLowerCase().includes(query))
      .map(l => ({
        label: l,
        path: getLabelPath(l.id, allLabels)
      }));
  }, [searchQuery, allLabels]);

  // Get all folder IDs for expand/collapse all
  const allFolderIds = useMemo(() => {
    return allLabels.filter(l => l.type === 'Folder').map(l => l.id);
  }, [allLabels]);

  const loadLabels = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const [tree, flat] = await Promise.all([getLabelsTree(), getLabels()]);
      setLabels(tree);
      setAllLabels(flat);
      
      // Auto-expand all folders by default
      const allFolders = flat.filter(l => l.type === 'Folder').map(l => l.id);
      setExpandedIds(new Set(allFolders));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load labels');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLabels();
  }, [loadLabels]);

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const expandAll = () => {
    setExpandedIds(new Set(allFolderIds));
  };

  const collapseAll = () => {
    setExpandedIds(new Set());
  };

  const handleAddRootFolder = () => {
    setEditingLabel(null);
    setNewLabelParentId(null);
    setNewLabelType('Folder');
    setIsModalOpen(true);
  };

  const handleAddRootCategory = () => {
    setEditingLabel(null);
    setNewLabelParentId(null);
    setNewLabelType('Category');
    setIsModalOpen(true);
  };

  const handleAddChild = (parentId: string, type: 'Folder' | 'Category') => {
    setEditingLabel(null);
    setNewLabelParentId(parentId);
    setNewLabelType(type);
    setIsModalOpen(true);
    
    // Auto-expand parent
    setExpandedIds(prev => new Set([...prev, parentId]));
  };

  const handleEdit = (label: LabelTree) => {
    setEditingLabel(label);
    setNewLabelParentId(label.parentId);
    setNewLabelType(label.type);
    setIsModalOpen(true);
  };

  const handleDelete = (label: LabelTree) => {
    setLabelToDelete(label);
    setDeleteModalOpen(true);
  };

  const handleModalSubmit = async (data: CreateLabelRequest | UpdateLabelRequest) => {
    try {
      setIsSaving(true);
      if (editingLabel) {
        await updateLabel(editingLabel.id, data as UpdateLabelRequest);
      } else {
        await createLabel(data as CreateLabelRequest);
      }
      await loadLabels();
      setIsModalOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save label');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!labelToDelete) return;
    
    try {
      setIsDeleting(true);
      await deleteLabel(labelToDelete.id);
      await loadLabels();
      setDeleteModalOpen(false);
      setLabelToDelete(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete label');
    } finally {
      setIsDeleting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div>
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
          {error}
          <button onClick={() => setError(null)} className="ml-2 text-red-500 hover:text-red-700">×</button>
        </div>
      )}

      {/* Header with buttons */}
      <div className="flex justify-between items-center mb-4">
        <p className="text-sm text-gray-500">
          Organize your transactions with folders and categories
        </p>
        <div className="flex items-center gap-2">
          <button
            onClick={handleAddRootCategory}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            New Category
          </button>
          <button
            onClick={handleAddRootFolder}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            New Folder
          </button>
        </div>
      </div>

      {/* Search and Expand/Collapse controls */}
      {labels.length > 0 && (
        <div className="flex items-center gap-3 mb-4">
          {/* Search */}
          <div className="relative flex-1 max-w-sm">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
            </svg>
            <input
              type="text"
              placeholder="Search categories..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          {/* Expand/Collapse toggle button */}
          {!searchQuery && allFolderIds.length > 0 && (
            <button
              onClick={expandedIds.size === allFolderIds.length ? collapseAll : expandAll}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
              title={expandedIds.size === allFolderIds.length ? "Collapse All" : "Expand All"}
            >
              {expandedIds.size === allFolderIds.length ? (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 9V4.5M9 9H4.5M9 9 3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5 5.25 5.25" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
                </svg>
              )}
            </button>
          )}
        </div>
      )}

      {/* Search Results */}
      {searchQuery && (
        <div className="bg-white rounded-lg border border-gray-200 mb-4">
          {searchResults.length === 0 ? (
            <div className="p-4 text-center text-gray-500 text-sm">
              No results found for "{searchQuery}"
            </div>
          ) : (
            <div className="py-2">
              <div className="px-3 py-1 text-xs font-medium text-gray-500 uppercase tracking-wider">
                {searchResults.length} result{searchResults.length !== 1 ? 's' : ''}
              </div>
              {searchResults.map(({ label, path }) => (
                <SearchResultItem
                  key={label.id}
                  label={label}
                  path={path}
                  onEdit={(l) => handleEdit(l as unknown as LabelTree)}
                  onDelete={(l) => handleDelete(l as unknown as LabelTree)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tree View (hidden during search) */}
      {!searchQuery && (
        <div className="bg-white rounded-lg border border-gray-200">
          {labels.length === 0 ? (
            <div className="p-8 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-purple-100 flex items-center justify-center">
                <svg className="w-8 h-8 text-purple-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 0 0 3 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 0 0 5.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 0 0 9.568 3Z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6Z" />
                </svg>
              </div>
              <h2 className="text-lg font-medium text-gray-900 mb-2">No categories yet</h2>
              <p className="text-gray-500 mb-4">
                Create categories to organize your transactions, or use folders to group related categories.
              </p>
              <div className="flex items-center justify-center gap-3">
                <button
                  onClick={handleAddRootCategory}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                  Create Category
                </button>
                <button
                  onClick={handleAddRootFolder}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                Create Folder
              </button>
            </div>
          </div>
        ) : (
          <div className="py-2">
            {labels.map(label => (
              <LabelTreeItem
                key={label.id}
                label={label}
                level={0}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onAddChild={handleAddChild}
                expandedIds={expandedIds}
                toggleExpand={toggleExpand}
              />
            ))}
          </div>
        )}
      </div>
      )}

      <LabelModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleModalSubmit}
        editingLabel={editingLabel}
        parentId={newLabelParentId}
        labelType={newLabelType}
        isLoading={isSaving}
        allLabels={allLabels}
      />

      <DeleteConfirmModal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={handleDeleteConfirm}
        labelName={labelToDelete?.name || ''}
        isLoading={isDeleting}
      />
    </div>
  );
}
