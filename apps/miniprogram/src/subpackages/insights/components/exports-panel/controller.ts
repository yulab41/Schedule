import {
  ClientCoreError,
  type OrganizationReadClient,
  type P9InsightsActionsClient,
} from '@schedule/client-core';
import type { ScheduleExportType } from '@schedule/contracts';
import { addBusinessMonths } from '@schedule/presentation-core';
import {
  buildExportFileName,
  getExportPeriodLabel,
  getExportSelectionSummary,
  pollExportJob,
} from '@schedule/presentation-core/export';
import { getCurrentStatisticsMonth } from '@schedule/presentation-core/statistics';
import {
  ClientCapabilityDisabledError,
  requireClientCapability,
} from '../../../../app/client-capability-store.js';
import {
  createRuntimeOrganizationReadClient,
  createRuntimeP9InsightsActionsClient,
} from '../../../../platform/client-core-calendar.js';
import {
  getStoredWechatToken,
  getWechatRequestAuthentication,
} from '../../../../platform/wechat-identity.js';
import { downloadScheduleExport } from '../../../../platform/secure-download.js';
import { recordMiniTelemetryBoundary } from '../../../../platform/telemetry.js';

type ExportPeriodType = 'month' | 'year';
type ExportState =
  'disabled' | 'error' | 'failed' | 'idle' | 'loading' | 'ready' | 'timed_out' | 'waiting';

interface SelectOption {
  readonly id: string;
  readonly label: string;
}

interface ExportsPageData {
  readonly businessMonth: string;
  readonly downloadBusy: boolean;
  readonly errorMessage: string;
  readonly exportType: ScheduleExportType;
  readonly fileLabel: string;
  readonly groupId: string;
  readonly largeText: boolean;
  readonly memberIndex: number;
  readonly memberOptions: readonly SelectOption[];
  readonly membershipId: string;
  readonly pageScrollStyle: string;
  readonly periodLabel: string;
  readonly periodType: ExportPeriodType;
  readonly roleId: string;
  readonly roleIndex: number;
  readonly roleOptions: readonly SelectOption[];
  readonly selectionSummary: string;
  readonly shellHeaderStyle: string;
  readonly state: ExportState;
  readonly statusLabel: string;
  readonly viewportClass: string;
  readonly year: number;
}

interface ExportsPageInstance {
  readonly data: ExportsPageData;
  readonly properties: { readonly groupId: string };
  _actionsClient: P9InsightsActionsClient;
  _jobId: string | undefined;
  _loadedGroupId: string;
  _organizationReadClient: OrganizationReadClient;
  _pollCancelled: boolean;
  setData(patch: Partial<ExportsPageData>, callback?: () => void): void;
}

const authentication = getWechatRequestAuthentication();
const actionsClient = createRuntimeP9InsightsActionsClient(getStoredWechatToken, authentication);
const organizationReadClient = createRuntimeOrganizationReadClient(
  getStoredWechatToken,
  authentication,
);
const initialBusinessMonth = getCurrentStatisticsMonth(new Date());
const initialYear = Number(initialBusinessMonth.slice(0, 4));

export function createExportsPanelControllerDefinition() {
  return {
    data: {
      businessMonth: initialBusinessMonth,
      downloadBusy: false,
      errorMessage: '',
      exportType: 'schedule' as ScheduleExportType,
      fileLabel: '',
      groupId: '',
      largeText: false,
      memberIndex: 0,
      memberOptions: [{ id: '', label: '全部成员' }],
      membershipId: '',
      pageScrollStyle: 'height:calc(100% - 76px);',
      periodLabel: getExportPeriodLabel(initialBusinessMonth),
      periodType: 'month' as ExportPeriodType,
      roleId: '',
      roleIndex: 0,
      roleOptions: [{ id: '', label: '全部岗位' }],
      selectionSummary: getExportSelectionSummary('schedule', initialBusinessMonth),
      shellHeaderStyle: 'height:76px;min-height:76px;padding-top:24px;',
      state: 'loading' as ExportState,
      statusLabel: '正在加载导出选项',
      viewportClass: '',
      year: initialYear,
    } satisfies ExportsPageData,
    properties: { groupId: { type: String, value: '' } },
    _actionsClient: actionsClient,
    _jobId: undefined as string | undefined,
    _loadedGroupId: '',
    _organizationReadClient: organizationReadClient,
    _pollCancelled: false,
    observers: {
      groupId(this: ExportsPageInstance): void {
        start(this);
      },
    },
    lifetimes: {
      attached(this: ExportsPageInstance): void {
        recordMiniTelemetryBoundary('exports:component-attached');
        const windowInfo = wx.getWindowInfo();
        const statusBarHeight = Math.max(0, windowInfo.statusBarHeight ?? 0);
        const headerHeight = statusBarHeight + 52;
        this.setData({
          pageScrollStyle: `height:calc(100% - ${headerHeight}px);`,
          shellHeaderStyle: `height:${headerHeight}px;min-height:${headerHeight}px;padding-top:${statusBarHeight}px;`,
          largeText:
            ((windowInfo as unknown as { readonly fontSizeSetting?: number }).fontSizeSetting ??
              16) >= 20,
          viewportClass: windowInfo.windowWidth <= 340 ? 'is-compact' : '',
        });
        start(this);
      },
      detached(this: ExportsPageInstance): void {
        this._pollCancelled = true;
      },
    },
    methods: {
      handleBack(): void {
        wx.navigateBack({ delta: 1 });
      },
      handleContinue(this: ExportsPageInstance): void {
        if (this._jobId === undefined || isWorking(this.data.state)) return;
        this._pollCancelled = false;
        void checkExistingJob(this, this._jobId);
      },
      handleCreate(this: ExportsPageInstance): void {
        void createExport(this);
      },
      handleDownload(this: ExportsPageInstance): void {
        void downloadExport(this);
      },
      handleMemberChange(this: ExportsPageInstance, event: PickerEvent): void {
        const index = parsePickerIndex(event, this.data.memberOptions.length);
        const option = this.data.memberOptions[index] ?? this.data.memberOptions[0]!;
        this.setData({ memberIndex: index, membershipId: option.id });
      },
      handleNextPeriod(this: ExportsPageInstance): void {
        shiftPeriod(this, 1);
      },
      handlePeriodType(this: ExportsPageInstance, event: TapEvent): void {
        const periodType = event.currentTarget.dataset.periodType;
        if (periodType !== 'month' && periodType !== 'year') return;
        setSelection(this, { periodType });
      },
      handlePreviousPeriod(this: ExportsPageInstance): void {
        shiftPeriod(this, -1);
      },
      handleRetry(this: ExportsPageInstance): void {
        this._pollCancelled = true;
        this._jobId = undefined;
        this._loadedGroupId = '';
        start(this);
      },
      handleReset(this: ExportsPageInstance): void {
        this._pollCancelled = true;
        this._jobId = undefined;
        this.setData({
          downloadBusy: false,
          errorMessage: '',
          fileLabel: '',
          state: 'idle',
          statusLabel: '选择内容后创建任务',
        });
      },
      handleRoleChange(this: ExportsPageInstance, event: PickerEvent): void {
        const index = parsePickerIndex(event, this.data.roleOptions.length);
        const option = this.data.roleOptions[index] ?? this.data.roleOptions[0]!;
        this.setData({ roleId: option.id, roleIndex: index });
      },
      handleTypeChange(this: ExportsPageInstance, event: PickerEvent): void {
        setSelection(this, {
          exportType: parsePickerIndex(event, 2) === 1 ? 'statistics' : 'schedule',
        });
      },
    },
  };
}

interface PickerEvent {
  readonly detail: { readonly value?: unknown };
}

interface TapEvent {
  readonly currentTarget: {
    readonly dataset: Readonly<Record<string, string | undefined>>;
  };
}

function start(page: ExportsPageInstance): void {
  initializeRuntimeState(page);
  const groupId = page.properties.groupId;
  if (groupId.length === 0) {
    page._loadedGroupId = '';
    page._jobId = undefined;
    page._pollCancelled = true;
    page.setData({
      errorMessage: '当前群组信息缺失，请返回工作台后重试。',
      groupId: '',
      state: 'error',
      statusLabel: '当前群组信息缺失，请返回工作台后重试。',
    });
    return;
  }
  if (groupId === page._loadedGroupId) return;
  page._pollCancelled = true;
  page._jobId = undefined;
  page._loadedGroupId = groupId;
  page.setData({
    downloadBusy: false,
    errorMessage: '',
    fileLabel: '',
    groupId,
    memberIndex: 0,
    memberOptions: [{ id: '', label: '全部成员' }],
    membershipId: '',
    roleId: '',
    roleIndex: 0,
    roleOptions: [{ id: '', label: '全部岗位' }],
    state: 'loading',
    statusLabel: '正在加载导出选项',
  });
  void loadOptions(page, groupId);
}

function initializeRuntimeState(page: ExportsPageInstance): void {
  page._actionsClient = actionsClient;
  page._organizationReadClient = organizationReadClient;
  if (typeof page._loadedGroupId !== 'string') page._loadedGroupId = '';
  if (typeof page._pollCancelled !== 'boolean') page._pollCancelled = false;
}

async function loadOptions(page: ExportsPageInstance, groupId: string): Promise<void> {
  try {
    await requireClientCapability('insights');
    const [config, members] = await Promise.all([
      page._organizationReadClient.getSchedulingConfig(groupId),
      page._organizationReadClient.listGroupMembers(groupId),
    ]);
    if (page.properties.groupId !== groupId) return;
    page.setData({
      memberOptions: [
        { id: '', label: '全部成员' },
        ...members
          .filter((member) => member.isPendingRoster !== true)
          .map((member) => ({ id: member.id, label: member.realName })),
      ],
      roleOptions: [
        { id: '', label: '全部岗位' },
        ...config.roles.map((role) => ({ id: role.id, label: role.name })),
      ],
      state: 'idle',
      statusLabel: '选择内容后创建任务',
    });
  } catch (error) {
    if (page.properties.groupId !== groupId) return;
    page.setData({
      errorMessage:
        error instanceof ClientCapabilityDisabledError
          ? error.message
          : toUserMessage(error, '导出选项暂时无法加载，请稍后重试。'),
      state: error instanceof ClientCapabilityDisabledError ? 'disabled' : 'error',
      statusLabel:
        error instanceof ClientCapabilityDisabledError ? '导出暂未开放' : '导出选项加载失败',
    });
  }
}

async function createExport(page: ExportsPageInstance): Promise<void> {
  initializeRuntimeState(page);
  if (isWorking(page.data.state) || page.data.state === 'disabled') return;
  if (page.data.groupId.length === 0) {
    page.setData({
      errorMessage: '当前群组信息缺失，请返回工作台后重试。',
      state: 'error',
      statusLabel: '当前群组信息缺失，请返回工作台后重试。',
    });
    return;
  }
  page._pollCancelled = false;
  page._jobId = undefined;
  page.setData({
    downloadBusy: false,
    errorMessage: '',
    fileLabel: '',
    state: 'waiting',
    statusLabel: '正在创建导出任务',
  });
  try {
    await requireClientCapability('insights');
    const job = await page._actionsClient.createExportJob(page.data.groupId, {
      exportType: page.data.exportType,
      ...(page.data.membershipId === '' ? {} : { membershipId: page.data.membershipId }),
      period: currentPeriod(page.data),
      ...(page.data.roleId === '' ? {} : { roleId: page.data.roleId }),
    });
    page._jobId = job.id;
    await checkExistingJob(page, job.id);
  } catch (error) {
    if (page._pollCancelled) return;
    page.setData({
      errorMessage:
        error instanceof ClientCapabilityDisabledError
          ? error.message
          : toUserMessage(error, '导出任务暂时无法创建，请稍后重试。'),
      state: error instanceof ClientCapabilityDisabledError ? 'disabled' : 'failed',
      statusLabel: '导出未完成',
    });
  }
}

async function checkExistingJob(page: ExportsPageInstance, jobId: string): Promise<void> {
  page.setData({ errorMessage: '', state: 'waiting', statusLabel: '正在生成 CSV' });
  try {
    const result = await pollExportJob(
      jobId,
      (candidateJobId) => page._actionsClient.getExportJob(page.data.groupId, candidateJobId),
      { isCancelled: () => page._pollCancelled },
    );
    if (result.status === 'cancelled') return;
    if (result.status === 'timed_out') {
      page.setData({
        state: 'timed_out',
        statusLabel: '任务仍在服务器生成，可继续检查同一任务',
      });
      return;
    }
    if (result.job.status !== 'completed') {
      throw new Error(result.job.error ?? '导出失败，请稍后重试。');
    }
    page.setData({
      fileLabel: buildExportFileName(result.job.exportType, result.job.period),
      state: 'ready',
      statusLabel: '导出完成，可下载 CSV',
    });
  } catch (error) {
    if (page._pollCancelled) return;
    if (error instanceof ClientCapabilityDisabledError) {
      setExportDisabled(page, error);
      return;
    }
    page.setData({
      errorMessage: toUserMessage(error, '导出暂时无法完成，请稍后重试。'),
      state: 'failed',
      statusLabel: '导出未完成',
    });
  }
}

async function downloadExport(page: ExportsPageInstance): Promise<void> {
  if (page._jobId === undefined || page.data.state !== 'ready' || page.data.downloadBusy) return;
  const jobId = page._jobId;
  const groupId = page.data.groupId;
  page.setData({ downloadBusy: true, errorMessage: '', statusLabel: '正在下载 CSV' });
  try {
    const tempFilePath = await downloadScheduleExport(
      getStoredWechatToken,
      authentication,
      groupId,
      jobId,
    );
    if (!isDownloadActive(page, groupId, jobId)) return;
    (
      wx as unknown as {
        openDocument: (options: {
          filePath: string;
          showMenu: boolean;
          fail: () => void;
          success: () => void;
        }) => unknown;
      }
    ).openDocument({
      filePath: tempFilePath,
      showMenu: false,
      fail: () => {
        if (!isDownloadActive(page, groupId, jobId)) return;
        page.setData({
          downloadBusy: false,
          errorMessage: '文件已下载，但当前设备无法打开该文件。',
          statusLabel: '文件打开失败，可重新下载',
        });
      },
      success: () => {
        if (!isDownloadActive(page, groupId, jobId)) return;
        page.setData({ downloadBusy: false, statusLabel: '导出完成，可下载 CSV' });
      },
    });
  } catch (error) {
    if (!isDownloadActive(page, groupId, jobId)) return;
    if (error instanceof ClientCapabilityDisabledError) {
      setExportDisabled(page, error);
      return;
    }
    page.setData({
      downloadBusy: false,
      errorMessage: toUserMessage(error, '文件下载失败，请稍后重试。'),
      statusLabel: '文件下载失败，可重新下载',
    });
  }
}

function shiftPeriod(page: ExportsPageInstance, delta: -1 | 1): void {
  if (isWorking(page.data.state)) return;
  setSelection(
    page,
    page.data.periodType === 'month'
      ? { businessMonth: addBusinessMonths(page.data.businessMonth, delta) }
      : { year: page.data.year + delta },
  );
}

function setSelection(page: ExportsPageInstance, patch: Partial<ExportsPageData>): void {
  const next = { ...page.data, ...patch };
  page.setData({
    ...patch,
    periodLabel: getExportPeriodLabel(currentPeriod(next)),
    selectionSummary: getExportSelectionSummary(next.exportType, currentPeriod(next)),
  });
}

function currentPeriod(
  data: Pick<ExportsPageData, 'businessMonth' | 'periodType' | 'year'>,
): string {
  return data.periodType === 'month' ? data.businessMonth : String(data.year);
}

function parsePickerIndex(event: PickerEvent, length: number): number {
  const value = Number(event.detail.value);
  return Number.isInteger(value) && value >= 0 && value < length ? value : 0;
}

function isWorking(state: ExportState): boolean {
  return state === 'loading' || state === 'waiting';
}

function isDownloadActive(page: ExportsPageInstance, groupId: string, jobId: string): boolean {
  return !page._pollCancelled && page.data.groupId === groupId && page._jobId === jobId;
}

function setExportDisabled(page: ExportsPageInstance, error: ClientCapabilityDisabledError): void {
  page._pollCancelled = true;
  page._jobId = undefined;
  page.setData({
    downloadBusy: false,
    errorMessage: error.message,
    fileLabel: '',
    state: 'disabled',
    statusLabel: '导出暂未开放',
  });
}

function toUserMessage(error: unknown, fallback: string): string {
  if (error instanceof ClientCoreError && error.message.length > 0) return error.message;
  return error instanceof Error && error.message.length > 0 ? error.message : fallback;
}
