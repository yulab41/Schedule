interface WorkflowPickerOption {
  readonly isWeekend?: boolean;
  readonly label: string;
  readonly value: string;
}

interface PickerChangeEvent {
  readonly detail: { readonly value: readonly number[] };
}

interface OptionTapEvent {
  readonly currentTarget: { readonly dataset: { readonly index?: number } };
}

interface WorkflowPickerInstance {
  readonly data: {
    readonly days: readonly number[];
    readonly draftIndices: readonly number[];
    readonly open: boolean;
    readonly selectedOptionIndex: number;
    readonly years: readonly number[];
  };
  readonly properties: {
    readonly disabled: boolean;
    readonly mode: 'date' | 'month' | 'selector';
    readonly options: readonly WorkflowPickerOption[];
    readonly selectedIndex: number;
    readonly value: string;
  };
  setData(patch: Readonly<Record<string, unknown>>): void;
  triggerEvent(name: string, detail?: unknown): void;
}

const monthValues = Array.from({ length: 12 }, (_, index) => index + 1);

Component({
  properties: {
    disabled: { type: Boolean, value: false },
    displayValue: { type: String, value: '' },
    mode: { type: String, value: 'selector' },
    options: { type: Array, value: [] },
    placeholder: { type: String, value: '请选择' },
    selectedIndex: { type: Number, value: -1 },
    title: { type: String, value: '请选择' },
    value: { type: String, value: '' },
  },

  data: {
    days: Array.from({ length: 31 }, (_, index) => index + 1),
    draftIndices: [5, 0, 0],
    months: monthValues,
    open: false,
    selectedOptionIndex: -1,
    years: createYearValues(new Date().getUTCFullYear()),
  },

  methods: {
    handleOpen(this: WorkflowPickerInstance): void {
      if (this.properties.disabled) return;
      const temporal = parseTemporalValue(this.properties.value);
      const centerYear = temporal?.year ?? new Date().getUTCFullYear();
      const years = createYearValues(centerYear);
      const yearIndex = Math.max(0, years.indexOf(centerYear));
      const monthIndex = Math.max(0, (temporal?.month ?? 1) - 1);
      const day = temporal?.day ?? 1;
      const days = createDayValues(centerYear, monthIndex + 1);
      this.setData({
        days,
        draftIndices: [yearIndex, monthIndex, Math.min(day, days.length) - 1],
        open: true,
        selectedOptionIndex: this.properties.selectedIndex,
        years,
      });
    },

    handleClose(this: WorkflowPickerInstance): void {
      this.setData({ open: false });
    },

    handleOptionTap(this: WorkflowPickerInstance, event: OptionTapEvent): void {
      const index = Number(event.currentTarget.dataset.index);
      if (!Number.isInteger(index) || this.properties.options[index] === undefined) return;
      this.setData({ selectedOptionIndex: index });
    },

    handlePickerViewChange(this: WorkflowPickerInstance, event: PickerChangeEvent): void {
      const [yearIndex = 0, monthIndex = 0, dayIndex = 0] = event.detail.value;
      const year = this.data.years[yearIndex] ?? new Date().getUTCFullYear();
      const days = createDayValues(year, monthIndex + 1);
      this.setData({
        days,
        draftIndices: [yearIndex, monthIndex, Math.min(dayIndex, days.length - 1)],
      });
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

      const [yearIndex = 0, monthIndex = 0, dayIndex = 0] = this.data.draftIndices;
      const year = this.data.years[yearIndex] ?? new Date().getUTCFullYear();
      const month = monthIndex + 1;
      const day = Math.min(dayIndex + 1, createDayValues(year, month).length);
      const value =
        this.properties.mode === 'month'
          ? `${year}-${pad(month)}`
          : `${year}-${pad(month)}-${pad(day)}`;
      this.triggerEvent('change', { value });
      this.setData({ open: false });
    },
  },
});

function createYearValues(centerYear: number): readonly number[] {
  return Array.from({ length: 11 }, (_, index) => centerYear - 5 + index);
}

function createDayValues(year: number, month: number): readonly number[] {
  const count = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return Array.from({ length: count }, (_, index) => index + 1);
}

function parseTemporalValue(
  value: string,
): { readonly day?: number; readonly month: number; readonly year: number } | undefined {
  const match = /^(\d{4})-(\d{2})(?:-(\d{2}))?$/u.exec(value);
  if (match === null) return undefined;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = match[3] === undefined ? undefined : Number(match[3]);
  if (!Number.isInteger(year) || month < 1 || month > 12) return undefined;
  return { ...(day === undefined ? {} : { day }), month, year };
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}
