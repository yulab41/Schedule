import type { Meta, StoryObj } from '@storybook/vue3-vite';

import NotificationSettingsPreview from './NotificationSettingsPreview.vue';

const meta = {
  title: 'Web UI 2.0/Notification Settings Preview',
  component: NotificationSettingsPreview,
  tags: ['autodocs'],
  args: {
    layout: 'mobile',
    enabled: false,
    status: 'ready',
  },
  argTypes: {
    layout: { control: 'radio', options: ['mobile', 'desktop'] },
    enabled: { control: 'boolean' },
    status: { control: 'radio', options: ['ready', 'permission-denied', 'registration-needed'] },
  },
  globals: { viewport: 'mobile390' },
  parameters: {
    docs: {
      description: {
        component: '仅用于视觉确认的通知设置预览，不会真实请求浏览器权限。',
      },
    },
  },
} satisfies Meta<typeof NotificationSettingsPreview>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Off390: Story = {
  name: '1 · 通知关闭 · 390px',
};

export const On390: Story = {
  name: '2 · 通知开启 · 390px',
  args: { enabled: true },
  globals: { viewport: 'mobile390' },
};

export const PermissionDenied320: Story = {
  name: '3 · 权限拒绝 · 320px',
  args: { status: 'permission-denied' },
  globals: { viewport: 'mobile320' },
};

export const RegistrationNeeded390: Story = {
  name: '4 · 需要重新注册 · 390px',
  args: { enabled: true, status: 'registration-needed' },
  globals: { viewport: 'mobile390' },
};

export const Desktop1280: Story = {
  name: '5 · 桌面布局 · 1280px',
  args: { layout: 'desktop', enabled: true },
  globals: { viewport: 'desktop1280' },
};
