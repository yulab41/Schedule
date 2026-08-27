import { recordMiniTelemetryBoundary } from '../../../../platform/telemetry.js';
import { createExportsPanelControllerDefinition } from '../../components/exports-panel/controller.js';

const controller = createExportsPanelControllerDefinition();
type ExportsPageInstance = ThisParameterType<typeof controller.lifetimes.attached>;

Page({
  data: controller.data,
  ...controller.methods,
  onLoad(this: ExportsPageInstance, query: Readonly<Record<string, string | undefined>>): void {
    recordMiniTelemetryBoundary('exports:page-onload');
    (this as unknown as { properties: { groupId: string } }).properties = {
      groupId: decodeGroupId(query['groupId']),
    };
    controller.lifetimes.attached.call(this);
  },
  onUnload(this: ExportsPageInstance): void {
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
