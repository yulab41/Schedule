import type { Meta, StoryObj } from '@storybook/vue3-vite';

import PasswordChangeDialog from '../../components/PasswordChangeDialog.vue';

const meta = {
  title: 'Web UI 2.0/Production · 密码安全',
  component: PasswordChangeDialog,
  args: {
    defaultPasswordReminder: true,
    saving: false,
    visible: true,
  },
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: '生产默认密码提醒与改密弹窗。故事仅展示交互，不提交真实密码。',
      },
    },
  },
} satisfies Meta<typeof PasswordChangeDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const DefaultPasswordReminder: Story = {
  name: '初始密码提醒 · 桌面',
  globals: { viewport: 'desktop1280' },
};

export const DefaultPasswordReminderMobile: Story = {
  name: '初始密码提醒 · 手机',
  globals: { viewport: 'mobile390' },
};

export const PasswordEditor: Story = {
  name: '修改密码表单',
  args: { defaultPasswordReminder: false },
  globals: { viewport: 'mobile390' },
};
