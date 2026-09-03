import type { Meta, StoryObj } from '@storybook/vue3-vite';

import MyProfilePreview from './MyProfilePreview.vue';
import CompactDirectoryPreview from './CompactDirectoryPreview.vue';

const meta = {
  title: 'Web UI 2.0/Review · Compact directory & profile',
  component: CompactDirectoryPreview,
  tags: ['autodocs'],
  args: {
    mode: 'internal',
  },
  argTypes: {
    mode: { control: 'radio', options: ['internal', 'employee'] },
  },
  globals: { viewport: 'mobile390' },
  parameters: {
    docs: {
      description: {
        component:
          '待确认的前端方案：通讯录收紧标题、导览说明和蓝色装饰；“我的”与默认密码提醒沿用系统设置式分组。全部数据为合成预览，不会写入生产。',
      },
    },
    layout: 'fullscreen',
  },
} satisfies Meta<typeof CompactDirectoryPreview>;

export default meta;
type Story = StoryObj<typeof meta>;

export const CompactMobile: Story = {
  name: '1 · 紧凑通讯录 · 手机 390px',
};

export const CompactPeopleMobile: Story = {
  name: '2 · 紧凑通讯录 · 人员模式',
  args: { mode: 'employee' },
};

export const CompactDesktop: Story = {
  name: '3 · 紧凑通讯录 · 桌面 1280px',
  args: { mode: 'employee' },
  globals: { viewport: 'desktop1280' },
};

export const MyProfileOverview: Story = {
  name: '4 · 我的 · 手机概览',
  render: () => ({
    components: { MyProfilePreview },
    template: '<MyProfilePreview layout="mobile" />',
  }),
  globals: { viewport: 'mobile390' },
};

export const DefaultPasswordModal: Story = {
  name: '5 · 我的 · 默认密码弹窗',
  render: () => ({
    components: { MyProfilePreview },
    template: '<MyProfilePreview layout="mobile" :modal-open="true" />',
  }),
  globals: { viewport: 'mobile390' },
};
