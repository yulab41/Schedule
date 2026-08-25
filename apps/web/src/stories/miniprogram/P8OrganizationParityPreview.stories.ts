import type { Meta, StoryObj } from '@storybook/vue3-vite';

import P8OrganizationParityPreview from './P8OrganizationParityPreview.vue';

const meta = {
  title: 'Miniprogram Parity/P8 Organization Parity',
  component: P8OrganizationParityPreview,
  tags: ['autodocs'],
  args: { area: 'group', largeText: false, role: 'owner', surface: 'ready' },
  argTypes: {
    area: {
      control: 'radio',
      options: ['group', 'members', 'config', 'invite-visitor', 'platform'],
    },
    largeText: { control: 'boolean' },
    role: {
      control: 'radio',
      options: ['owner', 'administrator', 'member', 'developer', 'platform-admin'],
    },
    surface: {
      control: 'radio',
      options: ['ready', 'loading', 'empty', 'error', 'conflict', 'confirm', 'success', 'disabled'],
    },
  },
  globals: { viewport: 'mobile390' },
} satisfies Meta<typeof P8OrganizationParityPreview>;

export default meta;
type Story = StoryObj<typeof meta>;

export const GroupOwner390: Story = {
  name: '1 · 群主管理全状态 · 390',
  args: { area: 'group', role: 'owner', surface: 'ready' },
};
export const GroupAdministrator390: Story = {
  name: '2 · 群管理员权限边界 · 390',
  args: { area: 'group', role: 'administrator', surface: 'ready' },
};
export const GroupMember390: Story = {
  name: '3 · 普通成员群组设置 · 390',
  args: { area: 'group', role: 'member', surface: 'ready' },
};
export const GroupDissolveConfirm390: Story = {
  name: '4 · 群组解散确认 · 390',
  args: { area: 'group', role: 'owner', surface: 'confirm' },
};
export const GroupConflict320: Story = {
  name: '5 · 群组版本冲突 · 320',
  args: { area: 'group', role: 'owner', surface: 'conflict' },
  globals: { viewport: 'mobile320' },
};
export const GroupSuccess320: Story = {
  name: '6 · 群组保存成功 · 320',
  args: { area: 'group', role: 'owner', surface: 'success' },
  globals: { viewport: 'mobile320' },
};
export const GroupLoading320: Story = {
  name: '7 · 群组加载状态 · 320',
  args: { area: 'group', role: 'owner', surface: 'loading' },
  globals: { viewport: 'mobile320' },
};
export const GroupError320: Story = {
  name: '8 · 群组错误状态 · 320',
  args: { area: 'group', role: 'owner', surface: 'error' },
  globals: { viewport: 'mobile320' },
};

export const MembersOwner390: Story = {
  name: '9 · 群主成员目录 · 390',
  args: { area: 'members', role: 'owner', surface: 'ready' },
};
export const MembersAdministrator390: Story = {
  name: '10 · 管理员成员目录 · 390',
  args: { area: 'members', role: 'administrator', surface: 'ready' },
};
export const MembersMember390: Story = {
  name: '11 · 普通成员通讯录 · 390',
  args: { area: 'members', role: 'member', surface: 'ready' },
};
export const MembersDeveloperClaims390: Story = {
  name: '12 · 后台管理员认领申请 · 390',
  args: { area: 'members', role: 'developer', surface: 'ready' },
};
export const MembersManageConfirm320: Story = {
  name: '13 · 成员管理危险操作 · 320',
  args: { area: 'members', role: 'owner', surface: 'confirm' },
  globals: { viewport: 'mobile320' },
};
export const MembersEmpty320: Story = {
  name: '14 · 成员空状态 · 320',
  args: { area: 'members', role: 'administrator', surface: 'empty' },
  globals: { viewport: 'mobile320' },
};
export const MembersSuccess320: Story = {
  name: '15 · 添加预设成员成功 · 320',
  args: { area: 'members', role: 'administrator', surface: 'success' },
  globals: { viewport: 'mobile320' },
};

export const ConfigOwner390: Story = {
  name: '16 · 群主排班配置 · 390',
  args: { area: 'config', role: 'owner', surface: 'ready' },
};
export const ConfigAdministrator390: Story = {
  name: '17 · 管理员排班配置 · 390',
  args: { area: 'config', role: 'administrator', surface: 'ready' },
};
export const ConfigConflict320: Story = {
  name: '18 · 配置 aggregate 冲突 · 320',
  args: { area: 'config', role: 'administrator', surface: 'conflict' },
  globals: { viewport: 'mobile320' },
};
export const ConfigConfirm320: Story = {
  name: '19 · 新增班种完整表单 · 320',
  args: { area: 'config', role: 'owner', surface: 'confirm' },
  globals: { viewport: 'mobile320' },
};
export const ConfigEmpty320: Story = {
  name: '20 · 配置空状态 · 320',
  args: { area: 'config', role: 'owner', surface: 'empty' },
  globals: { viewport: 'mobile320' },
};
export const ConfigLoading320: Story = {
  name: '21 · 配置加载状态 · 320',
  args: { area: 'config', role: 'administrator', surface: 'loading' },
  globals: { viewport: 'mobile320' },
};
export const ConfigDisabledMember320: Story = {
  name: '22 · 成员配置入口关闭 · 320',
  args: { area: 'config', role: 'member', surface: 'disabled' },
  globals: { viewport: 'mobile320' },
};

export const InviteVisitorOwner390: Story = {
  name: '23 · 群主邀请与访客码 · 390',
  args: { area: 'invite-visitor', role: 'owner', surface: 'ready' },
};
export const InviteVisitorAdministrator320: Story = {
  name: '24 · 管理员邀请边界 · 320',
  args: { area: 'invite-visitor', role: 'administrator', surface: 'ready' },
  globals: { viewport: 'mobile320' },
};
export const InviteVisitorConfirm320: Story = {
  name: '25 · 访客码轮换确认 · 320',
  args: { area: 'invite-visitor', role: 'owner', surface: 'confirm' },
  globals: { viewport: 'mobile320' },
};
export const InviteVisitorSuccess390: Story = {
  name: '26 · 访客码轮换成功 · 390',
  args: { area: 'invite-visitor', role: 'owner', surface: 'success' },
};
export const InviteVisitorDisabled320: Story = {
  name: '27 · 普通成员分享入口关闭 · 320',
  args: { area: 'invite-visitor', role: 'member', surface: 'disabled' },
  globals: { viewport: 'mobile320' },
};

export const PlatformAdmin390: Story = {
  name: '28 · 平台账号全状态 · 390',
  args: { area: 'platform', role: 'platform-admin', surface: 'ready' },
};
export const PlatformAssignment320: Story = {
  name: '29 · 用户名分配 · 320',
  args: { area: 'platform', role: 'platform-admin', surface: 'confirm' },
  globals: { viewport: 'mobile320' },
};
export const PlatformLinkSuccess390: Story = {
  name: '30 · 管理员绑定链接成功 · 390',
  args: { area: 'platform', role: 'platform-admin', surface: 'success' },
};
export const PlatformConflict320: Story = {
  name: '31 · 平台身份版本冲突 · 320',
  args: { area: 'platform', role: 'platform-admin', surface: 'conflict' },
  globals: { viewport: 'mobile320' },
};
export const PlatformEmpty320: Story = {
  name: '32 · 平台账号空状态 · 320',
  args: { area: 'platform', role: 'platform-admin', surface: 'empty' },
  globals: { viewport: 'mobile320' },
};
export const PlatformLoading320: Story = {
  name: '33 · 平台账号加载状态 · 320',
  args: { area: 'platform', role: 'platform-admin', surface: 'loading' },
  globals: { viewport: 'mobile320' },
};

export const OrganizationLargeText390: Story = {
  name: '34 · 组织管理大字号边界 · 390',
  args: { area: 'group', largeText: true, role: 'owner', surface: 'ready' },
};
