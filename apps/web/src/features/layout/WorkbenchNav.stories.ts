import type { Meta, StoryObj } from '@storybook/vue3-vite';

import WorkbenchNav from './WorkbenchNav.vue';
import {
  getDesktopNavItems,
  getPrimaryMobileNavItems,
  getSecondaryMobileNavItems,
} from './workbench-nav.js';

const ownerDesktopItems = getDesktopNavItems('owner');
const ownerPrimaryItems = getPrimaryMobileNavItems('owner');
const ownerSecondaryItems = getSecondaryMobileNavItems('owner');

const meta = {
  title: 'Web UI 2.0/Production · Workbench Navigation',
  component: WorkbenchNav,
  tags: ['autodocs'],
  args: {
    activeTab: 'calendar',
    desktopItems: ownerDesktopItems,
    forceIconMotion: true,
    primaryItems: ownerPrimaryItems,
    secondaryItems: ownerSecondaryItems,
  },
  globals: { viewport: 'desktop1280' },
} satisfies Meta<typeof WorkbenchNav>;

export default meta;

type Story = StoryObj<typeof meta>;

export const DesktopOwner: Story = {
  name: '1 · 桌面完整导航',
};

export const MobilePrimary390: Story = {
  name: '2 · 手机常驻导航',
  globals: { viewport: 'mobile390' },
};

export const MobileSecondary390: Story = {
  name: '3 · 手机次级页面与更多',
  args: { activeTab: 'leave' },
  globals: { viewport: 'mobile390' },
};
