import { recordMiniTelemetryBoundary } from '../../../../platform/telemetry.js';
import { createNotificationsPanelControllerDefinition } from '../../components/notifications-panel/controller.js';

const controller = createNotificationsPanelControllerDefinition();
type NotificationsPageInstance = ThisParameterType<typeof controller.lifetimes.attached>;

Page({
  data: controller.data,
  ...controller.methods,
  onLoad(
    this: NotificationsPageInstance,
    query: Readonly<Record<string, string | undefined>>,
  ): void {
    recordMiniTelemetryBoundary('notifications:page-onload');
    (this as unknown as { properties: { groupId: string; mode: 'notifications' } }).properties = {
      groupId: decodeGroupId(query['groupId']),
      mode: 'notifications',
    };
    controller.lifetimes.attached.call(this);
  },
  onUnload(this: NotificationsPageInstance): void {
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
