import type { Meta, StoryObj } from '@storybook/vue3-vite';
import ExternalDutyPreview from './ExternalDutyPreview.vue';

const meta = {
  title: 'Miniprogram Parity/External Duty',
  component: ExternalDutyPreview,
  args: { state: 'ready', largeText: false },
  globals: { viewport: 'mobile390' },
} satisfies Meta<typeof ExternalDutyPreview>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Ready390: Story = {};
export const Ready320: Story = { globals: { viewport: 'mobile320' } };
export const Preview: Story = { args: { state: 'preview' } };
export const Conflict: Story = { args: { state: 'conflict' } };
export const History: Story = { args: { state: 'history' } };
export const Restore: Story = { args: { state: 'restore' } };
export const Empty: Story = { args: { state: 'empty' } };
export const Error: Story = { args: { state: 'error' } };
export const LargeText: Story = { args: { largeText: true } };
