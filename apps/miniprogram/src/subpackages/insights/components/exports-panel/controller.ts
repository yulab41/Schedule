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
  createExportCancellation,
  waitForExportOperation,
  type ExportCancellation,
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
import {
  downloadScheduleExport,
  releaseTemporaryExport,
  shareScheduleExport,
} from '../../../../platform/secure-download.js';
import {
  clearInfoMessageTimer,
  scheduleInfoMessageExpiry,
} from '../../../../platform/info-message-lifetime.js';
import { recordMiniTelemetryBoundary } from '../../../../platform/telemetry.js';
import { recordRuntimeDiagnosticPerformance } from '../../../../platform/runtime-diagnostics-bridge.js';

type ExportPeriodType = 'month' | 'year';
type ExportState =
  | 'disabled'
  | 'error'
  | 'failed'
  | 'idle'
  | 'loading'
  | 'ready'
  | 'download_failed'
  | 'downloaded'
  | 'shared'
  | 'timed_out'
  | 'paused'
  | 'waiting';

interface SelectOption {
  readonly id: string;
  readonly label: string;
}

interface ExportsPageData {
  readonly businessMonth: string;
  readonly downloadBusy: boolean;
  readonly errorMessage: string;
  readonly infoMessage: string;
  readonly feedbackTone: 'info' | 'success' | 'error';
  readonly shareBusy: boolean;
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
  readonly canCheckJob: boolean;
  readonly canRetryCreate: boolean;
}

interface ExportsPageInstance {
  readonly data: ExportsPageData;
  readonly properties: { readonly groupId: string };
  _actionsClient: P9InsightsActionsClient;
  _jobId: string | undefined;
  _loadedGroupId: string;
  _organizationReadClient: OrganizationReadClient;
  _pollCancelled: boolean;
  _attached: boolean;
  _epoch: number;
  _tempFilePath: string | undefined;
  _wait: ExportCancellation | undefined;
  _visible: boolean;
  _resumePolling: boolean;
  _creating: boolean;
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
      canCheckJob: false,
      canRetryCreate: true,
    } satisfies ExportsPageData,
    properties: { groupId: { type: String, value: '' } },
    _actionsClient: actionsClient,
    _jobId: undefined as string | undefined,
    _loadedGroupId: '',
    _organizationReadClient: organizationReadClient,
    _pollCancelled: false,
    observers: {
      groupId(this: ExportsPageInstance): void {
        if (this._attached) start(this);
      },
    },
    lifetimes: {
      attached(this: ExportsPageInstance): void {
        this._attached = true;
        this._visible = true;
        this._resumePolling = false;
        this._creating = false;
        initializeRuntimeState(this);
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
        this._attached = false;
        invalidateExport(this);
        this._loadedGroupId = '';
      },
    },
    pageLifetimes: {
      hide(this: ExportsPageInstance): void {
        this._visible = false;
        if (this.data.state === 'waiting') {
          this._resumePolling = true;
          pauseExport(this);
        }
      },
      show(this: ExportsPageInstance): void {
        this._visible = true;
        if (this._resumePolling && this._jobId) {
          this._resumePolling = false;
          void checkExistingJob(this, this._jobId);
        }
      },
    },
    methods: {
      handleBack(): void {
        wx.navigateBack({ delta: 1 });
      },
      handleContinue(this: ExportsPageInstance): void {
        if (
          this._jobId === undefined ||
          isWorking(this.data.state) ||
          this.data.downloadBusy ||
          this.data.shareBusy
        )
          return;
        this._pollCancelled = false;
        void checkExistingJob(this, this._jobId);
      },
      handleStopWaiting(this: ExportsPageInstance): void {
        this._resumePolling = false;
        pauseExport(this);
      },
      handleCancel(this: ExportsPageInstance): void {
        if (this.data.state === 'waiting') {
          this._resumePolling = false;
          pauseExport(this);
        } else wx.navigateBack({ delta: 1 });
      },
      handleCreate(this: ExportsPageInstance): void {
        void createExport(this);
      },
      handleDownload(this: ExportsPageInstance): void {
        void downloadExport(this);
      },
      handleShare(this: ExportsPageInstance): void {
        void shareExport(this);
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
        invalidateExport(this);
        this._loadedGroupId = '';
        start(this);
      },
      handleReset(this: ExportsPageInstance): void {
        invalidateExport(this);
        this.setData({
          downloadBusy: false,
          shareBusy: false,
          infoMessage: '',
          errorMessage: '',
          fileLabel: '',
          canCheckJob: false,
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
    invalidateExport(page);
    page._loadedGroupId = '';
    page._jobId = undefined;
    page._pollCancelled = true;
    page.setData({
      errorMessage: '当前群组信息缺失，请返回工作台后重试。',
      groupId: '',
      fileLabel: '',
      downloadBusy: false,
      shareBusy: false,
      infoMessage: '',
      state: 'error',
      statusLabel: '当前群组信息缺失，请返回工作台后重试。',
    });
    return;
  }
  if (groupId === page._loadedGroupId) return;
  invalidateExport(page);
  page._loadedGroupId = groupId;
  page.setData({
    downloadBusy: false,
    shareBusy: false,
    infoMessage: '',
    errorMessage: '',
    fileLabel: '',
    canCheckJob: false,
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
  if (typeof page._epoch !== 'number') page._epoch = 0;
}

async function loadOptions(page: ExportsPageInstance, groupId: string): Promise<void> {
  const epoch = page._epoch;
  try {
    await requireClientCapability('insights');
    if (!isCurrent(page, groupId, epoch)) return;
    const [config, members] = await Promise.all([
      page._organizationReadClient.getSchedulingConfig(groupId),
      page._organizationReadClient.listGroupMembers(groupId),
    ]);
    if (!isCurrent(page, groupId, epoch)) return;
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
    if (!isCurrent(page, groupId, epoch)) return;
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
  if (
    (page.data.state === 'timed_out' || page.data.state === 'paused') &&
    !page._jobId &&
    !page.data.canRetryCreate
  )
    return;
  if (
    !page._attached ||
    isWorking(page.data.state) ||
    page.data.state === 'disabled' ||
    page.data.downloadBusy ||
    page.data.shareBusy
  )
    return;
  if (page._jobId !== undefined) {
    page._pollCancelled = false;
    await checkExistingJob(page, page._jobId);
    return;
  }
  if (page.data.groupId.length === 0) {
    page.setData({
      errorMessage: '当前群组信息缺失，请返回工作台后重试。',
      state: 'error',
      statusLabel: '当前群组信息缺失，请返回工作台后重试。',
    });
    return;
  }
  invalidateExport(page);
  page._pollCancelled = false;
  const epoch = page._epoch;
  const groupId = page.data.groupId;
  const selection = page.data;
  let creationRequested = false;
  const wait = createExportCancellation();
  page._wait = wait;
  page._creating = true;
  const startedAt = Date.now();
  recordExportProgress('create-start', startedAt);
  page.setData({
    downloadBusy: false,
    errorMessage: '',
    infoMessage: '',
    fileLabel: '',
    state: 'waiting',
    statusLabel: '正在创建导出任务',
    canRetryCreate: false,
  });
  try {
    const result = await waitForExportOperation(
      async (isStopped) => {
        await requireClientCapability('insights');
        if (isStopped() || !isCurrent(page, groupId, epoch)) return undefined;
        recordExportProgress('create-request', startedAt);
        creationRequested = true;
        const job = await page._actionsClient.createExportJob(groupId, {
          exportType: selection.exportType,
          ...(selection.membershipId === '' ? {} : { membershipId: selection.membershipId }),
          period: currentPeriod(selection),
          ...(selection.roleId === '' ? {} : { roleId: selection.roleId }),
        });
        // A late create may recover its ID, but never start another task or overwrite a new epoch.
        if (isCurrent(page, groupId, epoch)) {
          page._jobId = job.id;
          page.setData({ canCheckJob: true });
          if (isStopped() && page._visible && page._resumePolling) {
            page._resumePolling = false;
            void checkExistingJob(page, job.id);
          }
        }
        return job;
      },
      30_000,
      wait,
    );
    if (!isCurrent(page, groupId, epoch) || page._wait !== wait) return;
    page._creating = false;
    recordExportProgress(`create-${result.status}`, startedAt);
    if (result.status === 'cancelled') {
      if (!creationRequested) {
        page._resumePolling = false;
        page.setData({
          state: 'idle',
          canRetryCreate: true,
          statusLabel: '已停止等待，可重新生成',
        });
      }
      return;
    }
    if (result.status === 'timed_out') {
      page.setData({
        state: 'timed_out',
        canRetryCreate: !creationRequested,
        statusLabel: creationRequested
          ? '暂未获取创建结果，请勿重复提交'
          : '创建前检查超时，可重试生成',
      });
      return;
    }
    if (result.value) await checkExistingJob(page, result.value.id);
  } catch (error) {
    if (!isCurrent(page, groupId, epoch)) return;
    const explicitlyRejected =
      error instanceof ClientCapabilityDisabledError ||
      (error instanceof ClientCoreError &&
        error.status !== undefined &&
        error.status >= 400 &&
        error.status < 500 &&
        error.status !== 408);
    if (creationRequested && !explicitlyRejected) {
      page.setData({
        state: 'timed_out',
        canRetryCreate: false,
        statusLabel: '创建结果未知，请勿重复提交',
      });
      recordExportProgress('create-unknown', startedAt);
      return;
    }
    page.setData({
      errorMessage:
        error instanceof ClientCapabilityDisabledError
          ? error.message
          : toUserMessage(error, '导出任务暂时无法创建，请稍后重试。'),
      state: error instanceof ClientCapabilityDisabledError ? 'disabled' : 'failed',
      statusLabel: '导出未完成',
    });
    showFeedback(page, page.data.errorMessage, 'error');
  } finally {
    if (isCurrent(page, groupId, epoch)) page._creating = false;
  }
}

async function checkExistingJob(page: ExportsPageInstance, jobId: string): Promise<void> {
  const epoch = page._epoch;
  const groupId = page.data.groupId;
  page._wait?.cancel();
  const wait = createExportCancellation();
  page._wait = wait;
  page._pollCancelled = false;
  const startedAt = Date.now();
  clearInfoMessageTimer(page);
  page.setData({
    errorMessage: '',
    infoMessage: '',
    state: 'waiting',
    statusLabel: '正在生成 CSV',
  });
  try {
    const result = await pollExportJob(
      jobId,
      (candidateJobId) => page._actionsClient.getExportJob(groupId, candidateJobId),
      {
        cancellation: wait,
        isCancelled: () => page._pollCancelled || !isCurrent(page, groupId, epoch),
        onProgress: ({ phase, count, status }) =>
          recordExportProgress(
            `poll-${phase}-${count}-${['pending', 'running', 'completed', 'failed'].includes(status ?? '') ? status : 'unknown'}`,
            startedAt,
          ),
      },
    );
    if (!isCurrent(page, groupId, epoch) || page._wait !== wait) return;
    recordExportProgress(`poll-${result.status}`, startedAt);
    if (result.status === 'cancelled') return;
    if (result.status === 'timed_out') {
      page.setData({
        state: 'timed_out',
        statusLabel: '暂未获取完成结果，可检查同一任务',
      });
      return;
    }
    if (result.job.status !== 'completed') {
      throw new Error(result.job.error ?? '导出失败，请稍后重试。');
    }
    page.setData({
      fileLabel: buildExportFileName(result.job.exportType, result.job.period),
      state: 'ready',
      statusLabel: '文件已生成，可下载 CSV',
    });
  } catch (error) {
    if (!isCurrent(page, groupId, epoch) || page._wait !== wait) return;
    recordExportProgress('poll-failed', startedAt);
    if (error instanceof ClientCapabilityDisabledError) {
      setExportDisabled(page, error);
      return;
    }
    page.setData({
      errorMessage: toUserMessage(error, '导出暂时无法完成，请稍后重试。'),
      state: 'failed',
      statusLabel: '导出未完成',
    });
    showFeedback(page, page.data.errorMessage, 'error');
  }
}

async function downloadExport(page: ExportsPageInstance): Promise<void> {
  if (
    page._jobId === undefined ||
    !['ready', 'download_failed', 'downloaded', 'shared'].includes(page.data.state) ||
    page.data.downloadBusy ||
    page.data.shareBusy ||
    !page._attached
  )
    return;
  const jobId = page._jobId;
  const groupId = page.data.groupId;
  const epoch = page._epoch;
  releaseTemporaryExport(page._tempFilePath);
  page._tempFilePath = undefined;
  clearInfoMessageTimer(page);
  page.setData({
    state: 'ready',
    downloadBusy: true,
    infoMessage: '',
    errorMessage: '',
    statusLabel: '正在下载 CSV',
  });
  try {
    const tempFilePath = await downloadScheduleExport(
      getStoredWechatToken,
      authentication,
      groupId,
      jobId,
      () => isDownloadActive(page, groupId, jobId, epoch),
    );
    if (!isDownloadActive(page, groupId, jobId, epoch)) {
      releaseTemporaryExport(tempFilePath);
      return;
    }
    page._tempFilePath = tempFilePath;
    page.setData({
      downloadBusy: false,
      state: 'downloaded',
      statusLabel: '文件已下载，可发送文件',
    });
  } catch (error) {
    if (!isDownloadActive(page, groupId, jobId, epoch)) return;
    if (error instanceof ClientCapabilityDisabledError) {
      setExportDisabled(page, error);
      return;
    }
    page.setData({
      downloadBusy: false,
      state: 'download_failed',
      statusLabel: '文件下载失败，可重新下载',
    });
    showFeedback(page, toUserMessage(error, '文件下载失败，请稍后重试。'), 'error');
  }
}

async function shareExport(page: ExportsPageInstance): Promise<void> {
  if (
    !page._attached ||
    !page._tempFilePath ||
    !page._jobId ||
    page.data.shareBusy ||
    page.data.downloadBusy ||
    !['downloaded', 'shared'].includes(page.data.state)
  )
    return;
  const { _epoch: epoch, _jobId: jobId, _tempFilePath: filePath } = page;
  const groupId = page.data.groupId;
  clearInfoMessageTimer(page);
  page.setData({ shareBusy: true, infoMessage: '' });
  try {
    const result = await shareScheduleExport(filePath, page.data.fileLabel);
    if (!isDownloadActive(page, groupId, jobId, epoch)) return;
    page.setData({
      shareBusy: false,
      ...(result === 'shared' ? { state: 'shared' as const, statusLabel: '文件已发送' } : {}),
    });
    showFeedback(
      page,
      result === 'shared' ? '文件已发送。' : '已取消发送。',
      result === 'shared' ? 'success' : 'info',
    );
  } catch (error) {
    if (!isDownloadActive(page, groupId, jobId, epoch)) return;
    page.setData({ shareBusy: false });
    showFeedback(page, toUserMessage(error, '文件发送未完成，请重试。'), 'error');
  }
}

function invalidateExport(page: ExportsPageInstance): void {
  page._wait?.cancel();
  page._wait = undefined;
  page._resumePolling = false;
  page._creating = false;
  page._epoch = (page._epoch ?? 0) + 1;
  page._pollCancelled = true;
  page._jobId = undefined;
  releaseTemporaryExport(page._tempFilePath);
  page._tempFilePath = undefined;
  clearInfoMessageTimer(page);
}

function pauseExport(page: ExportsPageInstance): void {
  if (page.data.state !== 'waiting') return;
  page._wait?.cancel();
  page._pollCancelled = true;
  page.setData({ state: 'paused', statusLabel: '已停止等待，服务器任务不受影响' });
  recordExportProgress('paused', Date.now());
}

function recordExportProgress(metric: string, startedAt: number): void {
  recordRuntimeDiagnosticPerformance({
    metric,
    page: 'exports',
    recordedAt: Date.now(),
    durationMs: Math.max(0, Date.now() - startedAt),
  });
}

function isCurrent(page: ExportsPageInstance, groupId: string, epoch: number): boolean {
  return page._attached && page._epoch === epoch && page.properties.groupId === groupId;
}

function showFeedback(
  page: ExportsPageInstance,
  message: string,
  tone: ExportsPageData['feedbackTone'],
): void {
  const epoch = page._epoch;
  page.setData({ infoMessage: message, feedbackTone: tone });
  scheduleInfoMessageExpiry(page, message, () => page._attached && page._epoch === epoch);
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

function isDownloadActive(
  page: ExportsPageInstance,
  groupId: string,
  jobId: string,
  epoch: number,
): boolean {
  return (
    isCurrent(page, groupId, epoch) &&
    !page._pollCancelled &&
    page.data.groupId === groupId &&
    page._jobId === jobId
  );
}

function setExportDisabled(page: ExportsPageInstance, error: ClientCapabilityDisabledError): void {
  invalidateExport(page);
  page.setData({
    downloadBusy: false,
    shareBusy: false,
    infoMessage: '',
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
