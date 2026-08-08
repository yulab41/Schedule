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
import { getStoredToken } from '../../api/client.js';
import { getSelectedGroupId, resolveSelectedGroup, setSelectedGroupId } from '../../store/group.js';
import { hasDuplicateRosterName, parseRosterNames } from '../../utils/roster-input.js';

interface MemberRow {
  readonly claimLabel: string;
  readonly id: string;
  readonly isCurrentUser: boolean;
  readonly isPendingRoster: boolean;
  readonly realName: string;
  readonly role: GroupMember['role'];
  readonly roleLabel: string;
}

interface MembersPageData {
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
  } as MembersPageData,

  onLoad(options: Record<string, string | undefined>) {
    const groupId = options.groupId;
    if (typeof groupId === 'string' && groupId.length > 0) {
      this.setData({ selectedGroupId: groupId });
    }
  },

  onShow() {
    if (getStoredToken() === undefined) {
      wx.reLaunch({ url: '/pages/login/login' });
      return;
    }
    void this.loadAll();
  },

  async loadAll(): Promise<void> {
    this.setData({ errorMessage: '', loading: true });
    try {
      const groups = await listGroups();
      const selected = resolveSelectedGroup(
        groups,
        this.data.selectedGroupId || getSelectedGroupId(),
      );
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
      this.setData({ errorMessage: toMessage(error, '成员加载失败。') });
    } finally {
      this.setData({ loading: false });
    }
  },

  handleGroupChange(event: WechatMiniprogram.CustomEvent) {
    const groupId = event.detail.groupId;
    if (typeof groupId === 'string' && groupId.length > 0) {
      setSelectedGroupId(groupId);
      this.setData({ selectedGroupId: groupId });
      void this.loadAll();
    }
  },

  onRosterInput(event: WechatMiniprogram.TextareaInput) {
    this.setData({ rosterNames: event.detail.value });
  },

  async handleAddRoster(): Promise<void> {
    const names = parseRosterNames(this.data.rosterNames);
    if (names.length === 0) {
      this.setData({ errorMessage: '请至少输入一位待认领人员姓名。' });
      return;
    }
    if (hasDuplicateRosterName(names)) {
      this.setData({ errorMessage: '待认领名单中不能有重复姓名。' });
      return;
    }
    if (this.data.selectedGroupId.length === 0) {
      return;
    }
    this.setData({ errorMessage: '', infoMessage: '', submitting: true });
    try {
      const result = await addRosterEntries(this.data.selectedGroupId, { realNames: names });
      this.setData({ infoMessage: `已添加 ${result.added} 位待认领人员。`, rosterNames: '' });
      await this.loadAll();
    } catch (error) {
      this.setData({ errorMessage: toMessage(error, '添加失败。') });
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
      this.setData({ errorMessage: toMessage(error, '转正失败。') });
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
      this.setData({ errorMessage: toMessage(error, '角色调整失败。') });
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
    const confirmed = await confirmAction('转让群主', `确定将群主转让给 ${String(name)} 吗？`);
    if (!confirmed) {
      return;
    }
    this.setData({ errorMessage: '', infoMessage: '', submitting: true });
    try {
      await transferGroupOwnership(this.data.selectedGroupId, { membershipId: id });
      wx.showToast({ icon: 'success', title: '群主已转让' });
      await this.loadAll();
    } catch (error) {
      this.setData({ errorMessage: toMessage(error, '转让失败。') });
    } finally {
      this.setData({ submitting: false });
    }
  },

  async handleDeleteMember(event: WechatMiniprogram.TouchEvent): Promise<void> {
    const id = event.currentTarget.dataset.id;
    const name = event.currentTarget.dataset.name;
    if (typeof id !== 'string' || this.data.selectedGroupId.length === 0) {
      return;
    }
    const confirmed = await confirmAction('删除成员', `确定删除“${String(name)}”吗？`);
    if (!confirmed) {
      return;
    }
    this.setData({ errorMessage: '', infoMessage: '', submitting: true });
    try {
      await deleteGroupMember(this.data.selectedGroupId, id);
      wx.showToast({ icon: 'success', title: '已删除' });
      await this.loadAll();
    } catch (error) {
      this.setData({ errorMessage: toMessage(error, '删除失败。') });
    } finally {
      this.setData({ submitting: false });
    }
  },

  handleInvite(event: WechatMiniprogram.TouchEvent) {
    const id = event.currentTarget.dataset.id;
    const name = event.currentTarget.dataset.name;
    const isPending =
      event.currentTarget.dataset.pending === true ||
      event.currentTarget.dataset.pending === 'true';
    if (
      typeof id !== 'string' ||
      typeof name !== 'string' ||
      this.data.selectedGroupId.length === 0
    ) {
      return;
    }
    wx.navigateTo({
      url:
        `/pages/group/invite-create` +
        `?groupId=${encodeURIComponent(this.data.selectedGroupId)}` +
        `&targetKind=${isPending ? 'roster' : 'membership'}` +
        `&targetId=${encodeURIComponent(id)}` +
        `&realName=${encodeURIComponent(name)}`,
    });
  },

  openContactEdit(event: WechatMiniprogram.TouchEvent) {
    const id = event.currentTarget.dataset.id;
    const name = event.currentTarget.dataset.name;
    if (
      typeof id !== 'string' ||
      typeof name !== 'string' ||
      this.data.selectedGroupId.length === 0
    ) {
      return;
    }
    wx.navigateTo({
      url:
        `/pages/group/contact-edit` +
        `?groupId=${encodeURIComponent(this.data.selectedGroupId)}` +
        `&membershipId=${encodeURIComponent(id)}` +
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
  return '已认领';
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

function toMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message.length > 0 ? error.message : fallback;
}
