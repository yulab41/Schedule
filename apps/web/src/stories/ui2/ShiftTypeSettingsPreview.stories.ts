import type { Meta, StoryObj } from '@storybook/vue3-vite';

import ShiftTypeSettingsPreview from './ShiftTypeSettingsPreview.vue';

const meta = {
  title: 'Web UI 2.0/Next Refinements/Shift Type Settings',
  component: ShiftTypeSettingsPreview,
  tags: ['autodocs'],
  args: { layout: 'mobile' },
  argTypes: { layout: { control: 'radio', options: ['mobile', 'desktop'] } },
  parameters: {
    docs: {
      description: {
        component: '纯视觉交互稿：班种设置默认收起，编辑时才展示紧凑字段，不连接生产配置。',
      },
    },
  },
} satisfies Meta<typeof ShiftTypeSettingsPreview>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Mobile390: Story = {
  name: '1 · 班种设置 · 390px',
  globals: { viewport: 'mobile390' },
};

export const Mobile320: Story = {
  name: '2 · 班种设置 · 320px',
  globals: { viewport: 'mobile320' },
};

export const Desktop1280: Story = {
  name: '3 · 班种设置 · 1280px',
  args: { layout: 'desktop' },
  globals: { viewport: 'desktop1280' },
};
