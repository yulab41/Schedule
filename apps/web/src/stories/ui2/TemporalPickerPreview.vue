<script setup lang="ts">
import { computed, ref, watch } from 'vue';

type PickerKind = 'month' | 'date' | 'time';

const props = withDefaults(
  defineProps<{
    readonly initialKind?: PickerKind;
    readonly layout?: 'desktop' | 'mobile';
  }>(),
  { initialKind: 'month', layout: 'mobile' },
);

const kinds: readonly { readonly label: string; readonly value: PickerKind }[] = [
  { label: '月份', value: 'month' },
  { label: '日期', value: 'date' },
  { label: '时间', value: 'time' },
];
const monthLabels = [
  '1月',
  '2月',
  '3月',
  '4月',
  '5月',
  '6月',
  '7月',
  '8月',
  '9月',
  '10月',
  '11月',
  '12月',
];
const dateCells = [
  { day: 27, muted: true },
  { day: 28, muted: true },
  { day: 29, muted: true },
  { day: 30, muted: true },
  { day: 31, muted: true },
  ...Array.from({ length: 31 }, (_, index) => ({ day: index + 1, muted: false })),
  { day: 1, muted: true },
  { day: 2, muted: true },
  { day: 3, muted: true },
  { day: 4, muted: true },
  { day: 5, muted: true },
  { day: 6, muted: true },
];
const hours = ['06', '07', '08', '09', '10'];
const minutes = ['30', '45', '00', '15', '30'];

const activeKind = ref<PickerKind>(props.initialKind);
const isOpen = ref(true);
const selectedYear = ref(2026);
const selectedMonth = ref(8);
const selectedDay = ref(17);
const selectedHour = ref('08');
const selectedMinuteIndex = ref(2);
const selectedMinute = computed(() => minutes[selectedMinuteIndex.value] ?? '00');

watch(
  () => props.initialKind,
  (kind) => {
    activeKind.value = kind;
    isOpen.value = true;
  },
);

const pickerTitle = computed(
  () => kinds.find((kind) => kind.value === activeKind.value)?.label ?? '日期',
);
const selectedValue = computed(() => {
  if (activeKind.value === 'month') return `${selectedYear.value}年${selectedMonth.value}月`;
  if (activeKind.value === 'date')
    return `${selectedYear.value}年${selectedMonth.value}月${selectedDay.value}日`;
  return `${selectedHour.value}:${selectedMinute.value}`;
});
const selectedHint = computed(() => {
  if (activeKind.value === 'month') return '用于排班周期与统计范围';
  if (activeKind.value === 'date') return '周一 · 业务日按 08:00 交接';
  return '24 小时制 · 15 分钟间隔';
});

function openPicker(kind: PickerKind): void {
  activeKind.value = kind;
  isOpen.value = true;
}
</script>

<template>
  <main class="temporal-picker-preview" :class="`is-${layout}`">
    <header class="preview-heading">
      <p>排班时间</p>
      <h1>统一选择器</h1>
      <span>月份、日期与时间使用同一触发方式和操作层级。</span>
    </header>

    <section class="picker-fields" aria-label="时间选择器示例">
      <button
        v-for="kind in kinds"
        :key="kind.value"
        type="button"
        class="picker-trigger"
        :class="{ 'is-active': activeKind === kind.value && isOpen }"
        :aria-expanded="activeKind === kind.value && isOpen"
        @click="openPicker(kind.value)"
      >
        <span class="trigger-icon" aria-hidden="true">
          <svg v-if="kind.value !== 'time'" viewBox="0 0 24 24" fill="none">
            <path d="M7 3v3M17 3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v13H4V6a1 1 0 0 1 1-1Z" />
          </svg>
          <svg v-else viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="8" />
            <path d="M12 7v5l3 2" />
          </svg>
        </span>
        <span class="trigger-copy">
          <span>{{ kind.label }}</span>
          <strong v-if="kind.value === 'month'">2026年8月</strong>
          <strong v-else-if="kind.value === 'date'">8月17日 周一</strong>
          <strong v-else>08:00</strong>
        </span>
        <span class="trigger-chevron" aria-hidden="true">›</span>
      </button>
    </section>

    <section v-if="isOpen" class="picker-shell" role="dialog" :aria-label="`选择${pickerTitle}`">
      <div class="sheet-handle" aria-hidden="true" />
      <header class="picker-header">
        <div>
          <p>选择{{ pickerTitle }}</p>
          <h2>{{ selectedValue }}</h2>
        </div>
        <button type="button" aria-label="关闭选择器" @click="isOpen = false">×</button>
      </header>

      <div class="selection-summary">
        <span class="summary-mark" aria-hidden="true" />
        <span>
          <strong>{{ selectedValue }}</strong>
          <small>{{ selectedHint }}</small>
        </span>
      </div>

      <div v-if="activeKind === 'month'" class="picker-content month-picker-panel">
        <div class="period-navigation">
          <button type="button" aria-label="上一年" @click="selectedYear--">‹</button>
          <strong>{{ selectedYear }}年</strong>
          <button type="button" aria-label="下一年" @click="selectedYear++">›</button>
        </div>
        <div class="month-grid" role="group" aria-label="月份">
          <button
            v-for="(month, index) in monthLabels"
            :key="month"
            type="button"
            :class="{ 'is-selected': selectedMonth === index + 1 }"
            :aria-pressed="selectedMonth === index + 1"
            @click="selectedMonth = index + 1"
          >
            {{ month }}
          </button>
        </div>
      </div>

      <div v-else-if="activeKind === 'date'" class="picker-content date-picker-panel">
        <div class="period-navigation">
          <button type="button" aria-label="上一月">‹</button>
          <strong>{{ selectedYear }}年{{ selectedMonth }}月</strong>
          <button type="button" aria-label="下一月">›</button>
        </div>
        <div class="weekday-grid" aria-hidden="true">
          <span v-for="weekday in ['一', '二', '三', '四', '五', '六', '日']" :key="weekday">
            {{ weekday }}
          </span>
        </div>
        <div class="date-grid" role="group" aria-label="日期">
          <button
            v-for="(cell, index) in dateCells"
            :key="`${cell.day}-${index}`"
            type="button"
            :class="{
              'is-muted': cell.muted,
              'is-selected': !cell.muted && selectedDay === cell.day,
            }"
            :aria-pressed="!cell.muted && selectedDay === cell.day"
            :disabled="cell.muted"
            @click="selectedDay = cell.day"
          >
            {{ cell.day }}
          </button>
        </div>
      </div>

      <div v-else class="picker-content time-picker-panel">
        <div class="time-wheel" aria-label="时间">
          <div class="wheel-column" role="listbox" aria-label="小时">
            <button
              v-for="hour in hours"
              :key="hour"
              type="button"
              :class="{ 'is-selected': selectedHour === hour }"
              :aria-selected="selectedHour === hour"
              role="option"
              @click="selectedHour = hour"
            >
              {{ hour }} <small>时</small>
            </button>
          </div>
          <span class="time-separator" aria-hidden="true">:</span>
          <div class="wheel-column" role="listbox" aria-label="分钟">
            <button
              v-for="(minute, index) in minutes"
              :key="`${minute}-${index}`"
              type="button"
              :class="{ 'is-selected': selectedMinuteIndex === index }"
              :aria-selected="selectedMinuteIndex === index"
              role="option"
              @click="selectedMinuteIndex = index"
            >
              {{ minute }} <small>分</small>
            </button>
          </div>
        </div>
      </div>

      <footer class="picker-actions">
        <button type="button" class="secondary-action" @click="isOpen = false">取消</button>
        <button type="button" class="primary-action" @click="isOpen = false">完成</button>
      </footer>
    </section>
  </main>
</template>

<style scoped>
.temporal-picker-preview {
  --picker-blue: #0a66d5;
  --picker-blue-soft: #eaf3ff;
  --picker-canvas: #f4f7fb;
  --picker-divider: #dce3eb;
  --picker-ink: #16202a;
  position: relative;
  min-height: 100vh;
  padding: 22px 14px 420px;
  overflow: hidden;
  color: var(--picker-ink);
  background: var(--picker-canvas);
  font-family:
    'PingFang SC',
    'SF Pro Text',
    -apple-system,
    BlinkMacSystemFont,
    sans-serif;
}

.preview-heading {
  display: grid;
  gap: 4px;
  margin-bottom: 18px;
}

.preview-heading p,
.preview-heading h1,
.preview-heading span,
.picker-header p,
.picker-header h2 {
  margin: 0;
}

.preview-heading p {
  color: var(--picker-blue);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
}

.preview-heading h1 {
  font-family:
    'PingFang SC',
    'SF Pro Display',
    -apple-system,
    BlinkMacSystemFont,
    sans-serif;
  font-size: 26px;
  letter-spacing: -0.03em;
  line-height: 1.2;
}

.preview-heading span {
  color: #53677d;
  font-size: 13px;
  line-height: 1.5;
}

.picker-fields {
  overflow: hidden;
  background: #fff;
  border: 1px solid var(--picker-divider);
  border-radius: 16px;
  box-shadow: 0 8px 24px rgb(22 32 42 / 6%);
}

.picker-trigger {
  display: grid;
  width: 100%;
  min-height: 44px;
  padding: 8px 12px;
  grid-template-columns: 32px minmax(0, 1fr) 20px;
  align-items: center;
  gap: 8px;
  color: inherit;
  background: #fff;
  border: 0;
  border-bottom: 1px solid var(--picker-divider);
  cursor: pointer;
  font: inherit;
  text-align: left;
}

.picker-trigger:last-child {
  border-bottom: 0;
}

.picker-trigger.is-active {
  background: linear-gradient(90deg, var(--picker-blue-soft), #fff 72%);
}

.trigger-icon {
  display: grid;
  width: 32px;
  height: 32px;
  place-items: center;
  color: var(--picker-blue);
  background: var(--picker-blue-soft);
  border-radius: 10px;
}

.trigger-icon svg {
  width: 17px;
  height: 17px;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.8;
}

.trigger-copy {
  display: grid;
  gap: 1px;
}

.trigger-copy > span {
  color: #6b7785;
  font-size: 11px;
}

.trigger-copy strong,
.selection-summary strong,
.period-navigation strong,
.wheel-column button {
  font-variant-numeric: tabular-nums;
}

.trigger-copy strong {
  font-size: 14px;
  font-weight: 650;
}

.trigger-chevron {
  color: #8b96a3;
  font-size: 25px;
  font-weight: 300;
}

.picker-shell {
  position: absolute;
  right: 12px;
  bottom: 14px;
  left: 12px;
  z-index: 2;
  overflow: hidden;
  background: rgb(255 255 255 / 98%);
  border: 1px solid rgb(220 227 235 / 90%);
  border-radius: 22px;
  box-shadow: 0 20px 48px rgb(22 32 42 / 18%);
  backdrop-filter: blur(18px);
}

.sheet-handle {
  width: 36px;
  height: 4px;
  margin: 7px auto 1px;
  background: #cbd3dc;
  border-radius: 999px;
}

.picker-header {
  display: flex;
  min-height: 58px;
  padding: 8px 14px;
  align-items: center;
  justify-content: space-between;
}

.picker-header p {
  color: #6b7785;
  font-size: 11px;
}

.picker-header h2 {
  margin-top: 1px;
  font-size: 18px;
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;
}

.picker-header > button,
.period-navigation button {
  display: grid;
  width: 44px;
  height: 44px;
  padding: 0;
  place-items: center;
  color: var(--picker-blue);
  background: transparent;
  border: 0;
  border-radius: 13px;
  cursor: pointer;
  font: inherit;
  font-size: 24px;
}

.selection-summary {
  display: grid;
  margin: 0 14px 8px;
  padding: 9px 10px;
  grid-template-columns: 6px minmax(0, 1fr);
  align-items: center;
  gap: 9px;
  background: var(--picker-blue-soft);
  border: 1px solid #cfe3ff;
  border-radius: 12px;
}

.summary-mark {
  width: 4px;
  height: 30px;
  background: var(--picker-blue);
  border-radius: 999px;
}

.selection-summary > span:last-child {
  display: grid;
  gap: 2px;
}

.selection-summary strong {
  font-size: 14px;
}

.selection-summary small {
  color: #53677d;
  font-size: 10px;
}

.picker-content {
  padding: 0 14px 8px;
}

.period-navigation {
  display: grid;
  min-height: 44px;
  grid-template-columns: 44px minmax(0, 1fr) 44px;
  align-items: center;
  text-align: center;
}

.period-navigation strong {
  font-size: 15px;
}

.month-grid {
  display: grid;
  padding: 4px 0;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 4px;
}

.month-grid button,
.date-grid button {
  display: grid;
  min-width: 0;
  height: 40px;
  padding: 0;
  place-items: center;
  color: var(--picker-ink);
  background: transparent;
  border: 0;
  border-radius: 11px;
  cursor: pointer;
  font: inherit;
  font-size: 13px;
  font-variant-numeric: tabular-nums;
}

.month-grid button.is-selected,
.date-grid button.is-selected {
  color: #fff;
  background: var(--picker-blue);
  box-shadow: 0 5px 12px rgb(10 102 213 / 24%);
  font-weight: 700;
}

.weekday-grid,
.date-grid {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
}

.weekday-grid {
  min-height: 24px;
  align-items: center;
  color: #7b8794;
  font-size: 10px;
  font-weight: 650;
  text-align: center;
}

.weekday-grid span:nth-last-child(-n + 2) {
  color: #d9363e;
}

.date-grid {
  gap: 2px;
}

.date-grid button {
  height: 36px;
  border-radius: 50%;
  font-size: 12px;
}

.date-grid button.is-muted {
  color: #bec6cf;
}

.time-picker-panel {
  padding-top: 4px;
}

.time-wheel {
  position: relative;
  display: grid;
  max-width: 250px;
  height: 174px;
  margin: 0 auto;
  grid-template-columns: 1fr 22px 1fr;
  align-items: center;
  overflow: hidden;
  background: linear-gradient(#fff, rgb(255 255 255 / 20%) 25%, rgb(255 255 255 / 20%) 75%, #fff);
}

.wheel-column {
  display: grid;
  align-content: center;
}

.wheel-column button {
  height: 34px;
  padding: 0 12px;
  color: #9aa4ae;
  background: transparent;
  border: 0;
  border-radius: 10px;
  cursor: pointer;
  font: inherit;
  font-size: 18px;
}

.wheel-column button.is-selected {
  color: var(--picker-ink);
  background: var(--picker-blue-soft);
  box-shadow: inset 0 0 0 1px #cfe3ff;
  font-size: 22px;
  font-weight: 700;
}

.wheel-column small {
  color: #728090;
  font-size: 10px;
  font-weight: 600;
}

.time-separator {
  color: var(--picker-blue);
  font-size: 24px;
  font-weight: 700;
  text-align: center;
}

.picker-actions {
  display: grid;
  padding: 8px 14px 14px;
  grid-template-columns: 1fr 1.35fr;
  gap: 8px;
  border-top: 1px solid var(--picker-divider);
}

.picker-actions button {
  min-height: 44px;
  border-radius: 12px;
  cursor: pointer;
  font: inherit;
  font-size: 14px;
  font-weight: 650;
}

.secondary-action {
  color: #536170;
  background: #f3f6f9;
  border: 1px solid var(--picker-divider);
}

.primary-action {
  color: #fff;
  background: var(--picker-blue);
  border: 1px solid var(--picker-blue);
  box-shadow: 0 6px 14px rgb(10 102 213 / 22%);
}

button:focus-visible {
  outline: 2px solid #69a9f5;
  outline-offset: 2px;
}

@media (min-width: 760px) {
  .temporal-picker-preview {
    min-height: 900px;
    padding: 52px max(48px, calc((100vw - 1120px) / 2)) 80px;
  }

  .preview-heading,
  .picker-fields {
    width: min(520px, calc(100vw - 520px));
  }

  .preview-heading h1 {
    font-size: 34px;
  }

  .picker-shell {
    top: 48px;
    right: max(48px, calc((100vw - 1120px) / 2));
    bottom: auto;
    left: auto;
    width: 380px;
    border-radius: 20px;
  }

  .sheet-handle {
    display: none;
  }
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
