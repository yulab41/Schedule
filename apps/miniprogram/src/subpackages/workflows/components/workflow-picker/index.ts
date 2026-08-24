interface WorkflowPickerOption {
  readonly isWeekend?: boolean;
  readonly label: string;
  readonly value: string;
}

interface WorkflowPickerDateCell {
  readonly day: number;
  readonly disabled: boolean;
  readonly isSelected: boolean;
  readonly isWeekend: boolean;
  readonly muted: boolean;
  readonly value: string;
}

interface PickerChangeEvent {
  readonly detail: { readonly value: readonly number[] };
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

interface WorkflowPickerInstance {
  readonly data: {
    readonly dateCells: readonly WorkflowPickerDateCell[];
    readonly days: readonly number[];
    readonly draftDay: number;
    readonly draftDisplayValue: string;
    readonly draftIndices: readonly number[];
    readonly draftMonth: number;
    readonly draftYear: number;
    readonly open: boolean;
    readonly selectedOptionIndex: number;
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
  triggerEvent(name: string, detail?: unknown): void;
}

const monthValues = Array.from({ length: 12 }, (_, index) => index + 1);
const weekdays = ['一', '二', '三', '四', '五', '六', '日'];

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
    days: Array.from({ length: 31 }, (_, index) => index + 1),
    draftDay: 1,
    draftDisplayValue: '',
    draftIndices: [5, 0, 0],
    draftMonth: 1,
    draftYear: new Date().getUTCFullYear(),
    months: monthValues,
    open: false,
    selectedOptionIndex: -1,
    weekdays,
    years: createYearValues(new Date().getUTCFullYear()),
  },

  methods: {
    handleOpen(this: WorkflowPickerInstance): void {
      if (this.properties.disabled) return;
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
          selectedOptionIndex,
        });
        return;
      }

      const fallback = currentUtcDateParts();
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
        open: true,
        years,
      });
    },

    handleClose(this: WorkflowPickerInstance): void {
      this.setData({ open: false });
    },

    handleOptionTap(this: WorkflowPickerInstance, event: OptionTapEvent): void {
      const index = Number(event.currentTarget.dataset.index);
      const option = this.properties.options[index];
      if (!Number.isInteger(index) || option === undefined) return;
      this.triggerEvent('change', { index, option, value: String(index) });
      this.setData({
        draftDisplayValue: option.label,
        open: false,
        selectedOptionIndex: index,
      });
    },

    handlePickerViewChange(this: WorkflowPickerInstance, event: PickerChangeEvent): void {
      const [yearIndex = 0, monthIndex = 0] = event.detail.value;
      const year = this.data.years[yearIndex] ?? this.data.draftYear;
      const month = Math.min(12, Math.max(1, monthIndex + 1));
      const days = createDayValues(year, month);
      const draftDay = Math.min(this.data.draftDay, days.length);
      this.setData({
        days,
        draftDay,
        draftDisplayValue: formatTemporalDisplay('month', year, month, draftDay),
        draftIndices: [yearIndex, month - 1, draftDay - 1],
        draftMonth: month,
        draftYear: year,
      });
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
        this.setData({ open: false });
        return;
      }

      const value =
        this.properties.mode === 'month'
          ? `${this.data.draftYear}-${pad(this.data.draftMonth)}`
          : `${this.data.draftYear}-${pad(this.data.draftMonth)}-${pad(this.data.draftDay)}`;
      this.triggerEvent('change', { value });
      this.setData({ open: false });
    },
  },
});

function createDateDraftPatch(
  instance: WorkflowPickerInstance,
  year: number,
  month: number,
  day: number,
): Readonly<Record<string, unknown>> {
  return {
    dateCells: createDateCells(year, month, day, instance.properties.min, instance.properties.max),
    days: createDayValues(year, month),
    draftDay: day,
    draftDisplayValue: formatTemporalDisplay('date', year, month, day),
    draftMonth: month,
    draftYear: year,
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

function currentUtcDateParts(): {
  readonly day: number;
  readonly month: number;
  readonly year: number;
} {
  const now = new Date();
  return { day: now.getUTCDate(), month: now.getUTCMonth() + 1, year: now.getUTCFullYear() };
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
