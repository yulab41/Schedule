import type { Meta, StoryObj } from '@storybook/vue3-vite';

import EventTimelinePagePreview from './EventTimelinePagePreview.vue';

const meta = {
  title: 'Web UI 2.0/Next Refinements/Event Timeline Page',
  component: EventTimelinePagePreview,
  tags: ['autodocs'],
  args: { layout: 'mobile' },
  argTypes: { layout: { control: 'radio', options: ['mobile', 'desktop'] } },
  parameters: {
    docs: {
      description: {
        component: '纯视觉交互稿：事件主页面改为连续时间轨道，不连接生产事件接口。',
      },
    },
  },
} satisfies Meta<typeof EventTimelinePagePreview>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Mobile390: Story = {
  name: '1 · 事件时间轴 · 390px',
  globals: { viewport: 'mobile390' },
};

export const Mobile320: Story = {
  name: '2 · 事件时间轴 · 320px',
  globals: { viewport: 'mobile320' },
};

export const Desktop1280: Story = {
  name: '3 · 事件时间轴 · 1280px',
  args: { layout: 'desktop' },
  globals: { viewport: 'desktop1280' },
};
