import { ClientCoreError, type P9InsightsActionsClient } from '@schedule/client-core';
import type { ScheduleExportType } from '@schedule/contracts';
import {
  ClientCapabilityDisabledError,
  requireClientCapability,
} from '../../../../app/client-capability-store.js';
import { createRuntimeP9InsightsActionsClient } from '../../../../platform/client-core-calendar.js';
import {
  getStoredWechatToken,
  getWechatRequestAuthentication,
} from '../../../../platform/wechat-identity.js';
import { downloadScheduleExport } from '../../../../platform/secure-download.js';

type ExportState = 'disabled' | 'error' | 'idle' | 'ready' | 'waiting';

interface ExportsPageData {
  readonly errorMessage: string;
  readonly exportType: ScheduleExportType;
  readonly fileLabel: string;
  readonly groupId: string;
  readonly currentMonthLabel: string;
  readonly pageScrollStyle: string;
  readonly shellHeaderStyle: string;
  readonly state: ExportState;
  readonly statusLabel: string;
  readonly viewportClass: string;
}

interface ExportsPageInstance {
  readonly data: ExportsPageData;
  readonly properties: { readonly groupId: string };
  readonly _actionsClient: P9InsightsActionsClient;
  _loadedGroupId: string;
  _jobId: string | undefined;
  _pollCancelled: boolean;
  setData(patch: Partial<ExportsPageData>, callback?: () => void): void;
}

const actionsClient = createRuntimeP9InsightsActionsClient(
  getStoredWechatToken,
  getWechatRequestAuthentication(),
);
const authentication = getWechatRequestAuthentication();

export function createExportsPanelControllerDefinition() {
  return {
    data: {
      errorMessage: '',
      exportType: 'schedule' as ScheduleExportType,
      fileLabel: '',
      groupId: '',
      currentMonthLabel: currentBusinessMonthLabel(),
      pageScrollStyle: 'height:calc(100% - 76px);',
      shellHeaderStyle: 'height:76px;min-height:76px;padding-top:24px;',
      state: 'idle' as ExportState,
      statusLabel: '选择内容后创建任务',
      viewportClass: '',
    } satisfies ExportsPageData,
    properties: { groupId: { type: String, value: '' } },
    _actionsClient: actionsClient,
    _loadedGroupId: '',
    _jobId: undefined,
    _pollCancelled: false,
    observers: {
      groupId(this: ExportsPageInstance): void {
        start(this);
      },
    },
    lifetimes: {
      attached(this: ExportsPageInstance): void {
        const windowInfo = wx.getWindowInfo();
        const statusBarHeight = Math.max(0, windowInfo.statusBarHeight ?? 0);
        const headerHeight = statusBarHeight + 52;
        this.setData({
          pageScrollStyle: `height:calc(100% - ${headerHeight}px);`,
          shellHeaderStyle: `height:${headerHeight}px;min-height:${headerHeight}px;padding-top:${statusBarHeight}px;`,
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
      handleTypeChange(this: ExportsPageInstance, event: PickerEvent): void {
        this.setData({ exportType: event.detail.value === 'statistics' ? 'statistics' : 'schedule' });
      },
      handleCreate(this: ExportsPageInstance): void {
        void createExport(this);
      },
      handleDownload(this: ExportsPageInstance): void {
        void downloadExport(this);
      },
      handleReset(this: ExportsPageInstance): void {
        this._jobId = undefined;
        this._pollCancelled = false;
        this.setData({ errorMessage: '', fileLabel: '', state: 'idle', statusLabel: '选择内容后创建任务' });
      },
    },
  };
}

interface PickerEvent { readonly detail: { readonly value?: unknown } }

function start(page: ExportsPageInstance): void {
  const groupId = page.properties.groupId;
  if (groupId.length === 0 || groupId === page._loadedGroupId) return;
  page._loadedGroupId = groupId;
  page.setData({ groupId });
}

async function createExport(page: ExportsPageInstance): Promise<void> {
  if (page.data.state === 'waiting') return;
  page._pollCancelled = false;
  page.setData({ errorMessage: '', state: 'waiting', statusLabel: '正在准备导出' });
  try {
    await requireClientCapability('insights');
    const job = await page._actionsClient.createExportJob(page.data.groupId, {
      exportType: page.data.exportType,
      period: currentBusinessMonth(),
    });
    page._jobId = job.id;
    await pollJob(page, job.id);
  } catch (error) {
    if (page._pollCancelled) return;
    page.setData({ errorMessage: error instanceof ClientCapabilityDisabledError ? error.message : toUserMessage(error, '导出任务暂时无法创建，请稍后重试。'), state: error instanceof ClientCapabilityDisabledError ? 'disabled' : 'error', statusLabel: '导出未完成' });
  }
}

async function pollJob(page: ExportsPageInstance, jobId: string): Promise<void> {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    if (page._pollCancelled) return;
    const job = attempt === 0 ? undefined : await page._actionsClient.getExportJob(page.data.groupId, jobId);
    if (job !== undefined && job.status === 'completed') {
      page.setData({ fileLabel: `${job.exportType === 'statistics' ? '统计' : '排班'}-${job.period}.csv`, state: 'ready', statusLabel: '导出完成，可下载文件' });
      return;
    }
    if (job !== undefined && job.status === 'failed') throw new Error(job.error ?? '导出任务失败。');
    page.setData({ statusLabel: attempt === 0 ? '正在生成文件' : `正在生成文件（${attempt}/11）` });
    await delay(1000);
  }
  throw new Error('导出任务等待超时，请稍后继续查询。');
}

async function downloadExport(page: ExportsPageInstance): Promise<void> {
  if (page._jobId === undefined || page.data.state !== 'ready') return;
  try {
    const tempFilePath = await downloadScheduleExport(getStoredWechatToken, authentication, page.data.groupId, page._jobId);
    (wx as unknown as { openDocument: (options: { filePath: string; showMenu: boolean; fail: () => void }) => unknown }).openDocument({ filePath: tempFilePath, showMenu: true, fail: () => page.setData({ errorMessage: '文件已下载，但当前设备无法打开该文件。', state: 'error' }) });
  } catch (error) {
    page.setData({ errorMessage: toUserMessage(error, '文件下载失败，请稍后重试。'), state: 'error' });
  }
}

function currentBusinessMonth(): string {
  const now = new Date(Date.now() + 8 * 60 * 60 * 1000);
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
}

function currentBusinessMonthLabel(): string {
  const value = currentBusinessMonth();
  const [year, month] = value.split('-');
  return `${year} 年 ${Number(month)} 月`;
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function toUserMessage(error: unknown, fallback: string): string {
  if (error instanceof ClientCoreError && error.message.length > 0) return error.message;
  return error instanceof Error && error.message.length > 0 ? error.message : fallback;
}
