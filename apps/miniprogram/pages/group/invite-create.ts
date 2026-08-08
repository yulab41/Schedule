import type { InvitePermissionRole } from '@schedule/contracts';

import { createInviteLink, getSchedulingConfig } from '../../api/endpoints.js';

interface InviteCreatePageData {
  readonly errorMessage: string;
  readonly groupId: string;
  readonly infoMessage: string;
  readonly permissionRole: InvitePermissionRole;
  readonly realName: string;
  readonly roleIndex: number;
  readonly roleNames: readonly string[];
  readonly roleIds: readonly string[];
  readonly sharePath: string;
  readonly submitting: boolean;
  readonly targetId: string;
  readonly targetKind: string;
}

Page({
  data: {
    errorMessage: '',
    groupId: '',
    infoMessage: '',
    permissionRole: 'member',
    realName: '',
    roleIndex: 0,
    roleNames: [],
    roleIds: [],
    sharePath: '',
    submitting: false,
    targetId: '',
    targetKind: 'membership',
  } as InviteCreatePageData,

  onLoad(options: Record<string, string | undefined>) {
    const groupId = options.groupId ?? '';
    const targetKind = options.targetKind ?? 'membership';
    const targetId = options.targetId ?? '';
    const realName = options.realName ?? '';
    this.setData({ groupId, realName, targetId, targetKind });
    void this.loadRoles();
  },

  async loadRoles(): Promise<void> {
    if (this.data.groupId.length === 0) {
      return;
    }
    try {
      const config = await getSchedulingConfig(this.data.groupId);
      this.setData({
        roleIds: config.roles.map((role) => role.id),
        roleNames: config.roles.map((role) => role.name),
      });
    } catch {
      // 角色加载失败不阻塞邀请（岗位可选）
    }
  },

  onRoleChange(event: WechatMiniprogram.PickerChange) {
    this.setData({ roleIndex: Number(event.detail.value ?? 0) });
  },

  onPermissionChange(event: WechatMiniprogram.PickerChange) {
    const value = Number(event.detail.value ?? 0);
    this.setData({ permissionRole: value === 1 ? 'administrator' : 'member' });
  },

  async handleCreate(): Promise<void> {
    if (this.data.groupId.length === 0) {
      this.setData({ errorMessage: '缺少群组参数。' });
      return;
    }
    this.setData({ errorMessage: '', infoMessage: '', submitting: true });
    try {
      const roleId = this.data.roleIds[this.data.roleIndex];
      const result = await createInviteLink(this.data.groupId, {
        permissionRole: this.data.permissionRole,
        ...(roleId === undefined ? {} : { scheduleRoleId: roleId }),
        ...(this.data.targetKind === 'roster'
          ? { targetRosterEntryId: this.data.targetId }
          : { targetMembershipId: this.data.targetId }),
      });
      this.setData({
        infoMessage: `已生成邀请：${result.realName}（${result.permissionRole}）`,
        sharePath: result.sharePath,
      });
    } catch (error) {
      this.setData({ errorMessage: toMessage(error, '邀请创建失败。') });
    } finally {
      this.setData({ submitting: false });
    }
  },

  handleCopy() {
    if (this.data.sharePath.length === 0) {
      return;
    }
    wx.setClipboardData({
      data: this.data.sharePath,
      success: () => wx.showToast({ icon: 'success', title: '已复制邀请路径' }),
    });
  },

  onShareAppMessage() {
    return {
      path: this.data.sharePath || `/pages/invite/invite?token=`,
      title: '科室排班邀请',
    };
  },
});

function toMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message.length > 0 ? error.message : fallback;
}
