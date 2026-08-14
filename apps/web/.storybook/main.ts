import type { StorybookConfig } from '@storybook/vue3-vite';
import type { PluginOption } from 'vite';

function isComponentAutoImportPlugin(plugin: PluginOption): boolean {
  return Boolean(
    plugin &&
    typeof plugin === 'object' &&
    !Array.isArray(plugin) &&
    'name' in plugin &&
    typeof plugin.name === 'string' &&
    plugin.name.includes('unplugin-vue-components'),
  );
}

const config: StorybookConfig = {
  addons: ['@storybook/addon-docs', '@storybook/addon-a11y'],
  docs: {
    autodocs: 'tag',
  },
  framework: {
    name: '@storybook/vue3-vite',
    options: {},
  },
  stories: ['../src/**/*.stories.@(js|ts)'],
  viteFinal(config) {
    // Storybook stories use explicit imports. Removing this plugin prevents a
    // preview build from rewriting the production app's generated components.d.ts.
    config.plugins = config.plugins?.filter((plugin) => !isComponentAutoImportPlugin(plugin));
    return config;
  },
};

export default config;
