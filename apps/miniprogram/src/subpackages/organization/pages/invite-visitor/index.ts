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
  onShareAppMessage(this: InviteVisitorPageInstance) {
    controller.handleRefreshInviteExpiry.call(this);
    if (
      this._disposed ||
      !(this._inviteExpiresAtMs > Date.now()) ||
      !this.data.canManage ||
      !this.data.organizationEnabled ||
      this.data.managementState === 'loading' ||
      !this._inviteToken ||
      !this.data.inviteSharePath
    )
      return { title: '排班台', path: '/pages/workbench/index' };
    return {
      title: '群组邀请',
      path: `/pages/invite/invite?t=${encodeURIComponent(this._inviteToken)}`,
    };
  },
  onUnload(this: InviteVisitorPageInstance) {
    controller.lifetimes.detached.call(this);
  },
  onShow(this: InviteVisitorPageInstance) {
    controller.handleRefreshInviteExpiry.call(this);
  },
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
