import { setup, type Preview } from '@storybook/vue3-vite';
import { createPinia } from 'pinia';
import TDesign from 'tdesign-vue-next';
import { createMemoryHistory, createRouter } from 'vue-router';

import 'tdesign-vue-next/es/style/index.css';
import '../src/styles/tokens.css';
import '../src/generated/ui-icon-motion.css';
import './storybook.css';

const storyRouter = createRouter({
  history: createMemoryHistory(),
  routes: [
    { path: '/', component: { template: '<div />' } },
    { path: '/platform-admin/users', component: { template: '<div />' } },
  ],
});

setup((app) => {
  app.use(createPinia());
  app.use(TDesign);
  app.use(storyRouter);
});

const preview: Preview = {
  parameters: {
    a11y: {
      test: 'error',
    },
    backgrounds: {
      default: 'ui-canvas',
      values: [
        { name: 'ui-canvas', value: '#f4f7fb' },
        { name: 'surface', value: '#ffffff' },
      ],
    },
    controls: {
      expanded: true,
    },
    layout: 'fullscreen',
    options: {
      storySort: {
        order: ['Web UI 2.0', ['Overview', 'Mobile Screens']],
      },
    },
    viewport: {
      options: {
        mobile320: {
          name: 'Mobile 320px',
          styles: { height: '844px', width: '320px' },
          type: 'mobile',
        },
        mobile390: {
          name: 'Mobile 390×844',
          styles: { height: '844px', width: '390px' },
          type: 'mobile',
        },
        desktop1280: {
          name: 'Desktop 1280×900',
          styles: { height: '900px', width: '1280px' },
          type: 'desktop',
        },
      },
    },
  },
};

export default preview;
