import type { Meta, StoryObj } from '@storybook/react';
import { Component, type ReactNode } from 'react';
import { ErrorBoundary } from './ErrorBoundary';

// Component that throws an error for demonstration
function ThrowError({ message }: { message: string }): ReactNode {
  throw new Error(message);
}

// Component that simulates normal content
function NormalContent({ text }: { text: string }) {
  return (
    <div className="p-6 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
      <h3 className="text-lg font-medium text-green-800 dark:text-green-200">
        ✅ Component Rendered Successfully
      </h3>
      <p className="mt-2 text-green-600 dark:text-green-400">{text}</p>
    </div>
  );
}

// Controlled error thrower for demos
class ErrorThrower extends Component<{ shouldThrow: boolean; message: string }, object> {
  render() {
    if (this.props.shouldThrow) {
      throw new Error(this.props.message);
    }
    return <NormalContent text="Toggle 'shouldThrow' to see error boundary" />;
  }
}

const meta: Meta<typeof ErrorBoundary> = {
  title: 'Components/ErrorBoundary',
  component: ErrorBoundary,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: 'Error boundary component that catches React errors and displays a fallback UI. Supports inline mode for component-level errors.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    inline: {
      control: 'boolean',
      description: 'Use compact inline display instead of full-page error',
    },
    name: {
      control: 'text',
      description: 'Optional name for error reporting (used in Sentry)',
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const WithNormalContent: Story = {
  render: (args) => (
    <ErrorBoundary {...args}>
      <NormalContent text="This content renders normally. The error boundary is ready to catch any errors." />
    </ErrorBoundary>
  ),
  args: {
    name: 'DemoComponent',
  },
};

export const FullPageError: Story = {
  render: (args) => (
    <ErrorBoundary {...args}>
      <ThrowError message="This is a simulated error for demonstration purposes." />
    </ErrorBoundary>
  ),
  args: {
    name: 'CrashingComponent',
  },
  parameters: {
    docs: {
      description: {
        story: 'Full-page error display shown when an error occurs in child components.',
      },
    },
  },
};

export const InlineError: Story = {
  render: (_args) => (
    <div className="p-8">
      <h2 className="text-xl font-bold mb-4 text-gray-800 dark:text-gray-200">
        Page Content
      </h2>
      <div className="grid grid-cols-3 gap-4">
        <ErrorBoundary inline name="Widget1">
          <NormalContent text="Widget 1 - Working" />
        </ErrorBoundary>
        <ErrorBoundary inline name="Widget2">
          <ThrowError message="Widget 2 crashed!" />
        </ErrorBoundary>
        <ErrorBoundary inline name="Widget3">
          <NormalContent text="Widget 3 - Working" />
        </ErrorBoundary>
      </div>
    </div>
  ),
  args: {},
  parameters: {
    docs: {
      description: {
        story: 'Inline error boundaries allow individual components to fail without affecting the rest of the page.',
      },
    },
  },
};

export const InteractiveError: Story = {
  render: function Render() {
    return (
      <div className="p-8">
        <p className="mb-4 text-gray-600 dark:text-gray-400">
          This story demonstrates how the error boundary catches errors. 
          The component below intentionally throws an error.
        </p>
        <ErrorBoundary name="InteractiveDemo">
          <ErrorThrower shouldThrow={true} message="User-triggered error!" />
        </ErrorBoundary>
      </div>
    );
  },
  parameters: {
    docs: {
      description: {
        story: 'Interactive demonstration of error boundary behavior.',
      },
    },
  },
};
