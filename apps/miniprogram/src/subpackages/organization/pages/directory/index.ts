import { recordMiniTelemetryBoundary } from '../../../../platform/telemetry.js';
import { createDirectoryPanelControllerDefinition } from '../../components/directory-panel/directory-panel-controller.js';
import { directoryDiagnosticsBridge } from '../../components/directory-panel/directory-diagnostics-bridge.js';

const controller = createDirectoryPanelControllerDefinition(directoryDiagnosticsBridge);
type DirectoryPageInstance = ThisParameterType<typeof controller.lifetimes.attached>;
type DirectoryStandalonePageInstance = DirectoryPageInstance & { _directoryHasShown?: boolean };

Page({
  data: controller.data,
  ...controller.methods,
  onLoad(this: DirectoryPageInstance, query: Readonly<Record<string, string | undefined>>): void {
    recordMiniTelemetryBoundary('directory:page-onload');
    (
      this as unknown as {
        properties: { active: true; directoryKind: 'internal'; embedded: false; groupId: string };
      }
    ).properties = {
      directoryKind: 'internal',
      active: true,
      embedded: false,
      groupId: decodeGroupId(query['groupId']),
    };
    controller.lifetimes.attached.call(this);
  },
  onShow(this: DirectoryStandalonePageInstance): void {
    if (this._directoryHasShown !== true) {
      this._directoryHasShown = true;
      return;
    }
    controller.methods.handleForegroundRefresh.call(this);
  },
  onUnload(this: DirectoryPageInstance): void {
    controller.lifetimes.detached.call(this);
  },
} as never);

function decodeGroupId(value: string | undefined): string {
  if (value === undefined) return '';
  try {
    return decodeURIComponent(value);
  } catch {
    return '';
  }
}
