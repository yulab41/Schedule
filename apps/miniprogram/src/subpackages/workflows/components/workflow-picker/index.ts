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

interface WorkflowPickerWheelItem {
  readonly label: string;
  readonly unit: string;
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

interface WheelScrollEvent {
  readonly detail: { readonly scrollTop: number };
}

interface WheelScrollWorkletEvent {
  readonly detail: { readonly scrollTop: number };
}

interface WheelTapEvent {
  readonly currentTarget: { readonly dataset: { readonly index?: number } };
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
  _commitWheelIndexOnJS?: (
    kind: 'month' | 'year',
    index: number,
    generation: number,
    sequence: number,
  ) => void;
  _dateLocateTimer?: unknown;
  _monthWheelAcceptedSequence?: number;
  _monthWheelActiveGeneration?: number;
  _monthWheelGeneration?: MiniProgramSharedValue<number>;
  _monthWheelPositionValue?: MiniProgramSharedValue<number>;
  _monthWheelReportedIndex?: MiniProgramSharedValue<number>;
  _monthWheelSequence?: MiniProgramSharedValue<number>;
  _wheelStylesBound?: boolean;
  _yearWheelAcceptedSequence?: number;
  _yearWheelActiveGeneration?: number;
  _yearWheelGeneration?: MiniProgramSharedValue<number>;
  _yearWheelPositionValue?: MiniProgramSharedValue<number>;
  _yearWheelReportedIndex?: MiniProgramSharedValue<number>;
  _yearWheelSequence?: MiniProgramSharedValue<number>;
  applyAnimatedStyle(
    selector: string,
    updater: () => Record<string, string>,
    userConfig?: { readonly flush?: 'async' | 'sync' },
  ): void;
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
    readonly monthWheelTop: number;
    readonly monthWheelItems: readonly WorkflowPickerWheelItem[];
    readonly monthWheelPosition: number;
    readonly popoverPlacement: 'down' | 'up';
    readonly popoverPlacementReady: boolean;
    readonly wheelMounted: boolean;
    readonly wheelProgrammaticAnimation: boolean;
    readonly yearWheelItems: readonly WorkflowPickerWheelItem[];
    readonly yearWheelPosition: number;
    readonly yearWheelTop: number;
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
const wheelItemHeight = 44;
const dateLocateMotionMs = 520;
const pickerInstances = new Set<WorkflowPickerInstance>();

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
    months: monthValues,
    monthWheelTop: 0,
    monthWheelItems: createWheelItems(monthValues, '月'),
    monthWheelPosition: 0,
    open: false,
    popoverPlacement: 'down' as const,
    popoverPlacementReady: true,
    renderedOptions: [] as readonly WorkflowPickerRenderedOption[],
    selectedOptionIndex: -1,
    weekdays,
    wheelMounted: false,
    wheelProgrammaticAnimation: false,
    yearWheelItems: createWheelItems(createYearValues(new Date().getUTCFullYear()), '年'),
    yearWheelPosition: 5,
    yearWheelTop: 0,
    years: createYearValues(new Date().getUTCFullYear()),
  },

  lifetimes: {
    attached(this: WorkflowPickerInstance): void {
      pickerInstances.add(this);
    },
    detached(this: WorkflowPickerInstance): void {
      clearPickerTimers(this);
      invalidateWheelRuntime(this);
      pickerInstances.delete(this);
    },
  },

  methods: {
    handleOpen(this: WorkflowPickerInstance): void {
      if (this.properties.disabled) return;
      for (const picker of pickerInstances) {
        if (picker !== this && picker.data.open) {
          clearPickerTimers(picker);
          invalidateWheelRuntime(picker);
          picker.setData({ open: false });
        }
      }
      clearPickerTimers(this);
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
      if (this.properties.mode === 'month') {
        prepareWheelRuntime(this, yearIndex, monthIndex);
      }
      this.setData(
        {
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
          monthWheelTop: monthIndex * wheelItemHeight,
          monthWheelItems: createWheelItems(monthValues, '月'),
          monthWheelPosition: monthIndex,
          open: true,
          popoverPlacement: 'down',
          wheelMounted: this.data.wheelMounted || this.properties.mode === 'month',
          wheelProgrammaticAnimation: false,
          yearWheelItems: createWheelItems(years, '年'),
          yearWheelTop: yearIndex * wheelItemHeight,
          yearWheelPosition: yearIndex,
          years,
        },
        () => {
          if (this.properties.mode !== 'month') return;
          bindWheelAnimatedStyles(this);
          this.setData({ wheelProgrammaticAnimation: true });
        },
      );
    },

    handleClose(this: WorkflowPickerInstance): void {
      clearPickerTimers(this);
      invalidateWheelRuntime(this);
      this.setData({ open: false });
    },

    closeFromParent(this: WorkflowPickerInstance): void {
      if (this.data.open) {
        clearPickerTimers(this);
        invalidateWheelRuntime(this);
        this.setData({ open: false });
      }
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
      });
    },

    handleYearWheelScrollUpdate(
      this: WorkflowPickerInstance,
      event: WheelScrollWorkletEvent,
    ): void {
      'worklet';
      const positionValue = this._yearWheelPositionValue;
      const reportedIndex = this._yearWheelReportedIndex;
      const generation = this._yearWheelGeneration;
      const sequence = this._yearWheelSequence;
      const commit = this._commitWheelIndexOnJS;
      if (
        positionValue === undefined ||
        reportedIndex === undefined ||
        generation === undefined ||
        sequence === undefined ||
        commit === undefined
      ) {
        return;
      }
      let position = event.detail.scrollTop / 44;
      if (!(position >= 0)) position = 0;
      if (position > 10) position = 10;
      positionValue.value = position;
      const index = Math.floor(position + 0.5);
      if (reportedIndex.value === index) return;
      reportedIndex.value = index;
      sequence.value += 1;
      commit('year', index, generation.value, sequence.value);
    },

    handleMonthWheelScrollUpdate(
      this: WorkflowPickerInstance,
      event: WheelScrollWorkletEvent,
    ): void {
      'worklet';
      const positionValue = this._monthWheelPositionValue;
      const reportedIndex = this._monthWheelReportedIndex;
      const generation = this._monthWheelGeneration;
      const sequence = this._monthWheelSequence;
      const commit = this._commitWheelIndexOnJS;
      if (
        positionValue === undefined ||
        reportedIndex === undefined ||
        generation === undefined ||
        sequence === undefined ||
        commit === undefined
      ) {
        return;
      }
      let position = event.detail.scrollTop / 44;
      if (!(position >= 0)) position = 0;
      if (position > 11) position = 11;
      positionValue.value = position;
      const index = Math.floor(position + 0.5);
      if (reportedIndex.value === index) return;
      reportedIndex.value = index;
      sequence.value += 1;
      commit('month', index, generation.value, sequence.value);
    },

    handleYearWheelScrollEnd(this: WorkflowPickerInstance, event: WheelScrollEvent): void {
      settleWheel(this, 'year', event.detail.scrollTop);
    },

    handleMonthWheelScrollEnd(this: WorkflowPickerInstance, event: WheelScrollEvent): void {
      settleWheel(this, 'month', event.detail.scrollTop);
    },

    handleYearWheelTap(this: WorkflowPickerInstance, event: WheelTapEvent): void {
      const yearIndex = validWheelTapIndex(event, this.data.years.length);
      if (yearIndex === undefined) return;
      selectWheelIndex(this, 'year', yearIndex);
    },

    handleMonthWheelTap(this: WorkflowPickerInstance, event: WheelTapEvent): void {
      const monthIndex = validWheelTapIndex(event, monthValues.length);
      if (monthIndex === undefined) return;
      selectWheelIndex(this, 'month', monthIndex);
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
        this.setData({ open: false });
        return;
      }

      if (this.properties.mode === 'month') {
        const yearIndex = nearestWheelPosition(
          this._yearWheelPositionValue?.value ?? this.data.draftIndices[0] ?? 0,
          this.data.years.length,
        );
        const monthIndex = nearestWheelPosition(
          this._monthWheelPositionValue?.value ?? this.data.draftIndices[1] ?? 0,
          monthValues.length,
        );
        const year = this.data.years[yearIndex] ?? this.data.draftYear;
        const month = monthIndex + 1;
        applyMonthWheelDraft(this, yearIndex, monthIndex);
        this.triggerEvent('change', { value: `${year}-${pad(month)}` });
        invalidateWheelRuntime(this);
        this.setData({ open: false });
        return;
      }

      const value = `${this.data.draftYear}-${pad(this.data.draftMonth)}-${pad(this.data.draftDay)}`;
      this.triggerEvent('change', { value });
      this.setData({ open: false });
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

function ensureWheelRuntime(instance: WorkflowPickerInstance): void {
  if (instance._yearWheelPositionValue !== undefined) return;
  instance._yearWheelPositionValue = wx.worklet.shared(0);
  instance._monthWheelPositionValue = wx.worklet.shared(0);
  instance._yearWheelReportedIndex = wx.worklet.shared(0);
  instance._monthWheelReportedIndex = wx.worklet.shared(0);
  instance._yearWheelGeneration = wx.worklet.shared(0);
  instance._monthWheelGeneration = wx.worklet.shared(0);
  instance._yearWheelSequence = wx.worklet.shared(0);
  instance._monthWheelSequence = wx.worklet.shared(0);
  instance._commitWheelIndexOnJS = wx.worklet.runOnJS(
    (kind: 'month' | 'year', index: number, generation: number, sequence: number) => {
      commitWheelIndex(instance, kind, index, generation, sequence);
    },
  );
}

function prepareWheelRuntime(
  instance: WorkflowPickerInstance,
  yearIndex: number,
  monthIndex: number,
): void {
  ensureWheelRuntime(instance);
  const yearGeneration = (instance._yearWheelGeneration?.value ?? 0) + 1;
  const monthGeneration = (instance._monthWheelGeneration?.value ?? 0) + 1;
  instance._yearWheelGeneration!.value = yearGeneration;
  instance._monthWheelGeneration!.value = monthGeneration;
  instance._yearWheelSequence!.value = 0;
  instance._monthWheelSequence!.value = 0;
  instance._yearWheelPositionValue!.value = yearIndex;
  instance._monthWheelPositionValue!.value = monthIndex;
  instance._yearWheelReportedIndex!.value = yearIndex;
  instance._monthWheelReportedIndex!.value = monthIndex;
  instance._yearWheelActiveGeneration = yearGeneration;
  instance._monthWheelActiveGeneration = monthGeneration;
  instance._yearWheelAcceptedSequence = 0;
  instance._monthWheelAcceptedSequence = 0;
}

function invalidateWheelRuntime(instance: WorkflowPickerInstance): void {
  if (instance._yearWheelGeneration !== undefined) {
    instance._yearWheelGeneration.value += 1;
    delete instance._yearWheelActiveGeneration;
    instance._yearWheelAcceptedSequence = 0;
  }
  if (instance._monthWheelGeneration !== undefined) {
    instance._monthWheelGeneration.value += 1;
    delete instance._monthWheelActiveGeneration;
    instance._monthWheelAcceptedSequence = 0;
  }
}

function bindWheelAnimatedStyles(instance: WorkflowPickerInstance): void {
  ensureWheelRuntime(instance);
  if (instance._wheelStylesBound === true) return;
  bindWheelColumnAnimatedStyles(instance, 'year', instance._yearWheelPositionValue!, 11);
  bindWheelColumnAnimatedStyles(instance, 'month', instance._monthWheelPositionValue!, 12);
  instance._wheelStylesBound = true;
}

function bindWheelColumnAnimatedStyles(
  instance: WorkflowPickerInstance,
  kind: 'month' | 'year',
  positionValue: MiniProgramSharedValue<number>,
  optionCount: number,
): void {
  for (let index = 0; index < optionCount; index += 1) {
    const itemIndex = index;
    instance.applyAnimatedStyle(
      `#workflow-picker-${kind}-item-${index}`,
      () => {
        'worklet';
        let distance = Math.abs(itemIndex - positionValue.value);
        if (!(distance >= 0)) distance = 1;
        let proximity = 1 - distance;
        if (proximity < 0) proximity = 0;
        if (proximity > 1) proximity = 1;
        const scale = 0.94 + 0.06 * proximity;
        const opacity = 0.58 + 0.42 * proximity;
        return { opacity: `${opacity}`, transform: `scale(${scale})` };
      },
      { flush: 'sync' },
    );
    instance.applyAnimatedStyle(
      `#workflow-picker-${kind}-number-${index}`,
      () => {
        'worklet';
        let distance = Math.abs(itemIndex - positionValue.value);
        if (!(distance >= 0)) distance = 1;
        let proximity = 1 - distance;
        if (proximity < 0) proximity = 0;
        if (proximity > 1) proximity = 1;
        const scale = (19 + 5 * proximity) / 24;
        return { transform: `scale(${scale})` };
      },
      { flush: 'sync' },
    );
  }
}

function commitWheelIndex(
  instance: WorkflowPickerInstance,
  kind: 'month' | 'year',
  index: number,
  generation: number,
  sequence: number,
): void {
  const activeGeneration =
    kind === 'year' ? instance._yearWheelActiveGeneration : instance._monthWheelActiveGeneration;
  const acceptedSequence =
    kind === 'year'
      ? (instance._yearWheelAcceptedSequence ?? 0)
      : (instance._monthWheelAcceptedSequence ?? 0);
  if (generation !== activeGeneration || sequence <= acceptedSequence) return;
  if (kind === 'year') instance._yearWheelAcceptedSequence = sequence;
  else instance._monthWheelAcceptedSequence = sequence;
  const boundedIndex = Math.min(
    (kind === 'year' ? instance.data.years.length : monthValues.length) - 1,
    Math.max(0, index),
  );
  if (boundedIndex === instance.data.draftIndices[kind === 'year' ? 0 : 1]) return;
  applyMonthWheelDraft(
    instance,
    kind === 'year' ? boundedIndex : (instance.data.draftIndices[0] ?? 0),
    kind === 'month' ? boundedIndex : (instance.data.draftIndices[1] ?? 0),
  );
}

function selectWheelIndex(
  instance: WorkflowPickerInstance,
  kind: 'month' | 'year',
  index: number,
): void {
  ensureWheelRuntime(instance);
  const positionValue =
    kind === 'year' ? instance._yearWheelPositionValue! : instance._monthWheelPositionValue!;
  const reportedIndex =
    kind === 'year' ? instance._yearWheelReportedIndex! : instance._monthWheelReportedIndex!;
  const sequenceValue =
    kind === 'year' ? instance._yearWheelSequence! : instance._monthWheelSequence!;
  const generationValue =
    kind === 'year' ? instance._yearWheelGeneration! : instance._monthWheelGeneration!;
  positionValue.value = index;
  reportedIndex.value = index;
  sequenceValue.value += 1;
  commitWheelIndex(instance, kind, index, generationValue.value, sequenceValue.value);
  instance.setData({
    [kind === 'year' ? 'yearWheelPosition' : 'monthWheelPosition']: index,
    [kind === 'year' ? 'yearWheelTop' : 'monthWheelTop']: index * wheelItemHeight,
  });
}

function settleWheel(
  instance: WorkflowPickerInstance,
  kind: 'month' | 'year',
  rawScrollTop: number,
): void {
  ensureWheelRuntime(instance);
  const optionCount = kind === 'year' ? instance.data.years.length : monthValues.length;
  const scrollTop = Number.isFinite(rawScrollTop) ? Math.max(0, rawScrollTop) : 0;
  const position = Math.min(optionCount - 1, scrollTop / wheelItemHeight);
  const index = nearestWheelPosition(position, optionCount);
  const positionValue =
    kind === 'year' ? instance._yearWheelPositionValue! : instance._monthWheelPositionValue!;
  const reportedIndex =
    kind === 'year' ? instance._yearWheelReportedIndex! : instance._monthWheelReportedIndex!;
  const sequenceValue =
    kind === 'year' ? instance._yearWheelSequence! : instance._monthWheelSequence!;
  const generationValue =
    kind === 'year' ? instance._yearWheelGeneration! : instance._monthWheelGeneration!;
  positionValue.value = position;
  reportedIndex.value = index;
  sequenceValue.value += 1;
  commitWheelIndex(instance, kind, index, generationValue.value, sequenceValue.value);
  instance.setData({
    [kind === 'year' ? 'yearWheelPosition' : 'monthWheelPosition']: position,
    [kind === 'year' ? 'yearWheelTop' : 'monthWheelTop']: scrollTop,
  });
}

function clearPickerTimers(instance: WorkflowPickerInstance): void {
  if (instance._dateLocateTimer !== undefined) clearTimeout(instance._dateLocateTimer);
  instance._dateLocateTimer = undefined;
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

function createWheelItems(
  values: readonly number[],
  unit: string,
): readonly WorkflowPickerWheelItem[] {
  return values.map((value) => ({ label: String(value), unit }));
}

function nearestWheelPosition(position: number, optionCount: number): number {
  if (!Number.isFinite(position) || optionCount <= 0) return 0;
  return Math.min(optionCount - 1, Math.max(0, Math.round(position)));
}

function validWheelTapIndex(event: WheelTapEvent, optionCount: number): number | undefined {
  const index = Number(event.currentTarget.dataset.index);
  return Number.isInteger(index) && index >= 0 && index < optionCount ? index : undefined;
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
