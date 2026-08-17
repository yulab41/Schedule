import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { ref } from 'vue';

import TemporalPicker from './TemporalPicker.vue';

const meta = {
  title: 'Web UI 2.0/Components/Temporal Picker',
  component: TemporalPicker,
  tags: ['autodocs'],
  args: {
    kind: 'month',
    label: '排班月份',
    modelValue: '2026-08',
  },
  argTypes: {
    kind: { control: 'radio', options: ['month', 'date', 'time'] },
  },
  parameters: {
    docs: {
      description: {
        component: '已落地的统一时间选择组件：手机使用底部弹层，桌面使用输入旁浮层。',
      },
    },
  },
  render: (args) => ({
    components: { TemporalPicker },
    setup() {
      const value = ref(args.modelValue);
      return { args, value };
    },
    template: `
      <main style="box-sizing:border-box;min-height:100vh;padding:24px;background:#f4f7fb;font-family:'PingFang SC','SF Pro Text',sans-serif">
        <section style="width:min(100%,360px);padding:18px;background:#fff;border:1px solid #dce3eb;border-radius:18px;box-shadow:0 12px 30px rgb(22 32 42 / 8%)">
          <label style="display:grid;gap:8px;color:#16202a;font-size:14px;font-weight:650">
            {{ args.label }}
            <TemporalPicker
              v-model="value"
              :clearable="args.clearable"
              :compact="args.compact"
              :disabled="args.disabled"
              :kind="args.kind"
              :label="args.label"
              :max="args.max"
              :min="args.min"
              :minute-step="args.minuteStep"
              :placeholder="args.placeholder"
              :required="args.required"
            />
          </label>
          <output style="display:block;margin-top:12px;color:#66778a;font-size:12px;font-variant-numeric:tabular-nums">当前值：{{ value || '未设置' }}</output>
        </section>
      </main>
    `,
  }),
} satisfies Meta<typeof TemporalPicker>;

export default meta;
type Story = StoryObj<typeof meta>;

export const MobileMonth390: Story = {
  name: '1 · 生产组件 · 月份 · 390px',
  globals: { viewport: 'mobile390' },
};

export const MobileDate320: Story = {
  name: '2 · 生产组件 · 日期 · 320px',
  args: {
    kind: 'date',
    label: '开始日期',
    min: '2026-01-01',
    modelValue: '2026-08-17',
  },
  globals: { viewport: 'mobile320' },
};

export const MobileTime390: Story = {
  name: '3 · 生产组件 · 时间 · 390px',
  args: {
    clearable: true,
    compact: true,
    kind: 'time',
    label: '开始时间',
    minuteStep: 15,
    modelValue: '08:00',
  },
  globals: { viewport: 'mobile390' },
};

export const DesktopMonth1280: Story = {
  name: '4 · 生产组件 · 月份 · 1280px',
  globals: { viewport: 'desktop1280' },
};
