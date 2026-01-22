import type { StorybookConfig } from '@storybook/react-vite';

const config: StorybookConfig = {
  stories: [
    '../src/**/*.mdx',
    '../src/**/*.stories.@(js|jsx|mjs|ts|tsx)',
  ],
  // Storybook 10 has essentials (backgrounds, controls, etc.) built-in
  addons: [],
  framework: {
    name: '@storybook/react-vite',
    options: {},
  },
  docs: {},
  viteFinal: async (config) => {
    // Customize the Vite config for Storybook
    return {
      ...config,
      define: {
        ...config.define,
        'process.env': {},
      },
    };
  },
};

export default config;
