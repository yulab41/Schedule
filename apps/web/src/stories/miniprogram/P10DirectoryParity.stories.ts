import type { Meta, StoryObj } from '@storybook/vue3-vite';

import UnifiedDirectoryView from '../../views/directory/UnifiedDirectoryView.vue';
import {
  employeeDataSource,
  internalDataSource,
  previewGroup,
} from '../ui2/UnifiedDirectoryPreview.stories';

const meta = {
  title: 'Miniprogram Parity/P10 Directory',
  component: UnifiedDirectoryView,
  tags: ['autodocs'],
  args: {
    employeeDataSource,
    group: previewGroup,
    initialDirectory: 'internal',
    internalDataSource,
  },
  argTypes: {
    initialDirectory: { control: 'radio', options: ['internal', 'employee'] },
  },
  globals: { viewport: 'mobile390' },
  parameters: {
    docs: {
      description: {
        component:
          'P10 原生通讯录的 Web 黄金源。复用生产通讯录组件与合成数据，不连接生产 API；视觉方向为临床蓝、病历卡白底、院区/层级导览和 44px 触达区。',
      },
    },
    layout: 'fullscreen',
  },
} satisfies Meta<typeof UnifiedDirectoryView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Department390: Story = {
  name: '1 · 科室通讯录 · 390px',
};

export const Employee390: Story = {
  name: '2 · 人员通讯录 · 390px',
  args: { initialDirectory: 'employee' },
};

export const Department320: Story = {
  name: '3 · 科室通讯录 · 320px',
  globals: { viewport: 'mobile320' },
};

export const EmployeeDesktop1280: Story = {
  name: '4 · 人员通讯录 · 1280px',
  args: { initialDirectory: 'employee' },
  globals: { viewport: 'desktop1280' },
};
