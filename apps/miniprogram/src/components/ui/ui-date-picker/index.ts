import {
  createSelectorPopoverStyle,
  createRenderedOptions,
  scheduleSelectorPlacement,
  validOptionIndex,
} from '../ui-selector/selector.js';
import { needsCurrentRuntimeSkyline3172UiCompatibility } from '../../../platform/runtime-ui-compatibility.js';
import {
  CALENDAR_PERIOD_SCROLL_SETTLE_MS,
  CALENDAR_PERIOD_SWIPER_DURATION_MS,
  CALENDAR_PERIOD_SWIPER_EASING_FUNCTION,
  cancelCalendarPeriodShift,
  commitCalendarPeriodSwipe,
  createCalendarPeriodPaneId,
  createCalendarPeriodPagerState,
  finishCalendarPeriodShift,
  getAdjacentCalendarPeriodSlot,
  isCalendarPeriodSlot,
  mapCalendarPeriodRing,
  measureCalendarPeriodPaneWidth,
  mergeCalendarPeriodScrollMetrics,
  nearestCalendarPeriodScrollSlot,
  placeCalendarPeriodTarget,
  prepareCalendarPeriodChange,
  requestCalendarPeriodShift,
  takeQueuedCalendarPeriodShift,
  type CalendarPeriodScrollMetrics,
  type CalendarPeriodPagerState,
  type CalendarPeriodRelative,
  type CalendarPeriodSlot,
} from '../../calendar/calendar-period-pager.js';

interface WorkflowPickerOption {
  readonly isWeekend?: boolean;
  readonly label: string;
  readonly value: string;
}

interface WorkflowPickerRenderedOption extends WorkflowPickerOption {
  readonly leadingLabel: string;
  readonly trailingLabel: string;
  readonly weekendLabel: string;
}

interface WorkflowPickerWheelOption {
  readonly ariaLabel: string;
  readonly label: string;
  readonly unit: string;
}

interface WorkflowPickerDateCell {
  readonly day: number;
  readonly disabled: boolean;
  readonly isSelected: boolean;
  readonly isToday: boolean;
  readonly isWeekend: boolean;
  readonly muted: boolean;
  readonly value: string;
}
interface WorkflowPickerDatePanel {
  readonly cells: readonly WorkflowPickerDateCell[];
  readonly key: string;
  readonly month: number;
  readonly relative: CalendarPeriodRelative;
  readonly slot: CalendarPeriodSlot;
  readonly year: number;
}

interface UiWheelReportEvent {
  readonly detail: {
    readonly generation: number;
    readonly index: number;
    readonly offset: number;
    readonly runtimeKey: string;
    readonly sequence: number;
  };
}

interface OptionTapEvent {
  readonly currentTarget: { readonly dataset: { readonly index?: number } };
}

interface DateNavigateEvent {
  readonly currentTarget: { readonly dataset: { readonly offset?: number } };
}

interface DateTapEvent {
  readonly currentTarget: { readonly dataset: { readonly value?: string } };
}
interface DateSwiperEvent {
  readonly detail: { readonly current: number };
}

interface DateScrollEvent {
  readonly detail: { readonly scrollLeft?: number; readonly scrollWidth?: number };
}

interface WorkflowPickerInstance {
  applyChange?(detail: unknown): void;
  closeFromParent?(): void;
  forwardHostedChange?(detail: unknown): void;
  forwardHostedClose?(): void;
  openFromParent?(): void;
  _datePager?: CalendarPeriodPagerState;
  _datePendingSelection?:
    { readonly day: number; readonly month: number; readonly year: number } | undefined;
  _dateLocateTimer?: unknown;
  _dateCompatGesture?: boolean;
  _dateCompatGestureDelta?: -1 | 0 | 1 | undefined;
  _dateCompatRequestedDelta?: -1 | 0 | 1 | undefined;
  _dateCompatTimer?: ReturnType<typeof setTimeout>;
  _dateCompatMetrics?: CalendarPeriodScrollMetrics | undefined;
  _monthWheelSequence?: number;
  _wheelRuntimeId?: string;
  _yearWheelSequence?: number;
  createSelectorQuery?(): MiniProgramSelectorQuery;
  readonly data: {
    readonly dateCells: readonly WorkflowPickerDateCell[];
    readonly compatPanes: readonly WorkflowPickerDatePanel[];
    readonly dateLocateAnimating: boolean;
    readonly datePagerAnimated: boolean;
    readonly datePagerTarget: string;
    readonly datePaneStyle: string;
    readonly datePanels: readonly WorkflowPickerDatePanel[];
    readonly dateSwiperIndex: number;
    readonly dateSwiperDuration: number;
    readonly dateSwiperEasingFunction: string;
    readonly days: readonly number[];
    readonly draftDay: number;
    readonly draftDisplayValue: string;
    readonly draftIndices: readonly number[];
    readonly draftMonth: number;
    readonly draftYear: number;
    readonly hostedLocally: boolean;
    readonly open: boolean;
    readonly renderedOptions: readonly WorkflowPickerRenderedOption[];
    readonly selectedOptionIndex: number;
    readonly monthWheelCommandRevision: number;
    readonly monthWheelItems: readonly WorkflowPickerWheelOption[];
    readonly monthWheelRuntimeKey: string;
    readonly monthWheelSettledIndex: number;
    readonly popoverPlacement: 'down' | 'up';
    readonly popoverPlacementReady: boolean;
    readonly popoverStyle: string;
    readonly skyline3172UiCompatibility: boolean;
    readonly wheelGeneration: number;
    readonly yearWheelCommandRevision: number;
    readonly yearWheelItems: readonly WorkflowPickerWheelOption[];
    readonly yearWheelRuntimeKey: string;
    readonly yearWheelSettledIndex: number;
    readonly years: readonly number[];
  };
  readonly properties: {
    readonly disabled: boolean;
    readonly dialogOnly: boolean;
    readonly hostKey: string;
    readonly max: string;
    readonly min: string;
    readonly mode: 'date' | 'month' | 'selector';
    readonly options: readonly WorkflowPickerOption[];
    readonly selectedIndex: number;
    readonly title: string;
    readonly value: string;
  };
  setData(patch: Readonly<Record<string, unknown>>, callback?: () => void): void;
  triggerEvent(
    name: string,
    detail?: unknown,
    options?: { readonly bubbles?: boolean; readonly composed?: boolean },
  ): void;
}

const monthValues = Array.from({ length: 12 }, (_, index) => index + 1);
const weekdays = ['一', '二', '三', '四', '五', '六', '日'];
const dateLocateMotionMs = 520;
const pickerInstances = new Set<WorkflowPickerInstance>();
let pickerRuntimeSerial = 0;

Component({
  properties: {
    fieldLabel: { type: String, value: '' },
    disabled: { type: Boolean, value: false },
    displayValue: { type: String, value: '' },
    dialogOnly: { type: Boolean, value: false },
    hostKey: { type: String, value: '' },
    max: { type: String, value: '' },
    min: { type: String, value: '' },
    mode: { type: String, value: 'selector' },
    options: { type: Array, value: [] },
    placeholder: { type: String, value: '请选择' },
    selectedIndex: { type: Number, value: -1 },
    title: { type: String, value: '请选择' },
    value: { type: String, value: '' },
  },

  data: {
    dateCells: [] as readonly WorkflowPickerDateCell[],
    compatPanes: [] as readonly WorkflowPickerDatePanel[],
    hostedLocally: false,
    dateLocateAnimating: false,
    datePanels: [] as readonly WorkflowPickerDatePanel[],
    dateSwiperIndex: 1,
    dateSwiperDuration: CALENDAR_PERIOD_SWIPER_DURATION_MS,
    dateSwiperEasingFunction: CALENDAR_PERIOD_SWIPER_EASING_FUNCTION,
    datePagerAnimated: false,
    datePagerTarget: createCalendarPeriodPaneId('date-pane-', 1),
    datePaneStyle: '',
    days: Array.from({ length: 31 }, (_, index) => index + 1),
    draftDay: 1,
    draftDisplayValue: '',
    draftIndices: [5, 0, 0],
    draftMonth: 1,
    draftYear: new Date().getUTCFullYear(),
    monthWheelCommandRevision: 0,
    monthWheelItems: createWheelOptions(monthValues, '月'),
    monthWheelRuntimeKey: 'workflow-picker-unattached-month',
    monthWheelSettledIndex: 0,
    open: false,
    popoverPlacement: 'down' as const,
    popoverPlacementReady: true,
    popoverStyle: '',
    renderedOptions: [] as readonly WorkflowPickerRenderedOption[],
    selectedOptionIndex: -1,
    skyline3172UiCompatibility: needsCurrentRuntimeSkyline3172UiCompatibility(),
    weekdays,
    wheelGeneration: 0,
    yearWheelCommandRevision: 0,
    yearWheelItems: createWheelOptions(createYearValues(new Date().getUTCFullYear()), '年'),
    yearWheelRuntimeKey: 'workflow-picker-unattached-year',
    yearWheelSettledIndex: 5,
    years: createYearValues(new Date().getUTCFullYear()),
  },

  lifetimes: {
    attached(this: WorkflowPickerInstance): void {
      pickerInstances.add(this);
      resetDatePager(this);
      this.setData({
        ...createWheelRuntimePatch(this),
        hostedLocally: needsHostedDialog(this),
      });
    },
    detached(this: WorkflowPickerInstance): void {
      clearPickerTimer(this);
      resetDatePager(this);
      resetWheelSequences(this);
      pickerInstances.delete(this);
    },
  },

  observers: {
    'datePanels, skyline3172UiCompatibility'(this: WorkflowPickerInstance): void {
      syncCompatDatePanes(this);
    },
    hostKey(this: WorkflowPickerInstance): void {
      const hostedLocally = needsHostedDialog(this);
      if (hostedLocally !== this.data.hostedLocally) this.setData({ hostedLocally });
    },
  },

  methods: {
    handleOpen(this: WorkflowPickerInstance): void {
      if (this.properties.disabled || this.properties.dialogOnly) return;
      if (this.data.open) {
        closePicker(this);
        return;
      }
      for (const picker of pickerInstances) {
        if (picker !== this && picker.data.open) {
          closePicker(picker);
        }
      }
      if (this.data.hostedLocally) {
        // The affected runtime cannot lift an overlay out of a sheet's scroll
        // area, so the hosting panel renders the dialog on its own root layer.
        this.triggerEvent(
          'pickerrequestopen',
          {
            hostKey: this.properties.hostKey,
            max: this.properties.max,
            min: this.properties.min,
            mode: this.properties.mode,
            options: this.properties.options,
            selectedIndex: this.properties.selectedIndex,
            title: this.properties.title,
            value: this.properties.value,
          },
          { bubbles: true, composed: true },
        );
        this.setData({ open: true });
        return;
      }
      clearPickerTimer(this);
      resetDatePager(this);
      const wheelRuntime = beginWheelGeneration(this);
      this.triggerEvent('pickerrequestopen', {}, { bubbles: true, composed: true });
      if (this.properties.mode === 'selector') {
        const selectedOptionIndex = validOptionIndex(
          this.properties.options,
          this.properties.selectedIndex,
        );
        this.setData({
          draftDisplayValue:
            selectedOptionIndex < 0
              ? this.properties.title
              : (this.properties.options[selectedOptionIndex]?.label ?? this.properties.title),
          open: true,
          popoverPlacement: 'down',
          popoverPlacementReady: false,
          popoverStyle: createSelectorPopoverStyle(
            this.properties.options.length,
            this.data.skyline3172UiCompatibility,
          ),
          renderedOptions: createRenderedOptions(this.properties.options),
          selectedOptionIndex,
          ...wheelRuntime,
        });
        scheduleSelectorPlacement(this);
        return;
      }

      this.setData(createTemporalDraft(this, wheelRuntime), () => {
        measureCompatPanes(this);
      });
    },

    openFromParent(this: WorkflowPickerInstance): void {
      if (!this.properties.dialogOnly || this.data.open) return;
      clearPickerTimer(this);
      resetDatePager(this);
      this.setData(createTemporalDraft(this, beginWheelGeneration(this)), () => {
        measureCompatPanes(this);
      });
    },

    applyChange(this: WorkflowPickerInstance, detail: unknown): void {
      this.triggerEvent('change', detail);
      closePicker(this);
    },

    forwardHostedChange(this: WorkflowPickerInstance, detail: unknown): void {
      findHostedTrigger(this.properties.hostKey)?.applyChange?.(detail);
      closePicker(this);
    },

    forwardHostedClose(this: WorkflowPickerInstance): void {
      findHostedTrigger(this.properties.hostKey)?.closeFromParent?.();
      closePicker(this);
    },

    handleClose(this: WorkflowPickerInstance): void {
      closePicker(this);
      if (this.properties.dialogOnly) this.triggerEvent('close');
    },

    handleHostedClose(this: WorkflowPickerInstance): void {
      this.forwardHostedClose?.();
    },

    closeFromParent(this: WorkflowPickerInstance): void {
      if (this.data.open) closePicker(this);
    },

    handleInternalTap(): void {},

    handleOptionTap(this: WorkflowPickerInstance, event: OptionTapEvent): void {
      const index = Number(event.currentTarget.dataset.index);
      const option = this.properties.options[index];
      if (!Number.isInteger(index) || option === undefined) return;
      this.triggerEvent('change', { index, option, value: String(index) });
      this.setData({
        draftDisplayValue: option.label,
        open: false,
        selectedOptionIndex: index,
        wheelGeneration: nextWheelGeneration(this),
      });
    },

    handleYearWheelPreview(this: WorkflowPickerInstance, event: UiWheelReportEvent): void {
      applyWheelReport(this, 'year', event.detail, false);
    },

    handleMonthWheelPreview(this: WorkflowPickerInstance, event: UiWheelReportEvent): void {
      applyWheelReport(this, 'month', event.detail, false);
    },

    handleYearWheelSettled(this: WorkflowPickerInstance, event: UiWheelReportEvent): void {
      applyWheelReport(this, 'year', event.detail, true);
    },

    handleMonthWheelSettled(this: WorkflowPickerInstance, event: UiWheelReportEvent): void {
      applyWheelReport(this, 'month', event.detail, true);
    },

    handleDateNavigate(this: WorkflowPickerInstance, event: DateNavigateEvent): void {
      const offset = Number(event.currentTarget.dataset.offset);
      if (offset !== -1 && offset !== 1) return;
      startDateProgrammaticShift(this, offset);
    },

    handleDateSwiperChangeStart(this: WorkflowPickerInstance, event: DateSwiperEvent): void {
      const current = Number(event.detail.current);
      const state = readDatePagerState(this);
      if (!prepareCalendarPeriodChange(state, current)) return;
      writeDatePagerState(this, state);
      const targetPanel = this.data.datePanels[current];
      if (targetPanel !== undefined) {
        this._datePendingSelection = {
          day: Math.min(
            this.data.draftDay,
            createDayValues(targetPanel.year, targetPanel.month).length,
          ),
          month: targetPanel.month,
          year: targetPanel.year,
        };
      }
    },

    handleDateSwiperFinish(this: WorkflowPickerInstance, event: DateSwiperEvent): void {
      finishDateSwiperAt(this, Number(event.detail.current));
    },

    handleDateCompatTouchStart(this: WorkflowPickerInstance): void {
      this._dateCompatGesture = true;
    },

    measurePanes(this: WorkflowPickerInstance): void {
      measureCompatPanes(this);
    },

    handleDateCompatScroll(this: WorkflowPickerInstance, event: DateScrollEvent): void {
      this._dateCompatMetrics = mergeCalendarPeriodScrollMetrics(
        this._dateCompatMetrics,
        event.detail,
      );
      if (this._dateCompatGesture === true) prepareCompatDateTarget(this);
      scheduleDateCompatSettle(this);
    },

    handleDateCompatTouchEnd(this: WorkflowPickerInstance): void {
      this._dateCompatGesture = false;
      scheduleDateCompatSettle(this);
    },

    handleDateToday(this: WorkflowPickerInstance): void {
      const today = currentChinaDateParts();
      const value = formatDateValue(today);
      if (isOutsideRange(value, this.properties.min, this.properties.max)) return;
      startDateLocateMotion(this);
      if (this.data.skyline3172UiCompatibility) {
        startDateCompatLocate(this, today);
        return;
      }
      // Re-center on today in one step, whatever the pager was doing. Reading
      // the pending/prepared panel made this tap a silent no-op whenever a
      // shift or a queued arrow tap was still settling.
      resetDatePager(this);
      this._datePendingSelection = undefined;
      this.setData({
        ...createDateDraftPatch(this, today.year, today.month, today.day),
      });
    },

    handleDateSelect(this: WorkflowPickerInstance, event: DateTapEvent): void {
      const value = event.currentTarget.dataset.value;
      const selected = value === undefined ? undefined : parseTemporalValue(value);
      if (
        selected?.day === undefined ||
        selected.year !== this.data.draftYear ||
        selected.month !== this.data.draftMonth ||
        isOutsideRange(value ?? '', this.properties.min, this.properties.max)
      ) {
        return;
      }
      const state = readDatePagerState(this);
      if (state.targetSlot !== undefined || state.shiftPending) return;
      this._datePendingSelection = undefined;
      this.setData(createDateDraftPatch(this, selected.year, selected.month, selected.day));
    },

    handleConfirm(this: WorkflowPickerInstance): void {
      if (this.properties.mode === 'selector') {
        const index = this.data.selectedOptionIndex;
        const option = this.properties.options[index];
        if (option === undefined) return;
        this.triggerEvent('change', { index, option, value: String(index) });
        closePicker(this);
        return;
      }

      if (this.properties.mode === 'date') {
        const state = readDatePagerState(this);
        if (state.targetSlot !== undefined || state.shiftPending) return;
      }

      const value =
        this.properties.mode === 'month'
          ? `${this.data.draftYear}-${pad(this.data.draftMonth)}`
          : formatDateValue(
              this._datePendingSelection ?? {
                day: this.data.draftDay,
                month: this.data.draftMonth,
                year: this.data.draftYear,
              },
            );
      this.triggerEvent('change', { value });
      closePicker(this);
    },
  },
});

function startDateLocateMotion(instance: WorkflowPickerInstance): void {
  if (instance._dateLocateTimer !== undefined) clearTimeout(instance._dateLocateTimer);
  instance.setData({ dateLocateAnimating: true });
  instance._dateLocateTimer = setTimeout(() => {
    instance._dateLocateTimer = undefined;
    instance.setData({ dateLocateAnimating: false });
  }, dateLocateMotionMs);
}

function clearPickerTimer(instance: WorkflowPickerInstance): void {
  if (instance._dateLocateTimer !== undefined) clearTimeout(instance._dateLocateTimer);
  instance._dateLocateTimer = undefined;
}

function readDatePagerState(instance: WorkflowPickerInstance): CalendarPeriodPagerState {
  if (instance._datePager === undefined) {
    instance._datePager = createCalendarPeriodPagerState();
  }
  return instance._datePager;
}

function writeDatePagerState(
  instance: WorkflowPickerInstance,
  state: CalendarPeriodPagerState,
): void {
  instance._datePager = state;
}

function finishDateSwiperAt(instance: WorkflowPickerInstance, current: number): void {
  const state = readDatePagerState(instance);
  if (!isCalendarPeriodSlot(current)) return;
  if (current === state.activeSlot) {
    if (state.targetSlot === undefined) return;
    cancelCalendarPeriodShift(state);
    writeDatePagerState(instance, state);
    instance._datePendingSelection = undefined;
    return;
  }
  const committed = commitCalendarPeriodSwipe(state, current);
  if (committed === undefined) return;
  writeDatePagerState(instance, state);
  applyDatePeriodChange(instance, committed.delta);
}

function resetDatePager(instance: WorkflowPickerInstance): void {
  instance._datePager = createCalendarPeriodPagerState();
  instance._datePendingSelection = undefined;
}

function startDateProgrammaticShift(instance: WorkflowPickerInstance, delta: -1 | 1): void {
  const next = new Date(Date.UTC(instance.data.draftYear, instance.data.draftMonth - 1 + delta, 1));
  const year = next.getUTCFullYear();
  const month = next.getUTCMonth() + 1;
  const day = Math.min(instance.data.draftDay, createDayValues(year, month).length);
  startDatePeriodShift(instance, delta, year, month, day);
}

function startDatePeriodShift(
  instance: WorkflowPickerInstance,
  delta: -1 | 1,
  year: number,
  month: number,
  day: number,
): void {
  const state = readDatePagerState(instance);
  const request = requestCalendarPeriodShift(state, delta);
  writeDatePagerState(instance, state);
  if (!request.started) return;

  const targetPanel = createDatePanel(
    year,
    month,
    day,
    instance.properties.min,
    instance.properties.max,
    0,
    request.targetSlot,
  );
  const currentPanels =
    instance.data.datePanels.length === 3
      ? instance.data.datePanels
      : createDatePanels(
          instance.data.draftYear,
          instance.data.draftMonth,
          instance.data.draftDay,
          instance.properties.min,
          instance.properties.max,
          state.activeSlot,
        );
  const datePanels = placeCalendarPeriodTarget(currentPanels, state.activeSlot, delta, targetPanel);
  instance._datePendingSelection = { day, month, year };
  const generation = instance.data.wheelGeneration;
  instance.setData({ datePanels }, () => {
    const currentState = readDatePagerState(instance);
    if (
      !instance.data.open ||
      instance.data.wheelGeneration !== generation ||
      currentState.targetSlot !== request.targetSlot
    ) {
      return;
    }
    if (instance.data.skyline3172UiCompatibility) {
      // The affected runtime cannot animate a programmatic swiper jump, so the
      // month slides one native panel instead and settles when the scroll stops.
      // Panes keep a fixed physical order, so the slide follows the month.
      instance._dateCompatRequestedDelta = delta;
      instance.setData({
        datePagerAnimated: true,
        datePagerTarget: createCalendarPeriodPaneId('date-pane-', delta < 0 ? 0 : 2),
      });
      return;
    }
    instance.setData({
      dateSwiperDuration: CALENDAR_PERIOD_SWIPER_DURATION_MS,
      dateSwiperIndex: request.targetSlot,
    });
  });
}

// One slide, whatever the distance: the ring is re-centred on the month that is
// already on screen, then the platform animates a single panel over to today.
function startDateCompatLocate(
  instance: WorkflowPickerInstance,
  today: { readonly day: number; readonly month: number; readonly year: number },
): void {
  const days = createDayValues(today.year, today.month);
  const day = Math.min(today.day, days.length);
  clearDateCompatSettle(instance);
  instance._dateCompatRequestedDelta = undefined;
  instance._dateCompatGestureDelta = undefined;
  instance._dateCompatGesture = false;
  const currentIndex = instance.data.draftYear * 12 + instance.data.draftMonth - 1;
  const targetIndex = today.year * 12 + today.month - 1;
  const draftYear = instance.data.draftYear;
  const draftMonth = instance.data.draftMonth;
  const draftDay = instance.data.draftDay;
  resetDatePager(instance);
  instance._datePendingSelection = undefined;
  instance.setData(createDateDraftPatch(instance, draftYear, draftMonth, draftDay), () => {
    if (targetIndex === currentIndex) {
      instance.setData(createDateDraftPatch(instance, today.year, today.month, day));
      return;
    }
    startDatePeriodShift(
      instance,
      targetIndex < currentIndex ? -1 : 1,
      today.year,
      today.month,
      day,
    );
  });
}

function measureCompatPanes(instance: WorkflowPickerInstance): void {
  if (!instance.data.skyline3172UiCompatibility) return;
  measureCalendarPeriodPaneWidth(instance, '.workflow-picker-date-swiper.is-compat', (width) => {
    const datePaneStyle = `width:${width}px`;
    if (instance.data.datePaneStyle !== datePaneStyle) instance.setData({ datePaneStyle });
  });
}

function clearDateCompatSettle(instance: WorkflowPickerInstance): void {
  if (instance._dateCompatTimer !== undefined) {
    clearTimeout(instance._dateCompatTimer);
    instance._dateCompatTimer = undefined;
  }
}

function scheduleDateCompatSettle(instance: WorkflowPickerInstance): void {
  clearDateCompatSettle(instance);
  instance._dateCompatTimer = setTimeout(() => {
    instance._dateCompatTimer = undefined;
    settleDateCompatScroll(instance);
  }, CALENDAR_PERIOD_SCROLL_SETTLE_MS);
}

function nearestDateCompatSlot(instance: WorkflowPickerInstance): CalendarPeriodSlot | undefined {
  return nearestCalendarPeriodScrollSlot(instance._dateCompatMetrics);
}

// The native scroller pages by position, not by ring slot, so the affected
// runtime keeps its three date panes in a fixed physical order (previous |
// current | next) and is re-centred on the middle pane after every step.
function syncCompatDatePanes(instance: WorkflowPickerInstance): void {
  if (!instance.data.skyline3172UiCompatibility) return;
  const panels = instance.data.datePanels;
  const byRelative = new Map(panels.map((panel) => [panel.relative, panel]));
  const ordered = ([-1, 0, 1] as const).map(
    (relative, index) => byRelative.get(relative) ?? panels[index],
  );
  instance.setData({
    compatPanes: ordered,
    datePagerAnimated: false,
    datePagerTarget: createCalendarPeriodPaneId('date-pane-', 1),
  });
}

function compatDatePaneDelta(instance: WorkflowPickerInstance): -1 | 0 | 1 {
  const pane = nearestDateCompatSlot(instance);
  if (pane === undefined || pane === 1) return 0;
  return pane === 0 ? -1 : 1;
}

// A gesture swipe has no queued target, so the panel the scroll settled on is
// prepared here — the same preparation the swiper gets from its change event.
function prepareCompatDateTarget(instance: WorkflowPickerInstance): void {
  const delta = compatDatePaneDelta(instance);
  instance._dateCompatGestureDelta = delta;
  if (delta === 0) return;
  const state = readDatePagerState(instance);
  const slot = getAdjacentCalendarPeriodSlot(state.activeSlot, delta);
  if (!prepareCalendarPeriodChange(state, slot)) return;
  writeDatePagerState(instance, state);
  const panel = instance.data.compatPanes?.[delta < 0 ? 0 : 2];
  if (panel === undefined) return;
  const days = createDayValues(panel.year, panel.month);
  instance._datePendingSelection = {
    day: Math.min(instance.data.draftDay, days.length),
    month: panel.month,
    year: panel.year,
  };
}

function settleDateCompatScroll(instance: WorkflowPickerInstance): void {
  if (!instance.data.open || !instance.data.skyline3172UiCompatibility) return;
  const requested = instance._dateCompatRequestedDelta;
  instance._dateCompatRequestedDelta = undefined;
  prepareCompatDateTarget(instance);
  const delta = requested ?? instance._dateCompatGestureDelta ?? compatDatePaneDelta(instance);
  instance._dateCompatGestureDelta = undefined;
  if (delta === 0) return;
  const state = readDatePagerState(instance);
  const slot = getAdjacentCalendarPeriodSlot(state.activeSlot, delta);
  finishDateSwiperAt(instance, slot);
  // The ring rotated behind the scenes; land back on the middle pane so the next
  // step always travels the way a month does.
  const width = instance._dateCompatMetrics?.width;
  if (width !== undefined) instance._dateCompatMetrics = { left: width, width };
  instance.setData({
    datePagerAnimated: false,
    datePagerTarget: createCalendarPeriodPaneId('date-pane-', 1),
  });
}

function applyDatePeriodChange(instance: WorkflowPickerInstance, delta: -1 | 1): void {
  const pending = instance._datePendingSelection;
  const next = new Date(Date.UTC(instance.data.draftYear, instance.data.draftMonth - 1 + delta, 1));
  const year = pending?.year ?? next.getUTCFullYear();
  const month = pending?.month ?? next.getUTCMonth() + 1;
  const day = pending?.day ?? Math.min(instance.data.draftDay, createDayValues(year, month).length);
  const generation = instance.data.wheelGeneration;
  instance.setData(createDateDraftPatch(instance, year, month, day), () => {
    if (!instance.data.open || instance.data.wheelGeneration !== generation) return;
    instance._datePendingSelection = undefined;
    finishDatePeriodShift(instance);
  });
}

function finishDatePeriodShift(instance: WorkflowPickerInstance): void {
  const state = readDatePagerState(instance);
  const settled = finishCalendarPeriodShift(state);
  writeDatePagerState(instance, state);
  if (!settled.continues) return;
  const delta = takeQueuedCalendarPeriodShift(state);
  writeDatePagerState(instance, state);
  if (delta !== 0) startDateProgrammaticShift(instance, delta);
}

function ensureWheelRuntimeId(instance: WorkflowPickerInstance): string {
  if (instance._wheelRuntimeId === undefined) {
    pickerRuntimeSerial += 1;
    instance._wheelRuntimeId = `workflow-picker-${pickerRuntimeSerial}`;
  }
  return instance._wheelRuntimeId;
}

function createWheelRuntimePatch(
  instance: WorkflowPickerInstance,
): Readonly<Record<string, unknown>> {
  const runtimeId = ensureWheelRuntimeId(instance);
  return {
    monthWheelRuntimeKey: `${runtimeId}-month`,
    yearWheelRuntimeKey: `${runtimeId}-year`,
  };
}

function nextWheelGeneration(instance: WorkflowPickerInstance): number {
  return Math.max(0, Math.trunc(instance.data.wheelGeneration)) + 1;
}

function resetWheelSequences(instance: WorkflowPickerInstance): void {
  instance._monthWheelSequence = 0;
  instance._yearWheelSequence = 0;
}

function beginWheelGeneration(instance: WorkflowPickerInstance): Readonly<Record<string, unknown>> {
  resetWheelSequences(instance);
  return {
    ...createWheelRuntimePatch(instance),
    wheelGeneration: nextWheelGeneration(instance),
  };
}

function createTemporalDraft(
  instance: WorkflowPickerInstance,
  wheelRuntime: Readonly<Record<string, unknown>>,
): Readonly<Record<string, unknown>> {
  const fallback = currentChinaDateParts();
  const temporal = parseTemporalValue(instance.properties.value) ?? fallback;
  const centerYear = temporal.year;
  const years = createYearValues(centerYear);
  const yearIndex = Math.max(0, years.indexOf(centerYear));
  const monthIndex = temporal.month - 1;
  const days = createDayValues(centerYear, temporal.month);
  const draftDay = Math.min(temporal.day ?? 1, days.length);
  return {
    dateCells: createDateCells(
      centerYear,
      temporal.month,
      draftDay,
      instance.properties.min,
      instance.properties.max,
    ),
    datePanels: createDatePanels(
      centerYear,
      temporal.month,
      draftDay,
      instance.properties.min,
      instance.properties.max,
    ),
    dateSwiperIndex: 1,
    dateSwiperDuration: CALENDAR_PERIOD_SWIPER_DURATION_MS,
    dateSwiperEasingFunction: CALENDAR_PERIOD_SWIPER_EASING_FUNCTION,
    dateLocateAnimating: false,
    days,
    draftDay,
    draftDisplayValue: formatTemporalDisplay(
      instance.properties.mode === 'date' ? 'date' : 'month',
      centerYear,
      temporal.month,
      draftDay,
    ),
    draftIndices: [yearIndex, monthIndex, draftDay - 1],
    draftMonth: temporal.month,
    draftYear: centerYear,
    monthWheelItems: createWheelOptions(monthValues, '月'),
    monthWheelSettledIndex: monthIndex,
    open: true,
    popoverPlacement: 'down',
    yearWheelItems: createWheelOptions(years, '年'),
    yearWheelSettledIndex: yearIndex,
    years,
    ...wheelRuntime,
  };
}

function needsHostedDialog(instance: WorkflowPickerInstance): boolean {
  return (
    !instance.properties.dialogOnly &&
    instance.properties.hostKey !== '' &&
    instance.data.skyline3172UiCompatibility
  );
}

function findHostedTrigger(hostKey: string): WorkflowPickerInstance | undefined {
  if (hostKey === '') return undefined;
  for (const picker of pickerInstances) {
    if (!picker.properties.dialogOnly && picker.properties.hostKey === hostKey) return picker;
  }
  return undefined;
}

function closePicker(instance: WorkflowPickerInstance): void {
  clearPickerTimer(instance);
  resetDatePager(instance);
  resetWheelSequences(instance);
  instance.setData({ open: false, wheelGeneration: nextWheelGeneration(instance) });
}

function applyWheelReport(
  instance: WorkflowPickerInstance,
  kind: 'month' | 'year',
  report: UiWheelReportEvent['detail'],
  settled: boolean,
): void {
  const runtimeKey =
    kind === 'year' ? instance.data.yearWheelRuntimeKey : instance.data.monthWheelRuntimeKey;
  const sequenceKey = kind === 'year' ? '_yearWheelSequence' : '_monthWheelSequence';
  const sequence = Number(report.sequence);
  if (
    report.runtimeKey !== runtimeKey ||
    report.generation !== instance.data.wheelGeneration ||
    !Number.isInteger(sequence) ||
    sequence <= (instance[sequenceKey] ?? 0)
  ) {
    return;
  }
  const maximumIndex = kind === 'year' ? instance.data.years.length - 1 : monthValues.length - 1;
  const index = Number(report.index);
  if (!Number.isInteger(index) || index < 0 || index > maximumIndex) return;
  instance[sequenceKey] = sequence;
  applyMonthWheelDraft(
    instance,
    kind === 'year' ? index : (instance.data.draftIndices[0] ?? 0),
    kind === 'month' ? index : (instance.data.draftIndices[1] ?? 0),
  );
  if (settled) {
    instance.setData(
      kind === 'year' ? { yearWheelSettledIndex: index } : { monthWheelSettledIndex: index },
    );
  }
}

function applyMonthWheelDraft(
  instance: WorkflowPickerInstance,
  yearIndex: number,
  monthIndex: number,
): void {
  const boundedYearIndex = Math.min(instance.data.years.length - 1, Math.max(0, yearIndex));
  const boundedMonthIndex = Math.min(monthValues.length - 1, Math.max(0, monthIndex));
  const year = instance.data.years[boundedYearIndex] ?? instance.data.draftYear;
  const month = boundedMonthIndex + 1;
  const days = createDayValues(year, month);
  const draftDay = Math.min(instance.data.draftDay, days.length);
  instance.setData({
    days,
    draftDay,
    draftDisplayValue: formatTemporalDisplay('month', year, month, draftDay),
    draftIndices: [boundedYearIndex, boundedMonthIndex, draftDay - 1],
    draftMonth: month,
    draftYear: year,
  });
}

function createWheelOptions(
  values: readonly number[],
  unit: string,
): readonly WorkflowPickerWheelOption[] {
  return values.map((value) => ({
    ariaLabel: `${value}${unit}`,
    label: String(value),
    unit,
  }));
}

function createDateDraftPatch(
  instance: WorkflowPickerInstance,
  year: number,
  month: number,
  day: number,
): Readonly<Record<string, unknown>> {
  const activeSlot = readDatePagerState(instance).activeSlot;
  return {
    dateCells: createDateCells(year, month, day, instance.properties.min, instance.properties.max),
    datePanels: createDatePanels(
      year,
      month,
      day,
      instance.properties.min,
      instance.properties.max,
      activeSlot,
    ),
    dateSwiperDuration: CALENDAR_PERIOD_SWIPER_DURATION_MS,
    dateSwiperIndex: activeSlot,
    datePagerAnimated: false,
    datePagerTarget: createCalendarPeriodPaneId('date-pane-', activeSlot),
    days: createDayValues(year, month),
    draftDay: day,
    draftDisplayValue: formatTemporalDisplay('date', year, month, day),
    draftMonth: month,
    draftYear: year,
  };
}

function createDatePanels(
  year: number,
  month: number,
  day: number,
  min: string,
  max: string,
  activeSlot: CalendarPeriodSlot = 1,
): readonly WorkflowPickerDatePanel[] {
  const logicalPanels = ([-1, 0, 1] as const).map((relative) => {
    const date = new Date(Date.UTC(year, month - 1 + relative, 1));
    return createDatePanel(
      date.getUTCFullYear(),
      date.getUTCMonth() + 1,
      day,
      min,
      max,
      relative,
      (relative + 1) as CalendarPeriodSlot,
    );
  });
  return mapCalendarPeriodRing(logicalPanels, activeSlot);
}

function createDatePanel(
  year: number,
  month: number,
  day: number,
  min: string,
  max: string,
  relative: CalendarPeriodRelative,
  slot: CalendarPeriodSlot,
): WorkflowPickerDatePanel {
  return {
    cells: createDateCells(year, month, day, min, max),
    key: `${year}-${pad(month)}`,
    month,
    relative,
    slot,
    year,
  };
}

function createYearValues(centerYear: number): readonly number[] {
  return Array.from({ length: 11 }, (_, index) => centerYear - 5 + index);
}

function createDayValues(year: number, month: number): readonly number[] {
  const count = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return Array.from({ length: count }, (_, index) => index + 1);
}

function createDateCells(
  year: number,
  month: number,
  selectedDay: number,
  min: string,
  max: string,
): readonly WorkflowPickerDateCell[] {
  const todayValue = formatDateValue(currentChinaDateParts());
  const firstWeekday = (new Date(Date.UTC(year, month - 1, 1)).getUTCDay() + 6) % 7;
  const currentMonthDays = createDayValues(year, month).length;
  const previousMonth = month === 1 ? 12 : month - 1;
  const previousYear = month === 1 ? year - 1 : year;
  const previousMonthDays = createDayValues(previousYear, previousMonth).length;
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
    const weekday = new Date(Date.UTC(cellYear, cellMonth - 1, day)).getUTCDay();
    return {
      day,
      disabled: muted || isOutsideRange(value, min, max),
      isSelected: !muted && day === selectedDay,
      isToday: !muted && value === todayValue,
      isWeekend: weekday === 0 || weekday === 6,
      muted,
      value,
    };
  });
}

function currentChinaDateParts(): {
  readonly day: number;
  readonly month: number;
  readonly year: number;
} {
  const chinaNow = new Date(Date.now() + 8 * 60 * 60 * 1000);
  return {
    day: chinaNow.getUTCDate(),
    month: chinaNow.getUTCMonth() + 1,
    year: chinaNow.getUTCFullYear(),
  };
}

function formatDateValue(value: {
  readonly day: number;
  readonly month: number;
  readonly year: number;
}): string {
  return `${value.year}-${pad(value.month)}-${pad(value.day)}`;
}

function parseTemporalValue(
  value: string,
): { readonly day?: number; readonly month: number; readonly year: number } | undefined {
  const match = /^(\d{4})-(\d{2})(?:-(\d{2}))?$/u.exec(value);
  if (match === null) return undefined;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = match[3] === undefined ? undefined : Number(match[3]);
  if (
    !Number.isInteger(year) ||
    month < 1 ||
    month > 12 ||
    (day !== undefined && (day < 1 || day > createDayValues(year, month).length))
  ) {
    return undefined;
  }
  return { ...(day === undefined ? {} : { day }), month, year };
}

function formatTemporalDisplay(
  mode: 'date' | 'month',
  year: number,
  month: number,
  day: number,
): string {
  return mode === 'month' ? `${year}年${month}月` : `${year}年${month}月${day}日`;
}

function isOutsideRange(value: string, min: string, max: string): boolean {
  return (min !== '' && value < min) || (max !== '' && value > max);
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}
