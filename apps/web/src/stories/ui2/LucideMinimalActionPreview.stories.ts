import type { Meta, StoryObj } from '@storybook/vue3-vite';

import LucideMinimalActionPreview from './LucideMinimalActionPreview.vue';

const meta = {
  title: 'Web UI 2.0/Icon Motion · Lucide Minimal Actions',
  component: LucideMinimalActionPreview,
  parameters: { layout: 'fullscreen' },
  args: { boardOnly: false },
  globals: { viewport: 'desktop1280' },
} satisfies Meta<typeof LucideMinimalActionPreview>;

export default meta;

type Story = StoryObj<typeof meta>;

export const DesktopWorkbench: Story = {
  name: '1 · 桌面工作台场景',
};

export const MobileWorkbench390: Story = {
  name: '2 · 手机工作台场景',
  globals: { viewport: 'mobile390' },
};

export const IconMotionBoard: Story = {
  name: '3 · 全图标连续动效板',
  args: { boardOnly: true },
};
