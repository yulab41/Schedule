import type { Meta, StoryObj } from '@storybook/vue3-vite';

import P7WorkflowParityPreview from './P7WorkflowParityPreview.vue';

const meta = {
  title: 'Miniprogram Parity/P7 Workflow Parity',
  component: P7WorkflowParityPreview,
  tags: ['autodocs'],
  args: {
    role: 'member',
    surface: 'list',
    workflow: 'leave',
  },
  argTypes: {
    role: { control: 'radio', options: ['member', 'owner'] },
    surface: {
      control: 'radio',
      options: [
        'list',
        'create',
        'approval',
        'preview',
        'conflict',
        'direct',
        'empty',
        'error',
        'loading',
      ],
    },
    workflow: { control: 'radio', options: ['leave', 'swap', 'duty'] },
  },
  globals: { viewport: 'mobile390' },
} satisfies Meta<typeof P7WorkflowParityPreview>;

export default meta;

type Story = StoryObj<typeof meta>;

export const LeaveMember390: Story = {
  name: '1 · 请假成员全状态 · 390',
  args: { role: 'member', surface: 'list', workflow: 'leave' },
};

export const LeaveCreate390: Story = {
  name: '2 · 新建请假 Sheet · 390',
  args: { role: 'member', surface: 'create', workflow: 'leave' },
};

export const LeaveApprovalConflict390: Story = {
  name: '3 · 请假审批冲突确认 · 390',
  args: { role: 'owner', surface: 'approval', workflow: 'leave' },
};

export const LeaveEmpty320: Story = {
  name: '4 · 请假空状态 · 320',
  args: { role: 'member', surface: 'empty', workflow: 'leave' },
  globals: { viewport: 'mobile320' },
};

export const LeaveError320: Story = {
  name: '5 · 请假错误状态 · 320',
  args: { role: 'owner', surface: 'error', workflow: 'leave' },
  globals: { viewport: 'mobile320' },
};

export const LeaveLoading320: Story = {
  name: '6 · 请假加载状态 · 320',
  args: { role: 'member', surface: 'loading', workflow: 'leave' },
  globals: { viewport: 'mobile320' },
};

export const SwapMemberStates390: Story = {
  name: '7 · 换班成员全状态 · 390',
  args: { role: 'member', surface: 'list', workflow: 'swap' },
};

export const SwapCreatePreview390: Story = {
  name: '8 · 换班表单与预览 · 390',
  args: { role: 'member', surface: 'preview', workflow: 'swap' },
};

export const SwapAdminStates390: Story = {
  name: '9 · 换班管理员审批与设置 · 390',
  args: { role: 'owner', surface: 'list', workflow: 'swap' },
};

export const SwapDirect320: Story = {
  name: '10 · 管理员直接换班 · 320',
  args: { role: 'owner', surface: 'direct', workflow: 'swap' },
  globals: { viewport: 'mobile320' },
};

export const SwapEmpty320: Story = {
  name: '11 · 换班空状态 · 320',
  args: { role: 'member', surface: 'empty', workflow: 'swap' },
  globals: { viewport: 'mobile320' },
};

export const SwapError320: Story = {
  name: '12 · 换班错误状态 · 320',
  args: { role: 'owner', surface: 'error', workflow: 'swap' },
  globals: { viewport: 'mobile320' },
};

export const SwapLoading320: Story = {
  name: '13 · 换班加载状态 · 320',
  args: { role: 'member', surface: 'loading', workflow: 'swap' },
  globals: { viewport: 'mobile320' },
};

export const DutyMemberStates390: Story = {
  name: '14 · 加扣班成员全状态 · 390',
  args: { role: 'member', surface: 'list', workflow: 'duty' },
};

export const DutyCreateConflict390: Story = {
  name: '15 · 加扣班表单与冲突 · 390',
  args: { role: 'member', surface: 'conflict', workflow: 'duty' },
};

export const DutyAdminStates390: Story = {
  name: '16 · 加扣班管理员审批与设置 · 390',
  args: { role: 'owner', surface: 'list', workflow: 'duty' },
};

export const DutyDirect320: Story = {
  name: '17 · 管理员直接代值 · 320',
  args: { role: 'owner', surface: 'direct', workflow: 'duty' },
  globals: { viewport: 'mobile320' },
};

export const DutyEmpty320: Story = {
  name: '18 · 加扣班空状态 · 320',
  args: { role: 'member', surface: 'empty', workflow: 'duty' },
  globals: { viewport: 'mobile320' },
};

export const DutyError320: Story = {
  name: '19 · 加扣班错误状态 · 320',
  args: { role: 'owner', surface: 'error', workflow: 'duty' },
  globals: { viewport: 'mobile320' },
};

export const DutyLoading320: Story = {
  name: '20 · 加扣班加载状态 · 320',
  args: { role: 'member', surface: 'loading', workflow: 'duty' },
  globals: { viewport: 'mobile320' },
};
