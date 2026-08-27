import type { Meta, StoryObj } from '@storybook/vue3-vite';
import type { CalendarDutyAssignment } from '@schedule/contracts';
import type { MyProfileOverview } from '@schedule/presentation-core';

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

const demoOverview = {
  membershipId: 'storybook-membership',
  mobilePhone: '13412348339',
  monthCount: 8,
  monthDelta: 2,
  nextDuty: {
    actualMemberName: '示例用户',
    actualMembershipId: 'storybook-membership',
    businessDate: '2026-08-22',
    changeMarkers: [],
    endsAt: '2026-08-22T09:30:00.000Z',
    id: 'storybook-next-duty',
    plannedMemberName: '示例用户',
    plannedMembershipId: 'storybook-membership',
    schedulePeriodId: 'storybook-period',
    scheduleRoleId: 'storybook-role',
    scheduleRoleName: '头颈外科',
    shiftTypeAbbreviation: '日',
    shiftTypeColor: '#0A66D5',
    shiftTypeId: 'storybook-shift',
    shiftTypeName: '日班',
    shiftTypeTextColor: '#FFFFFF',
    slotPosition: 1,
    startsAt: '2026-08-22T00:00:00.000Z',
  },
  shortPhone: '68339',
  specialDateCount: 3,
  trend: [
    { businessMonth: '2026-05', count: 4, label: '5月' },
    { businessMonth: '2026-06', count: 6, label: '6月' },
    { businessMonth: '2026-07', count: 6, label: '7月' },
    { businessMonth: '2026-08', count: 8, label: '8月' },
  ],
  yearCount: 76,
} satisfies MyProfileOverview<CalendarDutyAssignment>;

const meta = {
  title: 'Web UI 2.0/Production · 我的',
  component: MyProfileView,
  tags: ['autodocs'],
  args: {
    group: demoGroup,
    overview: demoOverview,
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
