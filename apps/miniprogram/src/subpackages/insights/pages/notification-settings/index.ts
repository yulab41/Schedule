import { recordMiniTelemetryBoundary } from '../../../../platform/telemetry.js';
import { createNotificationsPanelControllerDefinition } from '../../components/notifications-panel/controller.js';

const controller = createNotificationsPanelControllerDefinition();
type NotificationSettingsPageInstance = ThisParameterType<typeof controller.lifetimes.attached>;

Page({
  data: controller.data,
  ...controller.methods,
  onLoad(
    this: NotificationSettingsPageInstance,
    query: Readonly<Record<string, string | undefined>>,
  ): void {
    recordMiniTelemetryBoundary('notification-settings:page-onload');
    (
      this as unknown as {
        properties: { embedded: false; groupId: string; mode: 'settings' };
      }
    ).properties = {
      embedded: false,
      groupId: decodeGroupId(query['groupId']),
      mode: 'settings',
    };
    controller.lifetimes.attached.call(this);
  },
  onUnload(this: NotificationSettingsPageInstance): void {
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
