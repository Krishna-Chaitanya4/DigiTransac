import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import PasswordInput from './PasswordInput';

const meta: Meta<typeof PasswordInput> = {
  title: 'Components/PasswordInput',
  component: PasswordInput,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'A password input component with visibility toggle.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    label: {
      control: 'text',
      description: 'Label text for the input',
    },
    hint: {
      control: 'text',
      description: 'Optional hint text below the input',
    },
    placeholder: {
      control: 'text',
      description: 'Placeholder text',
    },
    required: {
      control: 'boolean',
      description: 'Whether the input is required',
    },
    autoComplete: {
      control: 'select',
      options: ['current-password', 'new-password', 'off'],
      description: 'Autocomplete attribute value',
    },
  },
  decorators: [
    (Story) => (
      <div className="w-80">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

// Interactive wrapper for controlled input
function PasswordInputWrapper(props: React.ComponentProps<typeof PasswordInput>) {
  const [value, setValue] = useState(props.value || '');
  return <PasswordInput {...props} value={value} onChange={setValue} />;
}

export const Default: Story = {
  render: (args) => <PasswordInputWrapper {...args} />,
  args: {
    id: 'password',
    name: 'password',
    label: 'Password',
    value: '',
    placeholder: 'Enter your password',
  },
};

export const WithHint: Story = {
  render: (args) => <PasswordInputWrapper {...args} />,
  args: {
    id: 'password-hint',
    name: 'password',
    label: 'Password',
    value: '',
    placeholder: 'Enter your password',
    hint: 'Must be at least 8 characters with uppercase, lowercase, and numbers',
  },
};

export const NewPassword: Story = {
  render: (args) => <PasswordInputWrapper {...args} />,
  args: {
    id: 'new-password',
    name: 'newPassword',
    label: 'New Password',
    value: '',
    placeholder: 'Create a new password',
    autoComplete: 'new-password',
    hint: 'Choose a strong, unique password',
  },
};

export const Required: Story = {
  render: (args) => <PasswordInputWrapper {...args} />,
  args: {
    id: 'required-password',
    name: 'password',
    label: 'Password *',
    value: '',
    placeholder: 'Required field',
    required: true,
  },
};

export const FilledIn: Story = {
  render: (args) => <PasswordInputWrapper {...args} />,
  args: {
    id: 'filled-password',
    name: 'password',
    label: 'Password',
    value: 'MySecretPassword123',
    placeholder: 'Enter your password',
  },
};
