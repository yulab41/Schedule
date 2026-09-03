import type { Meta, StoryObj } from '@storybook/vue3-vite';

import NurseMultiShiftSchedulePreview from './NurseMultiShiftSchedulePreview.vue';

const meta = {
  title: 'Web UI 2.0/Nurse Multi-shift Calendar',
  component: NurseMultiShiftSchedulePreview,
  tags: ['autodocs'],
  args: {
    initialView: 'week',
    layout: 'mobile',
    screen: 'calendar',
  },
  argTypes: {
    initialView: { control: 'radio', options: ['month', 'week', 'list'] },
    layout: { control: 'radio', options: ['mobile', 'desktop'] },
    screen: {
      control: 'radio',
      options: ['calendar', 'group-settings', 'member-settings'],
    },
  },
  parameters: {
    docs: {
      description: {
        component:
          '护士一天多班种的设计验证：直接复用现有生产月历与周历；月视图只筛选一个班种并逐人显示姓名，仅在选中日期的详情区把同班人员收进一张班种卡。群组默认可被成员个人偏好覆盖。仅为 Storybook 原型。',
      },
    },
  },
} satisfies Meta<typeof NurseMultiShiftSchedulePreview>;

export default meta;

type Story = StoryObj<typeof meta>;

export const MobileWeek390: Story = {
  name: '1 · 手机周视图 / 现有组件 + 新详情',
  globals: { viewport: 'mobile390' },
};

export const MobileMonth390: Story = {
  name: '2 · 手机月视图 / 单班种逐人显示',
  args: { initialView: 'month' },
  globals: { viewport: 'mobile390' },
};

export const MobileWeek320: Story = {
  name: '3 · 窄屏详情 / 姓名展开拨号',
  globals: { viewport: 'mobile320' },
};

export const DesktopWeek1280: Story = {
  name: '4 · 桌面周视图 / 现有组件 + 三列详情',
  args: { layout: 'desktop' },
  globals: { viewport: 'desktop1280' },
};

export const GroupDefaults: Story = {
  name: '5 · 群组默认 / 管理员设置',
  args: { screen: 'group-settings' },
  globals: { viewport: 'mobile390' },
};

export const MemberPreferences: Story = {
  name: '6 · 个人覆盖 / 成员偏好',
  args: { screen: 'member-settings' },
  globals: { viewport: 'mobile390' },
};
