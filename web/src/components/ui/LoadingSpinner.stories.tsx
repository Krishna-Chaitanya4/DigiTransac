import type { Meta, StoryObj } from '@storybook/react';
import { LoadingSpinner, PageLoader, InlineLoader, CardLoader } from './LoadingSpinner';

const meta: Meta<typeof LoadingSpinner> = {
  title: 'UI/LoadingSpinner',
  component: LoadingSpinner,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'A versatile loading spinner component with multiple sizes, variants, and display modes.',
      },
    },
  },
  argTypes: {
    size: {
      control: 'select',
      options: ['xs', 'sm', 'md', 'lg', 'xl'],
      description: 'Size of the spinner',
    },
    variant: {
      control: 'select',
      options: ['primary', 'secondary', 'white', 'current'],
      description: 'Color variant of the spinner',
    },
    fullScreen: {
      control: 'boolean',
      description: 'Whether to display in full screen mode',
    },
    overlay: {
      control: 'boolean',
      description: 'Whether to display with a backdrop overlay',
    },
    label: {
      control: 'text',
      description: 'Optional label text below the spinner',
    },
    className: {
      control: 'text',
      description: 'Additional CSS classes',
    },
  },
};

export default meta;
type Story = StoryObj<typeof LoadingSpinner>;

// Basic variants
export const Default: Story = {
  args: {
    size: 'md',
    variant: 'primary',
  },
};

export const Small: Story = {
  args: {
    size: 'sm',
    variant: 'primary',
  },
};

export const Large: Story = {
  args: {
    size: 'lg',
    variant: 'primary',
  },
};

export const ExtraLarge: Story = {
  args: {
    size: 'xl',
    variant: 'primary',
  },
};

// Color variants
export const Primary: Story = {
  args: {
    size: 'lg',
    variant: 'primary',
  },
};

export const Secondary: Story = {
  args: {
    size: 'lg',
    variant: 'secondary',
  },
};

export const White: Story = {
  args: {
    size: 'lg',
    variant: 'white',
  },
  parameters: {
    backgrounds: { default: 'dark' },
  },
};

export const Current: Story = {
  args: {
    size: 'lg',
    variant: 'current',
  },
  decorators: [
    (Story) => (
      <div className="text-purple-500">
        <Story />
      </div>
    ),
  ],
};

// With label
export const WithLabel: Story = {
  args: {
    size: 'lg',
    variant: 'primary',
    label: 'Loading data...',
  },
};

// Overlay mode
export const WithOverlay: Story = {
  args: {
    size: 'lg',
    variant: 'primary',
    overlay: true,
    label: 'Processing...',
  },
  decorators: [
    (Story) => (
      <div className="relative w-64 h-64 border border-gray-200 rounded-lg">
        <p className="p-4">Content behind the overlay</p>
        <Story />
      </div>
    ),
  ],
};

// Compound components
export const PageLoaderExample: Story = {
  render: () => <PageLoader label="Loading page..." />,
  parameters: {
    layout: 'fullscreen',
  },
};

export const InlineLoaderExample: Story = {
  render: () => (
    <div className="flex items-center gap-2">
      <span>Loading</span>
      <InlineLoader />
    </div>
  ),
};

export const CardLoaderExample: Story = {
  render: () => (
    <div className="w-64 h-48 border border-gray-200 rounded-lg">
      <CardLoader />
    </div>
  ),
};

// All sizes comparison
export const AllSizes: Story = {
  render: () => (
    <div className="flex items-center gap-4">
      <div className="text-center">
        <LoadingSpinner size="xs" />
        <p className="text-xs mt-2">xs</p>
      </div>
      <div className="text-center">
        <LoadingSpinner size="sm" />
        <p className="text-xs mt-2">sm</p>
      </div>
      <div className="text-center">
        <LoadingSpinner size="md" />
        <p className="text-xs mt-2">md</p>
      </div>
      <div className="text-center">
        <LoadingSpinner size="lg" />
        <p className="text-xs mt-2">lg</p>
      </div>
      <div className="text-center">
        <LoadingSpinner size="xl" />
        <p className="text-xs mt-2">xl</p>
      </div>
    </div>
  ),
};

// All variants comparison
export const AllVariants: Story = {
  render: () => (
    <div className="flex items-center gap-4">
      <div className="text-center">
        <LoadingSpinner size="lg" variant="primary" />
        <p className="text-xs mt-2">primary</p>
      </div>
      <div className="text-center">
        <LoadingSpinner size="lg" variant="secondary" />
        <p className="text-xs mt-2">secondary</p>
      </div>
      <div className="text-center p-2 bg-gray-800 rounded">
        <LoadingSpinner size="lg" variant="white" />
        <p className="text-xs mt-2 text-white">white</p>
      </div>
      <div className="text-center text-green-500">
        <LoadingSpinner size="lg" variant="current" />
        <p className="text-xs mt-2">current</p>
      </div>
    </div>
  ),
};