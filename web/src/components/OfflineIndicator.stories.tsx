import type { Meta, StoryObj } from '@storybook/react';
import OfflineIndicator from './OfflineIndicator';

const meta: Meta<typeof OfflineIndicator> = {
  title: 'Components/OfflineIndicator',
  component: OfflineIndicator,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: 'A banner component that displays when the user goes offline. Shows at the top of the screen with a warning message.',
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof OfflineIndicator>;

// Default - Note: This won't show unless actually offline
export const Default: Story = {
  parameters: {
    docs: {
      description: {
        story: 'The offline indicator only appears when `navigator.onLine` is false. In Storybook, it may not render unless you simulate offline mode.',
      },
    },
  },
};

// Mock offline state for demo
export const MockedOffline: Story = {
  render: () => (
    <div>
      {/* Simulated offline banner */}
      <div className="bg-yellow-500 text-white px-4 py-2 text-center flex items-center justify-center gap-2 animate-slide-down">
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636a9 9 0 010 12.728M5.636 18.364a9 9 0 010-12.728m12.728 0L5.636 18.364M5.636 5.636l12.728 12.728" />
        </svg>
        <span className="font-medium">You are offline</span>
        <span className="text-sm opacity-90">Some features may not work properly</span>
      </div>
      
      {/* Sample page content */}
      <div className="p-4">
        <h1 className="text-2xl font-bold mb-4">Page Content</h1>
        <p className="text-gray-600">
          This demonstrates how the offline banner appears at the top of the page.
        </p>
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'A mocked version of the offline indicator for demonstration purposes.',
      },
    },
  },
};

// With page content
export const WithPageContent: Story = {
  render: () => (
    <div>
      {/* Simulated offline banner */}
      <div className="bg-yellow-500 text-white px-4 py-2 text-center flex items-center justify-center gap-2">
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <span className="font-medium">No internet connection</span>
      </div>
      
      {/* Sample transaction list */}
      <div className="p-4 space-y-3">
        <div className="flex items-center justify-between p-4 bg-white border rounded-lg opacity-75">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">🛒</div>
            <div>
              <p className="font-medium">Grocery Store</p>
              <p className="text-sm text-gray-500">Cached data</p>
            </div>
          </div>
          <span className="text-red-600 font-semibold">-$45.99</span>
        </div>
        
        <div className="flex items-center justify-between p-4 bg-white border rounded-lg opacity-75">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">💰</div>
            <div>
              <p className="font-medium">Salary</p>
              <p className="text-sm text-gray-500">Cached data</p>
            </div>
          </div>
          <span className="text-green-600 font-semibold">+$3,000.00</span>
        </div>
        
        <p className="text-center text-sm text-gray-400 mt-4">
          Showing cached data. Changes will sync when online.
        </p>
      </div>
    </div>
  ),
};

// Reconnecting state
export const Reconnecting: Story = {
  render: () => (
    <div>
      <div className="bg-blue-500 text-white px-4 py-2 text-center flex items-center justify-center gap-2">
        <svg className="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
        <span className="font-medium">Reconnecting...</span>
      </div>
      
      <div className="p-4">
        <p className="text-gray-600">Attempting to restore connection.</p>
      </div>
    </div>
  ),
};

// Back online notification
export const BackOnline: Story = {
  render: () => (
    <div>
      <div className="bg-green-500 text-white px-4 py-2 text-center flex items-center justify-center gap-2 animate-pulse">
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
        <span className="font-medium">Back online!</span>
        <span className="text-sm opacity-90">Syncing changes...</span>
      </div>
      
      <div className="p-4">
        <p className="text-gray-600">Connection restored. Your changes are being synchronized.</p>
      </div>
    </div>
  ),
};

// Mobile view
export const MobileView: Story = {
  render: () => (
    <div>
      <div className="bg-yellow-500 text-white px-2 py-1.5 text-center flex items-center justify-center gap-1.5 text-sm">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636a9 9 0 010 12.728M5.636 18.364a9 9 0 010-12.728" />
        </svg>
        <span className="font-medium">Offline</span>
      </div>
      
      <div className="p-4">
        <p className="text-sm text-gray-600">Compact offline indicator for mobile devices.</p>
      </div>
    </div>
  ),
  parameters: {
    viewport: {
      defaultViewport: 'mobile1',
    },
  },
};