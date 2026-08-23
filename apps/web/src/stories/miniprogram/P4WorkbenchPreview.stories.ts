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
          'P4 第一视觉切片：身份确认后进入有权限群组的只读工作台。对齐 Web 的月/周/列表、定位到今天、筛选和选中日期详情；写入型业务仍保持在后续阶段。',
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

export const FilterOpen390: Story = {
  name: '3 · 已认证工作台 / 筛选展开 · 390×844',
  args: { state: 'ready', viewport: 'mobile-390', initialFilterOpen: true },
  globals: { viewport: 'mobile390' },
};

export const Week390: Story = {
  name: '4 · 已认证工作台 / 周视图 · 390×844',
  args: { state: 'ready', viewport: 'mobile-390', initialView: 'week' },
  globals: { viewport: 'mobile390' },
};

export const List390: Story = {
  name: '5 · 已认证工作台 / 列表视图 · 390×844',
  args: { state: 'ready', viewport: 'mobile-390', initialView: 'list' },
  globals: { viewport: 'mobile390' },
};

export const Empty: Story = {
  name: '6 · 当前群组暂无已发布排班',
  args: { state: 'empty' },
  globals: { viewport: 'mobile390' },
};

export const Loading: Story = {
  name: '7 · 读取中',
  args: { state: 'loading' },
  globals: { viewport: 'mobile390' },
};

export const Error: Story = {
  name: '8 · 读取失败可重试',
  args: { state: 'error' },
  globals: { viewport: 'mobile390' },
};

export const Offline: Story = {
  name: '9 · 离线只读缓存',
  args: { state: 'offline' },
  globals: { viewport: 'mobile390' },
};
