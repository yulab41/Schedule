import type { Meta, StoryObj } from '@storybook/vue3-vite';

import CompactControlsPreview from './CompactControlsPreview.vue';

const meta = {
  title: 'Web UI 2.0/Next Refinements/Compact Controls',
  component: CompactControlsPreview,
  tags: ['autodocs'],
  args: { layout: 'mobile' },
  argTypes: { layout: { control: 'radio', options: ['mobile', 'desktop'] } },
  parameters: {
    docs: {
      description: {
        component: '纯视觉交互稿：统一所有勾选类控件，不连接生产表单或 API。',
      },
    },
  },
} satisfies Meta<typeof CompactControlsPreview>;

export default meta;
type Story = StoryObj<typeof meta>;

export const CompactMobile390: Story = {
  name: '1 · 紧凑开关 · 390px',
  globals: { viewport: 'mobile390' },
};

export const CompactMobile320: Story = {
  name: '2 · 紧凑开关 · 320px',
  globals: { viewport: 'mobile320' },
};

export const Desktop1280: Story = {
  name: '3 · 紧凑开关 · 1280px',
  args: { layout: 'desktop' },
  globals: { viewport: 'desktop1280' },
};
