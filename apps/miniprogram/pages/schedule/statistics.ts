import type { GroupSummary, StatisticsMemberRow, StatisticsSummary } from '@schedule/contracts';

import {
  getMonthStatistics,
  getYearStatistics,
  listGroups,
  recalculateStatistics,
  refreshMonthStatistics,
} from '../../api/endpoints.js';
import { getStoredToken } from '../../api/client.js';
import { getSelectedGroupId, resolveSelectedGroup, setSelectedGroupId } from '../../store/group.js';
import { getCurrentBusinessMonth } from '../../utils/china-time.js';
import {
  formatNetDutyAdjustment,
  formatStatisticsMonthLabel,
  sortMembersByActualCount,
  summarizeRecalculateMismatches,
} from '../../utils/statistics-logic.js';
import { toUserMessage } from '../../utils/user-message.js';

interface SummaryCard {
  readonly label: string;
  readonly value: string;
}

interface StatisticsPageData {
  readonly businessMonth: string;
  readonly cards: readonly SummaryCard[];
  readonly checkMessage: string;
  readonly errorMessage: string;
  readonly groups: readonly GroupSummary[];
  readonly isLoading: boolean;
  readonly memberRows: readonly (StatisticsMemberRow & {
    readonly actualVsPlannedCount: number;
    readonly netLabel: string;
  })[];
  readonly monthLabel: string;
  readonly roleRows: readonly {
    readonly name: string;
    readonly planned: number;
    readonly actual: number;
  }[];
  readonly selectedGroupId: string;
  readonly shiftRows: readonly {
    readonly name: string;
    readonly planned: number;
    readonly actual: number;
  }[];
  readonly viewMode: 'month' | 'year';
  readonly year: number;
  readonly yearOptions: readonly number[];
}

Page({
  data: {
    businessMonth: '',
    cards: [],
    checkMessage: '',
    errorMessage: '',
    groups: [],
    isLoading: false,
    memberRows: [],
    monthLabel: '',
    roleRows: [],
    selectedGroupId: '',
    shiftRows: [],
    viewMode: 'month',
    year: 0,
    yearOptions: [],
  } as StatisticsPageData,

  onShow() {
    if (getStoredToken() === undefined) {
      wx.reLaunch({ url: '/pages/login/login' });
      return;
    }
    const now = getCurrentBusinessMonth();
    const year = Number((this.data.businessMonth || now).slice(0, 4));
    this.setData({
      businessMonth: this.data.businessMonth || now,
      monthLabel: formatStatisticsMonthLabel(this.data.businessMonth || now),
      year,
      yearOptions: [year - 1, year, year + 1],
    });
    void this.loadGroupsAndData();
  },

  async loadGroupsAndData(): Promise<void> {
    this.setData({ errorMessage: '', isLoading: true });
    try {
      const groups = await listGroups();
      const selected = resolveSelectedGroup(groups, getSelectedGroupId());
      if (selected === undefined) {
        this.setData({ errorMessage: '请先加入一个群组。', groups });
        return;
      }
      setSelectedGroupId(selected.id);
      this.setData({ groups, selectedGroupId: selected.id });
      await this.loadData(selected.id);
    } catch (error) {
      this.setData({ errorMessage: toUserMessage(error, '统计加载失败。') });
    } finally {
      this.setData({ isLoading: false });
    }
  },

  async loadData(groupId: string): Promise<void> {
    if (this.data.viewMode === 'month') {
      const snapshot = await getMonthStatistics(groupId, this.data.businessMonth);
      this.applySummary(snapshot.summary);
    } else {
      const result = await getYearStatistics(groupId, this.data.year);
      this.applySummary(result.summary);
    }
  },

  applySummary(summary: StatisticsSummary): void {
    const memberRows = sortMembersByActualCount(summary.members).map((member) => ({
      ...member,
      actualVsPlannedCount: member.actualVsPlanned.length,
      netLabel: formatNetDutyAdjustment(member.netDutyAdjustment),
    }));
    this.setData({
      cards: [
        { label: '计划班次', value: String(summary.plannedCount) },
        { label: '实际值班', value: String(summary.actualCount) },
        { label: '计值班次', value: String(summary.countedActualCount) },
        { label: '周末值班', value: String(summary.weekendCount) },
        { label: '节假日值班', value: String(summary.holidayCount) },
        { label: '换班', value: String(summary.swapCount) },
        { label: '加班 / 扣班', value: `${summary.overtimeCount} / ${summary.deductionCount}` },
        { label: '加扣班净值', value: formatNetDutyAdjustment(summary.netDutyAdjustment) },
        { label: '请假补位', value: String(summary.leaveCoverCount) },
        { label: '人工调整', value: String(summary.manualAdjustmentCount) },
      ],
      memberRows,
      roleRows: summary.byRole.map((role) => ({
        actual: role.actualCount,
        name: role.scheduleRoleName,
        planned: role.plannedCount,
      })),
      shiftRows: summary.byShiftType.map((shift) => ({
        actual: shift.actualCount,
        name: shift.shiftTypeName,
        planned: shift.plannedCount,
      })),
    });
  },

  onViewModeChange(event: WechatMiniprogram.CustomEvent) {
    const index = Number(event.detail.value ?? 0);
    this.setData({ viewMode: index === 1 ? 'year' : 'month' });
    void this.loadGroupsAndData();
  },

  onMonthChange(event: WechatMiniprogram.PickerChange) {
    const businessMonth = String(event.detail.value ?? '');
    this.setData({
      businessMonth,
      monthLabel: formatStatisticsMonthLabel(businessMonth),
    });
    if (this.data.selectedGroupId.length > 0) {
      void this.loadData(this.data.selectedGroupId);
    }
  },

  onYearChange(event: WechatMiniprogram.PickerChange) {
    const year = Number(event.detail.value ?? 0);
    this.setData({ year });
    if (this.data.selectedGroupId.length > 0) {
      void this.loadData(this.data.selectedGroupId);
    }
  },

  async refreshSnapshot(): Promise<void> {
    if (this.data.viewMode !== 'month' || this.data.selectedGroupId.length === 0) {
      return;
    }
    this.setData({ isLoading: true, errorMessage: '' });
    try {
      const snapshot = await refreshMonthStatistics(
        this.data.selectedGroupId,
        this.data.businessMonth,
      );
      this.applySummary(snapshot.summary);
    } catch (error) {
      this.setData({ errorMessage: toUserMessage(error, '刷新快照失败。') });
    } finally {
      this.setData({ isLoading: false });
    }
  },

  async runRecalculateCheck(): Promise<void> {
    if (this.data.viewMode !== 'month' || this.data.selectedGroupId.length === 0) {
      return;
    }
    this.setData({ isLoading: true, errorMessage: '', checkMessage: '' });
    try {
      const result = await recalculateStatistics(
        this.data.selectedGroupId,
        this.data.businessMonth,
      );
      this.setData({ checkMessage: summarizeRecalculateMismatches(result.mismatches) });
    } catch (error) {
      this.setData({ errorMessage: toUserMessage(error, '重算校验失败。') });
    } finally {
      this.setData({ isLoading: false });
    }
  },

  handleGroupChange(event: WechatMiniprogram.CustomEvent) {
    const groupId = event.detail.groupId;
    if (typeof groupId === 'string' && groupId.length > 0) {
      setSelectedGroupId(groupId);
      this.setData({ selectedGroupId: groupId });
      void this.loadGroupsAndData();
    }
  },
});
