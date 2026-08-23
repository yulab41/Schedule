import type { Meta, StoryObj } from '@storybook/vue3-vite';

import P5SchedulingClosurePreview from './P5SchedulingClosurePreview.vue';

const meta = {
  title: 'MiniProgram Parity/P5 Scheduling Closure',
  component: P5SchedulingClosurePreview,
  tags: ['autodocs'],
  args: { state: 'editor', viewport: 'mobile-390' },
  parameters: {
    docs: {
      description: {
        component:
          'P5 排班闭环黄金稿：模板编辑与风险预览使用“排班交接轨”；草稿发布历史、覆盖冲突、撤回、重发、删除确认和排班补录 1:1 对齐 Web 手机版，手机号同意归入群组设置。全部状态只使用脱敏静态数据，不调用业务 API。',
      },
    },
  },
} satisfies Meta<typeof P5SchedulingClosurePreview>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Editor390: Story = {
  name: '1 · 七日模板编辑 · 390×844',
  globals: { viewport: 'mobile390' },
};

export const Editor320: Story = {
  name: '2 · 七日模板编辑边界 · 320×844',
  args: { viewport: 'mobile-320' },
  globals: { viewport: 'mobile320' },
};

export const Maximum390: Story = {
  name: '3 · 20×30 / 600 格上限 · 390×844',
  args: { state: 'maximum' },
  globals: { viewport: 'mobile390' },
};

export const Preview390: Story = {
  name: '4 · 30 天风险预览 · 390×844',
  args: { state: 'preview' },
  globals: { viewport: 'mobile390' },
};

export const RiskBlocked390: Story = {
  name: '5 · 空缺阻断与风险确认 · 390×844',
  args: { state: 'risk' },
  globals: { viewport: 'mobile390' },
};

export const Release390: Story = {
  name: '6 · 草稿 / 发布 / 历史版本 · 390×844',
  args: { state: 'release' },
  globals: { viewport: 'mobile390' },
};

export const ReleaseBlocked390: Story = {
  name: '9 · 草稿覆盖冲突确认 · 390×844',
  args: { state: 'release-blocked' },
  globals: { viewport: 'mobile390' },
};

export const ReleaseWithdraw390: Story = {
  name: '10 · 撤销当前发布确认 · 390×844',
  args: { state: 'release-withdraw' },
  globals: { viewport: 'mobile390' },
};

export const ReleaseRepublish390: Story = {
  name: '11 · 重新发布归档版本 · 390×844',
  args: { state: 'release-republish' },
  globals: { viewport: 'mobile390' },
};

export const ReleaseDelete390: Story = {
  name: '12 · 删除排班草稿确认 · 390×844',
  args: { state: 'release-delete' },
  globals: { viewport: 'mobile390' },
};

export const ReleaseRepublish320: Story = {
  name: '13 · 重新发布归档版本边界 · 320×844',
  args: { state: 'release-republish', viewport: 'mobile-320' },
  globals: { viewport: 'mobile320' },
};

export const Backfill390: Story = {
  name: '7 · Web 同构排班补录 · 390×844',
  args: { state: 'backfill' },
  globals: { viewport: 'mobile390' },
};

export const PhoneConsent390: Story = {
  name: '8 · 群组设置 / 手机号同意 · 390×844',
  args: { state: 'phone-consent' },
  globals: { viewport: 'mobile390' },
};
