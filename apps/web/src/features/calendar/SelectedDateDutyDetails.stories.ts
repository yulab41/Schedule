import type { CalendarDutyAssignment, CalendarDutyMember } from '@schedule/contracts';
import type { Meta, StoryObj } from '@storybook/vue3-vite';

import SelectedDateDutyDetails from './SelectedDateDutyDetails.vue';

const assignments: readonly CalendarDutyAssignment[] = [
  {
    businessDate: '2026-08-14',
    changeMarkers: [],
    endsAt: '2026-08-14T08:00:00.000Z',
    id: 'morning-duty',
    plannedMemberName: '林恩宇医生',
    plannedMembershipId: 'membership-1',
    schedulePeriodId: 'period-1',
    scheduleRoleId: 'role-1',
    scheduleRoleName: '一线',
    shiftTypeAbbreviation: 'A',
    shiftTypeColor: '#0A66D5',
    shiftTypeId: 'shift-a',
    shiftTypeName: '早班',
    shiftTypeTextColor: '#FFFFFF',
    slotPosition: 1,
    startsAt: '2026-08-14T00:00:00.000Z',
  },
  {
    actualMemberName: '陈护士',
    actualMembershipId: 'membership-2',
    businessDate: '2026-08-14',
    changeMarkers: ['swap'],
    endsAt: '2026-08-14T16:00:00.000Z',
    id: 'afternoon-duty',
    plannedMemberName: '王医生',
    plannedMembershipId: 'membership-3',
    schedulePeriodId: 'period-1',
    scheduleRoleId: 'role-2',
    scheduleRoleName: '留观区',
    shiftTypeAbbreviation: 'P',
    shiftTypeColor: '#248A3D',
    shiftTypeId: 'shift-p',
    shiftTypeName: '中班',
    shiftTypeTextColor: '#FFFFFF',
    slotPosition: 1,
    startsAt: '2026-08-14T08:00:00.000Z',
  },
];

const members: readonly CalendarDutyMember[] = [
  {
    isConfirmed: true,
    membershipId: 'membership-1',
    mobilePhone: '13800138000',
    realName: '林恩宇医生',
    shortPhone: '61234',
  },
  {
    isConfirmed: false,
    membershipId: 'membership-2',
    mobilePhone: '13900139000',
    realName: '陈护士',
  },
];

const meta = {
  title: 'Web UI 2.0/Production/Selected Date Duty Details',
  component: SelectedDateDutyDetails,
  tags: ['autodocs'],
  args: {
    assignments,
    members,
    selectedDate: '2026-08-14',
  },
  globals: {
    viewport: 'mobile390',
  },
  parameters: {
    layout: 'fullscreen',
  },
  render: (args) => ({
    components: { SelectedDateDutyDetails },
    setup: () => ({ args }),
    template: `
      <main style="min-height: 100vh; padding: 12px; background: var(--ui-color-background);">
        <SelectedDateDutyDetails v-bind="args" />
      </main>
    `,
  }),
} satisfies Meta<typeof SelectedDateDutyDetails>;

export default meta;

type Story = StoryObj<typeof meta>;

export const MobileTrack: Story = {
  name: '手机值班轨道',
};
