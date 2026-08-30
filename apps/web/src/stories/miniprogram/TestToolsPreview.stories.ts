import type { Meta, StoryObj } from '@storybook/vue3-vite';

import TestToolsPreview from './TestToolsPreview.vue';

const meta = {
  title: 'Miniprogram Audit/Test Tools',
  component: TestToolsPreview,
  tags: ['autodocs'],
  args: { largeText: false },
  globals: { viewport: 'mobile390' },
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof TestToolsPreview>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Ready390: Story = { name: '1 · 测试工具 · 390' };
export const Ready320: Story = {
  name: '2 · 测试工具 · 320',
  globals: { viewport: 'mobile320' },
};
export const LargeText390: Story = {
  name: '3 · 测试工具 · 大字号',
  args: { largeText: true },
};
