import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { EmojiPickerInput } from './EmojiPickerInput';

const meta: Meta<typeof EmojiPickerInput> = {
  title: 'Components/EmojiPickerInput',
  component: EmojiPickerInput,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'An emoji picker input with lazy-loaded dropdown for selecting emojis.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    value: {
      control: 'text',
      description: 'Currently selected emoji',
    },
    placeholder: {
      control: 'text',
      description: 'Placeholder text when no emoji is selected',
    },
    label: {
      control: 'text',
      description: 'Label text for the input',
    },
  },
  decorators: [
    (Story) => (
      <div className="w-80 h-[500px]">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

// Interactive wrapper for controlled input
function EmojiPickerWrapper(props: React.ComponentProps<typeof EmojiPickerInput>) {
  const [value, setValue] = useState(props.value || '');
  return <EmojiPickerInput {...props} value={value} onChange={setValue} />;
}

export const Default: Story = {
  render: (args) => <EmojiPickerWrapper {...args} />,
  args: {
    placeholder: 'Select an emoji',
  },
};

export const WithLabel: Story = {
  render: (args) => <EmojiPickerWrapper {...args} />,
  args: {
    id: 'category-icon',
    label: 'Category Icon',
    placeholder: 'Choose an icon',
  },
};

export const WithSelectedEmoji: Story = {
  render: (args) => <EmojiPickerWrapper {...args} />,
  args: {
    id: 'selected-emoji',
    label: 'Transaction Icon',
    value: '💰',
  },
};

export const FoodCategory: Story = {
  render: (args) => <EmojiPickerWrapper {...args} />,
  args: {
    id: 'food-icon',
    label: 'Food & Drinks',
    value: '🍔',
  },
};

export const TransportCategory: Story = {
  render: (args) => <EmojiPickerWrapper {...args} />,
  args: {
    id: 'transport-icon',
    label: 'Transportation',
    value: '🚗',
  },
};
