import type { Meta, StoryObj } from '@storybook/vue3-vite';

import P10DirectoryParityPreview from './P10DirectoryParityPreview.vue';

const meta = {
  title: 'Miniprogram Parity/P10 Directory Parity',
  component: P10DirectoryParityPreview,
  tags: ['autodocs'],
  args: {
    directoryKind: 'internal',
    halfSheetOpen: false,
    initialState: 'ready',
    largeText: false,
  },
  argTypes: {
    directoryKind: { control: 'radio', options: ['internal', 'employee'] },
    initialState: { control: 'radio', options: ['ready', 'loading', 'empty', 'error', 'disabled'] },
    halfSheetOpen: { control: 'boolean' },
    largeText: { control: 'boolean' },
  },
  globals: { viewport: 'mobile390' },
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof P10DirectoryParityPreview>;

export default meta;
type Story = StoryObj<typeof meta>;

export const InternalReady390: Story = {
  name: '1 · 院内通讯录 · 390',
  args: { directoryKind: 'internal' },
};
export const InternalReady320: Story = {
  name: '2 · 院内通讯录 · 320',
  args: { directoryKind: 'internal' },
  globals: { viewport: 'mobile320' },
};
export const EmployeeReady390: Story = {
  name: '3 · 员工通讯录 · 390',
  args: { directoryKind: 'employee' },
};
export const LargeText390: Story = { name: '4 · 大字号通讯录 · 390', args: { largeText: true } };
export const Loading320: Story = {
  name: '5 · 通讯录加载 · 320',
  args: { initialState: 'loading' },
  globals: { viewport: 'mobile320' },
};
export const Empty390: Story = { name: '6 · 通讯录空状态 · 390', args: { initialState: 'empty' } };
export const Error320: Story = {
  name: '7 · 通讯录错误 · 320',
  args: { initialState: 'error' },
  globals: { viewport: 'mobile320' },
};
export const Disabled390: Story = {
  name: '8 · 能力关闭 · 390',
  args: { initialState: 'disabled' },
};
export const HalfFilterSheet390: Story = {
  name: '9 · 半屏筛选 · 390',
  args: { directoryKind: 'employee', halfSheetOpen: true },
};
export const HalfFilterSheet320: Story = {
  name: '10 · 半屏筛选 · 320',
  args: { directoryKind: 'employee', halfSheetOpen: true },
  globals: { viewport: 'mobile320' },
};
