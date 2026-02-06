import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { SwipeableRow, SwipeActionIcon } from './SwipeableRow';

const meta: Meta<typeof SwipeableRow> = {
  title: 'Components/SwipeableRow',
  component: SwipeableRow,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: 'A swipeable row component with configurable left and right swipe actions. Supports touch gestures on mobile devices.',
      },
    },
  },
  argTypes: {
    onSwipeRight: {
      description: 'Callback when swiping right past threshold',
      action: 'swiped right',
    },
    onSwipeLeft: {
      description: 'Callback when swiping left past threshold',
      action: 'swiped left',
    },
    rightContent: {
      description: 'Content shown when swiping right (behind the row)',
    },
    leftContent: {
      description: 'Content shown when swiping left (behind the row)',
    },
    rightBgColor: {
      control: 'text',
      description: 'Tailwind background color class for right swipe',
    },
    leftBgColor: {
      control: 'text',
      description: 'Tailwind background color class for left swipe',
    },
    threshold: {
      control: { type: 'range', min: 20, max: 150, step: 10 },
      description: 'Swipe threshold in pixels to trigger callback',
    },
    disabled: {
      control: 'boolean',
      description: 'Whether swipe actions are disabled',
    },
  },
};

export default meta;
type Story = StoryObj<typeof SwipeableRow>;

// Basic example with right swipe
export const SwipeRight: Story = {
  args: {
    onSwipeRight: () => console.log('Swiped right!'),
    rightContent: <SwipeActionIcon icon="✓" label="Confirm" />,
    rightBgColor: 'bg-green-500',
    children: (
      <div className="p-4 bg-white dark:bg-gray-800 border rounded-lg">
        <p className="font-medium">Swipe me right</p>
        <p className="text-sm text-gray-500">To confirm this action</p>
      </div>
    ),
  },
};

// Basic example with left swipe
export const SwipeLeft: Story = {
  args: {
    onSwipeLeft: () => console.log('Swiped left!'),
    leftContent: <SwipeActionIcon icon="🗑️" label="Delete" />,
    leftBgColor: 'bg-red-500',
    children: (
      <div className="p-4 bg-white dark:bg-gray-800 border rounded-lg">
        <p className="font-medium">Swipe me left</p>
        <p className="text-sm text-gray-500">To delete this item</p>
      </div>
    ),
  },
};

// Both directions
export const BothDirections: Story = {
  args: {
    onSwipeRight: () => console.log('Confirmed!'),
    onSwipeLeft: () => console.log('Deleted!'),
    rightContent: <SwipeActionIcon icon="✓" label="Confirm" />,
    leftContent: <SwipeActionIcon icon="🗑️" label="Delete" />,
    rightBgColor: 'bg-green-500',
    leftBgColor: 'bg-red-500',
    children: (
      <div className="p-4 bg-white dark:bg-gray-800 border rounded-lg">
        <p className="font-medium">Swipe in either direction</p>
        <p className="text-sm text-gray-500">Right to confirm, left to delete</p>
      </div>
    ),
  },
};

// Transaction row example
export const TransactionRow: Story = {
  args: {
    onSwipeRight: () => console.log('Confirmed!'),
    onSwipeLeft: () => console.log('Deleted!'),
    rightContent: <SwipeActionIcon icon="✓" label="Confirm" />,
    leftContent: <SwipeActionIcon icon="🗑️" label="Delete" />,
    children: (
      <div className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 border rounded-lg">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-xl">
            🛒
          </div>
          <div>
            <p className="font-medium">Grocery Store</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">Today, 2:30 PM</p>
          </div>
        </div>
        <span className="font-semibold text-red-600 dark:text-red-400">-$45.99</span>
      </div>
    ),
  },
};

// Pending transaction
export const PendingTransaction: Story = {
  args: {
    onSwipeRight: () => console.log('Confirmed!'),
    onSwipeLeft: () => console.log('Declined!'),
    rightContent: <SwipeActionIcon icon="✓" label="Accept" />,
    leftContent: <SwipeActionIcon icon="✗" label="Decline" />,
    rightBgColor: 'bg-green-500',
    leftBgColor: 'bg-gray-500',
    children: (
      <div className="flex items-center justify-between p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-yellow-100 dark:bg-yellow-900/50 flex items-center justify-center text-xl">
            ⏳
          </div>
          <div>
            <p className="font-medium">Payment Request</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">From John Doe</p>
          </div>
        </div>
        <span className="font-semibold text-yellow-600 dark:text-yellow-400">$25.00</span>
      </div>
    ),
  },
};

// Disabled state
export const Disabled: Story = {
  args: {
    onSwipeLeft: () => console.log('Should not fire'),
    leftContent: <SwipeActionIcon icon="🗑️" label="Delete" />,
    disabled: true,
    children: (
      <div className="p-4 bg-gray-100 dark:bg-gray-700 border rounded-lg opacity-60">
        <p className="font-medium">Disabled row</p>
        <p className="text-sm text-gray-500">Swiping is disabled</p>
      </div>
    ),
  },
};

// List of swipeable transactions
export const TransactionList: Story = {
  render: () => {
    const items = [
      { id: 1, name: 'Coffee Shop', amount: -5.50, icon: '☕', confirmed: true },
      { id: 2, name: 'Salary', amount: 3000, icon: '💰', confirmed: true },
      { id: 3, name: 'Restaurant', amount: -32.00, icon: '🍽️', confirmed: false },
      { id: 4, name: 'Gas Station', amount: -45.00, icon: '⛽', confirmed: true },
    ];

    return (
      <div className="space-y-2">
        <p className="text-sm text-gray-500 mb-4">
          Swipe left to delete, swipe right to confirm
        </p>
        {items.map((item) => (
          <SwipeableRow
            key={item.id}
            onSwipeRight={() => alert(`Confirmed: ${item.name}`)}
            onSwipeLeft={() => alert(`Deleted: ${item.name}`)}
            rightContent={<SwipeActionIcon icon="✓" label="Confirm" />}
            leftContent={<SwipeActionIcon icon="🗑️" label="Delete" />}
          >
            <div className={`flex items-center justify-between p-4 bg-white dark:bg-gray-800 border rounded-lg ${
              !item.confirmed ? 'border-yellow-300 dark:border-yellow-700' : ''
            }`}>
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xl ${
                  item.amount > 0 ? 'bg-green-100 dark:bg-green-900/30' : 'bg-red-100 dark:bg-red-900/30'
                }`}>
                  {item.icon}
                </div>
                <div>
                  <span className="font-medium">{item.name}</span>
                  {!item.confirmed && (
                    <span className="ml-2 text-xs bg-yellow-100 dark:bg-yellow-900/50 text-yellow-700 dark:text-yellow-300 px-2 py-0.5 rounded">
                      Pending
                    </span>
                  )}
                </div>
              </div>
              <span className={`font-semibold ${
                item.amount > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
              }`}>
                {item.amount > 0 ? '+' : ''}${Math.abs(item.amount).toFixed(2)}
              </span>
            </div>
          </SwipeableRow>
        ))}
      </div>
    );
  },
};

// Interactive deletion demo component
function InteractiveDemoComponent() {
  const [items, setItems] = useState([
    { id: 1, name: 'Item 1', confirmed: false },
    { id: 2, name: 'Item 2', confirmed: false },
    { id: 3, name: 'Item 3', confirmed: false },
  ]);

  const handleConfirm = (id: number) => {
    setItems(items.map(item =>
      item.id === id ? { ...item, confirmed: true } : item
    ));
  };

  const handleDelete = (id: number) => {
    setItems(items.filter(item => item.id !== id));
  };

  return (
    <div className="space-y-2">
      <p className="text-sm text-gray-500 mb-4">
        Swipe right to confirm, left to delete
      </p>
      {items.map((item) => (
        <SwipeableRow
          key={item.id}
          onSwipeRight={() => handleConfirm(item.id)}
          onSwipeLeft={() => handleDelete(item.id)}
          rightContent={<SwipeActionIcon icon="✓" label="Confirm" />}
          leftContent={<SwipeActionIcon icon="🗑️" label="Delete" />}
        >
          <div className={`p-4 border rounded-lg transition-colors ${
            item.confirmed
              ? 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700'
              : 'bg-white dark:bg-gray-800'
          }`}>
            <div className="flex items-center justify-between">
              <span className="font-medium">{item.name}</span>
              {item.confirmed && (
                <span className="text-green-600 dark:text-green-400 text-sm">✓ Confirmed</span>
              )}
            </div>
          </div>
        </SwipeableRow>
      ))}
      {items.length === 0 && (
        <p className="text-center text-gray-400 py-8">All items deleted!</p>
      )}
    </div>
  );
}

export const InteractiveDemo: Story = {
  render: () => <InteractiveDemoComponent />,
};

// Custom threshold
export const CustomThreshold: Story = {
  args: {
    threshold: 40,
    onSwipeLeft: () => console.log('Quick delete!'),
    leftContent: <SwipeActionIcon icon="⚡" label="Quick" />,
    leftBgColor: 'bg-purple-500',
    children: (
      <div className="p-4 bg-white dark:bg-gray-800 border rounded-lg">
        <p className="font-medium">Low threshold (40px)</p>
        <p className="text-sm text-gray-500">Easier to trigger</p>
      </div>
    ),
  },
};