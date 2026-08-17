import type { Meta, StoryObj } from '@storybook/vue3-vite';

import TemporalPickerPreview from './TemporalPickerPreview.vue';

const meta = {
  title: 'Web UI 2.0/Next Refinements/Unified Temporal Pickers',
  component: TemporalPickerPreview,
  tags: ['autodocs'],
  args: { initialKind: 'month', layout: 'mobile' },
  argTypes: {
    initialKind: { control: 'radio', options: ['month', 'date', 'time'] },
    layout: { control: 'radio', options: ['mobile', 'desktop'] },
  },
  parameters: {
    docs: {
      description: {
        component: '纯视觉交互稿：统一月份、日期和时间选择器；不替换生产输入，不连接业务 API。',
      },
    },
  },
} satisfies Meta<typeof TemporalPickerPreview>;

export default meta;
type Story = StoryObj<typeof meta>;

export const MobileMonth390: Story = {
  name: '1 · 月份选择 · 390px',
  globals: { viewport: 'mobile390' },
};

export const MobileDate320: Story = {
  name: '2 · 日期选择 · 320px',
  args: { initialKind: 'date' },
  globals: { viewport: 'mobile320' },
};

export const MobileTime390: Story = {
  name: '3 · 时间选择 · 390px',
  args: { initialKind: 'time' },
  globals: { viewport: 'mobile390' },
};

export const Desktop1280: Story = {
  name: '4 · 统一选择器 · 1280px',
  args: { initialKind: 'month', layout: 'desktop' },
  globals: { viewport: 'desktop1280' },
};
