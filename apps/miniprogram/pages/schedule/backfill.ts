import type {
  GroupSummary,
  PastScheduleAssignment,
  PastScheduleBackfillRecord,
  PastSchedulePeriod,
  SchedulingConfig,
} from '@schedule/contracts';

import {
  createPastScheduleAssignment,
  getSchedulingConfig,
  listGroups,
  listPastScheduleAssignments,
  listPastScheduleBackfillRecords,
  listPastSchedulePeriods,
} from '../../api/endpoints.js';
import { getStoredToken } from '../../api/client.js';
import { getSelectedGroupId, resolveSelectedGroup, setSelectedGroupId } from '../../store/group.js';
import { buildMonthGrid } from '../../utils/calendar-logic.js';
import { isWeekend } from '../../utils/calendar-views.js';
import { getChinaStandardTimeBusinessDate } from '../../utils/china-time.js';
import { toUserMessage } from '../../utils/user-message.js';

interface BackfillCellView {
  readonly businessDate: string;
  readonly dayNumber: string;
  readonly isFuture: boolean;
  readonly isPending: boolean;
  readonly isWeekend: boolean;
  readonly label: string;
}

interface BackfillWeekView {
  readonly cells: readonly (BackfillCellView | null)[];
}

interface BackfillPageData {
  readonly assignmentsByDate: Record<string, readonly PastScheduleAssignment[]>;
  readonly businessMonth: string;
  readonly errorMessage: string;
  readonly gridWeeks: readonly BackfillWeekView[];
  readonly groups: readonly GroupSummary[];
  readonly infoMessage: string;
  readonly loading: boolean;
  readonly memberIndex: number;
  readonly memberNames: readonly string[];
  readonly memberOptions: readonly { readonly id: string; readonly name: string }[];
  readonly monthLabel: string;
  readonly pendingDates: readonly string[];
  readonly periodIndex: number;
  readonly periodLabels: readonly string[];
  readonly periods: readonly PastSchedulePeriod[];
  readonly reason: string;
  readonly records: readonly PastScheduleBackfillRecord[];
  readonly scheduleRoleId: string;
  readonly selectedGroupId: string;
  readonly shiftIndex: number;
  readonly shiftOptions: readonly {
    readonly id: string;
    readonly name: string;
    readonly abbreviation: string;
    readonly color: string;
    readonly textColor: string;
  }[];
  readonly submitting: boolean;
  readonly today: string;
}

Page({
  data: {
    assignmentsByDate: {},
    businessMonth: '',
    errorMessage: '',
    gridWeeks: [],
    groups: [],
    infoMessage: '',
    loading: false,
    memberIndex: 0,
    memberNames: [],
    memberOptions: [],
    monthLabel: '',
    pendingDates: [],
    periodIndex: 0,
    periodLabels: [],
    periods: [],
    reason: '',
    records: [],
    scheduleRoleId: '',
    selectedGroupId: '',
    shiftIndex: 0,
    shiftOptions: [],
    submitting: false,
    today: '',
  } as BackfillPageData,

  onShow() {
    if (getStoredToken() === undefined) {
      wx.reLaunch({ url: '/pages/login/login' });
      return;
    }
    const today = getChinaStandardTimeBusinessDate(new Date());
    this.setData({ today });
    void this.loadAll();
  },

  async loadAll(): Promise<void> {
    this.setData({ errorMessage: '', loading: true });
    try {
      const groups = await listGroups();
      const selected = resolveSelectedGroup(groups, getSelectedGroupId());
      if (selected === undefined) {
        this.setData({ errorMessage: '请先加入一个群组。', groups });
        return;
      }
      setSelectedGroupId(selected.id);
      const [config, periods, records] = await Promise.all([
        getSchedulingConfig(selected.id),
        listPastSchedulePeriods(selected.id),
        listPastScheduleBackfillRecords(selected.id),
      ]);
      this.config = config;
      this.setData({
        groups,
        periodLabels: periods.map(
          (period) => `${period.businessMonth.slice(0, 7)} · ${period.scheduleRoleName}`,
        ),
        periods,
        records,
        selectedGroupId: selected.id,
      });
      const first = periods[0];
      if (first !== undefined) {
        this.setData({ businessMonth: first.businessMonth, periodIndex: 0 });
        await this.loadPeriodAssignments(first);
      } else {
        this.setData({ gridWeeks: [], pendingDates: [] });
      }
    } catch (error) {
      this.setData({ errorMessage: toUserMessage(error, '补录数据加载失败。') });
    } finally {
      this.setData({ loading: false });
    }
  },

  config: undefined as SchedulingConfig | undefined,

  async onPeriodChange(event: WechatMiniprogram.PickerChange): Promise<void> {
    const index = Number(event.detail.value ?? 0);
    const period = this.data.periods[index];
    if (period === undefined) {
      return;
    }
    this.setData({ periodIndex: index });
    await this.loadPeriodAssignments(period);
  },

  async loadPeriodAssignments(period: PastSchedulePeriod): Promise<void> {
    this.setData({ loading: true, errorMessage: '' });
    try {
      const [assignments, config] = await Promise.all([
        listPastScheduleAssignments(this.data.selectedGroupId, period.id),
        getSchedulingConfig(this.data.selectedGroupId),
      ]);
      this.config = config;
      const role = config.roles.find((item) => item.id === period.scheduleRoleId);
      const memberOptions =
        role?.members.map((member) => ({
          id: member.membershipId,
          name: member.realName,
        })) ??
        config.groupMembers.map((member) => ({
          id: member.membershipId,
          name: member.realName,
        }));
      const shiftOptions = config.shiftTypes
        .filter((shiftType) => shiftType.isEnabled)
        .map((shiftType) => ({
          abbreviation: shiftType.abbreviation,
          color: shiftType.color,
          id: shiftType.id,
          name: shiftType.name,
          textColor: shiftType.textColor,
        }));
      const byDate: Record<string, readonly PastScheduleAssignment[]> = {};
      for (const assignment of assignments) {
        const list = byDate[assignment.businessDate] ?? [];
        byDate[assignment.businessDate] = [...list, assignment];
      }
      this.setData({
        assignmentsByDate: byDate,
        businessMonth: period.businessMonth,
        memberOptions,
        memberNames: memberOptions.map((member) => member.name),
        monthLabel: `${period.businessMonth.slice(0, 4)}年${Number(period.businessMonth.slice(5, 7))}月`,
        pendingDates: [],
        scheduleRoleId: period.scheduleRoleId,
        shiftOptions,
      });
      this.buildGrid(period.businessMonth);
    } catch (error) {
      this.setData({ errorMessage: toUserMessage(error, '补录班次加载失败。') });
    } finally {
      this.setData({ loading: false });
    }
  },

  buildGrid(businessMonth: string): void {
    const year = Number(businessMonth.slice(0, 4));
    const month = Number(businessMonth.slice(5, 7));
    const weeks = buildMonthGrid(year, month);
    const today = this.data.today;
    const gridWeeks = weeks.map((week) => ({
      cells: week.map((cell) => {
        if (cell === null) {
          return null;
        }
        const assignments = this.data.assignmentsByDate[cell.businessDate] ?? [];
        const label =
          assignments.length > 0
            ? assignments
                .map(
                  (assignment) =>
                    assignment.actualMemberName ?? assignment.plannedMemberName ?? '待定',
                )
                .join('、')
            : '';
        return {
          businessDate: cell.businessDate,
          dayNumber: String(Number(cell.businessDate.slice(8, 10))),
          isFuture: cell.businessDate >= today,
          isPending: this.data.pendingDates.includes(cell.businessDate),
          isWeekend: isWeekend(cell.businessDate),
          label,
        };
      }),
    }));
    this.setData({ gridWeeks });
  },

  onMemberChange(event: WechatMiniprogram.PickerChange) {
    this.setData({ memberIndex: Number(event.detail.value ?? 0) });
  },

  onShiftChange(event: WechatMiniprogram.PickerChange) {
    this.setData({ shiftIndex: Number(event.detail.value ?? 0) });
  },

  onReasonInput(event: WechatMiniprogram.TextareaInput) {
    this.setData({ reason: event.detail.value });
  },

  toggleDate(event: WechatMiniprogram.TouchEvent) {
    const businessDate = event.currentTarget.dataset.date;
    if (typeof businessDate !== 'string' || businessDate.length === 0) {
      return;
    }
    const cell = this.findCell(businessDate);
    if (cell === undefined || cell.isFuture) {
      return;
    }
    const pending = this.data.pendingDates;
    this.setData({
      pendingDates: pending.includes(businessDate)
        ? pending.filter((date) => date !== businessDate)
        : [...pending, businessDate],
    });
    this.buildGrid(this.data.businessMonth);
  },

  findCell(businessDate: string): BackfillCellView | undefined {
    for (const week of this.data.gridWeeks) {
      const cell = week.cells
        .filter((item): item is BackfillCellView => item !== null)
        .find((item) => item.businessDate === businessDate);
      if (cell !== undefined) {
        return cell;
      }
    }
    return undefined;
  },

  clearPending() {
    this.setData({ pendingDates: [] });
    this.buildGrid(this.data.businessMonth);
  },

  handleGroupChange(event: WechatMiniprogram.CustomEvent) {
    const groupId = event.detail.groupId;
    if (typeof groupId === 'string' && groupId.length > 0) {
      setSelectedGroupId(groupId);
      this.setData({ selectedGroupId: groupId });
      void this.loadAll();
    }
  },

  async handleConfirmBackfill(): Promise<void> {
    const member = this.data.memberOptions[this.data.memberIndex];
    const shift = this.data.shiftOptions[this.data.shiftIndex];
    if (member === undefined || shift === undefined) {
      this.setData({ errorMessage: '请先选择补录成员和班种。' });
      return;
    }
    if (this.data.pendingDates.length === 0) {
      this.setData({ errorMessage: '请先点击既往日期加入待确认列表。' });
      return;
    }
    const confirmed = await confirmAction(
      '确认补录',
      `将为 ${this.data.pendingDates.length} 个日期补录 ${member.name}（${shift.name}）。`,
    );
    if (!confirmed) {
      return;
    }
    this.setData({ errorMessage: '', infoMessage: '', submitting: true });
    try {
      for (const businessDate of this.data.pendingDates) {
        await createPastScheduleAssignment(this.data.selectedGroupId, {
          actualMembershipId: member.id,
          businessDate,
          reason: this.data.reason.trim(),
          scheduleRoleId: this.data.scheduleRoleId,
          shiftTypeId: shift.id,
        });
      }
      this.setData({
        infoMessage: `已补录 ${this.data.pendingDates.length} 个日期。`,
        pendingDates: [],
        reason: '',
      });
      const period = this.data.periods[this.data.periodIndex];
      if (period !== undefined) {
        await this.loadPeriodAssignments(period);
      }
      this.setData({ records: await listPastScheduleBackfillRecords(this.data.selectedGroupId) });
    } catch (error) {
      this.setData({ errorMessage: toUserMessage(error, '补录失败。') });
    } finally {
      this.setData({ submitting: false });
    }
  },
});

function confirmAction(title: string, content: string): Promise<boolean> {
  return new Promise((resolve) => {
    wx.showModal({
      cancelText: '取消',
      confirmText: '确认',
      content,
      success: (result) => resolve(result.confirm),
      fail: () => resolve(false),
      title,
    });
  });
}
