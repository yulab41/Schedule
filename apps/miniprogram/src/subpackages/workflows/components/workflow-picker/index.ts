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
}

interface WorkflowPickerDateCell {
  readonly day: number;
  readonly disabled: boolean;
  readonly isSelected: boolean;
  readonly isWeekend: boolean;
  readonly muted: boolean;
  readonly value: string;
}
interface WorkflowPickerDatePanel {
  readonly cells: readonly WorkflowPickerDateCell[];
  readonly key: string;
  readonly month: number;
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

interface WorkflowPickerInstance {
  _dateLocateTimer?: unknown;
  _monthWheelSequence?: number;
  _wheelRuntimeId?: string;
  _yearWheelSequence?: number;
  createSelectorQuery?(): MiniProgramSelectorQuery;
  readonly data: {
    readonly dateCells: readonly WorkflowPickerDateCell[];
    readonly dateLocateAnimating: boolean;
    readonly datePanels: readonly WorkflowPickerDatePanel[];
    readonly dateSwiperIndex: number;
    readonly days: readonly number[];
    readonly draftDay: number;
    readonly draftDisplayValue: string;
    readonly draftIndices: readonly number[];
    readonly draftMonth: number;
    readonly draftYear: number;
    readonly open: boolean;
    readonly renderedOptions: readonly WorkflowPickerRenderedOption[];
    readonly selectedOptionIndex: number;
    readonly monthWheelCommandRevision: number;
    readonly monthWheelItems: readonly WorkflowPickerWheelOption[];
    readonly monthWheelRuntimeKey: string;
    readonly monthWheelSettledIndex: number;
    readonly popoverPlacement: 'down' | 'up';
    readonly popoverPlacementReady: boolean;
    readonly wheelGeneration: number;
    readonly yearWheelCommandRevision: number;
    readonly yearWheelItems: readonly WorkflowPickerWheelOption[];
    readonly yearWheelRuntimeKey: string;
    readonly yearWheelSettledIndex: number;
    readonly years: readonly number[];
  };
  readonly properties: {
    readonly disabled: boolean;
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
    disabled: { type: Boolean, value: false },
    displayValue: { type: String, value: '' },
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
    dateLocateAnimating: false,
    datePanels: [] as readonly WorkflowPickerDatePanel[],
    dateSwiperIndex: 1,
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
    renderedOptions: [] as readonly WorkflowPickerRenderedOption[],
    selectedOptionIndex: -1,
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
      this.setData(createWheelRuntimePatch(this));
    },
    detached(this: WorkflowPickerInstance): void {
      clearPickerTimer(this);
      resetWheelSequences(this);
      pickerInstances.delete(this);
    },
  },

  methods: {
    handleOpen(this: WorkflowPickerInstance): void {
      if (this.properties.disabled) return;
      for (const picker of pickerInstances) {
        if (picker !== this && picker.data.open) {
          closePicker(picker);
        }
      }
      clearPickerTimer(this);
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
          renderedOptions: createRenderedOptions(this.properties.options),
          selectedOptionIndex,
          ...wheelRuntime,
        });
        scheduleSelectorPlacement(this);
        return;
      }

      const fallback = currentChinaDateParts();
      const temporal = parseTemporalValue(this.properties.value) ?? fallback;
      const centerYear = temporal.year;
      const years = createYearValues(centerYear);
      const yearIndex = Math.max(0, years.indexOf(centerYear));
      const monthIndex = temporal.month - 1;
      const days = createDayValues(centerYear, temporal.month);
      const draftDay = Math.min(temporal.day ?? 1, days.length);
      this.setData({
        dateCells: createDateCells(
          centerYear,
          temporal.month,
          draftDay,
          this.properties.min,
          this.properties.max,
        ),
        datePanels: createDatePanels(
          centerYear,
          temporal.month,
          draftDay,
          this.properties.min,
          this.properties.max,
        ),
        dateSwiperIndex: 1,
        dateLocateAnimating: false,
        days,
        draftDay,
        draftDisplayValue: formatTemporalDisplay(
          this.properties.mode,
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
      });
    },

    handleClose(this: WorkflowPickerInstance): void {
      closePicker(this);
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
      const next = new Date(Date.UTC(this.data.draftYear, this.data.draftMonth - 1 + offset, 1));
      const year = next.getUTCFullYear();
      const month = next.getUTCMonth() + 1;
      const days = createDayValues(year, month);
      const draftDay = Math.min(this.data.draftDay, days.length);
      this.setData(createDateDraftPatch(this, year, month, draftDay));
    },

    handleDateSwiperChange(this: WorkflowPickerInstance, event: DateSwiperEvent): void {
      const offset = event.detail.current - 1;
      if (offset !== -1 && offset !== 1) return;
      const next = new Date(Date.UTC(this.data.draftYear, this.data.draftMonth - 1 + offset, 1));
      const year = next.getUTCFullYear();
      const month = next.getUTCMonth() + 1;
      const day = Math.min(this.data.draftDay, createDayValues(year, month).length);
      this.setData(createDateDraftPatch(this, year, month, day));
    },

    handleDateToday(this: WorkflowPickerInstance): void {
      startDateLocateMotion(this);
      const today = currentChinaDateParts();
      const value = `${today.year}-${pad(today.month)}-${pad(today.day)}`;
      if (isOutsideRange(value, this.properties.min, this.properties.max)) return;
      this.setData(createDateDraftPatch(this, today.year, today.month, today.day));
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

      const value =
        this.properties.mode === 'month'
          ? `${this.data.draftYear}-${pad(this.data.draftMonth)}`
          : `${this.data.draftYear}-${pad(this.data.draftMonth)}-${pad(this.data.draftDay)}`;
      this.triggerEvent('change', { value });
      closePicker(this);
    },
  },
});

function scheduleSelectorPlacement(instance: WorkflowPickerInstance): void {
  if (typeof wx === 'undefined' || instance.createSelectorQuery === undefined) {
    instance.setData({ popoverPlacementReady: true });
    return;
  }
  const query = instance.createSelectorQuery();
  query
    .select('.workflow-picker-trigger')
    .boundingClientRect()
    .exec((results) => {
      if (!instance.data.open) return;
      const trigger = results[0];
      if (trigger === undefined || trigger === null) {
        instance.setData({ popoverPlacementReady: true });
        return;
      }
      const optionCount = instance.properties.options.length;
      const popupHeight = Math.min(300, Math.max(44, optionCount * 30 + 12));
      const windowHeight = wx.getWindowInfo().windowHeight;
      const spaceBelow = windowHeight - trigger.bottom - 8;
      const spaceAbove = trigger.top - 8;
      instance.setData({
        popoverPlacement:
          spaceBelow < popupHeight && spaceAbove > spaceBelow ? ('up' as const) : ('down' as const),
        popoverPlacementReady: true,
      });
    });
}

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

function closePicker(instance: WorkflowPickerInstance): void {
  clearPickerTimer(instance);
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
  }));
}

function createDateDraftPatch(
  instance: WorkflowPickerInstance,
  year: number,
  month: number,
  day: number,
): Readonly<Record<string, unknown>> {
  return {
    dateCells: createDateCells(year, month, day, instance.properties.min, instance.properties.max),
    datePanels: createDatePanels(
      year,
      month,
      day,
      instance.properties.min,
      instance.properties.max,
    ),
    dateSwiperIndex: 1,
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
): readonly WorkflowPickerDatePanel[] {
  return [-1, 0, 1].map((offset) => {
    const date = new Date(Date.UTC(year, month - 1 + offset, 1));
    return {
      cells: createDateCells(date.getUTCFullYear(), date.getUTCMonth() + 1, day, min, max),
      key: `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}`,
      month: date.getUTCMonth() + 1,
      year: date.getUTCFullYear(),
    };
  });
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
      isWeekend: weekday === 0 || weekday === 6,
      muted,
      value,
    };
  });
}

function validOptionIndex(options: readonly WorkflowPickerOption[], selectedIndex: number): number {
  return Number.isInteger(selectedIndex) && options[selectedIndex] !== undefined
    ? selectedIndex
    : -1;
}

function createRenderedOptions(
  options: readonly WorkflowPickerOption[],
): readonly WorkflowPickerRenderedOption[] {
  return options.map((option) => {
    const match = option.isWeekend ? /^(.*?)(（周[六日]）)(.*)$/u.exec(option.label) : null;
    return {
      ...option,
      leadingLabel: match?.[1] ?? option.label,
      trailingLabel: match?.[3] ?? '',
      weekendLabel: match?.[2] ?? '',
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
