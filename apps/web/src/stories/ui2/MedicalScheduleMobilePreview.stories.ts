import type { Meta, StoryObj } from '@storybook/vue3-vite';

import MedicalScheduleMobilePreview from './MedicalScheduleMobilePreview.vue';

const meta = {
  title: 'Web UI 2.0/Mobile Screens',
  component: MedicalScheduleMobilePreview,
  tags: ['autodocs'],
  args: {
    calendarScenario: 'august',
    screen: 'calendar',
  },
  argTypes: {
    calendarScenario: {
      control: 'radio',
      options: ['august', 'october-holiday'],
    },
    screen: {
      control: 'radio',
      options: ['login', 'calendar', 'detail', 'leave'],
    },
  },
  globals: {
    viewport: 'mobile390',
  },
} satisfies Meta<typeof MedicalScheduleMobilePreview>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Login: Story = {
  name: '1 · 登录',
  args: { screen: 'login' },
};

export const WorkbenchCalendar: Story = {
  name: '2 · 工作台 / 月历',
  args: { screen: 'calendar' },
};

export const HolidayCalendar: Story = {
  name: '2.1 · 多日节假日状态',
  args: { calendarScenario: 'october-holiday', screen: 'calendar' },
};

export const SelectedDateDetail: Story = {
  name: '3 · 选中日期详情',
  args: { screen: 'detail' },
};

export const LeaveAndApproval: Story = {
  name: '4 · 请假与审批',
  args: { screen: 'leave' },
};
