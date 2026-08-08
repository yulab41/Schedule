import type { GroupMember, GroupSummary } from '@schedule/contracts';

import {
  addRosterEntries,
  convertRosterEntries,
  deleteGroupMember,
  listGroupMembers,
  listGroups,
  transferGroupOwnership,
  updateGroupMemberRole,
} from '../../api/endpoints.js';
import { resolveSelectedGroup, setSelectedGroupId } from '../../store/group.js';

interface MemberRow {
  readonly claimLabel: string;
  readonly id: string;
  readonly isCurrentUser: boolean;
  readonly isPendingRoster: boolean;
  readonly isUnclaimed: boolean;
  readonly realName: string;
  readonly role: GroupMember['role'];
  readonly roleLabel: string;
}

interface GroupMembersPageData {
  readonly errorMessage: string;
  readonly groups: readonly GroupSummary[];
  readonly infoMessage: string;
  readonly loading: boolean;
  readonly members: readonly MemberRow[];
  readonly pendingCount: number;
  readonly rosterNames: string;
  readonly selectedGroupId: string;
  readonly selectedRole: string;
  readonly submitting: boolean;
}

Page({
  data: {
    errorMessage: '',
    groups: [],
    infoMessage: '',
    loading: false,
    members: [],
    pendingCount: 0,
    rosterNames: '',
    selectedGroupId: '',
    selectedRole: '',
    submitting: false,
  } as GroupMembersPageData,

  onLoad(options: Record<string, string | undefined>) {
    const groupId = options.groupId;
    if (typeof groupId === 'string' && groupId.length > 0) {
      this.setData({ selectedGroupId: groupId });
    }
  },

  onShow() {
    void this.loadAll();
  },

  async loadAll(): Promise<void> {
    this.setData({ errorMessage: '', loading: true });
    try {
      const groups = await listGroups();
      const selected = resolveSelectedGroup(groups, this.data.selectedGroupId);
      const groupId = selected?.id ?? '';
      if (selected === undefined) {
        this.setData({ groups, members: [], selectedGroupId: '', selectedRole: '' });
        return;
      }
      setSelectedGroupId(groupId);
      const members = await listGroupMembers(groupId);
      this.setData({
        groups,
        members: members.map(buildMemberRow),
        pendingCount: members.filter((member) => member.isPendingRoster === true).length,
        selectedGroupId: groupId,
        selectedRole: selected.role,
      });
    } catch (error) {
      this.setData({ errorMessage: toErrorMessage(error) });
    } finally {
      this.setData({ loading: false });
    }
  },

  handleGroupChange(event: WechatMiniprogram.CustomEvent) {
    const groupId = event.detail.groupId;
    if (typeof groupId === 'string' && groupId.length > 0) {
      this.setData({ selectedGroupId: groupId });
      setSelectedGroupId(groupId);
      void this.loadAll();
    }
  },

  handleRosterInput(event: WechatMiniprogram.TextareaInput) {
    this.setData({ rosterNames: event.detail.value });
  },

  async handleAddRoster(): Promise<void> {
    const names = parseNames(this.data.rosterNames);
    if (names.length === 0) {
      this.setData({ errorMessage: '请至少输入一位待认领人员姓名。' });
      return;
    }
    if (hasDuplicates(names)) {
      this.setData({ errorMessage: '待认领名单中不能有重复姓名。' });
      return;
    }
    if (this.data.selectedGroupId.length === 0) {
      return;
    }
    this.setData({ errorMessage: '', infoMessage: '', submitting: true });
    try {
      const result = await addRosterEntries(this.data.selectedGroupId, { realNames: names });
      this.setData({ rosterNames: '', infoMessage: `已添加 ${result.added} 位待认领人员。` });
      await this.loadAll();
    } catch (error) {
      this.setData({ errorMessage: toErrorMessage(error) });
    } finally {
      this.setData({ submitting: false });
    }
  },

  async handleConvertPending(): Promise<void> {
    const pending = this.data.members.filter((member) => member.isPendingRoster);
    if (pending.length === 0 || this.data.selectedGroupId.length === 0) {
      return;
    }
    const confirmed = await confirmAction(
      '转为正式成员',
      `确定将 ${pending.length} 位待认领成员转为正式成员吗？`,
    );
    if (!confirmed) {
      return;
    }
    this.setData({ errorMessage: '', infoMessage: '', submitting: true });
    try {
      const result = await convertRosterEntries(this.data.selectedGroupId, {
        realNames: pending.map((member) => member.realName),
      });
      this.setData({
        infoMessage:
          result.skipped > 0
            ? `已转正 ${result.converted} 位，跳过 ${result.skipped} 位。`
            : `已转正 ${result.converted} 位成员。`,
      });
      await this.loadAll();
    } catch (error) {
      this.setData({ errorMessage: toErrorMessage(error) });
    } finally {
      this.setData({ submitting: false });
    }
  },

  async handleToggleRole(event: WechatMiniprogram.TouchEvent): Promise<void> {
    const id = event.currentTarget.dataset.id;
    const role = event.currentTarget.dataset.role;
    if (
      typeof id !== 'string' ||
      (role !== 'administrator' && role !== 'member') ||
      this.data.selectedGroupId.length === 0
    ) {
      return;
    }
    this.setData({ errorMessage: '', infoMessage: '', submitting: true });
    try {
      await updateGroupMemberRole(this.data.selectedGroupId, id, { role });
      wx.showToast({
        icon: 'success',
        title: role === 'administrator' ? '已设为管理员' : '已移除管理员',
      });
      await this.loadAll();
    } catch (error) {
      this.setData({ errorMessage: toErrorMessage(error) });
    } finally {
      this.setData({ submitting: false });
    }
  },

  async handleTransfer(event: WechatMiniprogram.TouchEvent): Promise<void> {
    const id = event.currentTarget.dataset.id;
    const name = event.currentTarget.dataset.name;
    if (typeof id !== 'string' || this.data.selectedGroupId.length === 0) {
      return;
    }
    const confirmed = await confirmAction('转让群主', `确定将群主身份转让给 ${String(name)} 吗？`);
    if (!confirmed) {
      return;
    }
    this.setData({ errorMessage: '', infoMessage: '', submitting: true });
    try {
      await transferGroupOwnership(this.data.selectedGroupId, { membershipId: id });
      wx.showToast({ icon: 'success', title: '群主已转让' });
      await this.loadAll();
    } catch (error) {
      this.setData({ errorMessage: toErrorMessage(error) });
    } finally {
      this.setData({ submitting: false });
    }
  },

  async handleDeleteMember(event: WechatMiniprogram.TouchEvent): Promise<void> {
    const id = event.currentTarget.dataset.id;
    const name = event.currentTarget.dataset.name;
    const isPending = isTruthyDataset(event.currentTarget.dataset.pending);
    if (typeof id !== 'string' || this.data.selectedGroupId.length === 0) {
      return;
    }
    const confirmed = await confirmAction(
      '删除成员',
      isPending
        ? `确定删除未认领成员“${String(name)}”吗？`
        : `确定删除成员“${String(name)}”吗？其待处理申请将自动取消，历史排班保留姓名。`,
    );
    if (!confirmed) {
      return;
    }
    this.setData({ errorMessage: '', infoMessage: '', submitting: true });
    try {
      await deleteGroupMember(this.data.selectedGroupId, id);
      wx.showToast({ icon: 'success', title: '已删除' });
      await this.loadAll();
    } catch (error) {
      this.setData({ errorMessage: toErrorMessage(error) });
    } finally {
      this.setData({ submitting: false });
    }
  },

  handleInvite(event: WechatMiniprogram.TouchEvent) {
    const id = event.currentTarget.dataset.id;
    const name = event.currentTarget.dataset.name;
    const isPending = isTruthyDataset(event.currentTarget.dataset.pending);
    if (
      typeof id !== 'string' ||
      typeof name !== 'string' ||
      this.data.selectedGroupId.length === 0
    ) {
      return;
    }
    wx.navigateTo({
      url:
        `/pages/invite-create/invite-create` +
        `?groupId=${encodeURIComponent(this.data.selectedGroupId)}` +
        `&targetKind=${isPending ? 'roster' : 'membership'}` +
        `&targetId=${encodeURIComponent(id)}` +
        `&realName=${encodeURIComponent(name)}`,
    });
  },
});

function buildMemberRow(member: GroupMember): MemberRow {
  return {
    claimLabel: claimLabel(member),
    id: member.id,
    isCurrentUser: member.isCurrentUser,
    isPendingRoster: member.isPendingRoster === true,
    isUnclaimed: member.isUnclaimed === true,
    realName: member.realName,
    role: member.role,
    roleLabel: roleLabel(member.role),
  };
}

function roleLabel(role: GroupMember['role']): string {
  if (role === 'owner') {
    return '群主';
  }
  if (role === 'administrator') {
    return '管理员';
  }
  return role === 'guest' ? '访客' : '成员';
}

function claimLabel(member: GroupMember): string {
  if (member.isPendingRoster === true) {
    return '待认领名单';
  }
  if (member.isUnclaimed === true) {
    return '未认领';
  }
  if (member.isClaimedByCurrentUser === true) {
    return '已认领（我）';
  }
  if (member.claimRequestStatus === 'pending') {
    return '认领申请待审批';
  }
  return '已认领';
}

function parseNames(value: string): readonly string[] {
  return value
    .split(/\r?\n/u)
    .map((name) => name.trim())
    .filter((name) => name.length > 0);
}

function hasDuplicates(names: readonly string[]): boolean {
  return new Set(names).size !== names.length;
}

function confirmAction(title: string, content: string): Promise<boolean> {
  return new Promise((resolve) => {
    wx.showModal({
      cancelText: '取消',
      confirmText: '确认',
      content,
      success: (result) => resolve(result.confirm),
      fail: () => resolve(false),
      title,
    });
  });
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error && error.message.length > 0
    ? error.message
    : '操作失败，请稍后重试。';
}

function isTruthyDataset(value: unknown): boolean {
  return value === true || value === 'true';
}
