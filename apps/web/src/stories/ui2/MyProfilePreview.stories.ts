import type { Meta, StoryObj } from '@storybook/vue3-vite';

import MyProfilePreview from './MyProfilePreview.vue';

const meta = {
  title: 'Web UI 2.0/My Profile Preview',
  component: MyProfilePreview,
  tags: ['autodocs'],
  args: {
    layout: 'desktop',
    modalOpen: false,
  },
  argTypes: {
    layout: { control: 'radio', options: ['desktop', 'mobile'] },
    modalOpen: { control: 'boolean' },
  },
  parameters: {
    docs: {
      description: {
        component:
          '“我的”页面与默认密码提醒弹窗的视觉确认稿。所有数据和操作均为 Storybook 预览，不会写入账号或真实修改密码。',
      },
    },
  },
} satisfies Meta<typeof MyProfilePreview>;

export default meta;
type Story = StoryObj<typeof meta>;

export const DesktopOverview: Story = {
  name: '1 · 我的 · 桌面概览',
  globals: { viewport: 'desktop1280' },
};

export const MobileOverview: Story = {
  name: '2 · 我的 · 手机布局',
  args: { layout: 'mobile' },
  globals: { viewport: 'mobile390' },
};

export const DefaultPasswordModal: Story = {
  name: '3 · 默认密码提醒弹窗',
  args: { modalOpen: true },
  globals: { viewport: 'desktop1280' },
};

export const DefaultPasswordModalMobile: Story = {
  name: '4 · 默认密码提醒弹窗 · 手机',
  args: { layout: 'mobile', modalOpen: true },
  globals: { viewport: 'mobile390' },
};
