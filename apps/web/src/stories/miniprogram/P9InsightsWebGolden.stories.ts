import type { Meta, StoryObj } from '@storybook/vue3-vite';

import P9InsightsWebGolden from './P9InsightsWebGolden.vue';

const meta = {
  title: 'MiniProgram Parity/P9 Insights Suite',
  component: P9InsightsWebGolden,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'P9 数据与消息 Web 黄金：事件时间线、统计摘要、通知中心和导出入口共享排班事实；状态稿不发起 API 请求，也不代表生产 insights 已开启。',
      },
    },
  },
} satisfies Meta<typeof P9InsightsWebGolden>;

export default meta;
type Story = StoryObj<typeof meta>;

export const EventsReady390: Story = {
  name: '1 · 事件时间线 · 390×844',
  args: { surface: 'events' },
  globals: { viewport: 'mobile390' },
};
export const StatisticsReady390: Story = {
  name: '2 · 排班统计 · 390×844',
  args: { surface: 'statistics' },
  globals: { viewport: 'mobile390' },
};
export const NotificationsReady390: Story = {
  name: '3 · 通知中心 · 390×844',
  args: { surface: 'notifications' },
  globals: { viewport: 'mobile390' },
};
export const ExportReady390: Story = {
  name: '4 · 导出入口 · 390×844',
  args: { surface: 'export' },
  globals: { viewport: 'mobile390' },
};
export const EventsBoundary320: Story = {
  name: '5 · 事件边界 · 320×844',
  args: { surface: 'events' },
  globals: { viewport: 'mobile320' },
};
export const LargeText390: Story = {
  name: '6 · 大字号 · 390×844',
  args: { largeText: true, surface: 'statistics' },
  globals: { viewport: 'mobile390' },
};
export const Loading: Story = {
  name: '7 · 加载中',
  args: { state: 'loading' },
  globals: { viewport: 'mobile390' },
};
export const Empty: Story = {
  name: '8 · 空状态',
  args: { state: 'empty' },
  globals: { viewport: 'mobile390' },
};
export const ErrorState: Story = {
  name: '9 · 错误重试',
  args: { state: 'error' },
  globals: { viewport: 'mobile390' },
};
export const DisabledMember: Story = {
  name: '10 · 成员权限关闭',
  args: { role: 'member', state: 'disabled' },
  globals: { viewport: 'mobile390' },
};
