import { recordMiniTelemetryBoundary } from '../../../../platform/telemetry.js';
import { createVisitorAccessPanelControllerDefinition } from '../../components/visitor-access-panel/controller.js';

const controller = createVisitorAccessPanelControllerDefinition();
type VisitorAccessPageInstance = ThisParameterType<typeof controller.lifetimes.attached>;

Page({
  data: controller.data,
  ...controller.methods,
  onLoad(
    this: VisitorAccessPageInstance,
    query: Readonly<Record<string, string | undefined>>,
  ): void {
    recordMiniTelemetryBoundary('visitor-access:page-onload');
    (this as unknown as { properties: { groupId: string } }).properties = {
      groupId: decodeGroupId(query['groupId']),
    };
    controller.lifetimes.attached.call(this);
  },
  onUnload(this: VisitorAccessPageInstance): void {
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
