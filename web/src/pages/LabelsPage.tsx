import { useState, useCallback } from 'react';
import CategoriesTab from '../components/CategoriesTab';
import TagsTab from '../components/TagsTab';
import { PullToRefreshContainer } from '../components/PullToRefreshContainer';
import { useInvalidateLabels, useInvalidateTags } from '../hooks';

type Tab = 'categories' | 'tags';

export default function LabelsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('categories');
  
  // Invalidation hooks for pull-to-refresh
  const invalidateLabels = useInvalidateLabels();
  const invalidateTags = useInvalidateTags();
  
  // Handle refresh - invalidate labels and tags
  const handleRefresh = useCallback(async () => {
    await Promise.all([
      invalidateLabels(),
      invalidateTags(),
    ]);
  }, [invalidateLabels, invalidateTags]);

  return (
    <PullToRefreshContainer onRefresh={handleRefresh}>
      <h1 className="hidden lg:block text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6">Labels</h1>
      
      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('categories')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'categories'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
            }`}
          >
            Categories
          </button>
          <button
            onClick={() => setActiveTab('tags')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'tags'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
            }`}
          >
            Tags
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'categories' ? <CategoriesTab /> : <TagsTab />}
    </PullToRefreshContainer>
  );
}
