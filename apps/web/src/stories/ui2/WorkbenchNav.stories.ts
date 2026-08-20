import type { Meta, StoryObj } from '@storybook/vue3-vite';

import WorkbenchNav from '../../features/layout/WorkbenchNav.vue';
import {
  getDesktopNavItems,
  getPrimaryMobileNavItems,
  getSecondaryMobileNavItems,
} from '../../features/layout/workbench-nav.js';

const meta = {
  title: 'Web UI 2.0/Production · 移动导航',
  component: WorkbenchNav,
  args: {
    activeTab: 'calendar',
    desktopItems: getDesktopNavItems('owner'),
    primaryItems: getPrimaryMobileNavItems('owner'),
    secondaryItems: getSecondaryMobileNavItems('owner'),
  },
  globals: { viewport: 'mobile390' },
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: '生产移动底栏与“更多”功能页，不连接业务数据。',
      },
    },
  },
  decorators: [
    () => ({
      template:
        '<div style="min-height: 100vh; background: #f4f7fb"><div style="padding: 24px; color: #6b7785">移动工作台导航预览</div><story /></div>',
    }),
  ],
} satisfies Meta<typeof WorkbenchNav>;

export default meta;
type Story = StoryObj<typeof meta>;

export const OwnerMobile: Story = {
  name: '群主 · 四项常驻',
};

export const SwapActive: Story = {
  name: '换班选中态',
  args: { activeTab: 'swap' },
};
