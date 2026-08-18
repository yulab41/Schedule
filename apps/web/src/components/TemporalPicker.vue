<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';

import { isPointOutsideRectangle } from './temporal-picker-interactions.js';

defineOptions({ inheritAttrs: false });

type TemporalPickerKind = 'year' | 'month' | 'date' | 'time';
type PickerScrollBehavior = 'auto' | 'smooth';
type WheelKind = 'year' | 'month' | 'hour' | 'minute';

interface DateCell {
  readonly day: number;
  readonly disabled: boolean;
  readonly key: string;
  readonly muted: boolean;
  readonly value: string;
}

interface MinuteWheelOption {
  readonly minute: number;
  readonly position: number;
}

const props = withDefaults(
  defineProps<{
    readonly clearable?: boolean;
    readonly compact?: boolean;
    readonly disabled?: boolean;
    readonly kind: TemporalPickerKind;
    readonly label: string;
    readonly max?: string | undefined;
    readonly min?: string | undefined;
    readonly minuteStep?: number;
    readonly modelValue: string;
    readonly placeholder?: string | undefined;
    readonly required?: boolean;
  }>(),
  {
    clearable: false,
    compact: false,
    disabled: false,
    max: undefined,
    min: undefined,
    minuteStep: 15,
    placeholder: undefined,
    required: false,
  },
);

const emit = defineEmits<{
  change: [value: string];
  'update:modelValue': [value: string];
}>();

const trigger = ref<HTMLButtonElement | null>(null);
const dialog = ref<HTMLDialogElement | null>(null);
const previouslyFocused = ref<HTMLElement | null>(null);
const isOpen = ref(false);
const draftYear = ref(2026);
const draftMonth = ref(8);
const draftDay = ref(17);
const draftHour = ref(8);
const draftMinute = ref(0);
const minuteWheelAnchor = ref(0);
const draftMinutePosition = ref(0);
const yearWheel = ref<HTMLElement | null>(null);
const monthWheel = ref<HTMLElement | null>(null);
const hourWheel = ref<HTMLElement | null>(null);
const minuteWheel = ref<HTMLElement | null>(null);
const wheelSelectionFrames: Partial<Record<WheelKind, number>> = {};

const weekdays = ['一', '二', '三', '四', '五', '六', '日'] as const;
const hourOptions = Array.from({ length: 24 }, (_, hour) => hour);
const monthOptions = Array.from({ length: 12 }, (_, index) => index + 1);
const focusableSelector = [
  'button:not([disabled])',
  '[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

const kindLabel = computed(() => {
  if (props.kind === 'year') return '年份';
  if (props.kind === 'month') return '月份';
  if (props.kind === 'date') return '日期';
  return '时间';
});

const safeMinuteStep = computed(() => {
  const step = Math.trunc(props.minuteStep);
  return step > 0 && step <= 30 && 60 % step === 0 ? step : 15;
});

const minuteOptions = computed(() => {
  const options = Array.from(
    { length: 60 / safeMinuteStep.value },
    (_, index) => index * safeMinuteStep.value,
  );
  if (!options.includes(minuteWheelAnchor.value)) options.push(minuteWheelAnchor.value);
  return options.sort((left, right) => left - right);
});

const minuteWheelOptions = computed<readonly MinuteWheelOption[]>(() => {
  const options = minuteOptions.value;
  const anchorIndex = Math.max(0, options.indexOf(minuteWheelAnchor.value));
  const radius = Math.max(4, options.length);
  return Array.from({ length: radius * 2 + 1 }, (_, index) => {
    const position = index - radius;
    const optionIndex =
      (((anchorIndex + position) % options.length) + options.length) % options.length;
    return { minute: options[optionIndex] ?? 0, position };
  });
});

const yearOptions = computed(() => {
  const minimumYear = Math.min(1970, parseYear(props.min) ?? 1970, draftYear.value);
  const maximumYear = Math.max(2100, parseYear(props.max) ?? 2100, draftYear.value);
  return Array.from({ length: maximumYear - minimumYear + 1 }, (_, index) => minimumYear + index);
});

const draftValue = computed(() => {
  if (props.kind === 'year') return String(draftYear.value);
  if (props.kind === 'month') return `${draftYear.value}-${pad(draftMonth.value)}`;
  if (props.kind === 'date') {
    return `${draftYear.value}-${pad(draftMonth.value)}-${pad(draftDay.value)}`;
  }
  return `${pad(draftHour.value)}:${pad(draftMinute.value)}`;
});

const draftDisplayValue = computed(() => formatDisplayValue(props.kind, draftValue.value));
const accessibleValue = computed(() =>
  props.modelValue === ''
    ? (props.placeholder ?? `选择${props.label}`)
    : formatDisplayValue(props.kind, props.modelValue),
);
const displayValue = computed(() =>
  props.modelValue === ''
    ? (props.placeholder ?? `选择${props.label}`)
    : formatTriggerValue(props.kind, props.modelValue),
);
const selectedHint = computed(() => {
  if (props.kind === 'year') return '上下滑动选择年份';
  if (props.kind === 'month') return '上下滑动年份与月份';
  if (props.kind === 'date') return '按自然日选择';
  return `24 小时制 · ${safeMinuteStep.value} 分钟间隔`;
});
const dateCells = computed<readonly DateCell[]>(() => buildDateCells());
const canClear = computed(() => props.clearable && !props.required && props.modelValue !== '');

watch(
  () => props.modelValue,
  () => {
    if (isOpen.value) syncDraft();
  },
);

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function parseYear(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const match = /^(\d{4})/.exec(value);
  return match?.[1] === undefined ? undefined : Number(match[1]);
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function todayParts(): { day: number; month: number; year: number } {
  const today = new Date();
  return { day: today.getDate(), month: today.getMonth() + 1, year: today.getFullYear() };
}

function parseMonthValue(value: string): { month: number; year: number } | undefined {
  const match = /^(\d{4})-(\d{2})$/.exec(value);
  if (match?.[1] === undefined || match[2] === undefined) return undefined;
  const year = Number(match[1]);
  const month = Number(match[2]);
  return month >= 1 && month <= 12 ? { month, year } : undefined;
}

function parseDateValue(value: string): { day: number; month: number; year: number } | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (match?.[1] === undefined || match[2] === undefined || match[3] === undefined) {
    return undefined;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) return undefined;
  return { day, month, year };
}

function parseTimeValue(value: string): { hour: number; minute: number } | undefined {
  const match = /^(\d{2}):(\d{2})/.exec(value);
  if (match?.[1] === undefined || match[2] === undefined) return undefined;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59 ? { hour, minute } : undefined;
}

function formatDisplayValue(kind: TemporalPickerKind, value: string): string {
  if (kind === 'year') {
    const parsed = parseYear(value);
    return parsed === undefined ? value : `${parsed}年`;
  }
  if (kind === 'month') {
    const parsed = parseMonthValue(value);
    return parsed === undefined ? value : `${parsed.year}年${parsed.month}月`;
  }
  if (kind === 'date') {
    const parsed = parseDateValue(value);
    if (parsed === undefined) return value;
    const weekday =
      weekdays[(new Date(parsed.year, parsed.month - 1, parsed.day).getDay() + 6) % 7];
    return `${parsed.year}年${parsed.month}月${parsed.day}日 周${weekday}`;
  }
  const parsed = parseTimeValue(value);
  return parsed === undefined ? value : `${pad(parsed.hour)}:${pad(parsed.minute)}`;
}

function formatTriggerValue(kind: TemporalPickerKind, value: string): string {
  if (kind !== 'date') return formatDisplayValue(kind, value);
  const parsed = parseDateValue(value);
  if (parsed === undefined) return value;
  const weekday = weekdays[(new Date(parsed.year, parsed.month - 1, parsed.day).getDay() + 6) % 7];
  return `${parsed.year}-${pad(parsed.month)}-${pad(parsed.day)} 周${weekday}`;
}

function syncDraft(): void {
  const fallback = todayParts();
  if (props.kind === 'year') {
    draftYear.value = parseYear(props.modelValue) ?? fallback.year;
  } else if (props.kind === 'month') {
    const parsed = parseMonthValue(props.modelValue);
    draftYear.value = parsed?.year ?? fallback.year;
    draftMonth.value = parsed?.month ?? fallback.month;
  } else if (props.kind === 'date') {
    const parsed = parseDateValue(props.modelValue);
    draftYear.value = parsed?.year ?? fallback.year;
    draftMonth.value = parsed?.month ?? fallback.month;
    draftDay.value = parsed?.day ?? fallback.day;
  } else {
    const parsed = parseTimeValue(props.modelValue);
    draftHour.value = parsed?.hour ?? 8;
    draftMinute.value = parsed?.minute ?? 0;
    minuteWheelAnchor.value = draftMinute.value;
    draftMinutePosition.value = 0;
  }
}

function getFocusableElements(): readonly HTMLElement[] {
  const element = dialog.value;
  if (element === null) return [];
  return [...element.querySelectorAll<HTMLElement>(focusableSelector)].filter(
    (candidate) => candidate.getClientRects().length > 0,
  );
}

async function openPicker(): Promise<void> {
  if (props.disabled) return;
  syncDraft();
  previouslyFocused.value =
    document.activeElement instanceof HTMLElement ? document.activeElement : trigger.value;
  isOpen.value = true;
  await nextTick();
  const element = dialog.value;
  if (element === null || element.open) return;
  element.showModal();
  positionDialog();
  document.addEventListener('pointerdown', closeFromOutside, true);
  window.addEventListener('resize', positionDialog);
  getFocusableElements()[0]?.focus();
  await nextTick();
  centerVisibleWheels('auto');
}

function closePicker(): void {
  isOpen.value = false;
  document.removeEventListener('pointerdown', closeFromOutside, true);
  window.removeEventListener('resize', positionDialog);
  if (dialog.value?.open === true) dialog.value.close();
}

function cancelPicker(): void {
  closePicker();
}

function commitValue(value: string): void {
  if (value !== props.modelValue) {
    emit('update:modelValue', value);
    emit('change', value);
  }
  closePicker();
}

function confirmPicker(): void {
  syncDraftFromVisibleWheels();
  commitValue(draftValue.value);
}

function clearPicker(): void {
  commitValue('');
}

function onDialogClose(): void {
  isOpen.value = false;
  document.removeEventListener('pointerdown', closeFromOutside, true);
  window.removeEventListener('resize', positionDialog);
  const focusTarget = previouslyFocused.value;
  previouslyFocused.value = null;
  if (focusTarget?.isConnected === true) focusTarget.focus();
}

function closeFromOutside(event: PointerEvent): void {
  const element = dialog.value;
  if (
    element !== null &&
    element.open &&
    isPointOutsideRectangle(event, element.getBoundingClientRect())
  ) {
    cancelPicker();
  }
}

function trapFocus(event: KeyboardEvent): void {
  if (event.key !== 'Tab') return;
  const elements = getFocusableElements();
  const first = elements[0];
  const last = elements.at(-1);
  if (first === undefined || last === undefined) return;
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

function positionDialog(): void {
  const element = dialog.value;
  const anchor = trigger.value;
  if (element === null || anchor === null || window.matchMedia('(max-width: 640px)').matches) {
    element?.style.removeProperty('--temporal-picker-left');
    element?.style.removeProperty('--temporal-picker-top');
    return;
  }

  const anchorRect = anchor.getBoundingClientRect();
  const width = element.offsetWidth || 380;
  const height = element.offsetHeight || 420;
  const gap = 12;
  const edge = 16;
  let left = anchorRect.right + gap;
  if (left + width > window.innerWidth - edge) left = anchorRect.left - width - gap;
  if (left < edge) left = clamp(anchorRect.left, edge, window.innerWidth - width - edge);
  const top = clamp(anchorRect.top, edge, Math.max(edge, window.innerHeight - height - edge));
  element.style.setProperty('--temporal-picker-left', `${left}px`);
  element.style.setProperty('--temporal-picker-top', `${top}px`);
}

function wheelElement(kind: WheelKind): HTMLElement | null {
  if (kind === 'year') return yearWheel.value;
  if (kind === 'month') return monthWheel.value;
  if (kind === 'hour') return hourWheel.value;
  return minuteWheel.value;
}

function selectedWheelValue(kind: WheelKind): number {
  if (kind === 'year') return draftYear.value;
  if (kind === 'month') return draftMonth.value;
  if (kind === 'hour') return draftHour.value;
  return draftMinutePosition.value;
}

function centerWheel(kind: WheelKind, behavior: PickerScrollBehavior = 'smooth'): void {
  const wheel = wheelElement(kind);
  const target = wheel?.querySelector<HTMLElement>(
    `[data-wheel-value="${selectedWheelValue(kind)}"]`,
  );
  if (wheel === null || wheel === undefined || target === null || target === undefined) return;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  wheel.scrollTo({
    top: target.offsetTop - (wheel.clientHeight - target.offsetHeight) / 2,
    behavior: reducedMotion ? 'auto' : behavior,
  });
}

function setWheelValue(kind: WheelKind, value: number, center = true): void {
  if (kind === 'year') draftYear.value = value;
  else if (kind === 'month') draftMonth.value = value;
  else if (kind === 'hour') draftHour.value = value;
  else {
    const option = minuteWheelOptions.value.find((candidate) => candidate.position === value);
    if (option === undefined) return;
    draftMinutePosition.value = value;
    draftMinute.value = option.minute;
  }

  if (props.kind === 'date') {
    draftDay.value = Math.min(draftDay.value, daysInMonth(draftYear.value, draftMonth.value));
  }
  if (center) void nextTick(() => centerWheel(kind));
}

function updateWheelFromPosition(kind: WheelKind, wheel: HTMLElement): void {
  const value = nearestWheelValue(wheel);
  if (Number.isFinite(value)) setWheelValue(kind, value, false);
}

function trackWheelScroll(kind: WheelKind, event: Event): void {
  const wheel = event.currentTarget as HTMLElement;
  const existingFrame = wheelSelectionFrames[kind];
  if (existingFrame !== undefined) cancelAnimationFrame(existingFrame);
  wheelSelectionFrames[kind] = requestAnimationFrame(() => {
    delete wheelSelectionFrames[kind];
    updateWheelFromPosition(kind, wheel);
  });
}

function finishWheelScroll(kind: WheelKind, event: Event): void {
  const existingFrame = wheelSelectionFrames[kind];
  if (existingFrame !== undefined) cancelAnimationFrame(existingFrame);
  delete wheelSelectionFrames[kind];
  updateWheelFromPosition(kind, event.currentTarget as HTMLElement);
}

function nearestWheelValue(wheel: HTMLElement): number {
  const center = wheel.scrollTop + wheel.clientHeight / 2;
  const options = Array.from(wheel.querySelectorAll<HTMLButtonElement>('[data-wheel-value]'));
  const nearest = options.reduce<HTMLButtonElement | null>((closest, option) => {
    if (closest === null) return option;
    const optionDistance = Math.abs(option.offsetTop + option.offsetHeight / 2 - center);
    const closestDistance = Math.abs(closest.offsetTop + closest.offsetHeight / 2 - center);
    return optionDistance < closestDistance ? option : closest;
  }, null);
  return Number(nearest?.dataset.wheelValue);
}

function syncDraftFromVisibleWheels(): void {
  const wheelKinds: readonly WheelKind[] =
    props.kind === 'year'
      ? ['year']
      : props.kind === 'month'
        ? ['year', 'month']
        : props.kind === 'time'
          ? ['hour', 'minute']
          : [];
  wheelKinds.forEach((kind) => {
    const wheel = wheelElement(kind);
    if (wheel === null) return;
    const value = nearestWheelValue(wheel);
    if (Number.isFinite(value)) setWheelValue(kind, value, false);
  });
}

function centerVisibleWheels(behavior: PickerScrollBehavior): void {
  if (props.kind === 'year') {
    centerWheel('year', behavior);
  } else if (props.kind === 'month') {
    centerWheel('year', behavior);
    centerWheel('month', behavior);
  } else if (props.kind === 'time') {
    centerWheel('hour', behavior);
    centerWheel('minute', behavior);
  }
}

function buildDateCells(): readonly DateCell[] {
  const year = draftYear.value;
  const month = draftMonth.value;
  const firstWeekday = (new Date(year, month - 1, 1).getDay() + 6) % 7;
  const currentMonthDays = daysInMonth(year, month);
  const previousMonth = month === 1 ? 12 : month - 1;
  const previousYear = month === 1 ? year - 1 : year;
  const previousMonthDays = daysInMonth(previousYear, previousMonth);

  return Array.from({ length: 42 }, (_, index) => {
    let cellYear = year;
    let cellMonth = month;
    let day = index - firstWeekday + 1;
    let muted = false;
    if (day <= 0) {
      cellYear = previousYear;
      cellMonth = previousMonth;
      day = previousMonthDays + day;
      muted = true;
    } else if (day > currentMonthDays) {
      cellYear = month === 12 ? year + 1 : year;
      cellMonth = month === 12 ? 1 : month + 1;
      day -= currentMonthDays;
      muted = true;
    }
    const value = `${cellYear}-${pad(cellMonth)}-${pad(day)}`;
    const disabled =
      muted ||
      (props.min !== undefined && value < props.min) ||
      (props.max !== undefined && value > props.max);
    return { day, disabled, key: value, muted, value };
  });
}

function navigateDateMonth(offset: number): void {
  const next = new Date(draftYear.value, draftMonth.value - 1 + offset, 1);
  draftYear.value = next.getFullYear();
  draftMonth.value = next.getMonth() + 1;
  draftDay.value = Math.min(draftDay.value, daysInMonth(draftYear.value, draftMonth.value));
}

function selectDate(cell: DateCell): void {
  if (!cell.disabled) draftDay.value = cell.day;
}

onBeforeUnmount(() => {
  Object.values(wheelSelectionFrames).forEach((frame) => {
    if (frame !== undefined) cancelAnimationFrame(frame);
  });
  document.removeEventListener('pointerdown', closeFromOutside, true);
  window.removeEventListener('resize', positionDialog);
  if (dialog.value?.open === true) dialog.value.close();
});
</script>

<template>
  <div
    class="temporal-picker"
    :class="{ 'is-compact': compact, 'is-disabled': disabled }"
    v-bind="$attrs"
  >
    <button
      ref="trigger"
      type="button"
      class="temporal-picker-trigger"
      :aria-expanded="isOpen"
      :aria-label="`${label}：${accessibleValue}`"
      :aria-required="required"
      :disabled="disabled"
      aria-haspopup="dialog"
      @click="openPicker"
    >
      <span class="temporal-picker-value" :class="{ 'is-placeholder': modelValue === '' }">
        {{ displayValue }}
      </span>
      <span class="temporal-picker-chevron" aria-hidden="true">›</span>
    </button>

    <dialog
      ref="dialog"
      class="temporal-picker-dialog"
      role="dialog"
      :aria-label="`选择${kindLabel}`"
      @cancel.prevent="cancelPicker"
      @close="onDialogClose"
      @keydown="trapFocus"
    >
      <section class="temporal-picker-panel">
        <div class="temporal-picker-handle" aria-hidden="true" />
        <header class="temporal-picker-header">
          <div>
            <p>选择{{ kindLabel }}</p>
            <h2>{{ draftDisplayValue }}</h2>
          </div>
          <button
            type="button"
            class="temporal-picker-close"
            aria-label="关闭"
            @click="cancelPicker"
          >
            ×
          </button>
        </header>

        <div class="temporal-selection-summary">
          <span class="temporal-summary-mark" aria-hidden="true" />
          <span>
            <strong>{{ draftDisplayValue }}</strong>
            <small>{{ selectedHint }}</small>
          </span>
        </div>

        <div v-if="kind === 'year'" class="temporal-picker-content year-picker-panel">
          <div class="year-wheel" aria-label="年份">
            <div
              ref="yearWheel"
              class="wheel-column"
              role="listbox"
              aria-label="年份"
              @scroll.passive="trackWheelScroll('year', $event)"
              @scrollend="finishWheelScroll('year', $event)"
            >
              <button
                v-for="year in yearOptions"
                :key="year"
                type="button"
                :data-wheel-value="year"
                :class="{ 'is-selected': draftYear === year }"
                :aria-selected="draftYear === year"
                role="option"
                @click="setWheelValue('year', year)"
              >
                {{ year }} <small>年</small>
              </button>
            </div>
            <div class="wheel-rails" aria-hidden="true" />
          </div>
        </div>

        <div v-else-if="kind === 'month'" class="temporal-picker-content month-picker-panel">
          <div class="month-wheel" aria-label="年月">
            <div
              ref="yearWheel"
              class="wheel-column"
              role="listbox"
              aria-label="年份"
              @scroll.passive="trackWheelScroll('year', $event)"
              @scrollend="finishWheelScroll('year', $event)"
            >
              <button
                v-for="year in yearOptions"
                :key="year"
                type="button"
                :data-wheel-value="year"
                :class="{ 'is-selected': draftYear === year }"
                :aria-selected="draftYear === year"
                role="option"
                @click="setWheelValue('year', year)"
              >
                {{ year }} <small>年</small>
              </button>
            </div>
            <div
              ref="monthWheel"
              class="wheel-column"
              role="listbox"
              aria-label="月份"
              @scroll.passive="trackWheelScroll('month', $event)"
              @scrollend="finishWheelScroll('month', $event)"
            >
              <button
                v-for="month in monthOptions"
                :key="month"
                type="button"
                :data-wheel-value="month"
                :class="{ 'is-selected': draftMonth === month }"
                :aria-selected="draftMonth === month"
                role="option"
                @click="setWheelValue('month', month)"
              >
                {{ month }} <small>月</small>
              </button>
            </div>
            <div class="wheel-rails" aria-hidden="true" />
          </div>
        </div>

        <div v-else-if="kind === 'date'" class="temporal-picker-content date-picker-panel">
          <div class="date-period-navigation">
            <button type="button" aria-label="上一月" @click="navigateDateMonth(-1)">‹</button>
            <strong>{{ draftYear }}年{{ draftMonth }}月</strong>
            <button type="button" aria-label="下一月" @click="navigateDateMonth(1)">›</button>
          </div>
          <div class="weekday-grid" aria-hidden="true">
            <span v-for="weekday in weekdays" :key="weekday">{{ weekday }}</span>
          </div>
          <div class="date-grid" role="group" aria-label="日期">
            <button
              v-for="cell in dateCells"
              :key="cell.key"
              type="button"
              :class="{
                'is-muted': cell.muted,
                'is-selected': !cell.muted && draftDay === cell.day,
              }"
              :aria-pressed="!cell.muted && draftDay === cell.day"
              :disabled="cell.disabled"
              @click="selectDate(cell)"
            >
              <span>{{ cell.day }}</span>
            </button>
          </div>
        </div>

        <div v-else class="temporal-picker-content time-picker-panel">
          <div class="time-wheel" aria-label="时间">
            <div
              ref="hourWheel"
              class="wheel-column"
              role="listbox"
              aria-label="小时"
              @scroll.passive="trackWheelScroll('hour', $event)"
              @scrollend="finishWheelScroll('hour', $event)"
            >
              <button
                v-for="hour in hourOptions"
                :key="hour"
                type="button"
                :data-wheel-value="hour"
                :class="{ 'is-selected': draftHour === hour }"
                :aria-selected="draftHour === hour"
                role="option"
                @click="setWheelValue('hour', hour)"
              >
                {{ pad(hour) }} <small>时</small>
              </button>
            </div>
            <span class="time-separator" aria-hidden="true">:</span>
            <div
              ref="minuteWheel"
              class="wheel-column"
              role="listbox"
              aria-label="分钟"
              @scroll.passive="trackWheelScroll('minute', $event)"
              @scrollend="finishWheelScroll('minute', $event)"
            >
              <button
                v-for="option in minuteWheelOptions"
                :key="option.position"
                type="button"
                :data-minute-value="option.minute"
                :data-wheel-value="option.position"
                :class="{ 'is-selected': draftMinutePosition === option.position }"
                :aria-selected="draftMinutePosition === option.position"
                role="option"
                @click="setWheelValue('minute', option.position)"
              >
                {{ pad(option.minute) }} <small>分</small>
              </button>
            </div>
            <div class="wheel-rails" aria-hidden="true" />
          </div>
        </div>

        <footer class="temporal-picker-actions" :class="{ 'has-clear': canClear }">
          <button v-if="canClear" type="button" class="clear-action" @click="clearPicker">
            清除
          </button>
          <button type="button" class="secondary-action" @click="cancelPicker">取消</button>
          <button type="button" class="primary-action" @click="confirmPicker">完成</button>
        </footer>
      </section>
    </dialog>
  </div>
</template>

<style scoped>
.temporal-picker {
  --temporal-blue: var(--ui-color-primary, #0a66d5);
  --temporal-blue-soft: var(--ui-color-primary-light, #eaf3ff);
  --temporal-divider: var(--ui-color-border, #dce3eb);
  --temporal-ink: var(--ui-color-text-primary, #16202a);
  display: block;
  width: 100%;
  min-width: 0;
  font-family:
    'PingFang SC',
    'SF Pro Text',
    -apple-system,
    BlinkMacSystemFont,
    sans-serif;
}

.temporal-picker-trigger {
  display: grid;
  box-sizing: border-box;
  width: 100%;
  min-width: 0;
  min-height: 44px;
  padding: 5px 10px;
  grid-template-columns: minmax(0, 1fr) 14px;
  align-items: center;
  gap: 6px;
  color: var(--temporal-ink);
  background: var(--ui-color-surface, #fff);
  border: 1px solid var(--ui-color-border-strong, #c7d0db);
  border-radius: var(--ui-radius-small, 10px);
  cursor: pointer;
  font: inherit;
  text-align: left;
}

.is-compact .temporal-picker-trigger {
  min-height: 44px;
  padding-block: 4px;
}

.temporal-picker-trigger:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.temporal-picker-trigger:active:not(:disabled) {
  background: var(--temporal-blue-soft);
}

.temporal-picker-value {
  min-width: 0;
  font-size: clamp(12px, 3.6vw, 14px);
  font-variant-numeric: tabular-nums;
  font-weight: 650;
  line-height: 1.2;
  white-space: normal;
  word-break: keep-all;
}

.temporal-picker-value.is-placeholder {
  color: var(--ui-color-text-muted, #728090);
  font-weight: 500;
}

.temporal-picker-chevron {
  justify-self: end;
  color: var(--ui-color-text-muted, #8b96a3);
  font-size: 22px;
  font-weight: 300;
  line-height: 1;
}

.temporal-picker-dialog {
  position: fixed;
  top: var(--temporal-picker-top, 50%);
  left: var(--temporal-picker-left, 50%);
  width: min(380px, calc(100vw - 32px));
  max-height: min(620px, calc(100dvh - 32px));
  margin: 0;
  padding: 0;
  overflow: hidden;
  color: var(--temporal-ink);
  background: rgb(255 255 255 / 98%);
  border: 1px solid rgb(220 227 235 / 90%);
  border-radius: 20px;
  box-shadow: 0 20px 48px rgb(22 32 42 / 18%);
  font-family: inherit;
  transform: translate(0, 0);
  backdrop-filter: blur(18px);
}

.temporal-picker-dialog::backdrop {
  background: rgb(22 32 42 / 10%);
  backdrop-filter: blur(1px);
}

.temporal-picker-panel {
  display: flex;
  max-height: inherit;
  flex-direction: column;
}

.temporal-picker-handle {
  display: none;
}

.temporal-picker-header {
  display: flex;
  min-height: 58px;
  padding: 8px 14px;
  align-items: center;
  justify-content: space-between;
}

.temporal-picker-header p,
.temporal-picker-header h2 {
  margin: 0;
}

.temporal-picker-header p {
  color: var(--ui-color-text-muted, #6b7785);
  font-size: 11px;
}

.temporal-picker-header h2 {
  margin-top: 1px;
  font-family:
    'PingFang SC',
    'SF Pro Display',
    -apple-system,
    BlinkMacSystemFont,
    sans-serif;
  font-size: 18px;
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.02em;
}

.temporal-picker-close,
.date-period-navigation button {
  display: grid;
  width: 44px;
  height: 44px;
  padding: 0;
  place-items: center;
  color: var(--temporal-blue);
  background: transparent;
  border: 0;
  border-radius: 13px;
  cursor: pointer;
  font: inherit;
  font-size: 24px;
}

.temporal-selection-summary {
  display: grid;
  margin: 0 14px 8px;
  padding: 9px 10px;
  grid-template-columns: 6px minmax(0, 1fr);
  align-items: center;
  gap: 9px;
  background: var(--temporal-blue-soft);
  border: 1px solid var(--ui-color-primary-border, #cfe3ff);
  border-radius: 12px;
}

.temporal-summary-mark {
  width: 4px;
  height: 30px;
  background: var(--temporal-blue);
  border-radius: 999px;
}

.temporal-selection-summary > span:last-child {
  display: grid;
  min-width: 0;
  gap: 2px;
}

.temporal-selection-summary strong {
  overflow: hidden;
  font-size: 14px;
  font-variant-numeric: tabular-nums;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.temporal-selection-summary small {
  color: var(--ui-color-text-secondary, #53677d);
  font-size: 10px;
}

.temporal-picker-content {
  padding: 4px 14px 8px;
  overflow-y: auto;
}

.year-wheel,
.month-wheel,
.time-wheel {
  position: relative;
  display: grid;
  max-width: 292px;
  height: 188px;
  margin: 0 auto;
  align-items: center;
  overflow: hidden;
  background: #fff;
  isolation: isolate;
}

.year-wheel {
  max-width: 168px;
  grid-template-columns: minmax(0, 1fr);
}

.month-wheel {
  grid-template-columns: 1.12fr 0.88fr;
  gap: 10px;
}

.time-wheel {
  max-width: 258px;
  grid-template-columns: 1fr 28px 1fr;
}

.wheel-column {
  position: relative;
  display: grid;
  box-sizing: border-box;
  height: 188px;
  padding-block: 72px;
  align-content: start;
  overflow-y: auto;
  overscroll-behavior-y: contain;
  scrollbar-width: none;
  scroll-snap-type: y mandatory;
  touch-action: pan-y;
  -webkit-overflow-scrolling: touch;
  -webkit-mask-image: linear-gradient(
    to bottom,
    transparent 0,
    #000 22%,
    #000 78%,
    transparent 100%
  );
  mask-image: linear-gradient(to bottom, transparent 0, #000 22%, #000 78%, transparent 100%);
}

.wheel-column::-webkit-scrollbar {
  display: none;
}

.wheel-column button {
  height: 44px;
  padding: 0 12px;
  color: #9aa4ae;
  background: transparent;
  border: 0;
  border-radius: 0;
  cursor: pointer;
  font: inherit;
  font-size: 19px;
  font-variant-numeric: tabular-nums;
  opacity: 0.58;
  scroll-snap-align: center;
  transform: scale(0.94);
  transition:
    color 140ms ease,
    font-size 140ms ease,
    opacity 140ms ease,
    transform 140ms ease;
}

.wheel-column button.is-selected {
  color: var(--temporal-ink);
  background: transparent;
  box-shadow: none;
  font-size: 24px;
  font-weight: 650;
  opacity: 1;
  transform: scale(1);
}

.wheel-column small {
  color: currentColor;
  font-size: 10px;
  font-weight: 550;
  opacity: 0.72;
}

.wheel-rails {
  position: absolute;
  top: 50%;
  right: 0;
  left: 0;
  height: 44px;
  z-index: 3;
  box-sizing: border-box;
  background: transparent;
  border-top: 1px solid var(--temporal-divider);
  border-bottom: 1px solid var(--temporal-divider);
  pointer-events: none;
  transform: translateY(-50%);
}

.time-separator {
  position: relative;
  z-index: 4;
  color: var(--temporal-blue);
  font-size: 24px;
  font-weight: 700;
  text-align: center;
}

.date-period-navigation {
  display: grid;
  min-height: 44px;
  grid-template-columns: 44px minmax(0, 1fr) 44px;
  align-items: center;
  text-align: center;
}

.date-period-navigation strong {
  font-size: 15px;
  font-variant-numeric: tabular-nums;
}

.weekday-grid,
.date-grid {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
}

.weekday-grid {
  min-height: 24px;
  align-items: center;
  color: var(--ui-color-text-muted, #7b8794);
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
  position: relative;
  display: grid;
  min-width: 0;
  height: 36px;
  padding: 0;
  place-items: center;
  color: var(--temporal-ink);
  background: transparent;
  border: 0;
  cursor: pointer;
  font: inherit;
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  isolation: isolate;
}

.date-grid button::before {
  position: absolute;
  width: 36px;
  height: 36px;
  z-index: -1;
  background: transparent;
  border-radius: 50%;
  content: '';
  inset: 50% auto auto 50%;
  transform: translate(-50%, -50%);
}

.date-grid button > span {
  position: relative;
  z-index: 1;
}

.date-grid button.is-muted {
  color: #bec6cf;
}

.date-grid button.is-selected {
  color: #fff;
  background: transparent;
  font-weight: 700;
}

.date-grid button.is-selected::before {
  background: var(--temporal-blue);
  box-shadow: 0 5px 12px rgb(10 102 213 / 24%);
}

.date-grid button:disabled {
  cursor: default;
  opacity: 0.52;
}

.temporal-picker-actions {
  display: grid;
  padding: 8px 14px 14px;
  grid-template-columns: 1fr 1.35fr;
  gap: 8px;
  border-top: 1px solid var(--temporal-divider);
}

.temporal-picker-actions.has-clear {
  grid-template-columns: 0.8fr 1fr 1.35fr;
}

.temporal-picker-actions button {
  min-width: 0;
  min-height: 44px;
  border-radius: 12px;
  cursor: pointer;
  font: inherit;
  font-size: 14px;
  font-weight: 650;
}

.clear-action {
  color: var(--temporal-blue);
  background: transparent;
  border: 1px solid transparent;
}

.secondary-action {
  color: var(--ui-color-text-secondary, #536170);
  background: var(--ui-color-surface-muted, #f3f6f9);
  border: 1px solid var(--temporal-divider);
}

.primary-action {
  color: #fff;
  background: var(--temporal-blue);
  border: 1px solid var(--temporal-blue);
  box-shadow: 0 6px 14px rgb(10 102 213 / 22%);
}

button:focus-visible {
  outline: 2px solid #69a9f5;
  outline-offset: 2px;
}

@media (max-width: 640px) {
  .temporal-picker-dialog {
    top: auto;
    right: 12px;
    bottom: max(12px, env(safe-area-inset-bottom));
    left: 12px;
    width: auto;
    max-height: min(78dvh, 660px);
    border-radius: 22px;
  }

  .temporal-picker-dialog::backdrop {
    background: rgb(22 32 42 / 28%);
    backdrop-filter: blur(2px);
  }

  .temporal-picker-dialog[open] {
    animation: temporal-picker-enter 220ms cubic-bezier(0.22, 1, 0.36, 1);
  }

  .temporal-picker-handle {
    display: block;
    width: 36px;
    height: 4px;
    margin: 7px auto 1px;
    background: #cbd3dc;
    border-radius: 999px;
  }
}

@keyframes temporal-picker-enter {
  from {
    opacity: 0;
    transform: translateY(24px);
  }
}

@media (prefers-reduced-motion: reduce) {
  .temporal-picker-dialog[open] {
    animation: none;
  }

  .wheel-column {
    scroll-behavior: auto;
  }
}
</style>
