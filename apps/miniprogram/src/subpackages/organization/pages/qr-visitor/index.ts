import { recordMiniTelemetryBoundary } from '../../../../platform/telemetry.js';
import { createQrVisitorPanelControllerDefinition } from '../../components/qr-visitor-panel/controller.js';

const controller = createQrVisitorPanelControllerDefinition();
const pageMethods = Object.fromEntries(
  Object.entries(controller).filter(
    ([key, value]) => key.startsWith('handle') && typeof value === 'function',
  ),
);
type QrVisitorPageInstance = ThisParameterType<typeof controller.lifetimes.attached>;

Page({
  data: controller.data,
  ...pageMethods,
  onUnload(this: QrVisitorPageInstance) {
    controller.lifetimes.detached.call(this);
  },
  onLoad(this: QrVisitorPageInstance, query: Readonly<Record<string, string | undefined>>): void {
    recordMiniTelemetryBoundary('qr-visitor:page-onload');
    (this as unknown as { properties: { groupId: string } }).properties = {
      groupId: decodeGroupId(query['groupId']),
    };
    controller.lifetimes.attached.call(this);
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
