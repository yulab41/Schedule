import type { Meta, StoryObj } from '@storybook/vue3-vite';

import MemberDirectoryPreview from './MemberDirectoryPreview.vue';

const meta = {
  title: 'Web UI 2.0/Member Directory Preview',
  component: MemberDirectoryPreview,
  tags: ['autodocs'],
  args: {
    layout: 'mobile',
    viewerRole: 'member',
    initialState: 'directory',
  },
  argTypes: {
    layout: { control: 'radio', options: ['mobile', 'desktop'] },
    viewerRole: { control: 'radio', options: ['member', 'administrator', 'developer'] },
    initialState: {
      control: 'radio',
      options: ['directory', 'edit-self', 'missing-number', 'saved'],
    },
  },
  globals: { viewport: 'mobile390' },
  parameters: {
    docs: {
      description: {
        component: '仅用于视觉确认的成员通讯录预览，不连接生产 API。',
      },
    },
  },
} satisfies Meta<typeof MemberDirectoryPreview>;

export default meta;
type Story = StoryObj<typeof meta>;

export const OrdinaryMember390: Story = {
  name: '1 · 普通成员 · 390px',
};

export const Administrator390: Story = {
  name: '2 · 群主 / 群管理员 · 390px',
  args: { viewerRole: 'administrator' },
};

export const DeveloperDesktop1280: Story = {
  name: '3 · 后台管理员 · 1280px',
  args: { layout: 'desktop', viewerRole: 'developer' },
  globals: { viewport: 'desktop1280' },
};

export const MissingNumber320: Story = {
  name: '4 · 本人未填写号码 · 320px',
  args: { initialState: 'missing-number' },
  globals: { viewport: 'mobile320' },
};

export const EditSheet390: Story = {
  name: '5 · 编辑 Sheet 打开 · 390px',
  args: { initialState: 'edit-self' },
  globals: { viewport: 'mobile390' },
};

export const SavedState390: Story = {
  name: '6 · 保存成功后的列表 · 390px',
  args: { initialState: 'saved' },
  globals: { viewport: 'mobile390' },
};
