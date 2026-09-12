import { recordMiniTelemetryBoundary } from '../../../../platform/telemetry.js';
import {
  endExportRenderDiagnostics,
  measureExportFirstPaint,
  recordExportRenderStage,
} from '../../../../platform/export-render-diagnostics.js';
import { createExportsPanelControllerDefinition } from '../../components/exports-panel/controller.js';

type ExportsController = ReturnType<typeof createExportsPanelControllerDefinition>;
type ExportsPageInstance = ThisParameterType<ExportsController['lifetimes']['attached']>;
type ExportPageRuntime = ExportsPageInstance & {
  _controller?: ExportsController | undefined;
  _controllerLoadToken?: object | undefined;
  _controllerReadyPromise?: Promise<ExportsController | undefined> | undefined;
  _pageActive?: boolean;
};
type ExportMethodName = keyof ExportsController['methods'];

const pageMethods = {
  handleBack(this: ExportPageRuntime): void {
    wx.navigateBack({ delta: 1 });
  },
  handleContinue(this: ExportPageRuntime, event: unknown): void {
    forwardMethod(this, 'handleContinue', event);
  },
  handleStopWaiting(this: ExportPageRuntime, event: unknown): void {
    forwardMethod(this, 'handleStopWaiting', event);
  },
  handleCancel(this: ExportPageRuntime, event: unknown): void {
    forwardMethod(this, 'handleCancel', event);
  },
  handleCreate(this: ExportPageRuntime, event: unknown): void {
    forwardMethod(this, 'handleCreate', event);
  },
  handleDownload(this: ExportPageRuntime, event: unknown): void {
    forwardMethod(this, 'handleDownload', event);
  },
  handleShare(this: ExportPageRuntime, event: unknown): void {
    forwardMethod(this, 'handleShare', event);
  },
  handleMemberChange(this: ExportPageRuntime, event: unknown): void {
    forwardMethod(this, 'handleMemberChange', event);
  },
  handleNextPeriod(this: ExportPageRuntime, event: unknown): void {
    forwardMethod(this, 'handleNextPeriod', event);
  },
  handlePeriodType(this: ExportPageRuntime, event: unknown): void {
    forwardMethod(this, 'handlePeriodType', event);
  },
  handlePreviousPeriod(this: ExportPageRuntime, event: unknown): void {
    forwardMethod(this, 'handlePreviousPeriod', event);
  },
  handleRetry(this: ExportPageRuntime, event: unknown): void {
    if (this._controller === undefined) void ensureController(this);
    else forwardMethod(this, 'handleRetry', event);
  },
  handleReset(this: ExportPageRuntime, event: unknown): void {
    forwardMethod(this, 'handleReset', event);
  },
  handleRoleChange(this: ExportPageRuntime, event: unknown): void {
    forwardMethod(this, 'handleRoleChange', event);
  },
  handleTypeChange(this: ExportPageRuntime, event: unknown): void {
    forwardMethod(this, 'handleTypeChange', event);
  },
};

Page({
  data: {
    panelReady: false,
    startupError: '',
    largeText: false,
    viewportClass: '',
    shellHeaderStyle: 'height:84px;min-height:84px;padding-top:32px;',
    pageScrollStyle: 'height:calc(100% - 84px);',
  },
  ...pageMethods,
  onLoad(this: ExportPageRuntime, query: Readonly<Record<string, string | undefined>> = {}): void {
    recordExportRenderStage('page-load');
    recordMiniTelemetryBoundary('exports:page-onload');
    this._directPage = true;
    this._pageActive = true;
    this._controllerLoadToken = {};
    this._panelReadyToken = this._controllerLoadToken;
    this.setData({
      groupId: decodeGroupId(query['groupId']),
      panelReady: false,
      startupError: '',
    });
    void ensureController(this);
  },
  onUnload(this: ExportPageRuntime): void {
    this._pageActive = false;
    this._controllerLoadToken = undefined;
    this._controllerReadyPromise = undefined;
    clearTimeout(this._panelReadyTimer);
    this._panelReadyTimer = undefined;
    this._panelReadyToken = undefined;
    endExportRenderDiagnostics(this);
    if (this._controller !== undefined) this._controller.lifetimes.detached.call(this);
    this._controller = undefined;
  },
  onReady(): void {
    recordExportRenderStage('page-ready');
    measureExportFirstPaint(this);
    recordMiniTelemetryBoundary('exports:page-ready');
  },
  onHide(this: ExportPageRuntime): void {
    endExportRenderDiagnostics(this);
    this._controller?.pageLifetimes.hide.call(this);
  },
  onShow(this: ExportPageRuntime): void {
    recordExportRenderStage('page-show');
    this._controller?.pageLifetimes.show.call(this);
  },
} as never);
recordExportRenderStage('module-registered');

function ensureController(page: ExportPageRuntime): Promise<ExportsController | undefined> {
  if (page._controller !== undefined) return Promise.resolve(page._controller);
  if (page._controllerReadyPromise !== undefined) return page._controllerReadyPromise;
  const token = page._controllerLoadToken;
  const pending = Promise.resolve()
    .then(() => createExportsPanelControllerDefinition())
    .then((controller) => {
      if (page._pageActive !== true || page._controllerLoadToken !== token) return undefined;
      controller.lifetimes.attached.call(page);
      page._controller = controller;
      schedulePanelReveal(page, token);
      return controller;
    })
    .catch(() => {
      if (page._pageActive === true && page._controllerLoadToken === token) {
        page.setData({
          panelReady: false,
          startupError: '导出页面暂时无法加载，请返回工作台后重试。',
        });
      }
      return undefined;
    });
  page._controllerReadyPromise = pending;
  void pending.then(() => {
    if (page._controllerReadyPromise === pending) page._controllerReadyPromise = undefined;
  });
  return pending;
}

function schedulePanelReveal(page: ExportPageRuntime, token: object | undefined): void {
  clearTimeout(page._panelReadyTimer);
  page._panelReadyTimer = setTimeout(() => {
    if (page._pageActive !== true || page._controllerLoadToken !== token || page._attached !== true)
      return;
    page.setData({ panelReady: true, startupError: '' }, () => measureExportFirstPaint(page));
  }, 0);
}

function forwardMethod(page: ExportPageRuntime, name: ExportMethodName, event: unknown): void {
  const invoke = (controller: ExportsController): void => {
    if (page._pageActive !== true || page._controller !== controller) return;
    const method = controller.methods[name] as unknown as (
      this: ExportsPageInstance,
      event?: unknown,
    ) => void;
    method.call(page, event);
  };
  if (page._controller !== undefined) {
    invoke(page._controller);
    return;
  }
  void ensureController(page).then((controller) => {
    if (controller !== undefined) invoke(controller);
  });
}

function decodeGroupId(value: string | undefined): string {
  if (value === undefined) return '';
  try {
    return decodeURIComponent(value);
  } catch {
    return '';
  }
}
