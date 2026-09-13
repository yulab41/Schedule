import type { ScheduleExportType } from '@schedule/contracts';
import { getExportPeriodLabel } from '@schedule/presentation-core/export';
import { getCurrentStatisticsMonth } from '@schedule/presentation-core/statistics';

export function createExportsPanelInitialData() {
  const businessMonth = getCurrentStatisticsMonth(new Date());
  return {
    businessMonth,
    downloadBusy: false,
    docxAvailable: false,
    errorMessage: '',
    infoMessage: '',
    feedbackTone: 'info' as const,
    shareBusy: false,
    exportType: 'schedule' as ScheduleExportType,
    format: 'xlsx' as 'csv' | 'xlsx' | 'docx',
    scheduleFormats: ['csv', 'xlsx'] as readonly ('csv' | 'xlsx' | 'docx')[],
    statisticsFormats: ['csv', 'xlsx'] as readonly ('csv' | 'xlsx' | 'docx')[],
    fileLabel: '',
    groupId: '',
    largeText: false,
    memberOptions: [{ value: '', label: '全部成员', checked: true }],
    membershipIds: [] as readonly string[],
    memberSummary: '全部成员',
    pageScrollStyle: 'height:calc(100% - 76px);',
    periodLabel: getExportPeriodLabel(businessMonth),
    periodType: 'month' as const,
    roleOptions: [{ value: '', label: '全部岗位', checked: true }],
    roleIds: [] as readonly string[],
    roleSummary: '全部岗位',
    optionsLoading: true,
    shellHeaderStyle: 'height:76px;min-height:76px;padding-top:24px;',
    state: 'idle' as const,
    statusLabel: '正在加载导出选项',
    viewportClass: '',
    year: Number(businessMonth.slice(0, 4)),
    canCheckJob: false,
    canRetryCreate: true,
  };
}
