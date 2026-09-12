import { recordMiniTelemetryBoundary } from '../../../../platform/telemetry.js';
import {
  endExportRenderDiagnostics,
  measureExportFirstPaint,
  recordExportRenderStage,
} from '../../../../platform/export-render-diagnostics.js';
import { createExportsPanelControllerDefinition } from '../../components/exports-panel/controller.js';

const controller = createExportsPanelControllerDefinition();
type ExportsPageInstance = ThisParameterType<typeof controller.lifetimes.attached>;

Page({
  data: { ...controller.data, panelReady: false },
  ...controller.methods,
  onLoad(
    this: ExportsPageInstance,
    query: Readonly<Record<string, string | undefined>> = {},
  ): void {
    recordExportRenderStage('page-load');
    recordMiniTelemetryBoundary('exports:page-onload');
    this._directPage = true;
    this._panelReadyToken = {};
    this.setData({ groupId: decodeGroupId(query['groupId']), panelReady: false });
    controller.lifetimes.attached.call(this);
    const token = this._panelReadyToken;
    const revealPanel = (): void => {
      if (this._panelReadyToken !== token || this._attached === false) return;
      this.setData({ panelReady: true }, () => measureExportFirstPaint(this));
    };
    this._panelReadyTimer = setTimeout(revealPanel, 0);
  },
  onUnload(this: ExportsPageInstance): void {
    clearTimeout(this._panelReadyTimer);
    this._panelReadyTimer = undefined;
    this._panelReadyToken = undefined;
    endExportRenderDiagnostics(this);
    controller.lifetimes.detached.call(this);
  },
  onReady(): void {
    recordExportRenderStage('page-ready');
    measureExportFirstPaint(this);
    recordMiniTelemetryBoundary('exports:page-ready');
  },
  onHide(this: ExportsPageInstance): void {
    endExportRenderDiagnostics(this);
    controller.pageLifetimes.hide.call(this);
  },
  onShow(this: ExportsPageInstance): void {
    recordExportRenderStage('page-show');
    controller.pageLifetimes.show.call(this);
  },
} as never);
recordExportRenderStage('module-registered');

function decodeGroupId(value: string | undefined): string {
  if (value === undefined) return '';
  try {
    return decodeURIComponent(value);
  } catch {
    return '';
  }
}
