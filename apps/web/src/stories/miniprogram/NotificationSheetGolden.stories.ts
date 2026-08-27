import type { Meta, StoryObj } from '@storybook/vue3-vite';

import NotificationSheetGolden from './NotificationSheetGolden.vue';

const meta = {
  title: 'Miniprogram Parity/P4 Notification Sheet',
  component: NotificationSheetGolden,
  tags: ['autodocs'],
  args: { largeText: false },
  argTypes: { largeText: { control: 'boolean' } },
  globals: { viewport: 'mobile390' },
} satisfies Meta<typeof NotificationSheetGolden>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Ready390: Story = {
  name: '1 · 通知底部 Sheet · 390×844',
  globals: { viewport: 'mobile390' },
};

export const Ready320: Story = {
  name: '2 · 通知底部 Sheet · 320×844',
  globals: { viewport: 'mobile320' },
};

export const LargeText390: Story = {
  name: '3 · 通知底部 Sheet · 大字号',
  args: { largeText: true },
  globals: { viewport: 'mobile390' },
};
