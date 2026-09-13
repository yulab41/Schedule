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
  pollExportJob,
  createExportCancellation,
  waitForExportOperation,
  type ExportCancellation,
} from '@schedule/presentation-core/export';
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
import { createExportsPanelInitialData } from './initial-data.js';

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
  readonly value: string;
  readonly label: string;
  readonly checked: boolean;
}

interface ExportsPageData {
  readonly businessMonth: string;
  readonly downloadBusy: boolean;
  readonly docxAvailable: boolean;
  readonly errorMessage: string;
  readonly infoMessage: string;
  readonly feedbackTone: 'info' | 'success' | 'error';
  readonly shareBusy: boolean;
  readonly exportType: ScheduleExportType;
  readonly format: 'csv' | 'xlsx' | 'docx';
  readonly scheduleFormats: readonly ('csv' | 'xlsx' | 'docx')[];
  readonly statisticsFormats: readonly ('csv' | 'xlsx' | 'docx')[];
  readonly fileLabel: string;
  readonly groupId: string;
  readonly largeText: boolean;
  readonly memberOptions: readonly SelectOption[];
  readonly membershipIds: readonly string[];
  readonly memberSummary: string;
  readonly optionsLoading: boolean;
  readonly pageScrollStyle: string;
  readonly periodLabel: string;
  readonly periodType: ExportPeriodType;
  readonly roleIds: readonly string[];
  readonly roleOptions: readonly SelectOption[];
  readonly roleSummary: string;
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
  _directPage?: boolean;
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
export function createExportsPanelControllerDefinition() {
  return {
    data: createExportsPanelInitialData() satisfies ExportsPageData,
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
      handleMemberChange(this: ExportsPageInstance, event: SelectorChangeEvent): void {
        toggleMultiSelection(this, 'member', event.detail.option.value);
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
      handleRoleChange(this: ExportsPageInstance, event: SelectorChangeEvent): void {
        toggleMultiSelection(this, 'role', event.detail.option.value);
      },
      handleFormatChange(this: ExportsPageInstance, event: TapEvent): void {
        const format = event.currentTarget.dataset['format'];
        if (format !== 'csv' && format !== 'xlsx' && format !== 'docx') return;
        const allowed =
          this.data.exportType === 'schedule'
            ? this.data.scheduleFormats
            : this.data.statisticsFormats;
        if (allowed.includes(format))
          this.setData({
            format,
            ...(format === 'docx'
              ? {
                  membershipIds: [],
                  roleIds: [],
                  memberSummary: '全部成员',
                  roleSummary: '全部岗位',
                }
              : {}),
          });
      },
      handleTypeChange(this: ExportsPageInstance, event: PickerEvent): void {
        const exportType = parsePickerIndex(event, 2) === 1 ? 'statistics' : 'schedule';
        const formats =
          exportType === 'statistics' ? this.data.statisticsFormats : this.data.scheduleFormats;
        setSelection(this, {
          exportType,
          format: formats.includes(this.data.format)
            ? this.data.format
            : exportType === 'schedule' && formats.includes('docx')
              ? 'docx'
              : formats.includes('xlsx')
                ? 'xlsx'
                : (formats[0] ?? 'csv'),
        });
      },
    },
  };
}

interface PickerEvent {
  readonly detail: { readonly value?: unknown };
}
interface SelectorChangeEvent {
  readonly detail: { readonly option: SelectOption };
}

interface TapEvent {
  readonly currentTarget: {
    readonly dataset: Readonly<Record<string, string | undefined>>;
  };
}

function start(page: ExportsPageInstance): void {
  initializeRuntimeState(page);
  const groupId = getGroupId(page);
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
    docxAvailable: false,
    format: 'xlsx',
    groupId,
    memberOptions: [{ value: '', label: '全部成员', checked: true }],
    membershipIds: [],
    memberSummary: '全部成员',
    roleIds: [],
    roleOptions: [{ value: '', label: '全部岗位', checked: true }],
    roleSummary: '全部岗位',
    scheduleFormats: ['csv', 'xlsx'],
    statisticsFormats: ['csv', 'xlsx'],
    optionsLoading: true,
    state: 'idle',
    statusLabel: '选择内容后创建任务',
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
  const wait = createExportCancellation();
  page._wait = wait;
  try {
    const result = await waitForExportOperation(
      async (isStopped) => {
        await requireClientCapability('insights');
        if (isStopped() || !isCurrent(page, groupId, epoch)) return undefined;
        return Promise.all([
          page._organizationReadClient.getSchedulingConfig(groupId),
          page._organizationReadClient.listGroupMembers(groupId),
          page._actionsClient.getExportOptions(groupId),
        ]);
      },
      10_000,
      wait,
    );
    if (!isCurrent(page, groupId, epoch) || result.status === 'cancelled') return;
    if (result.status === 'timed_out' || result.value === undefined) {
      page.setData({
        optionsLoading: false,
        errorMessage: '岗位和成员读取超时，可重新加载。',
        statusLabel: '导出选项暂不可用',
      });
      showFeedback(page, '岗位和成员读取超时，可重新加载。', 'error');
      return;
    }
    const [config, members, exportOptions] = result.value;
    const scheduleFormat = exportOptions.scheduleFormats.includes('docx')
      ? 'docx'
      : exportOptions.scheduleFormats.includes('xlsx')
        ? 'xlsx'
        : 'csv';
    page.setData({
      format: scheduleFormat,
      docxAvailable: exportOptions.scheduleFormats.includes('docx'),
      scheduleFormats: exportOptions.scheduleFormats,
      statisticsFormats: exportOptions.statisticsFormats,
      memberOptions: [
        { value: '', label: '全部成员', checked: true },
        ...members
          .filter((member) => member.isPendingRoster !== true)
          .map((member) => ({ value: member.id, label: member.realName, checked: false })),
      ],
      roleOptions: [
        { value: '', label: '全部岗位', checked: true },
        ...config.roles.map((role) => ({ value: role.id, label: role.name, checked: false })),
      ],
      optionsLoading: false,
      state: 'idle',
      statusLabel: '选择内容后创建任务',
    });
  } catch (error) {
    if (!isCurrent(page, groupId, epoch)) return;
    page.setData({
      optionsLoading: false,
      errorMessage:
        error instanceof ClientCapabilityDisabledError
          ? error.message
          : toUserMessage(error, '导出选项暂时无法加载，请稍后重试。'),
      state: error instanceof ClientCapabilityDisabledError ? 'disabled' : 'idle',
      statusLabel:
        error instanceof ClientCapabilityDisabledError ? '导出暂未开放' : '导出选项暂不可用',
    });
    if (!(error instanceof ClientCapabilityDisabledError))
      showFeedback(page, '岗位和成员暂时无法读取，可重试加载。', 'error');
  } finally {
    if (page._wait === wait) page._wait = undefined;
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
        creationRequested = true;
        const job = await page._actionsClient.createExportJob(groupId, {
          exportType: selection.exportType,
          format: selection.format,
          ...(selection.format === 'docx' || selection.membershipIds.length === 0
            ? {}
            : { membershipIds: selection.membershipIds }),
          period: currentPeriod(selection),
          ...(selection.format === 'docx' || selection.roleIds.length === 0
            ? {}
            : { roleIds: selection.roleIds }),
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
  clearInfoMessageTimer(page);
  page.setData({
    errorMessage: '',
    infoMessage: '',
    state: 'waiting',
    statusLabel: `正在生成${formatLabel(page.data.format)}`,
  });
  try {
    const result = await pollExportJob(
      jobId,
      (candidateJobId) => page._actionsClient.getExportJob(groupId, candidateJobId),
      {
        cancellation: wait,
        isCancelled: () => page._pollCancelled || !isCurrent(page, groupId, epoch),
      },
    );
    if (!isCurrent(page, groupId, epoch) || page._wait !== wait) return;
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
      fileLabel: buildExportFileName(result.job.exportType, result.job.period).replace(
        /\.csv$/u,
        `.${result.job.format ?? page.data.format}`,
      ),
      state: 'ready',
      statusLabel: '文件已生成，正在准备发送',
    });
    await downloadExport(page);
  } catch (error) {
    if (!isCurrent(page, groupId, epoch) || page._wait !== wait) return;
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
    statusLabel: `正在准备${formatLabel(page.data.format)}文件`,
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
}

function isCurrent(page: ExportsPageInstance, groupId: string, epoch: number): boolean {
  return page._attached && page._epoch === epoch && getGroupId(page) === groupId;
}

function getGroupId(page: ExportsPageInstance): string {
  return page._directPage === true ? page.data.groupId : page.properties.groupId;
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
  });
}

function toggleMultiSelection(
  page: ExportsPageInstance,
  kind: 'member' | 'role',
  value: string,
): void {
  const idsKey = kind === 'member' ? 'membershipIds' : 'roleIds';
  const optionsKey = kind === 'member' ? 'memberOptions' : 'roleOptions';
  const summaryKey = kind === 'member' ? 'memberSummary' : 'roleSummary';
  const allLabel = kind === 'member' ? '全部成员' : '全部岗位';
  const currentIds = page.data[idsKey];
  const nextIds =
    value === ''
      ? []
      : currentIds.includes(value)
        ? currentIds.filter((id) => id !== value)
        : [...currentIds, value];
  const options = page.data[optionsKey].map((option) => ({
    ...option,
    checked: option.value === '' ? nextIds.length === 0 : nextIds.includes(option.value),
  }));
  const selectedLabels = options
    .filter((option) => option.value !== '' && option.checked)
    .map((option) => option.label);
  page.setData({
    [idsKey]: nextIds,
    [optionsKey]: options,
    [summaryKey]: selectedLabels.length === 0 ? allLabel : selectedLabels.join('、'),
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

function formatLabel(format: ExportsPageData['format']): string {
  return format === 'docx' ? ' Word' : format === 'xlsx' ? ' Excel' : ' CSV';
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
