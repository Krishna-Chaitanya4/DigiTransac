import { useState } from 'react';
import CategoriesTab from '../components/CategoriesTab';
import TagsTab from '../components/TagsTab';

type Tab = 'categories' | 'tags';

export default function LabelsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('categories');

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Labels</h1>
      
      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('categories')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'categories'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Categories
          </button>
          <button
            onClick={() => setActiveTab('tags')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'tags'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Tags
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'categories' ? <CategoriesTab /> : <TagsTab />}
    </div>
  );
}
