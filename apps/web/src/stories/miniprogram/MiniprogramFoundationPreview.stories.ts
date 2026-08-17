import type { Meta, StoryObj } from '@storybook/vue3-vite';

import MiniprogramFoundationPreview from './MiniprogramFoundationPreview.vue';

const meta = {
  title: 'MiniProgram Parity/P1 Foundation',
  component: MiniprogramFoundationPreview,
  tags: ['autodocs'],
  args: { layout: 'mobile-390' },
  argTypes: {
    layout: { control: 'radio', options: ['mobile-390', 'mobile-320'] },
  },
  parameters: {
    docs: {
      description: {
        component: '小程序手绘控件的 Web 黄金基线；用户确认前不得实现原生 WXML/WXSS。',
      },
    },
  },
} satisfies Meta<typeof MiniprogramFoundationPreview>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Controls390: Story = {
  name: '1 · 基础控件 · 390×844',
  globals: { viewport: 'mobile390' },
};

export const Controls320: Story = {
  name: '2 · 基础控件边界 · 320×844',
  args: { layout: 'mobile-320' },
  globals: { viewport: 'mobile320' },
};
