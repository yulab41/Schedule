<script setup lang="ts">
import { computed, ref, watch } from 'vue';

import Ui2Icon, { type Ui2IconName } from './Ui2Icon.vue';
import Ui2MonthCalendar from './Ui2MonthCalendar.vue';

export type WorkbenchRefinementLayout = 'desktop' | 'mobile';
export type WorkbenchRefinementScreen = 'calendar' | 'duty' | 'login' | 'swap';

const props = withDefaults(
  defineProps<{
    readonly layout?: WorkbenchRefinementLayout;
    readonly longGroupName?: boolean;
    readonly openGroupMenu?: boolean;
    readonly screen?: WorkbenchRefinementScreen;
  }>(),
  { layout: 'mobile', longGroupName: false, openGroupMenu: false, screen: 'calendar' },
);

const selectedDay = ref(14);
const groupName = computed(() =>
  props.longGroupName ? '头颈外科与颅底肿瘤联合诊疗医生组' : '头颈外科医生',
);
const previewGroups = computed(() => [
  { id: 'doctor', name: groupName.value, role: '群主' },
  { id: 'nurse', name: '头颈外科护士', role: '成员' },
]);
const selectedGroupId = ref('doctor');
const isGroupMenuOpen = ref(props.openGroupMenu);
const selectedPreviewGroup = computed(
  () =>
    previewGroups.value.find((group) => group.id === selectedGroupId.value) ??
    previewGroups.value[0],
);
const selectedGroupName = computed(() => selectedPreviewGroup.value?.name ?? groupName.value);
const selectedGroupRole = computed(() => selectedPreviewGroup.value?.role ?? '成员');

watch(
  () => props.openGroupMenu,
  (value) => {
    isGroupMenuOpen.value = value;
  },
);

function toggleGroupMenu(): void {
  isGroupMenuOpen.value = !isGroupMenuOpen.value;
}

function selectPreviewGroup(groupId: string): void {
  selectedGroupId.value = groupId;
  isGroupMenuOpen.value = false;
}

const pageTitle = computed(() => {
  if (props.screen === 'swap') return '换班';
  if (props.screen === 'duty') return '加扣班';
  return '工作台';
});

const activeNav = computed(() => {
  if (props.screen === 'swap') return 'swap';
  if (props.screen === 'duty') return 'duty';
  return 'calendar';
});

const navItems: readonly { icon: Ui2IconName; id: string; label: string }[] = [
  { id: 'calendar', label: '排班日历', icon: 'calendar' },
  { id: 'leave', label: '请假', icon: 'leave' },
  { id: 'swap', label: '换班', icon: 'swap' },
  { id: 'duty', label: '加扣班', icon: 'adjustment' },
  { id: 'more', label: '更多', icon: 'more' },
];
</script>

<template>
  <div class="preview-stage" :class="[`is-${layout}`, `screen-${screen}`]">
    <main v-if="screen === 'login'" class="login-preview" aria-label="登录页与备案页脚精修预览">
      <section class="login-shell">
        <div class="brand-mark" aria-hidden="true"><span /><span /></div>
        <p class="eyebrow">医护排班</p>
        <h1>清楚掌握每一次值班</h1>
        <p class="login-intro">登录后查看所在群组的排班、请假和班次变更。</p>

        <div class="segmented login-segmented" role="tablist" aria-label="登录或注册">
          <button class="is-active" type="button" role="tab" aria-selected="true">登录</button>
          <button type="button" role="tab" aria-selected="false">注册</button>
        </div>

        <form class="login-card" @submit.prevent>
          <label>
            <span>账号</span>
            <span class="input-shell"><Ui2Icon name="user" />3–64 位字母、数字或 ._-</span>
          </label>
          <label>
            <span>密码</span>
            <span class="input-shell"><span aria-hidden="true">▣</span>请输入密码</span>
          </label>
          <button class="primary-action" type="submit">进入工作台</button>
          <button class="secondary-action" type="button">访客查看排班</button>
        </form>
        <p class="privacy-note">账号只用于排班身份识别。联系信息仅对有权限的群组成员可见。</p>
      </section>

      <footer class="filing-footer">
        <a
          class="filing-link"
          href="https://beian.miit.gov.cn/"
          rel="noopener noreferrer"
          target="_blank"
          >粤ICP备2026116116号-1</a
        >
      </footer>
    </main>

    <main v-else class="app-preview" aria-label="紧凑工作台精修预览">
      <header class="workbench-header">
        <div class="workbench-title-block">
          <div class="group-heading-row">
            <span class="group-identity">{{ selectedGroupName }} · {{ selectedGroupRole }}</span>
            <button
              class="group-menu-action"
              type="button"
              role="combobox"
              aria-label="展开排班群组列表"
              aria-haspopup="listbox"
              :aria-expanded="isGroupMenuOpen"
              aria-controls="preview-group-menu"
              @click="toggleGroupMenu"
            >
              <span
                class="group-menu-arrow"
                :class="{ 'is-open': isGroupMenuOpen }"
                aria-hidden="true"
              />
            </button>
            <div
              v-if="isGroupMenuOpen"
              id="preview-group-menu"
              class="group-menu-list"
              role="listbox"
              aria-label="可用排班群组"
            >
              <button
                v-for="group in previewGroups"
                :key="group.id"
                class="group-menu-option"
                type="button"
                role="option"
                :aria-selected="group.id === selectedGroupId"
                @click="selectPreviewGroup(group.id)"
              >
                <span class="group-menu-option-copy">
                  <span>{{ group.name }}</span>
                  <small>{{ group.role }}</small>
                </span>
                <span v-if="group.id === selectedGroupId" aria-hidden="true">✓</span>
              </button>
            </div>
          </div>
          <h1>{{ pageTitle }}</h1>
        </div>
        <div class="header-actions">
          <button type="button" aria-label="通知"><Ui2Icon name="bell" /><i /></button>
          <button class="export-action" type="button" aria-label="导出排班">
            <span aria-hidden="true">↗</span><span>导出</span>
          </button>
        </div>
      </header>

      <div class="workspace">
        <aside v-if="layout === 'desktop'" class="desktop-nav" aria-label="桌面导航预览">
          <button
            v-for="item in navItems"
            :key="item.id"
            type="button"
            :class="{ 'is-active': item.id === activeNav }"
          >
            <Ui2Icon :name="item.icon" />
            <span>{{ item.label }}</span>
          </button>
        </aside>

        <section class="workspace-main">
          <template v-if="screen === 'calendar'">
            <div class="view-toolbar">
              <div class="segmented view-segmented" role="tablist" aria-label="日历视图">
                <button class="is-active" type="button" role="tab" aria-selected="true">月</button>
                <button type="button" role="tab" aria-selected="false">周</button>
                <button type="button" role="tab" aria-selected="false">列表</button>
              </div>
              <button class="filter-action" type="button">
                <Ui2Icon name="filter" /><span>筛选</span>
              </button>
            </div>

            <Ui2MonthCalendar
              scenario="october-holiday"
              :selected-day="selectedDay"
              @select="selectedDay = $event"
            />

            <section class="selected-summary" aria-live="polite">
              <div class="summary-date">
                <strong>10 月 {{ selectedDay }} 日</strong>
                <span>已选择日期</span>
              </div>
              <div class="summary-person">
                <span class="shift-dot" />
                <span><b>早班</b> 林恩宇</span>
              </div>
              <button type="button" class="text-action">查看完整值班</button>
            </section>
          </template>

          <template v-else>
            <section class="panel-heading">
              <div>
                <p>
                  {{
                    screen === 'swap'
                      ? '交换双方已发布班次，并跟踪接受与审批状态。'
                      : '安排成员代值已发布班次，并跟踪接受与审批状态。'
                  }}
                </p>
              </div>
              <button class="primary-action compact" type="button">
                {{ screen === 'swap' ? '发起换班' : '发起加扣班' }}
              </button>
            </section>

            <label class="setting-card">
              <input type="checkbox" :checked="screen === 'swap'" />
              <span>{{ screen === 'swap' ? '自动接受换班' : '自动接受换班/加扣班' }}</span>
            </label>
            <h2 class="records-heading">
              {{ screen === 'swap' ? '我的换班申请（1）' : '我的加扣班记录（1）' }}
            </h2>
            <article class="record-card">
              <dl>
                <dt>对方</dt>
                <dd>林恩宇</dd>
                <dt>班次</dt>
                <dd>
                  {{
                    screen === 'swap'
                      ? '08-10 08:00–08:00 ↔ 08-22 08:00–08:00'
                      : '08-10 08:00–08:00'
                  }}
                </dd>
                <dt>状态</dt>
                <dd><span class="status-pill">已撤销</span></dd>
              </dl>
            </article>
          </template>
        </section>
      </div>

      <nav v-if="layout === 'mobile'" class="bottom-nav" aria-label="手机导航预览">
        <button
          v-for="item in navItems"
          :key="item.id"
          type="button"
          :class="{ 'is-active': item.id === activeNav }"
        >
          <Ui2Icon :name="item.icon" /><span>{{ item.label }}</span>
        </button>
      </nav>
    </main>
  </div>
</template>

<style scoped>
.preview-stage {
  --ui2-primary: #0a66d5;
  --ui2-primary-dark: #084fa6;
  --ui2-primary-tint: #eaf3ff;
  --ui2-canvas: #f4f7fb;
  --ui2-surface: #fff;
  --ui2-surface-muted: #f8fafc;
  --ui2-text-primary: #16202a;
  --ui2-text-secondary: #5e6a78;
  --ui2-text-muted: #6b7785;
  --ui2-border: #dce3eb;
  --ui2-success: #248a3d;
  --ui2-success-tint: #eaf8ef;
  --ui2-warning: #b86a00;
  --ui2-warning-tint: #fff4d6;
  --ui2-danger: #d92d20;
  --ui2-danger-tint: #fdecea;
  --ui2-radius-sm: 10px;
  --ui2-radius-md: 14px;
  --ui2-radius-lg: 18px;
  --ui2-shadow-card: 0 8px 24px rgb(22 32 42 / 7%);
  min-height: 100vh;
  color: var(--ui2-text-primary);
  background: var(--ui2-canvas);
  font-family:
    -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'PingFang SC', 'Segoe UI', 'Microsoft YaHei',
    sans-serif;
}

button,
input {
  font: inherit;
}

button:focus-visible,
a:focus-visible {
  outline: 3px solid rgb(10 102 213 / 25%);
  outline-offset: 2px;
}

.app-preview,
.login-preview {
  min-height: 100vh;
  background: var(--ui2-canvas);
}

.app-preview {
  display: flex;
  flex-direction: column;
}

.workbench-header {
  position: sticky;
  z-index: 5;
  top: 0;
  display: flex;
  min-height: calc(68px + env(safe-area-inset-top));
  padding: calc(12px + env(safe-area-inset-top)) 16px 10px;
  align-items: flex-end;
  justify-content: space-between;
  gap: 10px;
  background: rgb(255 255 255 / 94%);
  border-bottom: 1px solid var(--ui2-border);
  backdrop-filter: blur(20px);
}

.workbench-title-block {
  min-width: 0;
  flex: 1;
}

.group-heading-row,
.header-actions,
.workbench-header button,
.filter-action {
  display: flex;
  align-items: center;
}

.group-heading-row {
  position: relative;
  width: fit-content;
  display: flex;
  min-width: 0;
  max-width: 100%;
  min-height: 44px;
  align-items: center;
  gap: 0;
}

.group-identity {
  display: block;
  min-width: 0;
  overflow: hidden;
  color: var(--ui2-text-secondary);
  font-size: 15px;
  font-weight: 650;
  line-height: 1.35;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.group-menu-action {
  width: 36px;
  min-width: 36px;
  min-height: 44px;
  padding: 0;
  flex: 0 0 auto;
  justify-content: center;
  color: inherit;
  background: transparent;
  border: 0;
  border-radius: 10px;
  cursor: pointer;
}

.group-menu-action:hover,
.group-menu-action:focus-visible,
.group-menu-action[aria-expanded='true'] {
  color: var(--ui2-primary);
  background: transparent;
}

.group-menu-action:focus-visible {
  outline: 2px solid rgb(10 102 213 / 35%);
  outline-offset: 1px;
}

.group-menu-arrow {
  width: 9px;
  height: 9px;
  flex: 0 0 auto;
  border-right: 2px solid currentColor;
  border-bottom: 2px solid currentColor;
  transform: translateY(-2px) rotate(45deg);
  transition: transform 120ms ease;
}

.group-menu-arrow.is-open {
  transform: translateY(2px) rotate(225deg);
}

.group-menu-list {
  position: absolute;
  z-index: 10;
  top: calc(100% + 8px);
  left: 0;
  width: max(100%, 216px);
  max-width: min(320px, calc(100vw - 24px));
  padding: 4px;
  background: var(--ui2-surface);
  border: 1px solid var(--ui2-border);
  border-radius: 14px;
  box-shadow: 0 16px 40px rgb(22 32 42 / 14%);
}

.group-menu-option {
  display: flex;
  width: 100%;
  min-height: 44px;
  padding: 8px 12px;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  color: var(--ui2-text-primary);
  background: transparent;
  border: 0;
  border-radius: 10px;
  cursor: pointer;
  text-align: left;
}

.group-menu-option:hover,
.group-menu-option[aria-selected='true'] {
  color: var(--ui2-primary);
  background: var(--ui2-primary-tint);
}

.group-menu-option-copy {
  display: grid;
  min-width: 0;
  gap: 2px;
}

.group-menu-option-copy span {
  overflow: hidden;
  font-size: 13px;
  font-weight: 650;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.group-menu-option-copy small {
  color: var(--ui2-text-secondary);
  font-size: 11px;
}

.workbench-title-block h1 {
  margin: 2px 0 0;
  font-size: 20px;
  line-height: 1.25;
  letter-spacing: -0.25px;
}

.header-actions {
  flex: 0 0 auto;
  gap: 8px;
}

.header-actions button {
  position: relative;
  min-width: 44px;
  min-height: 44px;
  justify-content: center;
  color: var(--ui2-text-primary);
  background: var(--ui2-surface-muted);
  border: 0;
  border-radius: 15px;
}

.header-actions button i {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 7px;
  height: 7px;
  background: #d92d20;
  border: 2px solid #fff;
  border-radius: 50%;
}

.export-action {
  padding-inline: 12px;
  color: var(--ui2-primary) !important;
  background: var(--ui2-surface) !important;
  border: 1px solid var(--ui2-border) !important;
  font-size: 13px;
  font-weight: 650;
  gap: 4px;
}

.workspace {
  display: flex;
  width: min(100%, 1280px);
  margin: 0 auto;
  padding: 20px 24px 28px;
  align-items: flex-start;
  gap: 20px;
}

.desktop-nav {
  position: sticky;
  top: 88px;
  display: grid;
  width: 188px;
  padding: 8px;
  flex: 0 0 auto;
  gap: 4px;
  background: var(--ui2-surface);
  border: 1px solid var(--ui2-border);
  border-radius: 18px;
  box-shadow: 0 8px 24px rgb(22 32 42 / 7%);
}

.desktop-nav button {
  display: flex;
  min-height: 44px;
  padding: 0 12px;
  align-items: center;
  gap: 10px;
  color: var(--ui2-text-secondary);
  background: transparent;
  border: 0;
  border-radius: 10px;
}

.desktop-nav button.is-active {
  color: var(--ui2-primary);
  background: var(--ui2-primary-tint);
  font-weight: 650;
}

.workspace-main {
  min-width: 0;
  flex: 1;
}

.view-toolbar {
  display: grid;
  margin-bottom: 14px;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
}

.segmented {
  display: grid;
  padding: 3px;
  background: #e8edf3;
  border-radius: 14px;
}

.segmented button {
  min-height: 44px;
  padding: 0 12px;
  color: var(--ui2-text-secondary);
  background: transparent;
  border: 0;
  border-radius: 11px;
  font-size: 13px;
  font-weight: 650;
}

.segmented button.is-active {
  color: var(--ui2-text-primary);
  background: #fff;
  box-shadow: 0 2px 8px rgb(22 32 42 / 9%);
}

.view-segmented {
  grid-template-columns: repeat(3, 1fr);
}

.filter-action {
  min-height: 44px;
  padding: 0 12px;
  justify-content: center;
  gap: 5px;
  color: var(--ui2-primary);
  background: #fff;
  border: 1px solid var(--ui2-border);
  border-radius: 14px;
  font-size: 13px;
  font-weight: 650;
}

.selected-summary {
  display: grid;
  min-height: 78px;
  margin-top: 14px;
  padding: 14px;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px 12px;
  background: var(--ui2-surface);
  border: 1px solid var(--ui2-border);
  border-radius: var(--ui2-radius-lg);
  box-shadow: var(--ui2-shadow-card);
}

.summary-date,
.summary-person {
  display: flex;
}

.summary-date {
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
}

.summary-date strong {
  font-size: 17px;
}

.summary-date span {
  color: var(--ui2-text-secondary);
  font-size: 13px;
}

.summary-person {
  grid-column: 1;
  align-items: center;
  gap: 7px;
  font-size: 13px;
}

.shift-dot {
  width: 9px;
  height: 9px;
  flex: 0 0 auto;
  background: var(--ui2-primary);
  border-radius: 50%;
}

.text-action {
  min-height: 50px;
  padding: 0 12px;
  grid-row: 1 / span 2;
  grid-column: 2;
  color: var(--ui2-primary);
  background: var(--ui2-primary-tint);
  border: 0;
  border-radius: 14px;
  font-size: 13px;
  font-weight: 650;
  white-space: nowrap;
}

.panel-heading {
  display: flex;
  margin-bottom: 14px;
  align-items: flex-end;
  justify-content: space-between;
  gap: 12px;
}

.panel-heading p,
.records-heading {
  margin: 0;
}

.panel-heading p {
  color: var(--ui2-text-secondary);
  font-size: 14px;
}

.primary-action,
.secondary-action {
  min-height: 50px;
  border-radius: 14px;
  font-weight: 650;
}

.primary-action {
  color: #fff;
  background: var(--ui2-primary);
  border: 0;
  box-shadow: 0 8px 20px rgb(10 102 213 / 20%);
}

.primary-action.compact {
  min-height: 44px;
  padding-inline: 13px;
  flex: 0 0 auto;
  font-size: 15px;
  white-space: nowrap;
}

.secondary-action {
  color: var(--ui2-text-primary);
  background: #fff;
  border: 1px solid var(--ui2-border);
}

.setting-card,
.record-card,
.login-card {
  background: var(--ui2-surface);
  border: 1px solid var(--ui2-border);
  border-radius: 18px;
  box-shadow: 0 8px 24px rgb(22 32 42 / 7%);
}

.setting-card {
  display: flex;
  min-height: 76px;
  padding: 12px 16px;
  align-items: center;
  gap: 12px;
  font-size: 15px;
}

.setting-card input {
  width: 28px;
  height: 28px;
  accent-color: var(--ui2-primary);
}

.records-heading {
  margin: 22px 0 12px;
  font-size: 20px;
}

.record-card {
  padding: 18px;
}

.record-card dl {
  display: grid;
  margin: 0;
  grid-template-columns: 68px minmax(0, 1fr);
  gap: 18px 12px;
}

.record-card dt {
  color: var(--ui2-text-secondary);
  font-size: 13px;
  font-weight: 650;
}

.record-card dd {
  min-width: 0;
  margin: 0;
  overflow-wrap: anywhere;
  text-align: right;
}

.status-pill {
  padding: 5px 9px;
  color: var(--ui2-primary);
  background: var(--ui2-primary-tint);
  border-radius: 999px;
  font-size: 11px;
}

.bottom-nav {
  position: fixed;
  z-index: 6;
  right: 0;
  bottom: 0;
  left: 0;
  display: grid;
  min-height: calc(70px + env(safe-area-inset-bottom));
  padding: 5px 3px calc(5px + env(safe-area-inset-bottom));
  grid-template-columns: repeat(5, minmax(0, 1fr));
  background: rgb(255 255 255 / 96%);
  border-top: 1px solid var(--ui2-border);
  backdrop-filter: blur(20px);
}

.bottom-nav button {
  display: flex;
  min-width: 0;
  min-height: 56px;
  padding: 4px 2px;
  align-items: center;
  flex-direction: column;
  justify-content: center;
  gap: 3px;
  color: var(--ui2-text-secondary);
  background: transparent;
  border: 0;
  border-radius: 13px;
  font-size: 10px;
  font-weight: 650;
}

.bottom-nav button.is-active {
  color: var(--ui2-primary);
  background: var(--ui2-primary-tint);
}

.filing-footer {
  display: flex;
  min-height: 52px;
  margin-top: auto;
  padding: 4px 16px;
  align-items: center;
  justify-content: center;
  color: var(--ui2-text-muted);
  background: transparent;
  font-size: 12px;
}

.filing-link {
  display: inline-flex;
  min-height: 44px;
  padding: 0 11px;
  align-items: center;
  color: inherit;
  border-radius: 999px;
  text-decoration: none;
  transition:
    color 140ms ease,
    background 140ms ease;
}

.filing-link:hover,
.filing-link:focus-visible {
  color: var(--ui2-primary);
  background: var(--ui2-primary-tint);
}

.login-preview {
  display: grid;
  min-height: 100vh;
  padding: max(32px, env(safe-area-inset-top)) 24px max(20px, env(safe-area-inset-bottom));
  grid-template-rows: 1fr auto;
  gap: 14px;
  background:
    radial-gradient(circle at 86% 10%, rgb(10 102 213 / 12%), transparent 28%), var(--ui2-canvas);
}

.login-shell {
  width: min(100%, 402px);
  margin: auto;
}

.brand-mark {
  position: relative;
  width: 52px;
  height: 52px;
  margin-bottom: 24px;
  background: var(--ui2-primary);
  border-radius: 17px;
  box-shadow: 0 12px 30px rgb(10 102 213 / 24%);
}

.brand-mark span {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 25px;
  height: 7px;
  background: #fff;
  border-radius: 999px;
  transform: translate(-50%, -50%);
}

.brand-mark span:last-child {
  transform: translate(-50%, -50%) rotate(90deg);
}

.eyebrow {
  margin: 0;
  color: var(--ui2-primary);
  font-size: 13px;
  font-weight: 650;
}

.login-shell h1 {
  margin: 6px 0 8px;
  font-size: 28px;
  line-height: 1.18;
  letter-spacing: -0.7px;
}

.login-intro {
  margin: 0;
  color: var(--ui2-text-secondary);
  font-size: 15px;
}

.login-segmented {
  margin: 30px 0 14px;
  grid-template-columns: repeat(2, 1fr);
}

.login-card {
  display: grid;
  padding: 20px;
  gap: 16px;
}

.login-card label {
  display: grid;
  gap: 7px;
  color: var(--ui2-text-secondary);
  font-size: 13px;
}

.input-shell {
  display: flex;
  min-height: 50px;
  padding: 0 14px;
  align-items: center;
  gap: 9px;
  color: var(--ui2-text-muted);
  background: var(--ui2-surface-muted);
  border: 1px solid var(--ui2-border);
  border-radius: 14px;
  font-size: 15px;
}

.privacy-note {
  margin: 15px 8px 0;
  color: var(--ui2-text-secondary);
  font-size: 12px;
  line-height: 1.45;
  text-align: center;
}

.is-mobile .workspace {
  display: block;
  padding: 14px 12px calc(90px + env(safe-area-inset-bottom));
}

.is-mobile.screen-calendar .workspace-main {
  display: grid;
  gap: 14px;
}

.is-mobile.screen-calendar .view-toolbar,
.is-mobile.screen-calendar .selected-summary {
  margin: 0;
}

.is-mobile .workbench-title-block {
  max-width: calc(100% - 54px);
}

.is-mobile .export-action {
  padding: 0;
}

.is-mobile .export-action span:last-child {
  position: absolute;
  overflow: hidden;
  width: 1px;
  height: 1px;
  clip-path: inset(50%);
  white-space: nowrap;
}

.is-mobile .panel-heading {
  align-items: center;
}

.is-desktop .workbench-title-block {
  max-width: 520px;
}

@media (max-width: 340px) {
  .workbench-header {
    padding-right: 12px;
    padding-left: 12px;
  }

  .is-mobile .workspace {
    padding-inline: 12px;
  }

  .filter-action {
    width: 44px;
    padding: 0;
  }

  .filter-action span {
    position: absolute;
    overflow: hidden;
    width: 1px;
    height: 1px;
    clip-path: inset(50%);
    white-space: nowrap;
  }

  .selected-summary {
    padding: 12px;
  }

  .text-action {
    padding-inline: 10px;
  }

  .login-preview {
    padding-inline: 16px;
  }

  .login-card {
    padding: 16px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .filing-link {
    transition: none;
  }
}
</style>
