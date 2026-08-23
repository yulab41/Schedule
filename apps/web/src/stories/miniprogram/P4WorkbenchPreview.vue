<script setup lang="ts">
import { computed, ref } from 'vue';

import Ui2Icon from '../ui2/Ui2Icon.vue';
import Ui2MonthCalendar from '../ui2/Ui2MonthCalendar.vue';

export type P4WorkbenchState = 'ready' | 'empty' | 'loading' | 'error' | 'offline';
export type P4WorkbenchView = 'month' | 'week' | 'list';

const props = withDefaults(
  defineProps<{
    readonly state?: P4WorkbenchState;
    readonly viewport?: 'mobile-320' | 'mobile-390';
  }>(),
  { state: 'ready', viewport: 'mobile-390' },
);

const selectedDay = ref(14);
const activeView = ref<P4WorkbenchView>('month');
const announcement = ref('');

const stateTitle = computed(() => {
  switch (props.state) {
    case 'empty':
      return '暂时没有已发布排班';
    case 'error':
      return '排班暂时无法加载';
    case 'offline':
      return '当前为离线状态';
    case 'loading':
      return '正在读取排班';
    default:
      return '';
  }
});

const stateDescription = computed(() => {
  switch (props.state) {
    case 'empty':
      return '群主完成发布后，这里会显示当前群组的值班安排。';
    case 'error':
      return '请检查网络连接后重试；本次没有写入任何业务数据。';
    case 'offline':
      return '只显示最近一次成功读取的内容，离线时不能提交业务变更。';
    case 'loading':
      return '正在读取当前群组的月历和班次。';
    default:
      return '';
  }
});

function selectView(view: P4WorkbenchView): void {
  activeView.value = view;
  announcement.value =
    view === 'month' ? '已切换到月视图。' : `${view === 'week' ? '周' : '列表'}视图预览。`;
}

function selectDay(day: number): void {
  selectedDay.value = day;
  announcement.value = `已选择 2026 年 8 月 ${day} 日。`;
}

function retry(): void {
  announcement.value = '正在重新读取排班…';
}
</script>

<template>
  <div class="p4-preview" :class="`viewport-${viewport}`" :data-state="state">
    <main class="phone-frame" aria-label="P4 已认证工作台预览">
      <header class="workbench-header">
        <div class="brand-lockup">
          <span class="brand-mark" aria-hidden="true">+</span>
          <span>排班台</span>
        </div>
        <span class="identity-chip">身份已确认</span>
      </header>

      <section class="workbench-content">
        <div class="workbench-heading">
          <div class="heading-copy">
            <p class="eyebrow">P4 · 已认证工作台</p>
            <h1>工作台</h1>
            <p class="lede">只查看你有权限的群组排班。</p>
          </div>
          <button class="group-switch" type="button" aria-label="切换当前群组">
            <span class="group-switch-label">当前群组</span>
            <strong>急诊一组</strong>
            <span class="group-role">成员⌄</span>
          </button>
        </div>

        <div class="period-row">
          <span class="period-label">2026 年 8 月</span>
          <span class="cache-note"><span class="cache-dot" />只读查看 · 24 小时缓存</span>
        </div>

        <div class="view-switch" role="tablist" aria-label="排班视图">
          <button
            v-for="view in ['month', 'week', 'list'] as const"
            :key="view"
            type="button"
            role="tab"
            :aria-selected="activeView === view"
            :class="{ 'is-active': activeView === view }"
            @click="selectView(view)"
          >
            {{ view === 'month' ? '月' : view === 'week' ? '周' : '列表' }}
          </button>
        </div>

        <p v-if="announcement" class="sr-announcement" aria-live="polite">{{ announcement }}</p>

        <template v-if="state === 'ready' && activeView === 'month'">
          <Ui2MonthCalendar scenario="august" :selected-day="selectedDay" @select="selectDay" />

          <section class="selected-summary" aria-live="polite">
            <div class="summary-date">
              <strong>8 月 {{ selectedDay }} 日</strong>
              <span>{{ selectedDay === 14 ? '今天 · 星期五' : '已选择日期' }}</span>
            </div>
            <div class="summary-duty">
              <span class="shift-dot" />
              <span><b>早班</b> 林恩宇</span>
            </div>
            <button class="detail-action" type="button">查看详情</button>
          </section>
        </template>

        <section v-else-if="state === 'ready'" class="view-placeholder" aria-live="polite">
          <span class="placeholder-mark" aria-hidden="true"><Ui2Icon name="calendar" /></span>
          <h2>{{ activeView === 'week' ? '周视图' : '列表视图' }}</h2>
          <p>这一视图将在月历只读链路确认后接入，当前不会提前显示未落地的业务内容。</p>
        </section>

        <section v-else class="state-card" :class="`state-${state}`" aria-live="polite">
          <span class="state-mark" aria-hidden="true">
            <Ui2Icon v-if="state === 'error'" name="bell" />
            <Ui2Icon v-else name="calendar" />
          </span>
          <h2>{{ stateTitle }}</h2>
          <p>{{ stateDescription }}</p>
          <button v-if="state === 'error'" class="retry-action" type="button" @click="retry">
            重新加载
          </button>
          <span v-else-if="state === 'loading'" class="loading-line" aria-hidden="true" />
          <span v-else class="state-note">保持当前群组权限不变</span>
        </section>
      </section>

      <nav class="bottom-nav" aria-label="工作台导航">
        <button class="is-active" type="button" aria-current="page">
          <Ui2Icon name="calendar" /><span>日历</span>
        </button>
        <button type="button"><Ui2Icon name="leave" /><span>请假</span></button>
        <button type="button"><Ui2Icon name="swap" /><span>换班</span></button>
        <button type="button"><Ui2Icon name="adjustment" /><span>调班</span></button>
        <button type="button"><Ui2Icon name="more" /><span>更多</span></button>
      </nav>
    </main>
  </div>
</template>

<style scoped>
:global(html),
:global(body) {
  overflow-x: hidden;
}

.p4-preview {
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
  box-sizing: border-box;
  color: var(--ui2-text-primary);
  background: var(--ui2-canvas);
  font-family:
    -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'PingFang SC', 'Segoe UI', 'Microsoft YaHei',
    sans-serif;
}

button {
  font: inherit;
}

button:focus-visible {
  outline: 3px solid rgb(10 102 213 / 26%);
  outline-offset: 2px;
}

.phone-frame {
  min-height: 100vh;
  padding-bottom: calc(82px + env(safe-area-inset-bottom));
}

.workbench-header {
  display: flex;
  min-height: 64px;
  padding: 12px 16px 10px;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  background: rgb(255 255 255 / 94%);
  border-bottom: 1px solid var(--ui2-border);
}

.brand-lockup,
.identity-chip,
.group-switch,
.period-row,
.cache-note,
.bottom-nav button {
  display: flex;
  align-items: center;
}

.brand-lockup {
  gap: 8px;
  font-size: 16px;
  font-weight: 700;
}

.brand-mark {
  display: grid;
  width: 28px;
  height: 28px;
  place-items: center;
  color: #fff;
  background: var(--ui2-primary);
  border-radius: 9px;
  font-size: 21px;
  line-height: 1;
}

.identity-chip {
  min-height: 28px;
  padding: 0 9px;
  color: var(--ui2-success);
  background: var(--ui2-success-tint);
  border-radius: 999px;
  font-size: 11px;
  font-weight: 650;
}

.workbench-content {
  display: grid;
  max-width: 540px;
  margin: 0 auto;
  padding: 18px 14px 24px;
  gap: 14px;
}

.workbench-heading {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: end;
  gap: 10px;
}

.heading-copy {
  min-width: 0;
}

.eyebrow {
  margin: 0;
  color: var(--ui2-primary);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.05em;
}

h1,
h2,
p {
  margin: 0;
}

h1 {
  margin-top: 3px;
  font-size: 27px;
  letter-spacing: -0.7px;
  line-height: 1.12;
}

.lede {
  margin-top: 6px;
  color: var(--ui2-text-secondary);
  font-size: 13px;
}

.group-switch {
  min-width: 128px;
  min-height: 58px;
  padding: 8px 10px;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  color: var(--ui2-text-primary);
  background: var(--ui2-surface);
  border: 1px solid var(--ui2-border);
  border-radius: 14px;
  box-shadow: var(--ui2-shadow-card);
  cursor: pointer;
  text-align: left;
}

.group-switch-label,
.group-role {
  color: var(--ui2-text-secondary);
  font-size: 10px;
}

.group-switch strong {
  max-width: 100%;
  overflow: hidden;
  font-size: 13px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.group-role {
  color: var(--ui2-primary);
}

.period-row {
  min-height: 32px;
  justify-content: space-between;
  gap: 8px;
}

.period-label {
  font-size: 13px;
  font-weight: 700;
}

.cache-note {
  min-width: 0;
  color: var(--ui2-text-muted);
  font-size: 10px;
  white-space: nowrap;
}

.cache-dot {
  width: 6px;
  height: 6px;
  margin-right: 5px;
  background: var(--ui2-success);
  border-radius: 50%;
}

.view-switch {
  display: grid;
  padding: 3px;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 3px;
  background: #e8edf3;
  border-radius: 14px;
}

.view-switch button {
  min-height: 44px;
  color: var(--ui2-text-secondary);
  background: transparent;
  border: 0;
  border-radius: 11px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 650;
}

.view-switch button.is-active {
  color: var(--ui2-text-primary);
  background: var(--ui2-surface);
  box-shadow: 0 2px 8px rgb(22 32 42 / 9%);
}

.selected-summary {
  display: grid;
  min-height: 78px;
  padding: 13px;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 6px 10px;
  background: var(--ui2-surface);
  border: 1px solid var(--ui2-border);
  border-radius: var(--ui2-radius-lg);
  box-shadow: var(--ui2-shadow-card);
}

.summary-date {
  display: grid;
  gap: 2px;
}

.summary-date strong {
  font-size: 16px;
}

.summary-date span {
  color: var(--ui2-text-secondary);
  font-size: 11px;
}

.summary-duty {
  display: flex;
  grid-column: 1;
  align-items: center;
  gap: 6px;
  font-size: 12px;
}

.shift-dot {
  width: 8px;
  height: 8px;
  background: var(--ui2-primary);
  border-radius: 50%;
}

.detail-action,
.retry-action {
  min-height: 44px;
  padding: 0 11px;
  color: var(--ui2-primary);
  background: var(--ui2-primary-tint);
  border: 0;
  border-radius: 12px;
  cursor: pointer;
  font-size: 12px;
  font-weight: 650;
}

.detail-action {
  grid-column: 2;
  grid-row: 1 / span 2;
}

.state-card,
.view-placeholder {
  display: grid;
  min-height: 270px;
  padding: 26px 20px;
  place-items: center;
  align-content: center;
  gap: 9px;
  color: var(--ui2-text-primary);
  background: var(--ui2-surface);
  border: 1px solid var(--ui2-border);
  border-radius: var(--ui2-radius-lg);
  box-shadow: var(--ui2-shadow-card);
  text-align: center;
}

.state-mark,
.placeholder-mark {
  display: grid;
  width: 52px;
  height: 52px;
  margin-bottom: 3px;
  place-items: center;
  color: var(--ui2-primary);
  background: var(--ui2-primary-tint);
  border-radius: 17px;
}

.state-error .state-mark {
  color: var(--ui2-danger);
  background: var(--ui2-danger-tint);
}

.state-card h2,
.view-placeholder h2 {
  font-size: 17px;
}

.state-card p,
.view-placeholder p {
  max-width: 280px;
  color: var(--ui2-text-secondary);
  font-size: 12px;
  line-height: 1.55;
}

.state-note {
  color: var(--ui2-text-muted);
  font-size: 11px;
}

.loading-line {
  width: 120px;
  height: 6px;
  overflow: hidden;
  background: var(--ui2-primary-tint);
  border-radius: 999px;
}

.loading-line::after {
  display: block;
  width: 46px;
  height: 100%;
  background: var(--ui2-primary);
  border-radius: inherit;
  content: '';
  animation: loading-sweep 1.2s ease-in-out infinite;
}

.bottom-nav {
  position: fixed;
  z-index: 5;
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
  min-width: 0;
  min-height: 56px;
  padding: 4px 2px;
  flex-direction: column;
  justify-content: center;
  gap: 3px;
  color: var(--ui2-text-secondary);
  background: transparent;
  border: 0;
  border-radius: 13px;
  cursor: pointer;
  font-size: 10px;
  font-weight: 650;
}

.bottom-nav button.is-active {
  color: var(--ui2-primary);
  background: var(--ui2-primary-tint);
}

.sr-announcement {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}

@keyframes loading-sweep {
  from {
    transform: translateX(-50px);
  }
  to {
    transform: translateX(124px);
  }
}

@media (max-width: 340px) {
  .workbench-header {
    padding-inline: 12px;
  }

  .workbench-content {
    padding-inline: 12px;
  }

  .workbench-heading {
    grid-template-columns: minmax(0, 1fr);
    align-items: start;
  }

  .group-switch {
    width: 100%;
    min-height: 50px;
  }

  .period-row {
    align-items: flex-start;
    flex-direction: column;
    gap: 2px;
  }

  .cache-note {
    white-space: normal;
  }
}

@media (prefers-reduced-motion: reduce) {
  .loading-line::after {
    animation: none;
  }
}
</style>
