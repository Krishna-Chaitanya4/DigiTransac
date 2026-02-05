import { useState, useEffect } from 'react';
import { Label } from '../../types/labels';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { getDescendantIds } from './utils';

interface DeleteConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reassignToId?: string) => void;
  labelName: string;
  labelType: 'Folder' | 'Category';
  transactionCount: number;
  allLabels: Label[];
  labelToDeleteId: string;
  isLoading: boolean;
  error: string | null;
}

export function DeleteConfirmModal({ 
  isOpen, 
  onClose, 
  onConfirm, 
  labelName, 
  labelType,
  transactionCount,
  allLabels,
  labelToDeleteId,
  isLoading,
  error
}: DeleteConfirmModalProps) {
  const [reassignToId, setReassignToId] = useState<string>('');
  const hasTransactions = transactionCount > 0;
  const modalRef = useFocusTrap<HTMLDivElement>(isOpen);
  
  // Reset reassignment selection when modal opens
  useEffect(() => {
    if (isOpen) {
      setReassignToId('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Get available labels for reassignment (exclude the one being deleted and its descendants)
  const excludeIds = getDescendantIds(labelToDeleteId, allLabels);
  const reassignableLabels = allLabels.filter(l => 
    l.type === 'Category' && !excludeIds.has(l.id)
  );

  return (
    <div 
      className="fixed inset-0 z-50 overflow-y-auto"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="delete-confirm-title"
      aria-describedby="delete-confirm-description"
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
          <h3 id="delete-confirm-title" className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
            Delete {labelType}
          </h3>
          
          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 rounded-lg text-sm" role="alert">
              {error}
            </div>
          )}
          
          {hasTransactions ? (
            <div className="space-y-4">
              <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <svg className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                </svg>
                <p className="text-sm text-amber-800">
                  This category is used in <strong>{transactionCount}</strong> transaction split{transactionCount === 1 ? '' : 's'}.
                  Please select a category to reassign them to.
                </p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Reassign transactions to: <span className="text-red-500 dark:text-red-400">*</span>
                </label>
                <select
                  value={reassignToId}
                  onChange={(e) => setReassignToId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                >
                  <option value="">-- Select a category --</option>
                  {reassignableLabels.map(l => (
                    <option key={l.id} value={l.id}>
                      {l.icon && `${l.icon} `}{l.name}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Transactions will be moved to the selected category before deletion.
                </p>
              </div>
            </div>
          ) : (
            <p id="delete-confirm-description" className="text-gray-600 dark:text-gray-400 mb-6">
              Are you sure you want to delete "{labelName}"? This action cannot be undone.
            </p>
          )}
          
          <div className="flex justify-end gap-3 mt-6">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
              disabled={isLoading}
            >
              Cancel
            </button>
            <button
              onClick={() => onConfirm(reassignToId || undefined)}
              className="px-4 py-2 text-sm font-medium text-white bg-red-600 dark:bg-red-700 rounded-lg hover:bg-red-700 dark:hover:bg-red-600 disabled:opacity-50"
              disabled={isLoading || (hasTransactions && !reassignToId)}
            >
              {isLoading ? 'Deleting...' : hasTransactions ? 'Delete & Reassign' : 'Delete'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
