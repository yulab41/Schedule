import type { Meta, StoryObj } from '@storybook/vue3-vite';

import WorkbenchShellRefinementPreview from './WorkbenchShellRefinementPreview.vue';

const meta = {
  title: 'Web UI 2.0/Shell Refinement Preview',
  component: WorkbenchShellRefinementPreview,
  tags: ['autodocs'],
  args: {
    layout: 'mobile',
    longGroupName: false,
    screen: 'calendar',
  },
  argTypes: {
    layout: { control: 'radio', options: ['mobile', 'desktop'] },
    longGroupName: { control: 'boolean' },
    screen: { control: 'radio', options: ['calendar', 'swap', 'duty', 'login'] },
  },
  globals: { viewport: 'mobile390' },
} satisfies Meta<typeof WorkbenchShellRefinementPreview>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Calendar390: Story = {
  name: '1 · 390px 完整月历',
};

export const LongGroupName320: Story = {
  name: '2 · 320px 长群组名称',
  args: { longGroupName: true },
  globals: { viewport: 'mobile320' },
};

export const Swap390: Story = {
  name: '3 · 390px 换班',
  args: { screen: 'swap' },
};

export const Duty390: Story = {
  name: '4 · 390px 加扣班',
  args: { screen: 'duty' },
};

export const LoginFooter390: Story = {
  name: '5 · 390px 登录页融入式页脚',
  args: { screen: 'login' },
};

export const Desktop1280: Story = {
  name: '6 · 1280px 紧凑工作台',
  args: { layout: 'desktop' },
  globals: { viewport: 'desktop1280' },
};
