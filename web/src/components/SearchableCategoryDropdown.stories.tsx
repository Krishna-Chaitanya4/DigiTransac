import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { SearchableCategoryDropdown } from './SearchableCategoryDropdown';
import type { Label } from '../types/labels';

const sampleCategories: Label[] = [
  { id: '1', name: 'Groceries', icon: '🛒', color: '#22c55e' },
  { id: '2', name: 'Transportation', icon: '🚗', color: '#3b82f6' },
  { id: '3', name: 'Entertainment', icon: '🎬', color: '#a855f7' },
  { id: '4', name: 'Utilities', icon: '💡', color: '#f59e0b' },
  { id: '5', name: 'Healthcare', icon: '🏥', color: '#ef4444' },
  { id: '6', name: 'Dining Out', icon: '🍽️', color: '#ec4899' },
  { id: '7', name: 'Shopping', icon: '🛍️', color: '#06b6d4' },
  { id: '8', name: 'Subscriptions', icon: '📱', color: '#8b5cf6' },
];

const meta: Meta<typeof SearchableCategoryDropdown> = {
  title: 'Components/SearchableCategoryDropdown',
  component: SearchableCategoryDropdown,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'A searchable dropdown for selecting categories with icons and colors.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    placeholder: {
      control: 'text',
      description: 'Placeholder text',
    },
    disabled: {
      control: 'boolean',
      description: 'Whether the dropdown is disabled',
    },
    excludeIds: {
      control: 'object',
      description: 'Category IDs to exclude from the list',
    },
  },
  decorators: [
    (Story) => (
      <div className="w-80 h-96">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

// Interactive wrapper for controlled input
function DropdownWrapper(props: Partial<React.ComponentProps<typeof SearchableCategoryDropdown>>) {
  const [value, setValue] = useState(props.value || '');
  return (
    <SearchableCategoryDropdown
      categories={sampleCategories}
      {...props}
      value={value}
      onChange={setValue}
    />
  );
}

export const Default: Story = {
  render: (args) => <DropdownWrapper {...args} />,
  args: {
    placeholder: 'Select category...',
  },
};

export const WithSelectedValue: Story = {
  render: (args) => <DropdownWrapper {...args} />,
  args: {
    value: '1',
    placeholder: 'Select category...',
  },
};

export const Disabled: Story = {
  render: (args) => <DropdownWrapper {...args} />,
  args: {
    value: '2',
    disabled: true,
  },
};

export const WithExcludedItems: Story = {
  render: (args) => <DropdownWrapper {...args} />,
  args: {
    placeholder: 'Categories (some excluded)',
    excludeIds: ['1', '3', '5'],
  },
};

export const CustomPlaceholder: Story = {
  render: (args) => <DropdownWrapper {...args} />,
  args: {
    placeholder: 'Choose a spending category',
  },
};
