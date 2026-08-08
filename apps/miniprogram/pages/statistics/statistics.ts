import type {
  GroupSummary,
  MonthStatisticsSnapshot,
  StatisticsSummary,
  YearStatistics,
} from '@schedule/contracts';

import {
  getMonthStatistics,
  getYearStatistics,
  listGroups,
  recalculateStatistics,
  refreshMonthStatistics,
} from '../../api/endpoints.js';
import { resolveSelectedGroup, setSelectedGroupId } from '../../store/group.js';
import { formatMonthLabel, shiftBusinessMonth } from '../../utils/calendar.js';

interface SummaryRow {
  readonly label: string;
  readonly value: string;
}

interface MemberStatRow {
  readonly actualCount: number;
  readonly deductionCount: number;
  readonly deltaCount: number;
  readonly holidayCount: number;
  readonly leaveCoverCount: number;
  readonly manualAdjustmentCount: number;
  readonly netDutyAdjustment: number;
  readonly overtimeCount: number;
  readonly plannedCount: number;
  readonly realName: string;
  readonly swapCount: number;
  readonly weekendCount: number;
}

interface StatisticsPageData {
  readonly activeTab: 'month' | 'year';
  readonly businessMonth: string;
  readonly errorMessage: string;
  readonly groupId: string;
  readonly groups: readonly GroupSummary[];
  readonly infoMessage: string;
  readonly loading: boolean;
  readonly memberRows: readonly MemberStatRow[];
  readonly monthLabel: string;
  readonly monthStats: MonthStatisticsSnapshot | undefined;
  readonly submitting: boolean;
  readonly summaryRows: readonly SummaryRow[];
  readonly year: number;
  readonly yearNames: readonly number[];
  readonly yearIndex: number;
  readonly yearStats: YearStatistics | undefined;
}

Page({
  data: {
    activeTab: 'month',
    businessMonth: currentBusinessMonth(),
    errorMessage: '',
    groupId: '',
    groups: [],
    infoMessage: '',
    loading: false,
    memberRows: [],
    monthLabel: formatMonthLabel(currentBusinessMonth()),
    monthStats: undefined,
    submitting: false,
    summaryRows: [],
    year: Number(currentBusinessMonth().slice(0, 4)),
    yearNames: [],
    yearIndex: 2,
    yearStats: undefined,
  } as StatisticsPageData,

  onLoad(options: Record<string, string | undefined>) {
    const groupId = options.groupId;
    if (typeof groupId === 'string' && groupId.length > 0) {
      this.setData({ groupId });
    }
    const yearNames = Array.from({ length: 5 }, (_, index) => {
      const currentYear = Number(currentBusinessMonth().slice(0, 4));
      return currentYear - 2 + index;
    });
    this.setData({
      year: Number(currentBusinessMonth().slice(0, 4)),
      yearIndex: 2,
      yearNames,
    });
  },

  onShow() {
    void this.loadAll();
  },

  async loadAll(): Promise<void> {
    this.setData({ errorMessage: '', infoMessage: '', loading: true });
    try {
      const groups = await listGroups();
      const selected = resolveSelectedGroup(groups, this.data.groupId);
      if (selected === undefined) {
        this.setData({ groups, memberRows: [], summaryRows: [] });
        return;
      }
      setSelectedGroupId(selected.id);
      this.setData({ groupId: selected.id, groups });
      if (this.data.activeTab === 'month') {
        await this.loadMonth();
      } else {
        await this.loadYear();
      }
    } catch (error) {
      this.setData({ errorMessage: toErrorMessage(error) });
    } finally {
      this.setData({ loading: false });
    }
  },

  switchTab(event: WechatMiniprogram.TouchEvent) {
    const tab = event.currentTarget.dataset.tab;
    if (tab !== 'month' && tab !== 'year') {
      return;
    }
    this.setData({ activeTab: tab, errorMessage: '', infoMessage: '' });
    void this.loadAll();
  },

  async loadMonth(): Promise<void> {
    if (this.data.groupId.length === 0) {
      return;
    }
    const monthStats = await getMonthStatistics(this.data.groupId, this.data.businessMonth);
    this.setData({
      memberRows: monthStats.summary.members.map(buildMemberStatRow),
      monthLabel: formatMonthLabel(monthStats.businessMonth),
      monthStats,
      summaryRows: buildSummaryRows(monthStats.summary),
    });
  },

  async loadYear(): Promise<void> {
    if (this.data.groupId.length === 0) {
      return;
    }
    const yearStats = await getYearStatistics(this.data.groupId, this.data.year);
    this.setData({
      memberRows: yearStats.summary.members.map(buildMemberStatRow),
      summaryRows: buildSummaryRows(yearStats.summary),
      yearStats,
    });
  },

  changeMonth(event: WechatMiniprogram.TouchEvent) {
    const delta = Number(event.currentTarget.dataset.delta ?? 0);
    if (!Number.isInteger(delta)) {
      return;
    }
    const businessMonth = shiftBusinessMonth(this.data.businessMonth, delta);
    this.setData({ businessMonth, monthLabel: formatMonthLabel(businessMonth) });
    void this.loadAll();
  },

  handleYearChange(event: WechatMiniprogram.PickerChange) {
    const yearIndex = Number(event.detail.value ?? 0);
    const year = this.data.yearNames[yearIndex];
    if (year !== undefined) {
      this.setData({ year, yearIndex });
      void this.loadAll();
    }
  },

  async handleRefreshMonth(): Promise<void> {
    if (this.data.groupId.length === 0) {
      return;
    }
    this.setData({ errorMessage: '', infoMessage: '', submitting: true });
    try {
      const result = await refreshMonthStatistics(this.data.groupId, this.data.businessMonth);
      this.setData({
        infoMessage: `已刷新 ${formatMonthLabel(result.businessMonth)} 统计快照。`,
      });
      await this.loadAll();
    } catch (error) {
      this.setData({ errorMessage: toErrorMessage(error) });
    } finally {
      this.setData({ submitting: false });
    }
  },

  async handleRecalculate(): Promise<void> {
    if (this.data.groupId.length === 0) {
      return;
    }
    this.setData({ errorMessage: '', infoMessage: '', submitting: true });
    try {
      const result = await recalculateStatistics(this.data.groupId, this.data.businessMonth);
      this.setData({
        infoMessage: result.matched
          ? '统计快照与重新计算结果一致。'
          : `发现 ${result.mismatches.length} 处不一致，请刷新快照后查看。`,
      });
    } catch (error) {
      this.setData({ errorMessage: toErrorMessage(error) });
    } finally {
      this.setData({ submitting: false });
    }
  },
});

function buildSummaryRows(summary: StatisticsSummary): SummaryRow[] {
  return [
    { label: '计划班次', value: String(summary.plannedCount) },
    { label: '实际班次', value: String(summary.actualCount) },
    { label: '周末', value: String(summary.weekendCount) },
    { label: '节假日', value: String(summary.holidayCount) },
    { label: '加扣班净额', value: String(summary.netDutyAdjustment) },
    { label: '请假覆盖', value: String(summary.leaveCoverCount) },
    { label: '手动调整', value: String(summary.manualAdjustmentCount) },
    { label: '换班', value: String(summary.swapCount) },
    { label: '加班', value: String(summary.overtimeCount) },
    { label: '扣班', value: String(summary.deductionCount) },
  ];
}

function buildMemberStatRow(member: StatisticsSummary['members'][number]): MemberStatRow {
  return {
    actualCount: member.actualCount,
    deductionCount: member.deductionCount,
    deltaCount: member.deltaCount,
    holidayCount: member.holidayCount,
    leaveCoverCount: member.leaveCoverCount,
    manualAdjustmentCount: member.manualAdjustmentCount,
    netDutyAdjustment: member.netDutyAdjustment,
    overtimeCount: member.overtimeCount,
    plannedCount: member.plannedCount,
    realName: member.realName,
    swapCount: member.swapCount,
    weekendCount: member.weekendCount,
  };
}

function currentBusinessMonth(): string {
  const date = new Date();
  return `${String(date.getFullYear()).padStart(4, '0')}-${String(date.getMonth() + 1).padStart(
    2,
    '0',
  )}`;
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error && error.message.length > 0
    ? error.message
    : '操作失败，请稍后重试。';
}
