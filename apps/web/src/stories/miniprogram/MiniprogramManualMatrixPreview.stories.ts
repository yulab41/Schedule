import type { Meta, StoryObj } from '@storybook/vue3-vite';

import MiniprogramManualMatrixPreview from './MiniprogramManualMatrixPreview.vue';

const meta = {
  title: 'MiniProgram Parity/P1 Manual Matrix',
  component: MiniprogramManualMatrixPreview,
  tags: ['autodocs'],
  args: { mode: 'daily' },
  argTypes: { mode: { control: 'radio', options: ['daily', 'maximum'] } },
  parameters: {
    docs: {
      description: {
        component: '复用生产 Web ManualGrid 的 P1 黄金样张；原生实现只复刻结果，不复用 DOM 表格。',
      },
    },
  },
} satisfies Meta<typeof MiniprogramManualMatrixPreview>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Daily390: Story = {
  name: '1 · 日常 7×7 · 390×844',
  globals: { viewport: 'mobile390' },
};

export const Daily320: Story = {
  name: '2 · 日常 7×7 边界 · 320×844',
  globals: { viewport: 'mobile320' },
};

export const Maximum390: Story = {
  name: '3 · 上限 20×30 · 390×844',
  args: { mode: 'maximum' },
  globals: { viewport: 'mobile390' },
};

export const Maximum320: Story = {
  name: '4 · 上限 20×30 边界 · 320×844',
  args: { mode: 'maximum' },
  globals: { viewport: 'mobile320' },
};
