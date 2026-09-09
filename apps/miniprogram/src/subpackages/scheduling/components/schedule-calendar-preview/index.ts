import { previewCalendarModel, type PreviewDuty } from './model.js';
import type { CalendarPeriodSlot } from '../../../../components/calendar/calendar-period-pager.js';
interface Instance {
  _slot: CalendarPeriodSlot;
  _locateTarget?: string;
  properties: { assignments: readonly PreviewDuty[]; startDate: string };
  data: { month: string; selectedDate: string };
  setData(patch: Record<string, unknown>, callback?: () => void): void;
  selectComponent(selector: string):
    | {
        finishPeriodShift(): void;
        continueQueuedShift(): void;
        startProgrammaticShift(delta: -1 | 1): void;
      }
    | undefined;
}
function sync(instance: Instance, month: string, selectedDate = '', callback?: () => void) {
  instance.setData(
    {
      month,
      selectedDate,
      ...previewCalendarModel(
        instance.properties.assignments,
        month,
        selectedDate,
        instance._slot ?? 1,
      ),
    },
    callback,
  );
}
Component({
  properties: { assignments: { type: Array, value: [] }, startDate: { type: String, value: '' } },
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
    'assignments,startDate'(this: Instance) {
      if (this.properties.startDate) sync(this, this.properties.startDate.slice(0, 7));
    },
  },
  methods: {
    handleMonthChange(
      this: Instance,
      event: { detail: { delta: -1 | 1; current: CalendarPeriodSlot } },
    ) {
      const [year, month] = this.data.month.split('-').map(Number);
      this._slot = event.detail.current;
      const next = new Date(Date.UTC(year!, month! - 1 + event.detail.delta, 1))
        .toISOString()
        .slice(0, 7);
      sync(this, next, '', () => this.selectComponent('#preview-month')?.finishPeriodShift());
    },
    handleMonthSettled(this: Instance) {
      if (this._locateTarget && this._locateTarget !== this.data.month) {
        this.selectComponent('#preview-month')?.startProgrammaticShift(
          this._locateTarget < this.data.month ? -1 : 1,
        );
      } else {
        delete this._locateTarget;
        this.selectComponent('#preview-month')?.continueQueuedShift();
      }
    },
    handleLocate(this: Instance) {
      const target = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 7);
      this._locateTarget = target;
      if (target !== this.data.month)
        this.selectComponent('#preview-month')?.startProgrammaticShift(
          target < this.data.month ? -1 : 1,
        );
    },
    handleSelect(this: Instance, event: { detail: { businessDate: string } }) {
      sync(this, this.data.month, event.detail.businessDate);
    },
  },
});
