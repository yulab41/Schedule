import { recordMiniTelemetryBoundary } from '../../../../platform/telemetry.js';
import { createDirectoryPanelControllerDefinition } from '../../components/directory-panel/controller.js';

const controller = createDirectoryPanelControllerDefinition();
type DirectoryPageInstance = ThisParameterType<typeof controller.lifetimes.attached>;

Page({
  data: controller.data,
  ...controller.methods,
  onLoad(this: DirectoryPageInstance, query: Readonly<Record<string, string | undefined>>): void {
    recordMiniTelemetryBoundary('directory:page-onload');
    (
      this as unknown as {
        properties: { directoryKind: 'internal'; groupId: string };
      }
    ).properties = {
      directoryKind: 'internal',
      groupId: decodeGroupId(query['groupId']),
    };
    controller.lifetimes.attached.call(this);
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
