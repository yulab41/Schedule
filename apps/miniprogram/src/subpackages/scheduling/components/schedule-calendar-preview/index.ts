import { previewCalendarModel, type PreviewDuty } from './model.js';
import type { ConfirmedHolidayDate } from '@schedule/contracts';
import type { CalendarPeriodSlot } from '../../../../components/calendar/calendar-period-pager.js';
interface Instance {
  _slot: CalendarPeriodSlot;
  _locateTarget?: string;
  properties: {
    assignments: readonly PreviewDuty[];
    startDate: string;
    compact: boolean;
    restrictToProposed: boolean;
    holidays: readonly ConfirmedHolidayDate[];
  };
  data: {
    month: string;
    selectedDate: string;
    panels: readonly Record<string, unknown>[];
    panelHeights: readonly number[];
  };
  setData(patch: Record<string, unknown>, callback?: () => void): void;
  triggerEvent(name: string, detail: unknown): void;
  selectComponent(selector: string):
    | {
        finishPeriodShift(): void;
        continueQueuedShift(): void;
        startProgrammaticShift(delta: -1 | 1): void;
      }
    | undefined;
}
function sync(instance: Instance, month: string, selectedDate = '', callback?: () => void) {
  const model = previewCalendarModel(
    instance.properties.assignments,
    month,
    selectedDate,
    instance._slot ?? 1,
    instance.properties.restrictToProposed,
    instance.properties.holidays,
  );
  instance.setData(
    {
      month,
      selectedDate,
      ...model,
    },
    callback,
  );
  instance.triggerEvent('heightchange', {
    height: model.gridHeight + 94 + (selectedDate ? 52 + model.details.length * 20 : 0),
  });
}
Component({
  properties: {
    assignments: { type: Array, value: [] },
    startDate: { type: String, value: '' },
    compact: { type: Boolean, value: false },
    restrictToProposed: { type: Boolean, value: false },
    holidays: { type: Array, value: [] },
    shadow: { type: Boolean, value: true },
  },
  data: {
    month: '',
    selectedDate: '',
    panels: [],
    panelHeights: [270, 270, 270],
    gridHeight: 270,
    monthLabel: '',
    details: [],
  },
  lifetimes: {
    attached(this: Instance) {
      this._slot = 1;
      if (this.properties.startDate) sync(this, this.properties.startDate.slice(0, 7));
    },
  },
  observers: {
    holidays(this: Instance) {
      const month = this.data.month || this.properties.startDate.slice(0, 7);
      if (month) sync(this, month, this.data.selectedDate);
    },
    startDate(this: Instance) {
      if (this.properties.startDate) sync(this, this.properties.startDate.slice(0, 7));
    },
    'assignments,restrictToProposed'(this: Instance) {
      const month = this.data.month || this.properties.startDate.slice(0, 7);
      if (month) sync(this, month, this.data.selectedDate);
    },
  },
  methods: {
    handleMonthChange(
      this: Instance,
      event: { detail: { delta: -1 | 1; current: CalendarPeriodSlot } },
    ) {
      const [year, month] = this.data.month.split('-').map(Number);
      this._slot = event.detail.current;
      const next =
        this._locateTarget ??
        new Date(Date.UTC(year!, month! - 1 + event.detail.delta, 1)).toISOString().slice(0, 7);
      delete this._locateTarget;
      sync(this, next, '', () => this.selectComponent('#preview-month')?.finishPeriodShift());
      this.triggerEvent('monthbrowse', { month: next });
    },
    handleMonthSettled(this: Instance) {
      this.selectComponent('#preview-month')?.continueQueuedShift();
    },
    handleLocate(this: Instance) {
      const target = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 7);
      if (target === this.data.month) return;
      const delta: -1 | 1 = target < this.data.month ? -1 : 1;
      const targetModel = previewCalendarModel(
        this.properties.assignments,
        target,
        '',
        this._slot,
        this.properties.restrictToProposed,
        this.properties.holidays,
      );
      const targetSlot = ((this._slot + delta + 3) % 3) as CalendarPeriodSlot;
      const panel = targetModel.panels[this._slot];
      if (!panel) return;
      this._locateTarget = target;
      const panels = [...this.data.panels];
      const panelHeights = [...this.data.panelHeights];
      panels[targetSlot] = { ...panel, relative: delta, slot: targetSlot };
      panelHeights[targetSlot] = targetModel.gridHeight;
      this.setData({ panels, panelHeights }, () =>
        this.selectComponent('#preview-month')?.startProgrammaticShift(delta),
      );
    },
    handleSelect(this: Instance, event: { detail: { businessDate: string } }) {
      sync(this, this.data.month, event.detail.businessDate);
    },
  },
});
