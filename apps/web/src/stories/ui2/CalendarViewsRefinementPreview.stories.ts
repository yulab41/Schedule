import type { Meta, StoryObj } from '@storybook/vue3-vite';

import CalendarViewsRefinementPreview from './CalendarViewsRefinementPreview.vue';

const meta = {
  title: 'Web UI 2.0/Calendar Views Refinement',
  component: CalendarViewsRefinementPreview,
  tags: ['autodocs'],
  args: {
    layout: 'mobile',
    view: 'week',
  },
  argTypes: {
    layout: { control: 'radio', options: ['mobile', 'desktop'] },
    view: { control: 'radio', options: ['month', 'week', 'list'] },
  },
} satisfies Meta<typeof CalendarViewsRefinementPreview>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Mobile390: Story = {
  name: '1 · 手机周视图 / 横向七列',
  globals: { viewport: 'mobile390' },
};

export const MobileMonthLocator: Story = {
  name: '2 · 手机月视图 / 定位今天',
  args: { view: 'month' },
  globals: { viewport: 'mobile390' },
};

export const MobileListSticky: Story = {
  name: '3 · 手机列表 / 固定月份与今天',
  args: { view: 'list' },
  globals: { viewport: 'mobile390' },
};

export const Desktop1280: Story = {
  name: '4 · 桌面周视图 / 七列完整展开',
  args: { layout: 'desktop', view: 'week' },
  globals: { viewport: 'desktop1280' },
};
