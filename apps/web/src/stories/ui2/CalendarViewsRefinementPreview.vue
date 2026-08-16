<script setup lang="ts">
import { computed, ref, watch } from 'vue';

import {
  addWeeks,
  getWeekDays,
  getWeekLabel,
  getWeekOfMonthLabel,
} from '../../features/calendar/calendar-views.js';
import Ui2Icon from './Ui2Icon.vue';

export type CalendarPreviewLayout = 'desktop' | 'mobile';
export type CalendarPreviewView = 'list' | 'month' | 'week';

interface PreviewAssignment {
  readonly name: string;
  readonly shortName?: string;
  readonly role: string;
  readonly shift: string;
  readonly shortShift?: string;
  readonly time: string;
  readonly marker?: '加班' | '换班';
}

interface PreviewWeekDay {
  readonly businessDate?: string;
  readonly date: string;
  readonly holiday?: string;
  readonly holidayTone?: 'holiday' | 'workday';
  readonly isToday?: boolean;
  readonly isWeekend?: boolean;
  readonly weekday: string;
  readonly assignments: readonly PreviewAssignment[];
}

interface PreviewListDay {
  readonly date: string;
  readonly holiday?: string;
  readonly holidayTone?: 'holiday' | 'workday';
  readonly isToday?: boolean;
  readonly isWeekend?: boolean;
  readonly weekday: string;
  readonly assignments: readonly PreviewAssignment[];
}

const props = withDefaults(
  defineProps<{
    readonly layout?: CalendarPreviewLayout;
    readonly view?: CalendarPreviewView;
  }>(),
  { layout: 'mobile', view: 'week' },
);

const activeView = ref<CalendarPreviewView>(props.view);
const monthOffset = ref(0);
const toastMessage = ref('');
let toastTimer: number | undefined;

watch(
  () => props.view,
  (view) => {
    activeView.value = view;
  },
);

const monthLabel = computed(() => {
  const month = 10 + monthOffset.value;
  return `2026年${month}月`;
});

const weekOffset = ref(0);
const previewWeekStart = computed(() => addWeeks('2026-10-12', weekOffset.value));
const weekTitle = computed(() => getWeekOfMonthLabel(previewWeekStart.value));
const weekRange = computed(() => getWeekLabel(previewWeekStart.value).replace('2026年', ''));

const baseWeekDays: readonly PreviewWeekDay[] = [
  {
    date: '12',
    weekday: '一',
    assignments: [
      {
        name: '林恩宇',
        shortName: '林',
        role: '头颈外科',
        shift: 'A班',
        shortShift: 'A',
        time: '08:00–18:00',
      },
      {
        name: '陈护士',
        shortName: '陈',
        role: '护士站',
        shift: 'P班',
        shortShift: 'P',
        time: '18:00–次日08:00',
      },
    ],
  },
  {
    date: '13',
    weekday: '二',
    assignments: [
      {
        name: '王护士',
        shortName: '王',
        role: '护士站',
        shift: 'A班',
        shortShift: 'A',
        time: '08:00–18:00',
        marker: '换班',
      },
      {
        name: '周医生',
        shortName: '周',
        role: '值班室',
        shift: 'N班',
        shortShift: 'N',
        time: '18:00–次日08:00',
        marker: '加班',
      },
    ],
  },
  {
    date: '14',
    weekday: '三',
    isToday: true,
    assignments: [
      {
        name: '林恩宇',
        shortName: '林',
        role: '头颈外科',
        shift: 'A班',
        shortShift: 'A',
        time: '08:00–18:00',
      },
      {
        name: '陈护士',
        shortName: '陈',
        role: '护士站',
        shift: 'P班',
        shortShift: 'P',
        time: '18:00–次日08:00',
        marker: '换班',
      },
      {
        name: '周医生',
        shortName: '周',
        role: '值班室',
        shift: 'N班',
        shortShift: 'N',
        time: '22:00–次日08:00',
      },
    ],
  },
  {
    date: '15',
    weekday: '四',
    assignments: [
      {
        name: '王护士',
        shortName: '王',
        role: '护士站',
        shift: 'A班',
        shortShift: 'A',
        time: '08:00–18:00',
      },
    ],
  },
  {
    date: '16',
    weekday: '五',
    assignments: [
      {
        name: '林恩宇',
        shortName: '林',
        role: '头颈外科',
        shift: 'P班',
        shortShift: 'P',
        time: '18:00–次日08:00',
      },
      {
        name: '陈护士',
        shortName: '陈',
        role: '护士站',
        shift: 'N班',
        shortShift: 'N',
        time: '22:00–次日08:00',
      },
    ],
  },
  {
    date: '17',
    weekday: '六',
    isWeekend: true,
    assignments: [
      {
        name: '王护士',
        shortName: '王',
        role: '护士站',
        shift: 'A班',
        shortShift: 'A',
        time: '08:00–18:00',
      },
    ],
  },
  {
    date: '18',
    weekday: '日',
    isWeekend: true,
    assignments: [
      {
        name: '待定',
        shortName: '待',
        role: '值班室',
        shift: 'N班',
        shortShift: 'N',
        time: '18:00–次日08:00',
      },
    ],
  },
];

const weekDays = computed<readonly PreviewWeekDay[]>(() => {
  const businessDates = getWeekDays(previewWeekStart.value);
  return baseWeekDays.map((day, index) => {
    const businessDate = businessDates[index] ?? previewWeekStart.value;
    return {
      ...day,
      businessDate,
      date: businessDate.slice(8),
      isToday: weekOffset.value === 0 && Boolean(day.isToday),
    };
  });
});

const selectedWeekdayIndex = ref(2);
const selectedWeekDay = computed<PreviewWeekDay>(
  () => weekDays.value[selectedWeekdayIndex.value] ?? weekDays.value[0] ?? baseWeekDays[0]!,
);

const weekCardHeight = computed(() => {
  const longestContent = Math.max(
    ...weekDays.value.map((day) => {
      const assignmentUnits = day.assignments.reduce(
        (total, assignment) => total + 1 + (assignment.marker ? 0.25 : 0),
        0,
      );
      const holidayUnits = day.holiday ? 0.5 : 0;
      return assignmentUnits + holidayUnits;
    }),
  );
  const baseHeight = props.layout === 'desktop' ? 54 : 42;
  const assignmentHeight = props.layout === 'desktop' ? 42 : 34;
  return baseHeight + longestContent * assignmentHeight;
});

const listDays: readonly PreviewListDay[] = [
  { date: '10-12', weekday: '周一', assignments: baseWeekDays[0]?.assignments ?? [] },
  {
    date: '10-13',
    weekday: '周二',
    assignments: baseWeekDays[1]?.assignments ?? [],
  },
  {
    date: '10-14',
    weekday: '周三',
    isToday: true,
    assignments: baseWeekDays[2]?.assignments ?? [],
  },
  {
    date: '10-17',
    weekday: '周六',
    isWeekend: true,
    assignments: baseWeekDays[5]?.assignments ?? [],
  },
];

const monthCells = [
  '28',
  '29',
  '30',
  '1',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  '10',
  '11',
  '12',
  '13',
  '14',
  '15',
  '16',
  '17',
  '18',
  '19',
  '20',
  '21',
  '22',
  '23',
  '24',
  '25',
  '26',
  '27',
  '28',
  '29',
  '30',
  '31',
  '1',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
] as const;

function selectView(view: CalendarPreviewView): void {
  activeView.value = view;
}

function selectWeekDay(dayIndex: number): void {
  selectedWeekdayIndex.value = dayIndex;
}

function shiftMonth(delta: -1 | 1): void {
  monthOffset.value = Math.max(-1, Math.min(1, monthOffset.value + delta));
  showToast(delta < 0 ? '已切换到上一个月' : '已切换到下一个月');
}

function shiftWeek(delta: -1 | 1): void {
  weekOffset.value += delta;
  showToast(delta < 0 ? '已切换到上一周' : '已切换到下一周');
}

function formatPreviewMonthDay(businessDate: string | undefined): string {
  if (businessDate === undefined) return '';
  return `${Number(businessDate.slice(5, 7))}月${Number(businessDate.slice(8))}日`;
}

function locateToday(): void {
  if (activeView.value === 'week') {
    weekOffset.value = 0;
    selectedWeekdayIndex.value = 2;
  }
  showToast(activeView.value === 'week' ? '已定位到本周：10月14日' : '已定位到今天：10月14日');
}

function showToast(message: string): void {
  toastMessage.value = message;
  if (toastTimer !== undefined) {
    window.clearTimeout(toastTimer);
  }
  toastTimer = window.setTimeout(() => {
    toastMessage.value = '';
  }, 1500);
}
</script>

<template>
  <div class="calendar-preview-stage" :class="`layout-${layout}`">
    <main class="preview-shell" aria-label="日历视图重做预览">
      <header class="app-header">
        <div class="app-heading">
          <span>头颈外科医生 · 群主</span>
          <h1>工作台</h1>
        </div>
        <div class="header-actions">
          <button type="button" aria-label="通知"><Ui2Icon name="bell" /></button>
          <button type="button" aria-label="导出排班"><span aria-hidden="true">↗</span></button>
        </div>
      </header>

      <div class="preview-scroll">
        <div class="view-toolbar">
          <div class="segmented" role="tablist" aria-label="日历视图">
            <button
              v-for="item in [
                ['month', '月'],
                ['week', '周'],
                ['list', '列表'],
              ] as const"
              :key="item[0]"
              type="button"
              role="tab"
              :aria-selected="activeView === item[0]"
              :class="{ active: activeView === item[0] }"
              @click="selectView(item[0])"
            >
              {{ item[1] }}
            </button>
          </div>
          <button class="filter-button" type="button" aria-label="筛选">
            <Ui2Icon name="filter" /><span>筛选</span>
          </button>
        </div>

        <section v-if="activeView === 'month'" class="month-card" aria-label="月视图预览">
          <header class="month-toolbar">
            <button class="month-step" type="button" aria-label="上一月" @click="shiftMonth(-1)">
              <Ui2Icon name="chevron-left" />
            </button>
            <div class="month-heading">
              <strong>{{ monthLabel }}</strong
              ><span>左右滑动切换月份</span>
            </div>
            <button
              class="locate-button"
              type="button"
              aria-label="定位到今天"
              @click="locateToday"
            >
              <span class="locate-crosshair" aria-hidden="true">
                <span class="locate-crosshair-center" />
              </span>
            </button>
            <button class="month-step" type="button" aria-label="下一月" @click="shiftMonth(1)">
              <Ui2Icon name="chevron-right" />
            </button>
          </header>
          <div class="weekday-row" aria-hidden="true">
            <span v-for="weekday in ['一', '二', '三', '四', '五', '六', '日']" :key="weekday">{{
              weekday
            }}</span>
          </div>
          <div class="month-grid">
            <button
              v-for="(day, index) in monthCells"
              :key="`${day}-${index}`"
              class="month-cell"
              :class="{
                outside: index < 3 || index > 34,
                weekend: index % 7 >= 5,
                holiday: index >= 3 && index <= 9,
                selected: day === '14',
                today: day === '14',
              }"
              type="button"
              :disabled="index < 3 || index > 34"
            >
              <span class="date-number">{{ day }}</span>
              <span v-if="index >= 3 && index <= 9" class="holiday-chip">国庆</span>
              <span
                v-if="
                  [3, 4, 5, 7, 8, 9, 10, 11, 14, 15, 17, 18, 21, 22, 24, 27, 29, 30, 32].includes(
                    index,
                  )
                "
                class="month-person"
              >
                {{ ['林恩宇', '陈护士', '王护士', '周医生'][index % 4] }}
              </span>
              <span v-if="[7, 14, 27].includes(index)" class="change-mark">{{
                index === 14 ? '换' : '加'
              }}</span>
            </button>
          </div>
          <section class="selected-summary">
            <header>
              <div><span>选中日期</span><strong>10月14日 · 周三</strong></div>
              <b>2 个班次</b>
            </header>
            <div class="summary-row">
              <span class="summary-dot" />
              <div><strong>王护士</strong><small>夜班 · 18:00–次日08:00 · 换班</small></div>
              <button type="button" aria-label="拨打王护士"><Ui2Icon name="phone" /></button>
            </div>
          </section>
        </section>

        <section v-else-if="activeView === 'week'" class="week-view" aria-label="周视图预览">
          <section class="week-calendar-card">
            <header class="month-toolbar week-month-toolbar">
              <button class="month-step" type="button" aria-label="上一周" @click="shiftWeek(-1)">
                <Ui2Icon name="chevron-left" />
              </button>
              <div class="month-heading">
                <strong>{{ weekTitle }}</strong
                ><span>{{ weekRange }}</span>
              </div>
              <button
                class="locate-button"
                type="button"
                aria-label="定位到今天"
                @click="locateToday"
              >
                <span class="locate-crosshair" aria-hidden="true">
                  <span class="locate-crosshair-center" />
                </span>
              </button>
              <button class="month-step" type="button" aria-label="下一周" @click="shiftWeek(1)">
                <Ui2Icon name="chevron-right" />
              </button>
            </header>
            <div class="week-weekday-row" aria-hidden="true">
              <span
                v-for="weekday in ['一', '二', '三', '四', '五', '六', '日']"
                :key="weekday"
                :class="{ weekend: weekday === '六' || weekday === '日' }"
                >{{ weekday }}</span
              >
            </div>
            <div class="week-rail" tabindex="0" aria-label="周一至周日七列排班轨道">
              <div class="week-grid">
                <article
                  v-for="(day, dayIndex) in weekDays"
                  :key="day.date"
                  class="week-day-card"
                  :style="{ minHeight: `${weekCardHeight}px` }"
                  :class="{
                    today: day.isToday,
                    weekend: day.isWeekend,
                    selected: selectedWeekdayIndex === dayIndex,
                  }"
                  role="button"
                  tabindex="0"
                  :aria-pressed="selectedWeekdayIndex === dayIndex"
                  :aria-label="
                    '选择' +
                    formatPreviewMonthDay(day.businessDate) +
                    ' 周' +
                    day.weekday +
                    '查看值班详情'
                  "
                  @click="selectWeekDay(dayIndex)"
                  @keydown.enter.prevent="selectWeekDay(dayIndex)"
                  @keydown.space.prevent="selectWeekDay(dayIndex)"
                >
                  <header class="week-day-heading">
                    <strong>{{ day.date }}</strong>
                    <span
                      v-if="day.holiday"
                      class="holiday-chip"
                      :class="`is-${day.holidayTone}`"
                      >{{ day.holiday }}</span
                    >
                  </header>
                  <div class="week-assignments">
                    <article
                      v-for="assignment in day.assignments"
                      :key="`${day.date}-${assignment.name}-${assignment.shift}`"
                      class="week-assignment"
                    >
                      <div class="assignment-top">
                        <strong class="assignment-name" :title="assignment.name">{{
                          assignment.name
                        }}</strong>
                      </div>
                      <div class="assignment-meta">
                        <span class="shift-pill" :title="assignment.shift">{{
                          assignment.shift.slice(0, 2)
                        }}</span>
                        <span
                          v-if="assignment.marker"
                          class="change-pill"
                          :aria-label="assignment.marker"
                          :title="assignment.marker"
                          >{{ assignment.marker === '换班' ? '换' : '加' }}</span
                        >
                      </div>
                      <span class="assignment-role">{{ assignment.role }}</span>
                      <span class="assignment-time">{{ assignment.time }}</span>
                    </article>
                  </div>
                </article>
              </div>
            </div>
          </section>
          <section class="selected-summary week-selected-summary" aria-label="选中日期值班详情">
            <header>
              <div>
                <span>选中日期</span>
                <strong
                  >{{ formatPreviewMonthDay(selectedWeekDay.businessDate) }} · 周{{
                    selectedWeekDay.weekday
                  }}</strong
                >
              </div>
              <b>{{ selectedWeekDay.assignments.length }} 个班次</b>
            </header>
            <div
              v-for="assignment in selectedWeekDay.assignments"
              :key="
                'selected-' + selectedWeekDay.date + '-' + assignment.name + '-' + assignment.shift
              "
              class="summary-row"
            >
              <span class="summary-dot" />
              <div>
                <strong>{{ assignment.name }}</strong>
                <small
                  >{{ assignment.shift }} · {{ assignment.time }} · {{ assignment.role
                  }}<template v-if="assignment.marker"> · {{ assignment.marker }}</template></small
                >
              </div>
              <button
                v-if="assignment.name !== '待定'"
                type="button"
                :aria-label="'拨打' + assignment.name"
              >
                <Ui2Icon name="phone" />
              </button>
            </div>
          </section>
        </section>

        <section v-else class="list-view" aria-label="列表视图预览">
          <header class="list-sticky-toolbar">
            <div class="list-month-bar">
              <button class="month-step" type="button" aria-label="上一月" @click="shiftMonth(-1)">
                <Ui2Icon name="chevron-left" />
              </button>
              <div>
                <strong>{{ monthLabel }}</strong
                ><small>31 天 · 12 个班次</small>
              </div>
              <button class="month-step" type="button" aria-label="下一月" @click="shiftMonth(1)">
                <Ui2Icon name="chevron-right" />
              </button>
              <button
                class="locate-button"
                type="button"
                aria-label="快速定位到今天"
                @click="locateToday"
              >
                <span class="locate-crosshair" aria-hidden="true">
                  <span class="locate-crosshair-center" />
                </span>
              </button>
            </div>
            <div class="list-meta">
              <span>月份工具栏固定 · 已按日期排序</span><b>今天 · 10/14</b>
            </div>
          </header>
          <div class="list-items">
            <article
              v-for="day in listDays"
              :key="day.date"
              class="list-day"
              :class="{ today: day.isToday, weekend: day.isWeekend }"
            >
              <header class="list-day-header">
                <strong>{{ day.date }}</strong
                ><span>{{ day.weekday }}</span
                ><span v-if="day.isToday" class="today-chip">今天</span
                ><b>{{ day.assignments.length }} 班</b>
              </header>
              <div
                v-for="assignment in day.assignments"
                :key="`${day.date}-${assignment.name}-${assignment.shift}`"
                class="list-assignment"
              >
                <div>
                  <strong>{{ assignment.name }}</strong
                  ><small
                    >{{ assignment.shift }} · {{ assignment.time }} · {{ assignment.role }}</small
                  >
                </div>
                <div class="list-actions">
                  <span v-if="assignment.marker" class="change-pill">{{ assignment.marker }}</span
                  ><button class="call-button" type="button" :aria-label="`拨打${assignment.name}`">
                    <Ui2Icon name="phone" />
                  </button>
                </div>
              </div>
            </article>
          </div>
        </section>
      </div>

      <nav class="bottom-nav" aria-label="手机主导航">
        <button class="active" type="button">
          <Ui2Icon name="calendar" /><span>排班日历</span>
        </button>
        <button type="button"><Ui2Icon name="leave" /><span>请假</span></button>
        <button type="button"><Ui2Icon name="swap" /><span>换班</span></button>
        <button type="button"><Ui2Icon name="adjustment" /><span>加扣班</span></button>
        <button type="button"><Ui2Icon name="more" /><span>更多</span></button>
      </nav>
      <div v-if="toastMessage" class="toast" role="status">{{ toastMessage }}</div>
    </main>
  </div>
</template>

<style scoped>
.calendar-preview-stage {
  --preview-canvas: #f4f7fb;
  --preview-surface: #fff;
  --preview-primary: #0a66d5;
  --preview-primary-tint: #eaf3ff;
  --preview-text: #16202a;
  --preview-muted: #5e6a78;
  --preview-border: #dce3eb;
  --preview-red: #df313a;
  --preview-red-tint: #fff0f1;
  --preview-amber: #a66700;
  --preview-amber-tint: #fff4d6;
  --preview-green: #167b63;
  --preview-green-tint: #e4f5ef;
  min-height: 100vh;
  padding: 24px;
  color: var(--preview-text);
  background:
    radial-gradient(circle at 50% 0, rgb(10 102 213 / 8%), transparent 32%), var(--preview-canvas);
  font-family:
    -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'PingFang SC', 'Segoe UI', 'Microsoft YaHei',
    sans-serif;
}

.preview-shell {
  position: relative;
  display: flex;
  width: min(390px, 100%);
  height: 844px;
  margin: 0 auto;
  overflow: hidden;
  flex-direction: column;
  background: var(--preview-canvas);
  border: 1px solid rgb(22 32 42 / 10%);
  border-radius: 32px;
  box-shadow: 0 24px 80px rgb(22 32 42 / 18%);
}

.layout-desktop .preview-shell {
  width: min(1180px, 100%);
  height: auto;
  min-height: 760px;
  border-radius: 22px;
}

button {
  font: inherit;
}
button:focus-visible {
  outline: 3px solid rgb(10 102 213 / 28%);
  outline-offset: 2px;
}

.app-header {
  display: flex;
  min-height: 68px;
  padding: 16px 16px 9px;
  align-items: flex-end;
  justify-content: space-between;
  background: rgb(255 255 255 / 96%);
  border-bottom: 1px solid var(--preview-border);
}
.app-heading {
  min-width: 0;
}
.app-heading > span {
  display: block;
  max-width: 240px;
  overflow: hidden;
  color: var(--preview-muted);
  font-size: 11px;
  font-weight: 650;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.app-heading h1 {
  margin: 4px 0 0;
  font-size: 20px;
  line-height: 1;
  letter-spacing: -0.04em;
}
.header-actions {
  display: flex;
  gap: 8px;
}
.header-actions button {
  display: grid;
  width: 42px;
  height: 42px;
  place-items: center;
  color: var(--preview-text);
  background: #f5f8fc;
  border: 0;
  border-radius: 14px;
  cursor: pointer;
}
.header-actions button + button {
  color: var(--preview-primary);
  background: var(--preview-surface);
  border: 1px solid var(--preview-border);
  font-size: 23px;
  line-height: 1;
}
.header-actions .ui2-icon {
  width: 19px;
  height: 19px;
}

.preview-scroll {
  min-height: 0;
  flex: 1;
  overflow: auto;
  scrollbar-width: none;
}
.preview-scroll::-webkit-scrollbar {
  display: none;
}
.view-toolbar {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 8px;
  padding: 14px 12px 0;
  align-items: center;
}
.segmented {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  padding: 3px;
  background: #e8edf3;
  border-radius: 14px;
}
.segmented button {
  min-height: 44px;
  padding: 0 8px;
  color: var(--preview-muted);
  background: transparent;
  border: 0;
  border-radius: 11px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 650;
}
.segmented button.active {
  color: var(--preview-text);
  background: var(--preview-surface);
  box-shadow: 0 2px 8px rgb(22 32 42 / 9%);
}
.filter-button {
  display: inline-flex;
  min-height: 44px;
  padding: 0 10px;
  align-items: center;
  justify-content: center;
  gap: 5px;
  color: var(--preview-primary);
  background: var(--preview-surface);
  border: 1px solid var(--preview-border);
  border-radius: 12px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 650;
}
.filter-button .ui2-icon {
  width: 17px;
  height: 17px;
}

.month-card,
.week-calendar-card,
.list-day {
  background: var(--preview-surface);
  border: 1px solid var(--preview-border);
  border-radius: 18px;
  box-shadow: 0 5px 16px rgb(21 43 67 / 7%);
}
.month-card {
  margin: 12px;
  overflow: hidden;
}
.month-toolbar {
  display: grid;
  grid-template-columns: 44px minmax(0, 1fr) 40px 44px;
  min-height: 62px;
  padding: 4px 6px;
  align-items: center;
  border-bottom: 1px solid var(--preview-border);
}
.month-heading {
  display: grid;
  min-width: 0;
  gap: 2px;
  text-align: center;
}
.month-heading strong {
  font-size: 15px;
  letter-spacing: -0.02em;
}
.month-heading span {
  color: var(--preview-muted);
  font-size: 10px;
}
.month-step {
  display: grid;
  width: 44px;
  height: 44px;
  padding: 0;
  place-items: center;
  color: var(--preview-primary);
  background: transparent;
  border: 0;
  border-radius: 12px;
  cursor: pointer;
}
.month-step .ui2-icon {
  width: 20px;
  height: 20px;
}

.locate-button {
  display: grid;
  width: 38px;
  height: 38px;
  padding: 0;
  box-sizing: border-box;
  place-items: center;
  color: var(--preview-primary);
  background: transparent;
  border: 0;
  border-radius: 12px;
  box-shadow: none;
  cursor: pointer;
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
  content: '';
  border: 2px solid currentColor;
  border-radius: 50%;
}
.locate-crosshair-center {
  position: absolute;
  top: 6px;
  left: 6px;
  width: 4px;
  height: 4px;
  background: currentColor;
  border-radius: 50%;
}

.weekday-row,
.month-grid {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
}
.weekday-row {
  height: 28px;
  align-items: center;
  color: var(--preview-muted);
  background: #f8fafc;
  font-size: 11px;
  font-weight: 650;
  text-align: center;
}
.weekday-row span:nth-last-child(-n + 2) {
  color: var(--preview-red);
}
.month-grid {
  gap: 1px;
  background: var(--preview-border);
}
.month-cell {
  position: relative;
  display: flex;
  min-height: 53px;
  padding: 4px 3px;
  overflow: hidden;
  flex-direction: column;
  align-items: flex-start;
  color: var(--preview-text);
  background: var(--preview-surface);
  border: 0;
  cursor: pointer;
  text-align: left;
}
.month-cell.outside {
  color: #a7b0bb;
  background: #fafbfd;
  cursor: default;
}
.month-cell.weekend .date-number {
  color: var(--preview-red);
}
.month-cell.holiday {
  background: var(--preview-red-tint);
}
.month-cell.selected {
  z-index: 1;
  box-shadow: inset 0 0 0 2px var(--preview-primary);
}
.month-cell.today .date-number {
  color: #fff;
  background: var(--preview-primary);
}
.date-number {
  display: inline-grid;
  min-width: 18px;
  height: 18px;
  padding: 0 3px;
  place-items: center;
  border-radius: 99px;
  font-size: 10px;
  font-weight: 700;
}
.holiday-chip,
.today-chip,
.change-pill,
.shift-pill {
  display: inline-flex;
  min-height: 16px;
  padding: 0 5px;
  align-items: center;
  border-radius: 5px;
  font-size: 9px;
  font-weight: 750;
  white-space: nowrap;
}
.holiday-chip {
  color: #ad2d36;
  background: #fee1e4;
}
.holiday-chip.is-workday {
  color: #1f5aa6;
  background: #e8f1fb;
}
.month-cell > .holiday-chip {
  position: absolute;
  top: 4px;
  right: 3px;
  max-width: 28px;
  overflow: hidden;
}
.month-person {
  display: block;
  max-width: 100%;
  margin-top: 2px;
  overflow: hidden;
  font-size: 9px;
  font-weight: 650;
  text-overflow: clip;
  white-space: nowrap;
}
.change-mark {
  display: inline-grid;
  position: absolute;
  right: 3px;
  bottom: 4px;
  width: 13px;
  height: 13px;
  place-items: center;
  color: var(--preview-amber);
  background: var(--preview-amber-tint);
  border-radius: 4px;
  font-size: 8px;
  font-weight: 750;
}

.selected-summary {
  margin: 12px;
  padding: 12px;
  background: linear-gradient(145deg, #fff, #f3f8ff);
  border: 1px solid #cfe1f7;
  border-radius: 16px;
}
.selected-summary header,
.summary-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.selected-summary header > div {
  display: grid;
  gap: 2px;
}
.selected-summary header span {
  color: var(--preview-primary);
  font-size: 10px;
  font-weight: 750;
}
.selected-summary header strong {
  font-size: 14px;
}
.selected-summary header b {
  padding: 5px 8px;
  color: var(--preview-primary);
  background: var(--preview-primary-tint);
  border-radius: 99px;
  font-size: 10px;
  white-space: nowrap;
}
.summary-row {
  padding-top: 10px;
  margin-top: 10px;
  border-top: 1px solid #e6eef7;
}
.summary-dot {
  width: 5px;
  height: 30px;
  flex: 0 0 auto;
  background: #63a7ee;
  border-radius: 99px;
}
.summary-row > div {
  min-width: 0;
  flex: 1;
}
.summary-row strong,
.summary-row small {
  display: block;
}
.summary-row strong {
  font-size: 12px;
}
.summary-row small {
  margin-top: 2px;
  color: var(--preview-muted);
  font-size: 10px;
}
.summary-row button {
  display: grid;
  width: 30px;
  height: 30px;
  place-items: center;
  color: var(--preview-green);
  background: var(--preview-green-tint);
  border: 0;
  border-radius: 10px;
}
.summary-row .ui2-icon {
  width: 15px;
  height: 15px;
}

.week-view {
  margin: 12px;
}
.week-calendar-card {
  overflow: hidden;
}
.week-month-toolbar {
  border-bottom: 1px solid var(--preview-border);
}
.week-weekday-row {
  display: grid;
  min-height: 28px;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  align-items: center;
  color: var(--preview-muted);
  background: #f8fafc;
  font-size: 11px;
  font-weight: 650;
  text-align: center;
}
.week-weekday-row span.weekend {
  color: var(--preview-red);
}
.week-rail {
  overflow-x: hidden;
}
.week-grid {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 1px;
  min-width: 0;
  align-items: stretch;
  background: var(--preview-border);
}
.week-day-card {
  display: flex;
  min-width: 0;
  padding: 8px;
  flex-direction: column;
  align-items: stretch;
  background: var(--preview-surface);
  border: 0;
  border-radius: 0;
  cursor: pointer;
  transition: box-shadow 160ms ease;
}
.week-day-card.today {
  background: var(--preview-primary-tint);
  box-shadow: inset 0 0 0 1px var(--preview-primary);
}
.week-day-card.selected {
  box-shadow: inset 0 0 0 2px var(--preview-primary);
}
.week-day-card:focus-visible {
  outline: 3px solid rgb(10 102 213 / 28%);
  outline-offset: -3px;
}
.week-day-card.weekend .week-day-heading strong {
  color: var(--preview-red);
}
.week-day-heading {
  display: flex;
  min-width: 0;
  min-height: 24px;
  align-items: flex-start;
  justify-content: space-between;
  gap: 2px;
}
.week-day-heading strong {
  display: inline-grid;
  min-width: 20px;
  height: 20px;
  place-items: center;
  border-radius: 50%;
  font-size: 12px;
  line-height: 20px;
}
.week-day-card.today .week-day-heading strong {
  color: var(--preview-text);
  background: #ffca28;
}
.today-chip {
  color: var(--preview-primary);
  background: var(--preview-primary-tint);
}
.week-day-heading .holiday-chip {
  max-width: calc(100% - 20px);
  padding-inline: 3px;
  overflow: hidden;
  text-overflow: ellipsis;
}
.week-assignments {
  display: grid;
  margin-top: 4px;
  gap: 5px;
}
.week-assignment {
  display: grid;
  min-width: 0;
  gap: 2px;
}
.assignment-top {
  display: flex;
  min-width: 0;
  align-items: center;
}
.assignment-name {
  display: block;
  min-width: 0;
  overflow-wrap: anywhere;
  font-size: 11px;
  line-height: 1.25;
  white-space: normal;
}
.assignment-meta {
  display: flex;
  min-width: 0;
  flex-wrap: nowrap;
  align-items: center;
  gap: 2px;
}
.shift-pill {
  max-width: 100%;
  padding-inline: 2px;
  overflow: hidden;
  color: #1d5b97;
  background: #e7f1fc;
  text-overflow: clip;
  white-space: nowrap;
}
.assignment-role,
.assignment-time {
  color: var(--preview-muted);
  font-size: 9px;
  line-height: 1.25;
}
.assignment-role {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.assignment-time {
  font-variant-numeric: tabular-nums;
}
.change-pill {
  width: fit-content;
  color: var(--preview-amber);
  background: var(--preview-amber-tint);
}
.call-button {
  display: grid;
  width: 28px;
  height: 28px;
  padding: 0;
  place-items: center;
  color: var(--preview-green);
  background: var(--preview-green-tint);
  border: 0;
  border-radius: 9px;
  cursor: pointer;
}
.call-button .ui2-icon {
  width: 14px;
  height: 14px;
}
.week-selected-summary {
  margin: 12px 0 0;
}

.list-view {
  margin: 12px;
}
.list-sticky-toolbar {
  position: sticky;
  z-index: 2;
  top: 0;
  padding: 0 0 9px;
  background: rgb(244 247 251 / 93%);
  backdrop-filter: blur(12px);
}
.list-month-bar {
  display: grid;
  grid-template-columns: 38px minmax(0, 1fr) 38px 38px;
  gap: 5px;
  padding: 4px;
  align-items: center;
  background: var(--preview-surface);
  border: 1px solid var(--preview-border);
  border-radius: 14px;
  box-shadow: 0 5px 16px rgb(21 43 67 / 7%);
}
.list-month-bar .month-step {
  width: 38px;
  height: 38px;
}
.list-month-bar > div {
  min-width: 0;
  text-align: center;
}
.list-month-bar strong,
.list-month-bar small {
  display: block;
}
.list-month-bar strong {
  font-size: 14px;
}
.list-month-bar small {
  color: var(--preview-muted);
  font-size: 10px;
}
.list-meta {
  display: flex;
  padding: 8px 2px 0;
  align-items: center;
  justify-content: space-between;
  color: var(--preview-muted);
  font-size: 10px;
}
.list-meta b {
  color: var(--preview-primary);
}
.list-items {
  display: grid;
  gap: 8px;
}
.list-day {
  padding: 11px;
  border-radius: 14px;
  box-shadow: none;
}
.list-day.today {
  padding: 10px;
  background: var(--preview-primary-tint);
  border: 2px solid var(--preview-primary);
}
.list-day.weekend .list-day-header > strong,
.list-day.weekend .list-day-header > span {
  color: var(--preview-red);
}
.list-day-header {
  display: flex;
  align-items: center;
  gap: 7px;
  padding-bottom: 8px;
}
.list-day-header > strong {
  font-size: 14px;
  font-variant-numeric: tabular-nums;
}
.list-day-header > span {
  color: var(--preview-muted);
  font-size: 11px;
}
.list-day-header > b {
  margin-left: auto;
  padding: 4px 7px;
  color: var(--preview-primary);
  background: var(--preview-primary-tint);
  border-radius: 99px;
  font-size: 9px;
}
.list-assignment {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 8px;
  padding: 8px 0;
  align-items: center;
  border-top: 1px solid #edf1f5;
}
.list-assignment > div:first-child {
  min-width: 0;
}
.list-assignment strong,
.list-assignment small {
  display: block;
}
.list-assignment strong {
  font-size: 12px;
}
.list-assignment small {
  margin-top: 3px;
  color: var(--preview-muted);
  font-size: 9px;
}
.list-actions {
  display: flex;
  align-items: center;
  gap: 5px;
}

.bottom-nav {
  display: grid;
  min-height: 68px;
  padding: 5px 4px;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  background: rgb(255 255 255 / 97%);
  border-top: 1px solid var(--preview-border);
  box-shadow: 0 -7px 20px rgb(21 43 67 / 7%);
}
.bottom-nav button {
  display: grid;
  min-height: 54px;
  padding: 3px 1px;
  place-items: center;
  color: #657488;
  background: transparent;
  border: 0;
  border-radius: 12px;
  cursor: pointer;
  font-size: 10px;
  font-weight: 650;
}
.bottom-nav button.active {
  color: var(--preview-primary);
  background: var(--preview-primary-tint);
}
.bottom-nav .ui2-icon {
  width: 20px;
  height: 20px;
}
.toast {
  position: absolute;
  right: 16px;
  bottom: 80px;
  padding: 9px 12px;
  color: #fff;
  background: rgb(22 32 42 / 92%);
  border-radius: 10px;
  box-shadow: 0 5px 16px rgb(21 43 67 / 14%);
  font-size: 11px;
}

@media (max-width: 640px) {
  .calendar-preview-stage {
    padding: 0;
  }
  .preview-shell {
    border-radius: 0;
    box-shadow: none;
  }
  .week-grid {
    grid-template-columns: repeat(7, minmax(0, 1fr));
    gap: 1px;
  }
  .week-rail {
    padding-bottom: 0;
  }
  .week-day-card {
    min-width: 0;
    padding: 4px 3px;
    border-radius: 0;
  }
  .week-day-heading {
    min-height: 20px;
    gap: 2px;
  }
  .week-day-heading strong {
    min-width: 18px;
    height: 18px;
    font-size: 11px;
    line-height: 18px;
  }
  .week-day-heading .holiday-chip {
    min-height: 14px;
    padding: 0 2px;
    font-size: 8px;
  }
  .week-assignments {
    margin-top: 3px;
  }
  .week-assignment {
    gap: 2px;
  }
  .assignment-name {
    font-size: 10px;
    line-height: 1.2;
  }
  .assignment-meta {
    gap: 1px;
  }
  .assignment-role,
  .assignment-time {
    display: none;
  }
  .shift-pill,
  .change-pill {
    min-height: 14px;
    padding: 0 2px;
    font-size: 8px;
  }
  .call-button .ui2-icon {
    width: 12px;
    height: 12px;
  }
}

@media (min-width: 641px) {
  .layout-mobile .preview-shell {
    margin-top: 4px;
  }
  .layout-desktop .week-grid {
    gap: 1px;
  }
  .layout-desktop .week-rail {
    overflow-x: hidden;
  }
}
</style>
