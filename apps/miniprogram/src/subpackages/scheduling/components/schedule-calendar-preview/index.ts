import { previewCalendarModel, previewWeekPanels, type PreviewDuty } from './model.js';
import { addWeeks, getWeekStartDate } from '@schedule/presentation-core';
import type { ConfirmedHolidayDate } from '@schedule/contracts';
import type { CalendarPeriodSlot } from '../../../../components/calendar/calendar-period-pager.js';
import { isNurseCalendarGroup } from '../../../../features/workbench/nurse-duty-state.js';
interface Instance {
  _slot: CalendarPeriodSlot;
  _locateTarget?: string;
  properties: {
    assignments: readonly PreviewDuty[];
    startDate: string;
    compact: boolean;
    restrictToProposed: boolean;
    holidays: readonly ConfirmedHolidayDate[];
    viewMode: string;
    groupName: string;
    shiftTypes: readonly { id: string }[];
  };
  data: {
    month: string;
    selectedDate: string;
    weekStart: string;
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
  const weekStart =
    instance.data.weekStart || getWeekStartDate(instance.properties.startDate || `${month}-01`);
  const model =
    instance.properties.viewMode === 'week'
      ? previewWeekPanels(
          instance.properties.assignments,
          weekStart,
          selectedDate,
          instance._slot ?? 1,
          instance.properties.restrictToProposed,
          instance.properties.holidays,
          {
            nursePreset: isNurseCalendarGroup(instance.properties.groupName ?? ''),
            shiftTypeOrder: (instance.properties.shiftTypes ?? []).map((shift) => shift.id),
            compact: instance.properties.compact,
          },
        )
      : previewCalendarModel(
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
      weekStart,
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
    viewMode: { type: String, value: 'month' },
    groupName: { type: String, value: '' },
    shiftTypes: { type: Array, value: [] },
  },
  data: {
    month: '',
    selectedDate: '',
    weekStart: '',
    panels: [],
    panelHeights: [270, 270, 270],
    gridHeight: 270,
    monthLabel: '',
    periodSubtitle: '',
    details: [],
  },
  lifetimes: {
    attached(this: Instance) {
      this._slot = 1;
      if (this.properties.startDate) {
        this.setData({ weekStart: getWeekStartDate(this.properties.startDate) });
        sync(this, this.properties.startDate.slice(0, 7));
      }
    },
  },
  observers: {
    holidays(this: Instance) {
      const month = this.data.month || this.properties.startDate.slice(0, 7);
      if (month) sync(this, month, this.data.selectedDate);
    },
    startDate(this: Instance) {
      if (this.properties.startDate) {
        this.setData({ weekStart: getWeekStartDate(this.properties.startDate) });
        sync(this, this.properties.startDate.slice(0, 7));
      }
    },
    'assignments,restrictToProposed,viewMode,groupName,shiftTypes'(this: Instance) {
      const month = this.data.month || this.properties.startDate.slice(0, 7);
      if (month) sync(this, month, this.data.selectedDate);
    },
  },
  methods: {
    handleMonthChange(
      this: Instance,
      event: { detail: { delta: -1 | 1; current: CalendarPeriodSlot } },
    ) {
      this._slot = event.detail.current;
      const [year, month] = this.data.month.split('-').map(Number);
      const next =
        this._locateTarget ??
        (this.properties.viewMode === 'week'
          ? addWeeks(this.data.weekStart, event.detail.delta)
          : new Date(Date.UTC(year!, month! - 1 + event.detail.delta, 1))
              .toISOString()
              .slice(0, 7));
      delete this._locateTarget;
      if (this.properties.viewMode === 'week') this.setData({ weekStart: next });
      sync(this, next.slice(0, 7), '', () =>
        this.selectComponent('#preview-month')?.finishPeriodShift(),
      );
      this.triggerEvent('monthbrowse', { month: next.slice(0, 7) });
    },
    handleMonthSettled(this: Instance) {
      this.selectComponent('#preview-month')?.continueQueuedShift();
    },
    handleLocate(this: Instance) {
      const today = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const target =
        this.properties.viewMode === 'week' ? getWeekStartDate(today) : today.slice(0, 7);
      const current = this.properties.viewMode === 'week' ? this.data.weekStart : this.data.month;
      if (target === current) return;
      const delta: -1 | 1 = target < current ? -1 : 1;
      const targetModel =
        this.properties.viewMode === 'week'
          ? previewWeekPanels(
              this.properties.assignments,
              target,
              '',
              this._slot,
              this.properties.restrictToProposed,
              this.properties.holidays,
              {
                nursePreset: isNurseCalendarGroup(this.properties.groupName ?? ''),
                shiftTypeOrder: (this.properties.shiftTypes ?? []).map((shift) => shift.id),
                compact: this.properties.compact,
              },
            )
          : previewCalendarModel(
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
