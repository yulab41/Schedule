import type { DissolvedGroup, GroupCatalogEntry, GroupSummary } from '@schedule/contracts';

import {
  createGroup,
  deleteGroup,
  joinGroupAsGuest,
  leaveGroup,
  listDissolvedGroups,
  listGroupCatalog,
  listGroups,
  regenerateGroupCode,
  regenerateVisitorKey,
  restoreGroup,
  updateGroupName,
} from '../../api/endpoints.js';
import { getStoredToken } from '../../api/client.js';
import { getSelectedGroupId, resolveSelectedGroup, setSelectedGroupId } from '../../store/group.js';

interface GroupsPageData {
  readonly catalog: readonly GroupCatalogEntry[];
  readonly catalogIndex: number;
  readonly catalogNames: readonly string[];
  readonly createName: string;
  readonly dissolved: readonly DissolvedGroup[];
  readonly errorMessage: string;
  readonly groupNameInput: string;
  readonly groups: readonly GroupSummary[];
  readonly infoMessage: string;
  readonly loading: boolean;
  readonly selectedGroupId: string;
  readonly selectedGroupName: string;
  readonly selectedRole: string;
  readonly submitting: boolean;
}

Page({
  data: {
    catalog: [],
    catalogIndex: 0,
    catalogNames: [],
    createName: '',
    dissolved: [],
    errorMessage: '',
    groupNameInput: '',
    groups: [],
    infoMessage: '',
    loading: false,
    selectedGroupId: '',
    selectedGroupName: '',
    selectedRole: '',
    submitting: false,
  } as GroupsPageData,

  onShow() {
    if (getStoredToken() === undefined) {
      wx.reLaunch({ url: '/pages/login/login' });
      return;
    }
    void this.loadAll();
  },

  async loadAll(): Promise<void> {
    this.setData({ errorMessage: '', infoMessage: '', loading: true });
    try {
      const [groups, catalog, dissolved] = await Promise.all([
        listGroups(),
        listGroupCatalog(),
        listDissolvedGroups(),
      ]);
      const selected = resolveSelectedGroup(groups, getSelectedGroupId());
      if (selected !== undefined) {
        setSelectedGroupId(selected.id);
      }
      this.setData({
        catalog,
        catalogNames: catalog.map((entry) => this.catalogLabel(entry)),
        dissolved,
        groups,
        groupNameInput: selected?.name ?? '',
        selectedGroupId: selected?.id ?? '',
        selectedGroupName: selected?.name ?? '',
        selectedRole: selected?.role ?? '',
      });
    } catch (error) {
      this.setData({ errorMessage: toMessage(error, '群组加载失败。') });
    } finally {
      this.setData({ loading: false });
    }
  },

  selectedGroup(): GroupSummary | undefined {
    return this.data.groups.find((group) => group.id === this.data.selectedGroupId);
  },

  handleGroupChange(event: WechatMiniprogram.CustomEvent) {
    const groupId = event.detail.groupId;
    const selected = this.data.groups.find((group) => group.id === groupId);
    if (selected === undefined) {
      return;
    }
    setSelectedGroupId(groupId);
    this.setData({
      groupNameInput: selected.name,
      selectedGroupId: groupId,
      selectedGroupName: selected.name,
      selectedRole: selected.role,
    });
  },

  onCreateNameInput(event: WechatMiniprogram.Input) {
    this.setData({ createName: event.detail.value });
  },

  onRenameInput(event: WechatMiniprogram.Input) {
    this.setData({ groupNameInput: event.detail.value });
  },

  async handleCreate(): Promise<void> {
    const name = this.data.createName.trim();
    if (name.length === 0) {
      this.setData({ errorMessage: '请填写群组名称。' });
      return;
    }
    this.setData({ errorMessage: '', infoMessage: '', submitting: true });
    try {
      const group = await createGroup({ name });
      setSelectedGroupId(group.id);
      this.setData({ createName: '' });
      wx.showToast({ icon: 'success', title: '群组已创建' });
      await this.loadAll();
    } catch (error) {
      this.setData({ errorMessage: toMessage(error, '创建失败。') });
    } finally {
      this.setData({ submitting: false });
    }
  },

  async handleRename(): Promise<void> {
    const group = this.selectedGroup();
    if (group === undefined || group.role !== 'owner') {
      return;
    }
    const name = this.data.groupNameInput.trim();
    if (name.length === 0) {
      this.setData({ errorMessage: '群组名称不能为空。' });
      return;
    }
    this.setData({ errorMessage: '', infoMessage: '', submitting: true });
    try {
      await updateGroupName(group.id, { name });
      wx.showToast({ icon: 'success', title: '名称已更新' });
      await this.loadAll();
    } catch (error) {
      this.setData({ errorMessage: toMessage(error, '改名失败。') });
    } finally {
      this.setData({ submitting: false });
    }
  },

  async handleRegenerateCode(): Promise<void> {
    const group = this.selectedGroup();
    if (group === undefined || group.role !== 'owner') {
      return;
    }
    const confirmed = await confirmAction('重新生成群组码', '旧码立即失效。');
    if (!confirmed) {
      return;
    }
    this.setData({ errorMessage: '', infoMessage: '', submitting: true });
    try {
      await regenerateGroupCode(group.id);
      wx.showToast({ icon: 'success', title: '群组码已更新' });
    } catch (error) {
      this.setData({ errorMessage: toMessage(error, '操作失败。') });
    } finally {
      this.setData({ submitting: false });
    }
  },

  async handleRegenerateVisitorKey(): Promise<void> {
    const group = this.selectedGroup();
    if (group === undefined || group.role !== 'owner') {
      return;
    }
    const confirmed = await confirmAction('重新生成访客码', '旧二维码立即失效。');
    if (!confirmed) {
      return;
    }
    this.setData({ errorMessage: '', infoMessage: '', submitting: true });
    try {
      await regenerateVisitorKey(group.id);
      wx.showToast({ icon: 'success', title: '访客码已更新' });
    } catch (error) {
      this.setData({ errorMessage: toMessage(error, '操作失败。') });
    } finally {
      this.setData({ submitting: false });
    }
  },

  openQr() {
    const group = this.selectedGroup();
    if (group !== undefined) {
      wx.navigateTo({ url: `/pages/group/qr?groupId=${encodeURIComponent(group.id)}` });
    }
  },

  openMembers() {
    const group = this.selectedGroup();
    if (group !== undefined) {
      wx.navigateTo({ url: `/pages/group/members?groupId=${encodeURIComponent(group.id)}` });
    }
  },

  openInvite() {
    const group = this.selectedGroup();
    if (group !== undefined) {
      wx.navigateTo({ url: `/pages/group/invite-create?groupId=${encodeURIComponent(group.id)}` });
    }
  },

  onCatalogChange(event: WechatMiniprogram.PickerChange) {
    this.setData({ catalogIndex: Number(event.detail.value ?? 0) });
  },

  async handleJoinGuest(): Promise<void> {
    const entry = this.data.catalog[this.data.catalogIndex];
    if (entry === undefined) {
      this.setData({ errorMessage: '请先选择要加入的群组。' });
      return;
    }
    if (entry.relation === 'active-member' || entry.relation === 'active-guest') {
      this.setData({ errorMessage: '您已经加入该群组。' });
      return;
    }
    if (entry.relation === 'left-member') {
      this.setData({ errorMessage: '该群有您的未认领成员身份，请通过邀请链接重新加入。' });
      return;
    }
    this.setData({ errorMessage: '', infoMessage: '', submitting: true });
    try {
      const group = await joinGroupAsGuest(entry.id);
      setSelectedGroupId(group.id);
      wx.showToast({ icon: 'success', title: '已以访客身份加入' });
      await this.loadAll();
    } catch (error) {
      this.setData({ errorMessage: toMessage(error, '加入失败。') });
    } finally {
      this.setData({ submitting: false });
    }
  },

  async handleLeave(): Promise<void> {
    const group = this.selectedGroup();
    if (group === undefined || group.role === 'owner') {
      return;
    }
    const confirmed = await confirmAction(
      '退出群组',
      '退出后历史排班保留，重新加入需群主/管理员邀请。',
    );
    if (!confirmed) {
      return;
    }
    this.setData({ errorMessage: '', infoMessage: '', submitting: true });
    try {
      await leaveGroup(group.id);
      wx.showToast({ icon: 'success', title: '已退出群组' });
      await this.loadAll();
    } catch (error) {
      this.setData({ errorMessage: toMessage(error, '退出失败。') });
    } finally {
      this.setData({ submitting: false });
    }
  },

  async handleDissolve(): Promise<void> {
    const group = this.selectedGroup();
    if (group === undefined || group.role !== 'owner') {
      return;
    }
    const confirmed = await confirmAction('解散群组', '解散后数据保留，可在“已解散群组”中恢复。');
    if (!confirmed) {
      return;
    }
    this.setData({ errorMessage: '', infoMessage: '', submitting: true });
    try {
      await deleteGroup(group.id);
      wx.showToast({ icon: 'success', title: '群组已解散' });
      await this.loadAll();
    } catch (error) {
      this.setData({ errorMessage: toMessage(error, '解散失败。') });
    } finally {
      this.setData({ submitting: false });
    }
  },

  async handleRestore(event: WechatMiniprogram.TouchEvent): Promise<void> {
    const groupId = event.currentTarget.dataset.id;
    if (typeof groupId !== 'string' || groupId.length === 0) {
      return;
    }
    const confirmed = await confirmAction('恢复群组', '恢复后群组与成员关系原样回来。');
    if (!confirmed) {
      return;
    }
    this.setData({ errorMessage: '', infoMessage: '', submitting: true });
    try {
      await restoreGroup(groupId);
      wx.showToast({ icon: 'success', title: '群组已恢复' });
      await this.loadAll();
    } catch (error) {
      this.setData({ errorMessage: toMessage(error, '恢复失败。') });
    } finally {
      this.setData({ submitting: false });
    }
  },

  catalogLabel(entry: GroupCatalogEntry): string {
    if (entry.relation === 'active-member' || entry.relation === 'active-guest') {
      return `${entry.name}（已加入）`;
    }
    if (entry.relation === 'left-member') {
      return `${entry.name}（未认领成员身份）`;
    }
    return entry.name;
  },
});

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
