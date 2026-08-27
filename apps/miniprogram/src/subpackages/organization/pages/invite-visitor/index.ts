import { recordMiniTelemetryBoundary } from '../../../../platform/telemetry.js';
import { createInviteVisitorPanelControllerDefinition } from '../../components/invite-visitor-panel/controller.js';

const controller = createInviteVisitorPanelControllerDefinition();
const pageMethods = Object.fromEntries(
  Object.entries(controller).filter(
    ([key, value]) => key.startsWith('handle') && typeof value === 'function',
  ),
);
type InviteVisitorPageInstance = ThisParameterType<typeof controller.lifetimes.attached>;

Page({
  data: controller.data,
  ...pageMethods,
  onLoad(
    this: InviteVisitorPageInstance,
    query: Readonly<Record<string, string | undefined>>,
  ): void {
    recordMiniTelemetryBoundary('invite-visitor:page-onload');
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
