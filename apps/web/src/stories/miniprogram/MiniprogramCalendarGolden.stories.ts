import type { Meta, StoryObj } from '@storybook/vue3-vite';

import CalendarViewsRefinementPreview from '../ui2/CalendarViewsRefinementPreview.vue';

const meta = {
  title: 'MiniProgram Parity/P1 Calendar',
  component: CalendarViewsRefinementPreview,
  tags: ['autodocs'],
  args: { layout: 'mobile', view: 'month' },
  parameters: {
    docs: {
      description: {
        component: '直接复用当前 Web 月历黄金组件，不复制出第二套视觉实现。',
      },
    },
  },
} satisfies Meta<typeof CalendarViewsRefinementPreview>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Month390: Story = {
  name: '1 · 动态月历 · 390×844',
  globals: { viewport: 'mobile390' },
};

export const Month320: Story = {
  name: '2 · 动态月历边界 · 320×844',
  globals: { viewport: 'mobile320' },
};
