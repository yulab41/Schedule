import type { Meta, StoryObj } from '@storybook/vue3-vite';

import P3IdentitySecurityPreview from './P3IdentitySecurityPreview.vue';

const meta = {
  title: 'MiniProgram Parity/P3 Identity Security',
  component: P3IdentitySecurityPreview,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'P3 身份安全视觉黄金稿。Web 先确认登录与平台账号后台；小程序随后复用同一令牌复刻微信登录、账号证明、真实姓名建档和管理员 URL Link 绑定。所有按钮仅改变预览状态，不调用 API。',
      },
    },
  },
} satisfies Meta<typeof P3IdentitySecurityPreview>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WebLogin: Story = {
  name: '1 · Web 登录（无公开注册）',
  args: { screen: 'web-login' },
  globals: { viewport: 'mobile390' },
};

export const PlatformAdminAccounts: Story = {
  name: '2 · 平台账号后台',
  args: { screen: 'platform-admin' },
  globals: { viewport: 'desktop1280' },
};

export const PlatformAdminAssignment: Story = {
  name: '3 · 分配账号弹窗',
  args: { dialogOpen: true, screen: 'platform-admin' },
  globals: { viewport: 'desktop1280' },
};

export const MiniLogin390: Story = {
  name: '4 · Mini 微信登录 · 390×844',
  args: { screen: 'mini-login' },
  globals: { viewport: 'mobile390' },
};

export const MiniLogin320: Story = {
  name: '5 · Mini 微信登录边界 · 320×844',
  args: { screen: 'mini-login' },
  globals: { viewport: 'mobile320' },
};

export const MiniLinkPassword: Story = {
  name: '6 · Mini 密码绑定',
  args: { screen: 'mini-link' },
  globals: { viewport: 'mobile390' },
};

export const MiniRegisterProfile: Story = {
  name: '7 · Mini 首次建档',
  args: { screen: 'mini-register' },
  globals: { viewport: 'mobile390' },
};

export const MiniAdminLinkPreview: Story = {
  name: '8 · Mini 管理员绑定预览',
  args: { screen: 'mini-admin-preview' },
  globals: { viewport: 'mobile390' },
};

export const MiniAdminLinkConfirm: Story = {
  name: '9 · Mini 管理员绑定确认',
  args: { screen: 'mini-admin-confirm' },
  globals: { viewport: 'mobile390' },
};

export const MiniUnbindConfirm: Story = {
  name: '10 · Mini 解绑当前身份',
  args: { screen: 'mini-unbind' },
  globals: { viewport: 'mobile390' },
};

export const MiniUnbindConfirm320: Story = {
  name: '11 · Mini 解绑边界 · 320×844',
  args: { screen: 'mini-unbind' },
  globals: { viewport: 'mobile320' },
};
