import type { Meta, StoryObj } from '@storybook/vue3-vite';

import P9VisitorAccessGolden from './P9VisitorAccessGolden.vue';

const meta = {
  title: 'MiniProgram Parity/P9 Visitor Access',
  component: P9VisitorAccessGolden,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'P9 访客访问审计黄金稿：只读展示访问时间、查看月份和脱敏来源线索；不持久化 visitor key 或 token，不代表生产 insights capability 已开放。',
      },
    },
  },
} satisfies Meta<typeof P9VisitorAccessGolden>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Ready390: Story = { name: '1 · 最近访问 · 390×844', args: { state: 'ready' }, globals: { viewport: 'mobile390' } };
export const Ready320: Story = { name: '2 · 最近访问边界 · 320×844', args: { state: 'ready' }, globals: { viewport: 'mobile320' } };
export const LargeText390: Story = { name: '3 · 大字号 · 390×844', args: { largeText: true, state: 'ready' }, globals: { viewport: 'mobile390' } };
export const Loading: Story = { name: '4 · 加载中', args: { state: 'loading' }, globals: { viewport: 'mobile390' } };
export const Empty: Story = { name: '5 · 空状态', args: { state: 'empty' }, globals: { viewport: 'mobile390' } };
export const ErrorState: Story = { name: '6 · 错误重试', args: { state: 'error' }, globals: { viewport: 'mobile390' } };
export const InsightsDisabled: Story = { name: '7 · 能力关闭', args: { state: 'disabled' }, globals: { viewport: 'mobile390' } };
