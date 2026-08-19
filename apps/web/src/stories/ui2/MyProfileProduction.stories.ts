import type { Meta, StoryObj } from '@storybook/vue3-vite';

import MyProfileView from '../../views/my-profile/MyProfileView.vue';

const demoProfile = {
  id: 'storybook-profile',
  realName: '示例用户',
  version: 1,
} as const;

const demoGroup = {
  groupCode: 'demo',
  id: 'storybook-profile-group',
  isDeveloperAdmin: false,
  name: '示例医疗中心',
  role: 'member',
  version: 1,
} as const;

const meta = {
  title: 'Web UI 2.0/Production · 我的',
  component: MyProfileView,
  tags: ['autodocs'],
  args: {
    group: demoGroup,
    profile: demoProfile,
  },
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: '生产“我的”页面预览，使用合成资料，不会写入真实账号或业务数据。',
      },
    },
  },
} satisfies Meta<typeof MyProfileView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Desktop: Story = {
  name: '桌面账户中心',
  globals: { viewport: 'desktop1280' },
};

export const Mobile: Story = {
  name: '手机账户中心',
  globals: { viewport: 'mobile390' },
};
