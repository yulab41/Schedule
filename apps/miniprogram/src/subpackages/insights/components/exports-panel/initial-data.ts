import type { ScheduleExportType } from '@schedule/contracts';
import {
  getExportPeriodLabel,
  getExportSelectionSummary,
} from '@schedule/presentation-core/export';
import { getCurrentStatisticsMonth } from '@schedule/presentation-core/statistics';

export function createExportsPanelInitialData() {
  const businessMonth = getCurrentStatisticsMonth(new Date());
  return {
    businessMonth,
    downloadBusy: false,
    errorMessage: '',
    infoMessage: '',
    feedbackTone: 'info' as const,
    shareBusy: false,
    exportType: 'schedule' as ScheduleExportType,
    fileLabel: '',
    groupId: '',
    largeText: false,
    memberIndex: 0,
    memberOptions: [{ id: '', label: '全部成员' }],
    membershipId: '',
    pageScrollStyle: 'height:calc(100% - 76px);',
    periodLabel: getExportPeriodLabel(businessMonth),
    periodType: 'month' as const,
    roleId: '',
    roleIndex: 0,
    roleOptions: [{ id: '', label: '全部岗位' }],
    selectionSummary: getExportSelectionSummary('schedule', businessMonth),
    shellHeaderStyle: 'height:76px;min-height:76px;padding-top:24px;',
    state: 'loading' as const,
    statusLabel: '正在加载导出选项',
    viewportClass: '',
    year: Number(businessMonth.slice(0, 4)),
    canCheckJob: false,
    canRetryCreate: true,
  };
}
