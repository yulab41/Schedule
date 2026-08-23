import type { Meta, StoryObj } from '@storybook/vue3-vite';

import P4WorkbenchPreview from './P4WorkbenchPreview.vue';

const meta = {
  title: 'MiniProgram Parity/P4 Workbench',
  component: P4WorkbenchPreview,
  tags: ['autodocs'],
  args: { state: 'ready', viewport: 'mobile-390' },
  parameters: {
    docs: {
      description: {
        component:
          'P4 第一视觉切片：身份确认后进入有权限群组的只读工作台。月视图复用当前 Web 黄金日历；周视图、列表视图和异常状态先作为明确的可见边界，不提前伪装成已接入业务。',
      },
    },
  },
} satisfies Meta<typeof P4WorkbenchPreview>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Ready390: Story = {
  name: '1 · 已认证工作台 / 月视图 · 390×844',
  args: { state: 'ready', viewport: 'mobile-390' },
  globals: { viewport: 'mobile390' },
};

export const Ready320: Story = {
  name: '2 · 已认证工作台边界 · 320×844',
  args: { state: 'ready', viewport: 'mobile-320' },
  globals: { viewport: 'mobile320' },
};

export const Empty: Story = {
  name: '3 · 当前群组暂无已发布排班',
  args: { state: 'empty' },
  globals: { viewport: 'mobile390' },
};

export const Loading: Story = {
  name: '4 · 读取中',
  args: { state: 'loading' },
  globals: { viewport: 'mobile390' },
};

export const Error: Story = {
  name: '5 · 读取失败可重试',
  args: { state: 'error' },
  globals: { viewport: 'mobile390' },
};

export const Offline: Story = {
  name: '6 · 离线只读缓存',
  args: { state: 'offline' },
  globals: { viewport: 'mobile390' },
};
