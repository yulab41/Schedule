import type { CreateInviteLinkResponse, ScheduleRole } from '@schedule/contracts';

import { createInviteLink, getSchedulingConfig, revokeInviteLink } from '../../api/endpoints.js';

interface InviteCreatePageData {
  readonly errorMessage: string;
  readonly groupId: string;
  readonly loading: boolean;
  readonly permissionIndex: number;
  readonly permissionNames: readonly string[];
  readonly realName: string;
  readonly result: CreateInviteLinkResponse | undefined;
  readonly roleIndex: number;
  readonly roleNames: readonly string[];
  readonly roles: readonly ScheduleRole[];
  readonly submitting: boolean;
  readonly targetId: string;
  readonly targetKind: 'membership' | 'roster';
}

Page({
  data: {
    errorMessage: '',
    groupId: '',
    loading: false,
    permissionIndex: 0,
    permissionNames: ['成员', '管理员'],
    realName: '',
    result: undefined,
    roleIndex: 0,
    roleNames: [],
    roles: [],
    submitting: false,
    targetId: '',
    targetKind: 'membership',
  } as InviteCreatePageData,

  onLoad(options: Record<string, string | undefined>) {
    const groupId = options.groupId;
    const targetId = options.targetId;
    const realName = options.realName;
    if (
      typeof groupId !== 'string' ||
      groupId.length === 0 ||
      typeof targetId !== 'string' ||
      targetId.length === 0
    ) {
      this.setData({ errorMessage: '缺少邀请目标参数，请从成员页进入。' });
      return;
    }
    const targetKind = options.targetKind === 'roster' ? 'roster' : 'membership';
    this.setData({
      groupId,
      realName: typeof realName === 'string' ? realName : '',
      targetId,
      targetKind,
    });
    void this.loadRoles(groupId);
  },

  async loadRoles(groupId: string): Promise<void> {
    this.setData({ loading: true });
    try {
      const config = await getSchedulingConfig(groupId);
      this.setData({
        roleNames: ['（不指定排班岗位）', ...config.roles.map((role) => role.name)],
        roles: config.roles,
      });
    } catch {
      // 岗位加载失败时仍可创建不带排班岗位的邀请。
    } finally {
      this.setData({ loading: false });
    }
  },

  handleRoleChange(event: WechatMiniprogram.PickerChange) {
    this.setData({ roleIndex: Number(event.detail.value ?? 0) });
  },

  handlePermissionChange(event: WechatMiniprogram.PickerChange) {
    this.setData({ permissionIndex: Number(event.detail.value ?? 0) });
  },

  async handleCreate(): Promise<void> {
    if (this.data.submitting || this.data.groupId.length === 0 || this.data.targetId.length === 0) {
      return;
    }
    this.setData({ errorMessage: '', submitting: true });
    try {
      const role = this.data.roles[this.data.roleIndex - 1];
      const result = await createInviteLink(this.data.groupId, {
        ...(this.data.targetKind === 'roster'
          ? { targetRosterEntryId: this.data.targetId }
          : { targetMembershipId: this.data.targetId }),
        ...(role === undefined ? {} : { scheduleRoleId: role.id }),
        permissionRole: this.data.permissionIndex === 1 ? 'administrator' : 'member',
      });
      this.setData({ result });
    } catch (error) {
      this.setData({
        errorMessage:
          error instanceof Error && error.message.length > 0
            ? error.message
            : '邀请创建失败，请稍后重试。',
      });
    } finally {
      this.setData({ submitting: false });
    }
  },

  async handleRevoke(): Promise<void> {
    const result = this.data.result;
    if (result === undefined || this.data.submitting) {
      return;
    }
    this.setData({ errorMessage: '', submitting: true });
    try {
      await revokeInviteLink(this.data.groupId, result.token);
      this.setData({ result: undefined });
      wx.showToast({ icon: 'success', title: '邀请已撤销' });
    } catch (error) {
      this.setData({
        errorMessage:
          error instanceof Error && error.message.length > 0
            ? error.message
            : '撤销失败，请稍后重试。',
      });
    } finally {
      this.setData({ submitting: false });
    }
  },

  onShareAppMessage(): WechatMiniprogram.Page.ICustomShareContent {
    const result = this.data.result;
    if (result === undefined) {
      return { path: '/pages/index/index', title: '科室排班' };
    }
    return {
      path: result.sharePath,
      title: `${result.realName}：邀请你加入“${result.groupName}”`,
    };
  },
});
