<script setup lang="ts">
import { defineComponent, h, ref } from 'vue';
import pageStyles from '../../../../miniprogram/src/subpackages/insights/pages/external-duty/index.wxss?raw';
import buttonStyles from '../../../../miniprogram/src/components/ui/ui-button/index.wxss?raw';
import sheetStyles from '../../../../miniprogram/src/components/ui/ui-sheet/index.wxss?raw';
import tokens from '../../../../../packages/ui-tokens/src/tokens.css?raw';
import backIcon from '../../../../miniprogram/src/assets/icons/ui-chevron-left.svg';

const props = withDefaults(
  defineProps<{
    state?: 'ready' | 'empty' | 'error' | 'preview' | 'history' | 'restore' | 'conflict';
    largeText?: boolean;
  }>(),
  { state: 'ready', largeText: false },
);
const history = ref(props.state === 'history' || props.state === 'restore');
const dialog = ref(['preview', 'restore', 'conflict'].includes(props.state));
const restoring = ref(props.state === 'restore');
const rows = [
  { date: '2026-10-12', before: '甲医生', after: '乙医生' },
  { date: '2026-10-13', before: '乙医生', after: '甲医生' },
];
const GoldenButton = defineComponent({
  props: {
    label: { type: String, default: '' },
    variant: { type: String, default: 'secondary' },
    disabled: Boolean,
  },
  emits: ['press'],
  setup:
    (button, { emit }) =>
    () =>
      h(
        'ui-button',
        {},
        h(
          'button',
          {
            class: [
              'ui-button',
              `ui-button--${button.variant}`,
              { 'is-inactive': button.disabled },
            ],
            disabled: button.disabled,
            onClick: () => emit('press'),
          },
          button.label,
        ),
      ),
});
function open(restore = false) {
  restoring.value = restore;
  dialog.value = true;
}
</script>

<template>
  <component :is="'style'">{{ tokens + pageStyles + buttonStyles + sheetStyles }}</component>
  <main class="duty-page golden-duty" :class="{ 'is-large-text': largeText }">
    <header class="duty-header" style="height: 76px; padding-top: 24px; padding-right: 102px">
      <button class="duty-back" aria-label="返回更多">
        <img :src="backIcon" width="20" height="20" alt="" />
      </button>
      <span class="duty-title">排班网页校对</span>
    </header>
    <div class="duty-scroll">
      <div class="duty-content">
        <section class="duty-overview">
          <div class="duty-overview-top">
            <div class="duty-overview-copy">
              <span class="duty-group">头颈外科医生</span
              ><span class="duty-muted">一线 · 全天班</span>
            </div>
            <GoldenButton variant="primary" label="立即检测" />
          </div>
          <span class="duty-description"
            >仅核对今天起已发布、且网页有排班的日期。同步前需你确认。</span
          >
          <span class="duty-checked">上次自动检测 09-28 23:00 · 北京时间</span>
        </section>
        <div class="duty-tabs">
          <button class="duty-tab" :class="{ 'is-active': !history }" @click="history = false">
            <span>待处理</span
            ><span class="duty-count">{{ state === 'empty' ? 0 : 2 }}</span></button
          ><button class="duty-tab" :class="{ 'is-active': history }" @click="history = true">
            <span>操作记录</span><span class="duty-count">1</span>
          </button>
        </div>
        <div v-if="state === 'error'" class="duty-note is-danger">
          <strong>操作未完成</strong><span>网页暂时无法读取，请稍后重新检测。</span>
        </div>
        <template v-if="history">
          <span class="duty-history-intro">查看同步进度，或将某次操作恢复为最新发布基线。</span>
          <section class="duty-card">
            <div class="duty-card-top">
              <span class="duty-date">2026-10-12</span><span class="duty-badge">已执行</span>
            </div>
            <span class="duty-source">同步到本系统</span>
            <div class="duty-change">
              <span class="duty-before">甲医生</span><span class="duty-arrow">→</span
              ><span class="duty-after">乙医生</span>
            </div>
            <span class="duty-muted">操作时发布基线：甲医生</span>
            <div class="duty-card-actions">
              <GoldenButton label="恢复发布基线" @press="open(true)" />
            </div>
          </section>
        </template>
        <div v-else-if="state === 'empty'" class="duty-empty">
          <span class="duty-empty-title">暂无待处理差异</span
          ><span class="duty-muted">检测范围内没有待处理差异。</span>
        </div>
        <template v-else>
          <section v-for="row in rows" :key="row.date" class="duty-card">
            <div class="duty-card-top">
              <span class="duty-date">{{ row.date }}</span
              ><span class="duty-badge">待确认</span>
            </div>
            <span class="duty-source">网页端有变化</span>
            <div class="duty-people">
              <div class="duty-person is-changed">
                <span class="duty-person-label">网页</span
                ><span class="duty-person-name">{{ row.after }}</span>
              </div>
              <div class="duty-person is-baseline">
                <span class="duty-person-label">发布基线</span
                ><span class="duty-person-name">{{ row.before }}</span>
              </div>
              <div class="duty-person">
                <span class="duty-person-label">本系统</span
                ><span class="duty-person-name">{{ row.before }}</span>
              </div>
            </div>
            <div class="duty-note">
              <span class="duty-note-title">建议换班</span
              ><span>涉及 1 步交换，查看完整方案后确认。</span>
            </div>
            <div class="duty-card-actions">
              <GoldenButton variant="primary" label="预览建议" @press="open()" />
            </div>
          </section>
        </template>
        <span class="duty-footer">一致日期自动隐藏 · 每分钟检测一次</span>
      </div>
    </div>
    <div v-if="dialog" class="ui-sheet__layer is-visible no-enter-animation">
      <div class="ui-sheet__scrim" @click="dialog = false"></div>
      <section
        class="ui-sheet__panel is-content-sized"
        style="height: auto; max-height: 90vh"
        role="dialog"
        :aria-label="restoring ? '恢复发布基线' : '换班预览'"
      >
        <div class="ui-sheet__handle-region"><div class="ui-sheet__handle"></div></div>
        <div class="ui-sheet__header">
          <span class="ui-sheet__title">{{ restoring ? '恢复发布基线' : '换班预览' }}</span
          ><button class="ui-sheet__close" @click="dialog = false">取消</button>
        </div>
        <div class="ui-sheet__content">
          <div class="duty-confirm" :class="{ 'is-large-text': largeText }">
            <div class="duty-confirm-scroll">
              <span class="duty-description">{{
                restoring
                  ? '将本系统恢复为最新正式发布版本的人员，覆盖当前值。确认后仍需通过原业务校验。'
                  : '按以下顺序执行完整换班方案，每步重新校验。中途失败时请查看最新记录；实际排班一致后才会移出列表。'
              }}</span>
              <div class="duty-changes">
                <div
                  v-for="row in restoring ? rows.slice(0, 1) : rows"
                  :key="row.date"
                  class="duty-change-row"
                >
                  <span class="duty-change-date">{{ row.date }}</span>
                  <div class="duty-change">
                    <span class="duty-before">{{ restoring ? row.after : row.before }}</span
                    ><span class="duty-arrow">→</span
                    ><span class="duty-after">{{ restoring ? row.before : row.after }}</span>
                  </div>
                </div>
              </div>
              <div v-if="!restoring" class="duty-note">
                <span class="duty-note-title">换班步骤 · 1 步</span
                ><span>1. 2026-10-12 与 2026-10-13 交换</span>
              </div>
              <div v-if="state === 'conflict'" class="duty-note is-danger">
                <span class="duty-note-title">请先解决以下冲突</span><span>同一时间有其他班次</span>
              </div>
            </div>
            <div class="duty-confirm-actions">
              <GoldenButton label="取消" @press="dialog = false" /><GoldenButton
                :variant="restoring ? 'danger' : 'primary'"
                :label="restoring ? '确认恢复' : '确认方案'"
                :disabled="state === 'conflict'"
                @press="dialog = false"
              />
            </div>
          </div>
        </div>
      </section>
    </div>
  </main>
</template>

<style>
.golden-duty {
  font-family: var(--ui-font-family-system);
}
.golden-duty button {
  appearance: none;
  margin: 0;
  font-family: inherit;
  cursor: pointer;
}
.golden-duty .duty-back,
.golden-duty .duty-tab,
.golden-duty .ui-sheet__close {
  border: 0;
  background: transparent;
}
.golden-duty .duty-tab.is-active {
  background: var(--ui-color-surface);
}
.golden-duty .duty-back img {
  display: block;
}
.golden-duty .duty-scroll,
.golden-duty .duty-confirm-scroll {
  overflow-y: auto;
}
.golden-duty .ui-button {
  width: 100%;
  box-sizing: border-box;
}
</style>
