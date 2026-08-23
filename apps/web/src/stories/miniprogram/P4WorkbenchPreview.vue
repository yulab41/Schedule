<script setup lang="ts">
import { computed, ref } from 'vue';

import Ui2Icon from '../ui2/Ui2Icon.vue';
import Ui2MonthCalendar from '../ui2/Ui2MonthCalendar.vue';

export type P4WorkbenchState = 'ready' | 'empty' | 'loading' | 'error' | 'offline';
export type P4WorkbenchView = 'month' | 'week' | 'list';
export type P4WorkbenchFilter = 'all' | 'mine' | 'changes';

const props = withDefaults(
  defineProps<{
    readonly state?: P4WorkbenchState;
    readonly viewport?: 'mobile-320' | 'mobile-390';
    readonly initialView?: P4WorkbenchView;
    readonly initialFilterOpen?: boolean;
  }>(),
  { state: 'ready', viewport: 'mobile-390', initialView: 'month', initialFilterOpen: false },
);

const selectedDay = ref(14);
const activeView = ref<P4WorkbenchView>(props.initialView);
const activeFilter = ref<P4WorkbenchFilter>('all');
const filterOpen = ref(props.initialFilterOpen);
const announcement = ref('');
const monthOffset = ref(0);
const weekOffset = ref(0);

const baseWeekDays = [
  { day: 10, weekday: '一', duty: '早班 · 林恩宇' },
  { day: 11, weekday: '二', duty: '—' },
  { day: 12, weekday: '三', duty: '中班 · 陈护士' },
  { day: 13, weekday: '四', duty: '—' },
  { day: 14, weekday: '五', duty: '早班 · 林恩宇' },
  { day: 15, weekday: '六', duty: '晚班 · 王医生' },
  { day: 16, weekday: '日', duty: '—' },
] as const;

const listRowsByMonth = [
  [
    { day: 14, weekday: '星期二', shift: '早班', name: '林恩宇', note: '08:00–16:00 · 已确认' },
    { day: 15, weekday: '星期三', shift: '中班', name: '陈护士', note: '14:00–20:00 · 换班完成' },
  ],
  [
    { day: 14, weekday: '星期五', shift: '早班', name: '林恩宇', note: '08:00–16:00 · 已确认' },
    { day: 14, weekday: '星期五', shift: '中班', name: '陈护士', note: '14:00–20:00 · 换班完成' },
    { day: 15, weekday: '星期六', shift: '晚班', name: '王医生', note: '20:00–次日08:00 · 已确认' },
  ],
  [
    { day: 14, weekday: '星期一', shift: '早班', name: '王医生', note: '08:00–16:00 · 已确认' },
    { day: 16, weekday: '星期三', shift: '晚班', name: '周医生', note: '20:00–次日08:00 · 已确认' },
  ],
] as const;

const monthNumber = computed(() => 8 + monthOffset.value);
const monthLabel = computed(() => `2026 年 ${monthNumber.value} 月`);
const weekRangeLabel = computed(() => {
  const start = 10 + weekOffset.value * 7;
  return `8 月 ${start} 日–${start + 6} 日`;
});
const weekPeriodNote = computed(() => `第 ${3 + weekOffset.value} 周 · 左右滑动切换`);
const weekDays = computed(() =>
  baseWeekDays.map((day, index) => ({
    ...day,
    day: day.day + weekOffset.value * 7,
    isWeekend: index >= 5,
  })),
);
const listRows = computed(() => listRowsByMonth[monthOffset.value + 1] ?? listRowsByMonth[1]);

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
  filterOpen.value = false;
  announcement.value =
    view === 'month' ? '已切换到月视图。' : `${view === 'week' ? '周' : '列表'}视图预览。`;
}

function selectDay(day: number): void {
  selectedDay.value = day;
  announcement.value = `已选择 2026 年 ${monthNumber.value} 月 ${day} 日。`;
}

function locateToday(): void {
  monthOffset.value = 0;
  weekOffset.value = 0;
  selectedDay.value = 14;
  announcement.value =
    activeView.value === 'week' ? '已定位到本周：8 月 14 日。' : '已定位到今天：8 月 14 日。';
}

function changeWeek(offset: -1 | 1): void {
  weekOffset.value = Math.max(-1, Math.min(1, weekOffset.value + offset));
  selectedDay.value = 14 + weekOffset.value * 7;
  announcement.value = offset < 0 ? '已切换到上一周。' : '已切换到下一周。';
}

function changeMonth(offset: -1 | 1): void {
  monthOffset.value = Math.max(-1, Math.min(1, monthOffset.value + offset));
  announcement.value = offset < 0 ? '已切换到上个月。' : '已切换到下个月。';
}

function chooseFilter(filter: P4WorkbenchFilter): void {
  activeFilter.value = filter;
  filterOpen.value = false;
  announcement.value = `已应用筛选：${filter === 'all' ? '全部班次' : filter === 'mine' ? '只看我的排班' : '只看有变更的班次'}。`;
}

function retry(): void {
  announcement.value = '正在重新读取排班…';
}

function announceUnavailable(label: string): void {
  announcement.value = `${label}功能将在后续阶段开放。`;
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
          <span class="period-label">{{ monthLabel }}</span>
          <span class="cache-note"><span class="cache-dot" />只读查看 · 24 小时缓存</span>
        </div>

        <div class="view-controls">
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
          <button
            class="filter-button"
            type="button"
            aria-label="筛选排班"
            @click="filterOpen = true"
          >
            <Ui2Icon name="filter" />
            <span>筛选</span>
            <span v-if="activeFilter !== 'all'" class="filter-count">1</span>
          </button>
        </div>

        <section v-if="filterOpen" class="filter-panel" aria-label="筛选排班">
          <header>
            <strong>筛选排班</strong>
            <button type="button" @click="filterOpen = false">完成</button>
          </header>
          <button
            v-for="filter in ['all', 'mine', 'changes'] as const"
            :key="filter"
            class="filter-option"
            :class="{ 'is-selected': activeFilter === filter }"
            type="button"
            @click="chooseFilter(filter)"
          >
            <span>{{
              filter === 'all'
                ? '全部班次'
                : filter === 'mine'
                  ? '只看我的排班'
                  : '只看有变更的班次'
            }}</span>
            <Ui2Icon v-if="activeFilter === filter" name="check" />
          </button>
        </section>

        <p v-if="announcement" class="sr-announcement" aria-live="polite">{{ announcement }}</p>

        <template v-if="state === 'ready' && activeView === 'month'">
          <Ui2MonthCalendar
            scenario="august"
            :selected-day="selectedDay"
            @locate="locateToday"
            @month-change="changeMonth"
            @select="selectDay"
          />

          <section class="selected-detail" aria-live="polite">
            <header class="selected-detail-heading">
              <div class="summary-date">
                <span>选中日期</span>
                <strong>{{ monthNumber }} 月 {{ selectedDay }} 日</strong>
                <small>{{ selectedDay === 14 ? '今天 · 星期五' : '已选择日期' }}</small>
              </div>
              <b>2 个班次</b>
            </header>
            <div class="summary-duty">
              <span class="shift-dot" />
              <span><b>早班 · 林恩宇</b><small>08:00–16:00 · 已确认</small></span>
            </div>
            <div class="summary-duty">
              <span class="shift-dot is-secondary" />
              <span><b>中班 · 陈护士</b><small>14:00–20:00 · 换班完成</small></span>
            </div>
            <p class="privacy-note">联系方式仅在群组成员单独同意后显示</p>
          </section>
        </template>

        <template v-else-if="state === 'ready' && activeView === 'week'">
          <section class="week-calendar" aria-label="周视图">
            <header class="calendar-navigation">
              <button
                class="calendar-step"
                type="button"
                aria-label="上一周"
                @click="changeWeek(-1)"
              >
                <Ui2Icon name="chevron-left" />
              </button>
              <div class="calendar-heading">
                <strong>{{ weekRangeLabel }}</strong>
                <span>{{ weekPeriodNote }}</span>
              </div>
              <button
                class="calendar-locator"
                type="button"
                aria-label="定位到今天"
                @click="locateToday"
              >
                <span class="locate-crosshair" aria-hidden="true"><span /></span>
              </button>
              <button
                class="calendar-step"
                type="button"
                aria-label="下一周"
                @click="changeWeek(1)"
              >
                <Ui2Icon name="chevron-right" />
              </button>
            </header>
            <div class="week-day-row" aria-hidden="true">
              <span v-for="day in weekDays" :key="day.day" :class="{ 'is-weekend': day.isWeekend }">
                {{ day.weekday }}
              </span>
            </div>
            <div class="week-day-grid">
              <button
                v-for="day in weekDays"
                :key="day.day"
                class="week-day"
                :class="{
                  'is-selected': selectedDay === day.day,
                  'is-today': day.day === 14,
                  'is-weekend': day.isWeekend,
                }"
                type="button"
                @click="selectDay(day.day)"
              >
                <span class="day-number">{{ day.day }}</span>
                <span>{{ day.duty }}</span>
              </button>
            </div>
          </section>
          <section class="selected-detail compact-detail" aria-live="polite">
            <header class="selected-detail-heading">
              <div class="summary-date">
                <span>选中日期</span><strong>{{ monthNumber }} 月 {{ selectedDay }} 日</strong>
              </div>
              <b>2 个班次</b>
            </header>
            <div class="summary-duty">
              <span class="shift-dot" /><span
                ><b>早班 · 林恩宇</b><small>08:00–16:00 · 已确认</small></span
              >
            </div>
            <p class="privacy-note">联系方式仅在群组成员单独同意后显示</p>
          </section>
        </template>

        <template v-else-if="state === 'ready' && activeView === 'list'">
          <section class="list-calendar" aria-label="列表视图">
            <header class="list-calendar-heading">
              <button
                class="calendar-step"
                type="button"
                aria-label="上一月"
                @click="changeMonth(-1)"
              >
                <Ui2Icon name="chevron-left" />
              </button>
              <div class="calendar-heading">
                <strong>{{ monthLabel }}</strong>
                <span>固定月份 · {{ listRows.length }} 个班次</span>
              </div>
              <button
                class="calendar-locator"
                type="button"
                aria-label="定位到今天"
                @click="locateToday"
              >
                <span class="locate-crosshair" aria-hidden="true"><span /></span>
              </button>
              <button
                class="calendar-step"
                type="button"
                aria-label="下一月"
                @click="changeMonth(1)"
              >
                <Ui2Icon name="chevron-right" />
              </button>
            </header>
            <p class="list-meta">月份工具栏固定 · 已按日期排序</p>
            <button
              v-for="row in listRows"
              :key="`${row.day}-${row.shift}`"
              class="list-row"
              type="button"
              :class="{ 'is-selected': selectedDay === row.day }"
              @click="selectDay(row.day)"
            >
              <span class="list-date"
                ><strong>{{ row.day }}</strong
                ><small>{{ row.weekday }}</small></span
              >
              <span class="list-copy"
                ><b>{{ row.shift }} · {{ row.name }}</b
                ><small>{{ row.note }}</small></span
              >
              <Ui2Icon name="chevron-right" />
            </button>
          </section>
        </template>

        <template v-else>
          <section class="state-card" :class="`state-${state}`" aria-live="polite">
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
        </template>
      </section>

      <nav class="bottom-nav" aria-label="工作台导航">
        <button class="is-active" type="button" aria-current="page">
          <Ui2Icon name="calendar" /><span>日历</span>
        </button>
        <button
          class="is-disabled"
          type="button"
          aria-disabled="true"
          @click="announceUnavailable('请假')"
        >
          <Ui2Icon name="leave" /><span>请假</span>
        </button>
        <button
          class="is-disabled"
          type="button"
          aria-disabled="true"
          @click="announceUnavailable('换班')"
        >
          <Ui2Icon name="swap" /><span>换班</span>
        </button>
        <button
          class="is-disabled"
          type="button"
          aria-disabled="true"
          @click="announceUnavailable('调班')"
        >
          <Ui2Icon name="adjustment" /><span>调班</span>
        </button>
        <button
          class="is-disabled"
          type="button"
          aria-disabled="true"
          @click="announceUnavailable('更多')"
        >
          <Ui2Icon name="more" /><span>更多</span>
        </button>
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

.view-controls {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
}

.filter-button {
  display: inline-flex;
  min-width: 76px;
  min-height: 44px;
  padding: 0 11px;
  align-items: center;
  justify-content: center;
  gap: 5px;
  color: var(--ui2-primary);
  background: var(--ui2-primary-tint);
  border: 0;
  border-radius: 12px;
  cursor: pointer;
  font-size: 12px;
  font-weight: 650;
}

.filter-count {
  display: inline-grid;
  min-width: 17px;
  height: 17px;
  padding: 0 3px;
  place-items: center;
  color: #fff;
  background: var(--ui2-primary);
  border-radius: 999px;
  font-size: 10px;
}

.filter-panel {
  display: grid;
  padding: 12px;
  gap: 4px;
  background: var(--ui2-surface);
  border: 1px solid var(--ui2-border);
  border-radius: var(--ui2-radius-lg);
  box-shadow: var(--ui2-shadow-card);
}

.filter-panel header {
  display: flex;
  min-height: 32px;
  align-items: center;
  justify-content: space-between;
  color: var(--ui2-text-primary);
  font-size: 13px;
}

.filter-panel header button {
  min-height: 32px;
  padding: 0 8px;
  color: var(--ui2-primary);
  background: transparent;
  border: 0;
  cursor: pointer;
  font-size: 12px;
  font-weight: 650;
}

.filter-option {
  display: flex;
  min-height: 44px;
  padding: 0 9px;
  align-items: center;
  justify-content: space-between;
  color: var(--ui2-text-secondary);
  background: transparent;
  border: 0;
  border-radius: 10px;
  cursor: pointer;
  font-size: 12px;
  text-align: left;
}

.filter-option.is-selected {
  color: var(--ui2-primary);
  background: var(--ui2-primary-tint);
  font-weight: 650;
}

.selected-detail {
  display: grid;
  padding: 14px;
  gap: 10px;
  background: var(--ui2-surface);
  border: 1px solid var(--ui2-border);
  border-radius: var(--ui2-radius-lg);
  box-shadow: var(--ui2-shadow-card);
}

.selected-detail-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.selected-detail-heading > b {
  padding-top: 2px;
  color: var(--ui2-primary);
  font-size: 12px;
  white-space: nowrap;
}

.summary-date small,
.summary-duty small {
  display: block;
  color: var(--ui2-text-secondary);
  font-size: 11px;
  font-weight: 400;
  line-height: 1.45;
}

.summary-duty > span:last-child {
  display: grid;
  gap: 1px;
}

.privacy-note {
  padding-top: 2px;
  color: var(--ui2-text-muted);
  font-size: 10px;
  line-height: 1.45;
}

.shift-dot.is-secondary {
  background: var(--ui2-warning);
}

.compact-detail {
  gap: 8px;
}

.week-calendar,
.list-calendar {
  overflow: hidden;
  background: var(--ui2-surface);
  border: 1px solid var(--ui2-border);
  border-radius: var(--ui2-radius-lg);
  box-shadow: var(--ui2-shadow-card);
}

.calendar-navigation,
.list-calendar-heading {
  display: grid;
  min-height: 60px;
  padding: 4px 6px;
  grid-template-columns: 44px minmax(0, 1fr) 44px 44px;
  align-items: center;
  border-bottom: 1px solid var(--ui2-border);
}

.calendar-step,
.calendar-locator {
  display: grid;
  width: 44px;
  height: 44px;
  padding: 0;
  place-items: center;
  color: var(--ui2-primary);
  background: transparent;
  border: 0;
  border-radius: 14px;
  cursor: pointer;
}

.calendar-step:active,
.calendar-locator:active {
  background: var(--ui2-primary-tint);
  transform: scale(0.96);
}

.calendar-heading {
  display: grid;
  min-width: 0;
  gap: 1px;
  text-align: center;
}

.calendar-heading strong {
  overflow: hidden;
  font-size: 14px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.calendar-heading span,
.list-meta {
  color: var(--ui2-text-secondary);
  font-size: 11px;
}

.locate-crosshair {
  position: relative;
  display: block;
  width: 16px;
  height: 16px;
  background:
    linear-gradient(currentColor, currentColor) center top / 2px 4px no-repeat,
    linear-gradient(currentColor, currentColor) center bottom / 2px 4px no-repeat,
    linear-gradient(currentColor, currentColor) left center / 4px 2px no-repeat,
    linear-gradient(currentColor, currentColor) right center / 4px 2px no-repeat;
}

.locate-crosshair::before {
  position: absolute;
  inset: 2px;
  border: 2px solid currentColor;
  border-radius: 50%;
  content: '';
}

.locate-crosshair > span {
  position: absolute;
  top: 6px;
  left: 6px;
  width: 4px;
  height: 4px;
  background: currentColor;
  border-radius: 50%;
}

.week-day-row,
.week-day-grid {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
}

.week-day-row {
  min-height: 30px;
  align-items: center;
  color: var(--ui2-text-secondary);
  background: var(--ui2-surface-muted);
  border-bottom: 1px solid var(--ui2-border);
  font-size: 11px;
  font-weight: 650;
  text-align: center;
}

.week-day-row .is-weekend {
  color: var(--ui2-danger);
}

.week-day {
  display: grid;
  min-width: 0;
  min-height: 102px;
  padding: 8px 5px;
  align-content: start;
  gap: 6px;
  color: var(--ui2-text-primary);
  background: var(--ui2-surface);
  border: 0;
  border-right: 1px solid var(--ui2-border);
  border-bottom: 1px solid var(--ui2-border);
  cursor: pointer;
  font-size: 10px;
  line-height: 1.35;
  text-align: left;
}

.week-day:nth-child(7n) {
  border-right: 0;
}

.week-day:nth-last-child(-n + 7) {
  border-bottom: 0;
}

.week-day.is-selected {
  background: var(--ui2-primary-tint);
  box-shadow: inset 0 0 0 2px var(--ui2-primary);
}

.week-day.is-weekend {
  color: var(--ui2-danger);
}

.day-number {
  display: inline-grid;
  width: 24px;
  height: 24px;
  place-items: center;
  color: inherit;
  border-radius: 50%;
  font-size: 12px;
  font-weight: 700;
}

.week-day.is-today .day-number {
  color: #fff;
  background: var(--ui2-primary);
}

.list-meta {
  margin: 0;
  padding: 10px 14px 4px;
}

.list-row {
  display: grid;
  min-width: 100%;
  min-height: 68px;
  padding: 10px 14px;
  grid-template-columns: 46px minmax(0, 1fr) 20px;
  align-items: center;
  gap: 10px;
  color: var(--ui2-text-primary);
  background: var(--ui2-surface);
  border: 0;
  border-bottom: 1px solid var(--ui2-border);
  cursor: pointer;
  text-align: left;
}

.list-row:last-child {
  border-bottom: 0;
}

.list-row.is-selected {
  background: var(--ui2-primary-tint);
}

.list-date,
.list-copy {
  display: grid;
  min-width: 0;
  gap: 2px;
}

.list-date strong {
  color: var(--ui2-primary);
  font-size: 18px;
  line-height: 1;
}

.list-date small,
.list-copy small {
  overflow: hidden;
  color: var(--ui2-text-secondary);
  font-size: 10px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.list-copy b {
  overflow: hidden;
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.list-row > .ui2-icon {
  color: var(--ui2-text-muted);
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

.bottom-nav button.is-disabled {
  color: var(--ui2-text-muted);
  cursor: default;
  opacity: 0.62;
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
