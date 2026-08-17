<script setup lang="ts">
import { reactive, ref } from 'vue';

import CompactSwitch from '../../components/CompactSwitch.vue';

withDefaults(
  defineProps<{
    readonly layout?: 'mobile-320' | 'mobile-390';
  }>(),
  { layout: 'mobile-390' },
);

const switches = reactive({ changesOnly: true, notifications: false });
const checked = ref(true);
const radio = ref<'month' | 'week'>('month');
</script>

<template>
  <main class="foundation-preview" :class="`layout-${layout}`">
    <header class="preview-heading">
      <div>
        <span class="context-label">P1 · 原生复刻基线</span>
        <h1>基础控件</h1>
        <p>沿用 Web 已确认的排班密度与状态语义，不使用小程序默认组件外观。</p>
      </div>
      <span class="baseline-chip">待确认</span>
    </header>

    <section class="preview-card action-card" aria-labelledby="actions-heading">
      <header>
        <h2 id="actions-heading">操作层级</h2>
        <span>44px 触控区</span>
      </header>
      <div class="button-grid">
        <button type="button" class="ui-button primary">发布排班</button>
        <button type="button" class="ui-button secondary">保存草稿</button>
        <button type="button" class="ui-button danger">撤回发布</button>
        <button type="button" class="ui-button secondary" disabled>正在保存…</button>
      </div>
    </section>

    <section class="preview-card settings-card" aria-labelledby="switches-heading">
      <header>
        <h2 id="switches-heading">紧凑开关</h2>
        <span>本体 52×30</span>
      </header>
      <div class="setting-row">
        <button
          type="button"
          class="setting-copy"
          @click="switches.changesOnly = !switches.changesOnly"
        >
          <strong>仅显示有变更的班次</strong>
          <small>收起没有换班、请假或加扣班记录的日期。</small>
        </button>
        <CompactSwitch v-model="switches.changesOnly" label="仅显示有变更的班次" />
      </div>
      <div class="setting-row">
        <button
          type="button"
          class="setting-copy"
          @click="switches.notifications = !switches.notifications"
        >
          <strong>微信值班提醒</strong>
          <small>关闭状态保留中性灰，不使用 TDesign 默认绿色。</small>
        </button>
        <CompactSwitch v-model="switches.notifications" label="微信值班提醒" />
      </div>
      <div class="setting-row is-disabled">
        <div class="setting-copy" aria-hidden="true">
          <strong>长期订阅消息</strong>
          <small>模板资格尚未开放时不可操作。</small>
        </div>
        <CompactSwitch :model-value="false" label="长期订阅消息" disabled />
      </div>
    </section>

    <section class="preview-card selection-card" aria-labelledby="selection-heading">
      <header>
        <h2 id="selection-heading">选择与字段</h2>
        <span>清晰焦点</span>
      </header>
      <div class="choice-row">
        <button
          type="button"
          class="choice-control"
          role="checkbox"
          :aria-checked="checked"
          @click="checked = !checked"
        >
          <span class="checkbox-mark" :class="{ checked }">{{ checked ? '✓' : '' }}</span>
          <span>已核对联系方式</span>
        </button>
        <div class="radio-group" role="radiogroup" aria-label="默认日历视图">
          <button
            v-for="option in ['month', 'week'] as const"
            :key="option"
            type="button"
            class="choice-control"
            role="radio"
            :aria-checked="radio === option"
            @click="radio = option"
          >
            <span class="radio-mark" :class="{ checked: radio === option }" />
            <span>{{ option === 'month' ? '月视图' : '周视图' }}</span>
          </button>
        </div>
      </div>
      <label class="field-shell">
        <span>模板名称</span>
        <input value="十月头颈外科值班" aria-label="模板名称" />
      </label>
      <button type="button" class="field-shell picker-shell">
        <span>应用日期</span>
        <strong>2026-10-01 至 2026-10-30</strong>
        <span aria-hidden="true">›</span>
      </button>
    </section>

    <section class="preview-card status-card" aria-labelledby="status-heading">
      <header>
        <h2 id="status-heading">状态反馈</h2>
        <span>只表达业务</span>
      </header>
      <div class="chip-row">
        <span class="status-chip primary">草稿</span>
        <span class="status-chip success">已发布</span>
        <span class="status-chip warning">待确认</span>
        <span class="status-chip danger">有冲突</span>
      </div>
      <div class="inline-alert" role="alert">
        <strong>发现 2 个排班冲突</strong>
        <span>查看冲突成员后再发布，本次编辑仍保留。</span>
      </div>
    </section>
  </main>
</template>

<style scoped>
:global(body) {
  min-width: 0;
}

.foundation-preview {
  min-height: 100vh;
  box-sizing: border-box;
  padding: 20px 14px 36px;
  color: var(--ui-color-text-primary);
  background: var(--ui-color-background);
  font-family: var(--ui-font-family-system);
}

.preview-heading {
  display: flex;
  margin-bottom: 14px;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.preview-heading h1,
.preview-heading p,
.preview-card h2 {
  margin: 0;
}

.context-label {
  color: var(--ui-color-primary);
  font-size: var(--ui-font-size-xs);
  font-weight: var(--ui-font-weight-strong);
  letter-spacing: 0.04em;
}

.preview-heading h1 {
  margin-top: 3px;
  font-size: var(--ui-font-size-xxl);
  line-height: var(--ui-line-height-title);
}

.preview-heading p {
  max-width: 280px;
  margin-top: 6px;
  color: var(--ui-color-text-secondary);
  font-size: var(--ui-font-size-sm);
  line-height: var(--ui-line-height-normal);
}

.baseline-chip {
  flex: none;
  padding: 5px 9px;
  color: var(--ui-color-warning);
  background: var(--ui-color-warning-light);
  border-radius: var(--ui-radius-pill);
  font-size: var(--ui-font-size-xs);
  font-weight: var(--ui-font-weight-semibold);
}

.preview-card {
  overflow: hidden;
  background: var(--ui-color-surface);
  border: 1px solid var(--ui-color-border);
  border-radius: var(--ui-radius-medium);
  box-shadow: var(--ui-shadow-card);
}

.preview-card + .preview-card {
  margin-top: 12px;
}

.preview-card > header {
  display: flex;
  min-height: 44px;
  padding: 0 13px;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  background: var(--ui-color-surface-muted);
  border-bottom: 1px solid var(--ui-color-border);
}

.preview-card h2 {
  font-size: var(--ui-font-size-md);
  font-weight: var(--ui-font-weight-semibold);
}

.preview-card > header span {
  color: var(--ui-color-text-muted);
  font-size: var(--ui-font-size-xs);
}

.button-grid {
  display: grid;
  padding: 13px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 9px;
}

.ui-button {
  min-height: var(--ui-touch-target-minimum);
  padding: 0 14px;
  border: 1px solid transparent;
  border-radius: var(--ui-radius-small);
  cursor: pointer;
  font: inherit;
  font-size: var(--ui-font-size-sm);
  font-weight: var(--ui-font-weight-semibold);
}

.ui-button.primary {
  color: var(--ui-color-white);
  background: var(--ui-color-primary);
  box-shadow: var(--ui-shadow-primary);
}

.ui-button.secondary {
  color: var(--ui-color-primary-dark);
  background: var(--ui-color-surface);
  border-color: var(--ui-color-primary-border);
}

.ui-button.danger {
  color: var(--ui-color-danger);
  background: var(--ui-color-danger-light);
  border-color: rgb(217 45 32 / 18%);
}

.ui-button:disabled {
  color: var(--ui-color-text-muted);
  background: var(--ui-color-surface-muted);
  border-color: var(--ui-color-border);
  cursor: not-allowed;
  opacity: 0.72;
}

.setting-row {
  display: grid;
  min-height: 68px;
  margin: 0 13px;
  grid-template-columns: minmax(0, 1fr) 60px;
  align-items: center;
  gap: 8px;
}

.setting-row + .setting-row {
  border-top: 1px solid var(--ui-color-border);
}

.setting-row.is-disabled {
  opacity: 0.58;
}

.setting-copy {
  display: grid;
  min-width: 0;
  min-height: 44px;
  padding: 7px 0;
  align-content: center;
  gap: 3px;
  color: inherit;
  background: transparent;
  border: 0;
  font: inherit;
  text-align: left;
}

button.setting-copy {
  cursor: pointer;
}

.setting-copy strong {
  font-size: var(--ui-font-size-sm);
}

.setting-copy small {
  color: var(--ui-color-text-muted);
  font-size: var(--ui-font-size-xs);
  line-height: 1.4;
}

.choice-row {
  display: grid;
  padding: 13px 13px 4px;
  gap: 8px;
}

.choice-control {
  display: flex;
  min-height: var(--ui-touch-target-minimum);
  align-items: center;
  gap: 9px;
  color: inherit;
  background: transparent;
  border: 0;
  cursor: pointer;
  font: inherit;
  font-size: var(--ui-font-size-sm);
}

.radio-group {
  display: flex;
  gap: 16px;
}

.checkbox-mark,
.radio-mark {
  display: grid;
  width: 22px;
  height: 22px;
  flex: none;
  box-sizing: border-box;
  place-items: center;
  color: var(--ui-color-white);
  background: var(--ui-color-surface);
  border: 2px solid var(--ui-color-border-strong);
  font-size: 14px;
  font-weight: 800;
}

.checkbox-mark {
  border-radius: 6px;
}

.radio-mark {
  border-radius: 50%;
}

.checkbox-mark.checked {
  background: var(--ui-color-primary);
  border-color: var(--ui-color-primary);
}

.radio-mark.checked {
  border: 6px solid var(--ui-color-primary);
}

.field-shell {
  display: grid;
  min-height: 58px;
  margin: 8px 13px 13px;
  padding: 7px 11px;
  box-sizing: border-box;
  align-content: center;
  gap: 3px;
  color: inherit;
  background: var(--ui-color-surface);
  border: 1px solid var(--ui-color-border-strong);
  border-radius: var(--ui-radius-small);
  font: inherit;
  text-align: left;
}

.field-shell + .field-shell {
  margin-top: -5px;
}

.field-shell > span:first-child {
  color: var(--ui-color-text-muted);
  font-size: var(--ui-font-size-xs);
}

.field-shell input {
  min-width: 0;
  padding: 0;
  color: var(--ui-color-text-primary);
  background: transparent;
  border: 0;
  outline: 0;
  font: inherit;
  font-size: var(--ui-font-size-sm);
}

.picker-shell {
  width: calc(100% - 26px);
  grid-template-columns: minmax(0, 1fr) auto;
  cursor: pointer;
}

.picker-shell > span:first-child {
  grid-column: 1 / -1;
}

.picker-shell strong {
  overflow: hidden;
  font-size: var(--ui-font-size-sm);
  font-weight: var(--ui-font-weight-medium);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chip-row {
  display: flex;
  padding: 13px;
  flex-wrap: wrap;
  gap: 7px;
}

.status-chip {
  padding: 4px 8px;
  border-radius: var(--ui-radius-pill);
  font-size: var(--ui-font-size-xs);
  font-weight: var(--ui-font-weight-semibold);
}

.status-chip.primary {
  color: var(--ui-color-primary-dark);
  background: var(--ui-color-primary-light);
}

.status-chip.success {
  color: var(--ui-color-success);
  background: var(--ui-color-success-light);
}

.status-chip.warning {
  color: var(--ui-color-warning);
  background: var(--ui-color-warning-light);
}

.status-chip.danger {
  color: var(--ui-color-danger);
  background: var(--ui-color-danger-light);
}

.inline-alert {
  display: grid;
  margin: 0 13px 13px;
  padding: 10px 11px;
  gap: 2px;
  color: var(--ui-color-danger);
  background: var(--ui-color-danger-light);
  border-left: 3px solid var(--ui-color-danger);
  border-radius: 8px;
}

.inline-alert strong {
  font-size: var(--ui-font-size-sm);
}

.inline-alert span {
  font-size: var(--ui-font-size-xs);
  line-height: 1.45;
}

button:focus-visible,
input:focus-visible {
  outline: 3px solid var(--ui-color-focus-ring);
  outline-offset: 2px;
}

.layout-mobile-320 {
  padding-inline: 10px;
}

.layout-mobile-320 .preview-heading p {
  max-width: 228px;
}

.layout-mobile-320 .button-grid {
  grid-template-columns: minmax(0, 1fr);
}

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    scroll-behavior: auto !important;
    transition: none !important;
  }
}
</style>
