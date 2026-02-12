import { useState, useEffect } from 'react';
import { Label, LabelTree, CreateLabelRequest, UpdateLabelRequest } from '../../types/labels';
import { EmojiPickerInput } from '../EmojiPickerInput';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { SearchableFolderDropdown } from './SearchableFolderDropdown';
import { getDescendantIds } from './utils';

// Preset colors (matching AccountModal style)
const PRESET_COLORS = [
  '#3b82f6', // blue
  '#ef4444', // red
  '#10b981', // green
  '#f59e0b', // amber
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#f97316', // orange
];

interface LabelModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CreateLabelRequest | UpdateLabelRequest) => void;
  editingLabel: LabelTree | null;
  parentId: string | null;
  labelType: 'Folder' | 'Category';
  isLoading: boolean;
  allLabels: Label[];
  error: string | null;
}

export function LabelModal({ isOpen, onClose, onSubmit, editingLabel, parentId, labelType, isLoading, allLabels, error }: LabelModalProps) {
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('');
  const [color, setColor] = useState('');
  const [selectedParentId, setSelectedParentId] = useState<string | null>(null);
  const [excludeFromAnalytics, setExcludeFromAnalytics] = useState(false);
  const modalRef = useFocusTrap<HTMLDivElement>(isOpen);

  // Check if editing a system label
  const isSystemLabel = editingLabel?.isSystem ?? false;

  // Check if parent is excluded (inherited exclusion)
  const parentLabel = selectedParentId ? allLabels.find(l => l.id === selectedParentId) : null;
  const isParentExcluded = parentLabel?.excludeFromAnalytics ?? false;

  useEffect(() => {
    if (editingLabel) {
      setName(editingLabel.name);
      setIcon(editingLabel.icon || '');
      setColor(editingLabel.color || '');
      setSelectedParentId(editingLabel.parentId);
      setExcludeFromAnalytics(editingLabel.excludeFromAnalytics);
    } else {
      setName('');
      setIcon('');
      setColor('');
      setSelectedParentId(parentId);
      setExcludeFromAnalytics(false);
    }
  }, [editingLabel, parentId, isOpen]);

  // Get available parents (only folders, and exclude self and descendants when editing)
  const getAvailableParents = (): Label[] => {
    const folders = allLabels.filter(l => l.type === 'Folder');
    
    if (!editingLabel) {
      return folders;
    }
    
    // When editing, exclude self and descendants
    const excludeIds = getDescendantIds(editingLabel.id, allLabels);
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
        excludeFromAnalytics,
      });
    } else {
      onSubmit({
        name: name.trim(),
        type: labelType,
        parentId: selectedParentId,
        icon: icon || null,
        color: color || null,
        excludeFromAnalytics,
      });
    }
  };

  if (!isOpen) return null;

  const title = editingLabel 
    ? `Edit ${editingLabel.type}` 
    : `New ${labelType}`;

  return (
    <div 
      className="fixed inset-0 z-50 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="label-modal-title"
    >
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="fixed inset-0 bg-black/30" onClick={onClose} aria-hidden="true" />
        <div 
          ref={modalRef}
          className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6"
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault();
              onClose();
            }
          }}
        >
          <h3 id="label-modal-title" className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">{title}</h3>
          
          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 rounded-lg text-sm" role="alert">
              {error}
            </div>
          )}
          
          <form onSubmit={handleSubmit}>
            <div className="space-y-4">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Name
                </label>
                <input
                  type="text"
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                    isSystemLabel 
                      ? 'bg-gray-100 dark:bg-gray-700 border-gray-200 dark:border-gray-700 cursor-not-allowed text-gray-500 dark:text-gray-400' 
                      : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100'
                  }`}
                  placeholder={`Enter ${labelType.toLowerCase()} name`}
                  required
                  autoFocus={!isSystemLabel}
                  disabled={isSystemLabel}
                />
                {isSystemLabel && (
                  <p className="mt-1 text-xs text-amber-600">
                    🔒 System labels cannot be renamed
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="parent" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Parent Folder
                </label>
                <SearchableFolderDropdown
                  value={selectedParentId}
                  onChange={setSelectedParentId}
                  folders={availableParents}
                  allLabels={allLabels}
                  disabled={isSystemLabel}
                />
                {isSystemLabel ? (
                  <p className="mt-1 text-xs text-amber-600">
                    🔒 System labels cannot be moved
                  </p>
                ) : (
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    {labelType === 'Category' 
                      ? 'Categories can be placed in folders or at root level'
                      : 'Folders can be nested inside other folders'}
                  </p>
                )}
              </div>

              <div>
                <EmojiPickerInput
                  id="icon"
                  label="Icon (emoji)"
                  value={icon}
                  onChange={setIcon}
                  placeholder="Select an emoji"
                />
              </div>

              {/* Color - with preset colors like AccountModal */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Color
                </label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {PRESET_COLORS.map((presetColor) => (
                    <button
                      key={presetColor}
                      type="button"
                      onClick={() => setColor(presetColor)}
                      className={`w-8 h-8 rounded-full border-2 transition-transform ${
                        color === presetColor ? 'border-gray-900 dark:border-gray-100 scale-110' : 'border-transparent'
                      }`}
                      style={{ backgroundColor: presetColor }}
                    />
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    id="color"
                    value={color || '#6b7280'}
                    onChange={(e) => setColor(e.target.value)}
                    className="w-10 h-10 p-1 border border-gray-300 dark:border-gray-600 rounded cursor-pointer"
                  />
                  {color && (
                    <button
                      type="button"
                      onClick={() => setColor('')}
                      className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                    >
                      Use default
                    </button>
                  )}
                </div>
              </div>

              {/* Exclude from Analytics toggle */}
              <div>
                <div className="flex items-center justify-between">
                  <div>
                    <label htmlFor="excludeFromAnalytics" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Exclude from calculations
                    </label>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {isParentExcluded
                        ? 'Inherited from parent folder — always excluded'
                        : labelType === 'Folder'
                          ? 'Excludes this folder and all children from calculations'
                          : 'Excludes this category from calculations'}
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={isParentExcluded || excludeFromAnalytics}
                    disabled={isParentExcluded}
                    onClick={() => setExcludeFromAnalytics(!excludeFromAnalytics)}
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 ${
                      isParentExcluded
                        ? 'bg-amber-300 dark:bg-amber-700 cursor-not-allowed opacity-60'
                        : excludeFromAnalytics
                          ? 'bg-amber-500 dark:bg-amber-600 cursor-pointer'
                          : 'bg-gray-200 dark:bg-gray-600 cursor-pointer'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        (isParentExcluded || excludeFromAnalytics) ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
                {isParentExcluded && (
                  <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                    ⚠️ Parent folder is excluded — this label inherits the exclusion
                  </p>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                disabled={isLoading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-br from-blue-600 to-blue-700 dark:from-blue-900 dark:to-blue-950 rounded-lg hover:from-blue-700 hover:to-blue-800 dark:hover:from-blue-800 dark:hover:to-blue-900 disabled:opacity-50"
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
