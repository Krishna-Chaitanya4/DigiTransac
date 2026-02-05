import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { DatePicker } from './DatePicker';

const meta: Meta<typeof DatePicker> = {
  title: 'Components/DatePicker',
  component: DatePicker,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'A custom date picker component with calendar dropdown, year picker, and date range constraints.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    value: {
      control: 'text',
      description: 'Selected date in YYYY-MM-DD format',
    },
    placeholder: {
      control: 'text',
      description: 'Placeholder text when no date is selected',
    },
    disabled: {
      control: 'boolean',
      description: 'Whether the picker is disabled',
    },
    label: {
      control: 'text',
      description: 'Label text for the input',
    },
    minDate: {
      control: 'date',
      description: 'Minimum selectable date',
    },
    maxDate: {
      control: 'date',
      description: 'Maximum selectable date',
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
function DatePickerWrapper(props: React.ComponentProps<typeof DatePicker>) {
  const [value, setValue] = useState(props.value || '');
  return <DatePicker {...props} value={value} onChange={setValue} />;
}

export const Default: Story = {
  render: (args) => <DatePickerWrapper {...args} />,
  args: {
    placeholder: 'Select date',
  },
};

export const WithLabel: Story = {
  render: (args) => <DatePickerWrapper {...args} />,
  args: {
    label: 'Transaction Date',
    placeholder: 'Select date',
  },
};

export const WithSelectedDate: Story = {
  render: (args) => <DatePickerWrapper {...args} />,
  args: {
    label: 'Start Date',
    value: '2025-01-15',
  },
};

export const Disabled: Story = {
  render: (args) => <DatePickerWrapper {...args} />,
  args: {
    label: 'Disabled Date Picker',
    value: '2025-01-15',
    disabled: true,
  },
};

export const WithMinDate: Story = {
  render: (args) => <DatePickerWrapper {...args} />,
  args: {
    label: 'Future Dates Only',
    placeholder: 'Select a future date',
    minDate: new Date(),
  },
};

export const WithMaxDate: Story = {
  render: (args) => <DatePickerWrapper {...args} />,
  args: {
    label: 'Past Dates Only',
    placeholder: 'Select a past date',
    maxDate: new Date(),
  },
};

export const WithDateRange: Story = {
  render: (args) => <DatePickerWrapper {...args} />,
  args: {
    label: 'Date Range (This Month)',
    placeholder: 'Select a date',
    minDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
    maxDate: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0),
  },
};
