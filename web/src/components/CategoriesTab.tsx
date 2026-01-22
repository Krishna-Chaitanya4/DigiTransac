import { useState, useEffect, useCallback, useMemo } from 'react';
import { Label, LabelTree, CreateLabelRequest, UpdateLabelRequest } from '../types/labels';
import { getLabels, getLabelsTree, createLabel, updateLabel, deleteLabel, getLabelTransactionCount, deleteLabelWithReassignment } from '../services/labelService';
import { 
  SearchResultItem, 
  LabelTreeItem, 
  LabelModal, 
  DeleteConfirmModal,
  getLabelPath 
} from './categories';

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
  const [saveError, setSaveError] = useState<string | null>(null);
  
  // Delete modal
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [labelToDelete, setLabelToDelete] = useState<LabelTree | null>(null);
  const [labelTransactionCount, setLabelTransactionCount] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

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
      const allFolders = flat.filter((l: Label) => l.type === 'Folder').map((l: Label) => l.id);
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

  const handleDelete = async (label: LabelTree) => {
    setLabelToDelete(label);
    setLabelTransactionCount(0);
    setDeleteModalOpen(true);
    
    // Fetch transaction count for categories (folders don't have direct transactions)
    if (label.type === 'Category') {
      try {
        const { transactionCount } = await getLabelTransactionCount(label.id);
        setLabelTransactionCount(transactionCount);
      } catch (err) {
        console.error('Failed to get transaction count:', err);
      }
    }
  };

  const handleModalSubmit = async (data: CreateLabelRequest | UpdateLabelRequest) => {
    try {
      setIsSaving(true);
      setSaveError(null);
      if (editingLabel) {
        await updateLabel(editingLabel.id, data as UpdateLabelRequest);
      } else {
        await createLabel(data as CreateLabelRequest);
      }
      await loadLabels();
      setIsModalOpen(false);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save label');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteConfirm = async (reassignToId?: string) => {
    if (!labelToDelete) return;
    
    try {
      setIsDeleting(true);
      setDeleteError(null);
      // Use reassignment delete if there are transactions
      if (labelTransactionCount > 0) {
        await deleteLabelWithReassignment(labelToDelete.id, reassignToId);
      } else {
        await deleteLabel(labelToDelete.id);
      }
      await loadLabels();
      setDeleteModalOpen(false);
      setLabelToDelete(null);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Failed to delete label');
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
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 rounded-lg text-sm">
          {error}
          <button onClick={() => setError(null)} className="ml-2 text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300">×</button>
        </div>
      )}

      {/* Header with buttons */}
      <div className="flex justify-between items-center mb-4">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Organize your transactions with folders and categories
        </p>
        <div className="flex items-center gap-2">
          <button
            onClick={handleAddRootCategory}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            New Category
          </button>
          <button
            onClick={handleAddRootFolder}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-gradient-to-br from-blue-600 to-blue-700 dark:from-blue-900 dark:to-blue-950 rounded-lg hover:from-blue-700 hover:to-blue-800 dark:hover:from-blue-800 dark:hover:to-blue-900"
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
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
            </svg>
            <input
              type="text"
              placeholder="Search categories..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
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
              className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-lg"
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
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 mb-4">
          {searchResults.length === 0 ? (
            <div className="p-4 text-center text-gray-500 dark:text-gray-400 text-sm">
              No results found for "{searchQuery}"
            </div>
          ) : (
            <div className="py-2">
              <div className="px-3 py-1 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
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
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          {labels.length === 0 ? (
            <div className="p-8 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                <svg className="w-8 h-8 text-purple-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 0 0 3 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 0 0 5.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 0 0 9.568 3Z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6Z" />
                </svg>
              </div>
              <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">No categories yet</h2>
              <p className="text-gray-500 dark:text-gray-400 mb-4">
                Create categories to organize your transactions, or use folders to group related categories.
              </p>
              <div className="flex items-center justify-center gap-3">
                <button
                  onClick={handleAddRootCategory}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                  Create Category
                </button>
                <button
                  onClick={handleAddRootFolder}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-gradient-to-br from-blue-600 to-blue-700 dark:from-blue-900 dark:to-blue-950 rounded-lg hover:from-blue-700 hover:to-blue-800 dark:hover:from-blue-800 dark:hover:to-blue-900"
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
        onClose={() => { setIsModalOpen(false); setSaveError(null); }}
        onSubmit={handleModalSubmit}
        editingLabel={editingLabel}
        parentId={newLabelParentId}
        labelType={newLabelType}
        isLoading={isSaving}
        allLabels={allLabels}
        error={saveError}
      />

      <DeleteConfirmModal
        isOpen={deleteModalOpen}
        onClose={() => { setDeleteModalOpen(false); setDeleteError(null); }}
        onConfirm={handleDeleteConfirm}
        labelName={labelToDelete?.name || ''}
        labelType={labelToDelete?.type || 'Category'}
        transactionCount={labelTransactionCount}
        allLabels={allLabels}
        labelToDeleteId={labelToDelete?.id || ''}
        isLoading={isDeleting}
        error={deleteError}
      />
    </div>
  );
}
