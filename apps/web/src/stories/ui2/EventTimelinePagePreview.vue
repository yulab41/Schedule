<script setup lang="ts">
import { computed, ref } from 'vue';

import Ui2Icon from './Ui2Icon.vue';

interface PreviewEvent {
  actor: string;
  affected: string;
  date: string;
  day: string;
  detail?: string;
  id: string;
  narrative: string;
  time: string;
  title: string;
  tone: 'amber' | 'blue' | 'green' | 'violet';
  type: string;
}

interface PreviewEventDay {
  date: string;
  day: string;
  events: readonly PreviewEvent[];
  key: string;
}

const props = withDefaults(
  defineProps<{
    readonly layout?: 'desktop' | 'mobile';
  }>(),
  { layout: 'mobile' },
);

const selectedEventId = ref('swap');
const activeFilter = ref('全部');
const filters = ['全部', '换班', '请假', '排班发布'] as const;
const events: readonly PreviewEvent[] = [
  {
    id: 'swap',
    date: '8月16日',
    day: '今天 · 周日',
    time: '15:42',
    type: '换班',
    title: '换班已生效',
    narrative: '林恩宇与周承泽完成 8月19日全天班互换。',
    affected: '林恩宇、周承泽',
    actor: '陈思敏（群主）',
    detail: '值班人员：林恩宇 → 周承泽；关联申请 #SW-0819 已归档。',
    tone: 'violet',
  },
  {
    id: 'leave',
    date: '8月16日',
    day: '今天 · 周日',
    time: '11:08',
    type: '请假',
    title: '请假已批准',
    narrative: '黄嘉雯 8月22日至23日的事假申请已批准。',
    affected: '黄嘉雯',
    actor: '陈思敏（群主）',
    detail: '替班策略：保持原顺序；相关班次等待重新安排。',
    tone: 'green',
  },
  {
    id: 'publish',
    date: '8月15日',
    day: '昨天 · 周六',
    time: '18:30',
    type: '排班',
    title: '9月排班已发布',
    narrative: '头颈外科医生 2026年9月排班版本 V3 已生效。',
    affected: '7 位成员',
    actor: '林恩宇（群主）',
    detail: '发布版本 V3；替换草稿 V2；共 30 天、62 个班次。',
    tone: 'blue',
  },
  {
    id: 'shift',
    date: '8月14日',
    day: '周五',
    time: '09:16',
    type: '配置',
    title: '夜班时段已调整',
    narrative: '夜班结束时间由次日 07:30 调整为次日 08:00。',
    affected: '夜班',
    actor: '后台管理员',
    detail: '开始时间保持 18:00；继续启用并计入统计。',
    tone: 'amber',
  },
];

const eventDays: readonly PreviewEventDay[] = [
  {
    key: '2026-08-16',
    date: '8月16日',
    day: '今天 · 周日',
    events: events.slice(0, 2),
  },
  {
    key: '2026-08-15',
    date: '8月15日',
    day: '昨天 · 周六',
    events: events.slice(2, 3),
  },
  {
    key: '2026-08-14',
    date: '8月14日',
    day: '周五',
    events: events.slice(3, 4),
  },
];
const expandedDateKeys = ref<string[]>(eventDays.map((day) => day.key));

const visibleEventDays = computed<readonly PreviewEventDay[]>(() => {
  if (activeFilter.value === '全部') return eventDays;
  return eventDays
    .map((day) => ({
      ...day,
      events: day.events.filter((event) =>
        activeFilter.value === '排班发布'
          ? event.type === '排班'
          : event.type === activeFilter.value,
      ),
    }))
    .filter((day) => day.events.length > 0);
});

const visibleEventCount = computed(() =>
  visibleEventDays.value.reduce((total, day) => total + day.events.length, 0),
);

function toggleDetail(id: string): void {
  selectedEventId.value = selectedEventId.value === id ? '' : id;
}

function isDateExpanded(key: string): boolean {
  return expandedDateKeys.value.includes(key);
}

function toggleDate(key: string): void {
  expandedDateKeys.value = isDateExpanded(key)
    ? expandedDateKeys.value.filter((item) => item !== key)
    : [...expandedDateKeys.value, key];
}

function expandAllDates(): void {
  expandedDateKeys.value = eventDays.map((day) => day.key);
}

function collapseAllDates(): void {
  expandedDateKeys.value = [];
  selectedEventId.value = '';
}
</script>

<template>
  <main class="event-page-preview" :class="`layout-${props.layout}`">
    <div class="event-shell">
      <header class="page-heading">
        <div>
          <p>记录与审计</p>
          <h1>事件</h1>
          <span>按时间查看排班如何变化，以及谁完成了操作。</span>
        </div>
        <button class="filter-button" type="button"><Ui2Icon name="filter" />筛选</button>
      </header>

      <nav class="filter-pills" aria-label="事件类型筛选">
        <button
          v-for="filter in filters"
          :key="filter"
          type="button"
          :class="{ active: activeFilter === filter }"
          :aria-pressed="activeFilter === filter"
          @click="activeFilter = filter"
        >
          {{ filter }}
        </button>
      </nav>

      <section class="timeline-section" aria-labelledby="timeline-heading">
        <header>
          <div>
            <h2 id="timeline-heading">最近动态</h2>
            <span>{{ visibleEventCount }} 条</span>
          </div>
          <div class="timeline-header-actions">
            <small>北京时间 · 新到旧</small>
            <button type="button" aria-label="展开全部日期" @click="expandAllDates">展开</button>
            <button type="button" aria-label="折叠全部日期" @click="collapseAllDates">折叠</button>
          </div>
        </header>

        <ol class="timeline-rail">
          <li v-for="day in visibleEventDays" :key="day.key" class="timeline-day-group">
            <div class="timeline-day-label">
              <button
                class="timeline-day-toggle"
                type="button"
                :aria-expanded="isDateExpanded(day.key)"
                :aria-label="`${isDateExpanded(day.key) ? '折叠' : '展开'}${day.date}事件`"
                @click="toggleDate(day.key)"
              >
                <span class="timeline-date-copy">
                  <strong>{{ day.date }}</strong>
                  <small>{{ day.day }}</small>
                </span>
                <span class="timeline-date-dot" aria-hidden="true" />
                <span class="timeline-date-meta">
                  <b>{{ day.events.length }} 条</b>
                  <Ui2Icon name="chevron-right" />
                </span>
              </button>
            </div>
            <Transition name="date-fold">
              <ol v-if="isDateExpanded(day.key)" class="timeline-day-events">
                <li v-for="event in day.events" :key="event.id" class="timeline-node">
                  <span aria-hidden="true" />
                  <span class="timeline-dot" :class="`is-${event.tone}`" aria-hidden="true" />
                  <article class="event-summary-card" :class="`is-${event.tone}`">
                    <header>
                      <div>
                        <time>{{ event.time }}</time
                        ><span>{{ event.type }}</span>
                      </div>
                      <button
                        type="button"
                        :aria-expanded="selectedEventId === event.id"
                        :aria-label="`${selectedEventId === event.id ? '收起' : '展开'}${event.title}`"
                        @click="toggleDetail(event.id)"
                      >
                        <Ui2Icon name="chevron-right" />
                      </button>
                    </header>
                    <h3>{{ event.title }}</h3>
                    <p>{{ event.narrative }}</p>
                    <dl>
                      <div>
                        <dt>涉及</dt>
                        <dd>{{ event.affected }}</dd>
                      </div>
                      <div>
                        <dt>操作人</dt>
                        <dd>{{ event.actor }}</dd>
                      </div>
                    </dl>
                    <div v-if="selectedEventId === event.id" class="event-detail">
                      <span aria-hidden="true"><Ui2Icon name="check" /></span>
                      <p>{{ event.detail }}</p>
                    </div>
                  </article>
                </li>
              </ol>
            </Transition>
          </li>
        </ol>
      </section>

      <button class="load-more-button" type="button">查看更早事件</button>
    </div>
  </main>
</template>

<style scoped>
:global(body) {
  min-width: 0;
}

.event-page-preview {
  --blue: #0a66d5;
  --blue-soft: #eaf3ff;
  --canvas: #f4f7fb;
  --surface: #fff;
  --text: #16202a;
  --muted: #637083;
  --border: #dce3eb;
  min-height: 100vh;
  color: var(--text);
  background:
    radial-gradient(circle at 88% 0, rgb(10 102 213 / 8%), transparent 320px), var(--canvas);
  font-family:
    -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'PingFang SC', 'Segoe UI', 'Microsoft YaHei',
    sans-serif;
}

.event-shell {
  width: min(100%, 980px);
  margin: 0 auto;
  padding: 28px 20px 44px;
  box-sizing: border-box;
}

.page-heading {
  display: flex;
  margin-bottom: 16px;
  align-items: flex-end;
  justify-content: space-between;
  gap: 18px;
}

.page-heading p,
.page-heading h1,
.page-heading span {
  margin: 0;
}

.page-heading p {
  color: var(--blue);
  font-size: 12px;
  font-weight: 750;
  letter-spacing: 0.08em;
}

.page-heading h1 {
  margin-top: 3px;
  font-size: clamp(28px, 5vw, 38px);
  letter-spacing: -0.03em;
  line-height: 1.1;
}

.page-heading div > span {
  display: block;
  margin-top: 6px;
  color: var(--muted);
  font-size: 13px;
}

.filter-button,
.filter-pills button,
.load-more-button,
.event-summary-card header button {
  min-height: 44px;
  border-radius: 12px;
  cursor: pointer;
  font: inherit;
}

.filter-button {
  display: inline-flex;
  padding: 0 13px;
  align-items: center;
  gap: 6px;
  color: var(--blue);
  background: #fff;
  border: 1px solid var(--border);
  font-size: 13px;
  font-weight: 700;
}

.filter-button .ui2-icon {
  width: 16px;
  height: 16px;
}

.filter-pills {
  display: flex;
  margin-bottom: 14px;
  padding: 3px;
  overflow-x: auto;
  gap: 3px;
  background: #e8edf3;
  border-radius: 14px;
  scrollbar-width: none;
}

.filter-pills::-webkit-scrollbar {
  display: none;
}

.filter-pills button {
  min-width: 70px;
  padding: 0 12px;
  flex: 1 0 auto;
  color: #506075;
  background: transparent;
  border: 0;
  font-size: 12px;
  font-weight: 700;
}

.filter-pills button.active {
  color: var(--text);
  background: #fff;
  box-shadow: 0 2px 8px rgb(22 32 42 / 10%);
}

.timeline-section {
  padding: 0 16px 16px;
  background: rgb(255 255 255 / 84%);
  border: 1px solid var(--border);
  border-radius: 20px;
  box-shadow: 0 10px 32px rgb(26 45 68 / 7%);
  backdrop-filter: blur(14px);
}

.timeline-section > header {
  display: flex;
  min-height: 58px;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  border-bottom: 1px solid #e7ecf2;
}

.timeline-section > header > div {
  display: flex;
  align-items: center;
  gap: 8px;
}

.timeline-section h2 {
  margin: 0;
  font-size: 16px;
}

.timeline-section > header span {
  padding: 3px 7px;
  color: var(--blue);
  background: var(--blue-soft);
  border-radius: 999px;
  font-size: 10px;
  font-weight: 750;
}

.timeline-section > header small {
  color: var(--muted);
  font-size: 10px;
}

.timeline-header-actions {
  display: flex;
  align-items: center;
  gap: 5px;
}

.timeline-header-actions button {
  min-height: 44px;
  padding: 0 9px;
  color: var(--blue);
  background: transparent;
  border: 0;
  border-radius: 9px;
  cursor: pointer;
  font: inherit;
  font-size: 10px;
  font-weight: 700;
}

.timeline-header-actions button:hover {
  background: var(--blue-soft);
}

.timeline-rail {
  --date-column: 72px;
  --rail-column: 18px;
  position: relative;
  display: grid;
  margin: 0;
  padding: 14px 0 0;
  gap: 12px;
  list-style: none;
}

.timeline-rail::before {
  position: absolute;
  top: 31px;
  bottom: 28px;
  left: calc(var(--date-column) + var(--rail-column) / 2 - 1px);
  width: 2px;
  background: linear-gradient(#7eb6f4, #d6e1ed 88%);
  border-radius: 999px;
  content: '';
}

.timeline-day-group {
  position: relative;
  display: grid;
  gap: 7px;
}

.timeline-day-events {
  display: grid;
  margin: 0;
  padding: 0;
  gap: 10px;
  list-style: none;
}

.timeline-node {
  position: relative;
  display: grid;
  grid-template-columns: var(--date-column) var(--rail-column) minmax(0, 1fr);
  align-items: start;
  gap: 0 10px;
}

.timeline-day-label {
  min-width: 0;
}

.timeline-day-toggle {
  display: grid;
  width: 100%;
  min-height: 44px;
  padding: 0;
  grid-template-columns: var(--date-column) var(--rail-column) minmax(0, 1fr);
  align-items: center;
  gap: 0 10px;
  color: inherit;
  background: transparent;
  border: 0;
  border-radius: 11px;
  cursor: pointer;
  font: inherit;
}

.timeline-date-copy {
  display: grid;
  min-width: 0;
  text-align: right;
}

.timeline-date-copy strong {
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}

.timeline-date-copy small {
  margin-top: 2px;
  color: var(--muted);
  font-size: 9px;
}

.timeline-date-dot {
  z-index: 1;
  width: 14px;
  height: 14px;
  margin: 0 auto;
  background: #fff;
  border: 3px solid var(--blue);
  border-radius: 50%;
  box-shadow: 0 0 0 3px var(--blue-soft);
  box-sizing: border-box;
}

.timeline-date-meta {
  display: flex;
  min-width: 0;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.timeline-date-meta b {
  padding: 4px 7px;
  color: #425165;
  background: #eef2f6;
  border-radius: 999px;
  font-size: 9px;
}

.timeline-date-meta .ui2-icon {
  width: 16px;
  height: 16px;
  margin-right: 9px;
  color: var(--blue);
  transition: transform 180ms ease;
}

.timeline-day-toggle[aria-expanded='true'] .timeline-date-meta .ui2-icon {
  transform: rotate(90deg);
}

.timeline-dot {
  z-index: 1;
  width: 12px;
  height: 12px;
  margin: 11px auto 0;
  background: #7d8b9b;
  border: 3px solid #fff;
  border-radius: 50%;
  box-shadow: 0 0 0 2px #cbd7e5;
  box-sizing: border-box;
}

.timeline-dot.is-blue {
  background: var(--blue);
  box-shadow: 0 0 0 2px #9dc6f4;
}

.timeline-dot.is-green {
  background: #248168;
  box-shadow: 0 0 0 2px #acd9cd;
}

.timeline-dot.is-violet {
  background: #6656c7;
  box-shadow: 0 0 0 2px #c6bef0;
}

.timeline-dot.is-amber {
  background: #ad7411;
  box-shadow: 0 0 0 2px #ead19f;
}

.event-summary-card {
  min-width: 0;
  padding: 11px 12px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 15px;
  box-shadow: 0 5px 18px rgb(26 45 68 / 5%);
}

.event-summary-card.is-blue {
  border-left: 3px solid var(--blue);
}

.event-summary-card.is-green {
  border-left: 3px solid #248168;
}

.event-summary-card.is-violet {
  border-left: 3px solid #6656c7;
}

.event-summary-card.is-amber {
  border-left: 3px solid #ad7411;
}

.event-summary-card > header {
  display: flex;
  min-height: 32px;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
}

.event-summary-card > header > div {
  display: flex;
  align-items: center;
  gap: 7px;
}

.event-summary-card time {
  color: var(--muted);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  font-weight: 650;
}

.event-summary-card > header span {
  padding: 3px 7px;
  color: #425165;
  background: #eef2f6;
  border-radius: 999px;
  font-size: 9px;
  font-weight: 750;
}

.event-summary-card header button {
  display: grid;
  width: 44px;
  min-height: 44px;
  margin: -8px -8px 0 0;
  padding: 0;
  place-items: center;
  color: var(--blue);
  background: transparent;
  border: 0;
}

.event-summary-card header button .ui2-icon {
  width: 17px;
  height: 17px;
  transition: transform 180ms ease;
}

.event-summary-card header button[aria-expanded='true'] .ui2-icon {
  transform: rotate(90deg);
}

.event-summary-card h3 {
  margin: -2px 0 4px;
  font-size: 14px;
}

.event-summary-card > p {
  margin: 0;
  color: #425165;
  font-size: 11px;
  line-height: 1.5;
}

.event-summary-card dl {
  display: flex;
  margin: 9px 0 0;
  flex-wrap: wrap;
  gap: 5px 12px;
}

.event-summary-card dl div {
  display: flex;
  min-width: 0;
  gap: 4px;
  font-size: 9px;
}

.event-summary-card dt {
  color: var(--muted);
}

.event-summary-card dd {
  margin: 0;
  color: #425165;
  font-weight: 650;
}

.event-detail {
  display: grid;
  margin-top: 10px;
  padding: 9px;
  grid-template-columns: 24px minmax(0, 1fr);
  align-items: start;
  gap: 7px;
  background: var(--blue-soft);
  border-radius: 10px;
}

.event-detail > span {
  display: grid;
  width: 22px;
  height: 22px;
  place-items: center;
  color: #fff;
  background: var(--blue);
  border-radius: 50%;
}

.event-detail .ui2-icon {
  width: 12px;
  height: 12px;
}

.event-detail p {
  margin: 1px 0 0;
  color: #2f4f75;
  font-size: 10px;
  line-height: 1.5;
}

.date-fold-enter-active,
.date-fold-leave-active {
  transition:
    opacity 180ms ease,
    translate 180ms ease;
}

.date-fold-enter-from,
.date-fold-leave-to {
  opacity: 0;
  translate: 0 -5px;
}

.load-more-button {
  display: block;
  min-width: 132px;
  margin: 14px auto 0;
  padding: 0 16px;
  color: var(--blue);
  background: transparent;
  border: 0;
  font-size: 12px;
  font-weight: 700;
}

button:focus-visible {
  outline: 3px solid rgb(10 102 213 / 30%);
  outline-offset: 2px;
}

@media (max-width: 640px) {
  .event-shell {
    padding: 22px 10px 32px;
  }

  .page-heading {
    padding-inline: 4px;
    align-items: flex-start;
  }

  .page-heading div > span {
    max-width: 235px;
    line-height: 1.5;
  }

  .filter-button {
    padding-inline: 11px;
  }

  .filter-pills button {
    min-width: 72px;
  }

  .timeline-section {
    padding-inline: 9px;
    border-radius: 17px;
  }

  .timeline-rail {
    --date-column: 58px;
    --rail-column: 16px;
    gap: 10px;
  }

  .timeline-node {
    gap: 0 6px;
  }

  .timeline-date-copy strong {
    font-size: 10px;
  }

  .timeline-date-copy small {
    font-size: 8px;
  }

  .timeline-header-actions small {
    display: none;
  }

  .event-summary-card {
    padding: 10px;
    border-radius: 13px;
  }

  .event-summary-card dl {
    display: grid;
    gap: 3px;
  }
}

@media (max-width: 340px) {
  .event-shell {
    padding-inline: 7px;
  }

  .page-heading div > span {
    max-width: 190px;
  }

  .timeline-rail {
    --date-column: 48px;
    --rail-column: 14px;
  }

  .timeline-date-copy strong {
    font-size: 9px;
  }

  .timeline-date-copy small {
    display: none;
  }

  .event-summary-card > p {
    font-size: 10px;
  }
}

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    transition: none !important;
  }
}
</style>
