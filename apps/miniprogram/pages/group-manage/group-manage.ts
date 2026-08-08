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
import { resolveSelectedGroup, setSelectedGroupId } from '../../store/group.js';

interface GroupManagePageData {
  readonly catalog: readonly GroupCatalogEntry[];
  readonly catalogIndex: number;
  readonly catalogNames: readonly string[];
  readonly createCode: string;
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
    createCode: '',
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
  } as GroupManagePageData,

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
    this.setData({ errorMessage: '', infoMessage: '', loading: true });
    try {
      const [groups, catalog, dissolved] = await Promise.all([
        listGroups(),
        listGroupCatalog(),
        this.isOwnerSelected() ? listDissolvedGroups() : Promise.resolve([]),
      ]);
      const selected = resolveSelectedGroup(groups, this.data.selectedGroupId);
      const selectedId = selected?.id ?? '';
      if (selected !== undefined) {
        setSelectedGroupId(selected.id);
      }
      this.setData({
        catalog,
        catalogNames: catalog.map((entry) => this.catalogLabel(entry)),
        dissolved,
        groups,
        groupNameInput: selected?.name ?? '',
        selectedGroupId: selectedId,
        selectedGroupName: selected?.name ?? '',
        selectedRole: selected?.role ?? '',
      });
    } catch (error) {
      this.setData({ errorMessage: toErrorMessage(error) });
    } finally {
      this.setData({ loading: false });
    }
  },

  isOwnerSelected(): boolean {
    const selected = this.selectedGroup();
    return selected?.role === 'owner';
  },

  selectedGroup(): GroupSummary | undefined {
    return this.data.groups.find((group) => group.id === this.data.selectedGroupId);
  },

  handleGroupChange(event: WechatMiniprogram.CustomEvent) {
    const groupId = event.detail.groupId;
    if (typeof groupId === 'string' && groupId.length > 0) {
      const selected = this.data.groups.find((group) => group.id === groupId);
      this.setData({
        groupNameInput: selected?.name ?? '',
        selectedGroupId: groupId,
        selectedGroupName: selected?.name ?? '',
        selectedRole: selected?.role ?? '',
      });
      setSelectedGroupId(groupId);
      void this.loadAll();
    }
  },

  handleCreateNameInput(event: WechatMiniprogram.Input) {
    this.setData({ createName: event.detail.value });
  },

  handleCreateCodeInput(event: WechatMiniprogram.Input) {
    this.setData({ createCode: event.detail.value });
  },

  handleGroupNameInput(event: WechatMiniprogram.Input) {
    this.setData({ groupNameInput: event.detail.value });
  },

  handleCatalogChange(event: WechatMiniprogram.PickerChange) {
    const index = Number(event.detail.value ?? 0);
    this.setData({ catalogIndex: index });
  },

  async handleCreateGroup(): Promise<void> {
    const name = this.data.createName.trim();
    if (name.length === 0) {
      this.setData({ errorMessage: '请填写群组名称。' });
      return;
    }
    const code = this.data.createCode.trim();
    if (code.length > 0 && !/^\d{4}$/u.test(code)) {
      this.setData({ errorMessage: '自定义群组码必须为四位数字。' });
      return;
    }
    this.setData({ errorMessage: '', infoMessage: '', submitting: true });
    try {
      const group = await createGroup(code.length === 0 ? { name } : { groupCode: code, name });
      this.setData({ createCode: '', createName: '' });
      setSelectedGroupId(group.id);
      wx.showToast({ icon: 'success', title: '群组已创建' });
      await this.loadAll();
    } catch (error) {
      this.setData({ errorMessage: toErrorMessage(error) });
    } finally {
      this.setData({ submitting: false });
    }
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
      this.setData({ errorMessage: toErrorMessage(error) });
    } finally {
      this.setData({ submitting: false });
    }
  },

  async handleSaveGroupName(): Promise<void> {
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
      this.setData({ errorMessage: toErrorMessage(error) });
    } finally {
      this.setData({ submitting: false });
    }
  },

  async handleRegenerateCode(): Promise<void> {
    const group = this.selectedGroup();
    if (group === undefined || group.role !== 'owner') {
      return;
    }
    const confirmed = await confirmAction('重新生成群组码', '旧码立即失效，已加入成员不受影响。');
    if (!confirmed) {
      return;
    }
    this.setData({ errorMessage: '', infoMessage: '', submitting: true });
    try {
      await regenerateGroupCode(group.id);
      wx.showToast({ icon: 'success', title: '群组码已更新' });
      await this.loadAll();
    } catch (error) {
      this.setData({ errorMessage: toErrorMessage(error) });
    } finally {
      this.setData({ submitting: false });
    }
  },

  async handleRegenerateVisitorKey(): Promise<void> {
    const group = this.selectedGroup();
    if (group === undefined || group.role !== 'owner') {
      return;
    }
    const confirmed = await confirmAction(
      '重新生成访客小程序码',
      '旧二维码立即失效，需重新展示并保存新码。',
    );
    if (!confirmed) {
      return;
    }
    this.setData({ errorMessage: '', infoMessage: '', submitting: true });
    try {
      await regenerateVisitorKey(group.id);
      wx.showToast({ icon: 'success', title: '访客码已更新' });
    } catch (error) {
      this.setData({ errorMessage: toErrorMessage(error) });
    } finally {
      this.setData({ submitting: false });
    }
  },

  openGroupQr(): void {
    const group = this.selectedGroup();
    if (group === undefined) {
      return;
    }
    wx.navigateTo({ url: `/pages/group-qr/group-qr?groupId=${encodeURIComponent(group.id)}` });
  },

  openMembers(): void {
    const group = this.selectedGroup();
    if (group === undefined) {
      return;
    }
    wx.navigateTo({
      url: `/pages/group-members/group-members?groupId=${encodeURIComponent(group.id)}`,
    });
  },

  openScheduleRoles(): void {
    const group = this.selectedGroup();
    if (group === undefined) {
      return;
    }
    wx.navigateTo({
      url: `/pages/schedule-roles/schedule-roles?groupId=${encodeURIComponent(group.id)}`,
    });
  },

  openShiftTypes(): void {
    const group = this.selectedGroup();
    if (group === undefined) {
      return;
    }
    wx.navigateTo({
      url: `/pages/shift-types/shift-types?groupId=${encodeURIComponent(group.id)}`,
    });
  },

  openScheduling(): void {
    const group = this.selectedGroup();
    if (group === undefined) {
      return;
    }
    wx.navigateTo({ url: `/pages/scheduling/scheduling?groupId=${encodeURIComponent(group.id)}` });
  },

  openStatistics(): void {
    const group = this.selectedGroup();
    if (group === undefined) {
      return;
    }
    wx.navigateTo({ url: `/pages/statistics/statistics?groupId=${encodeURIComponent(group.id)}` });
  },

  async handleDissolve(): Promise<void> {
    const group = this.selectedGroup();
    if (group === undefined || group.role !== 'owner') {
      return;
    }
    const confirmed = await confirmAction(
      '解散群组',
      '解散后群组立即从所有列表消失，数据保留 30 天，可在“已解散群组”中恢复。',
    );
    if (!confirmed) {
      return;
    }
    this.setData({ errorMessage: '', infoMessage: '', submitting: true });
    try {
      await deleteGroup(group.id);
      wx.showToast({ icon: 'success', title: '群组已解散' });
      await this.loadAll();
    } catch (error) {
      this.setData({ errorMessage: toErrorMessage(error) });
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
      '退出后历史排班和联系方式保留，身份变为未认领；重新加入需群主/管理员邀请。',
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
      this.setData({ errorMessage: toErrorMessage(error) });
    } finally {
      this.setData({ submitting: false });
    }
  },

  async handleRestore(event: WechatMiniprogram.TouchEvent): Promise<void> {
    const groupId = event.currentTarget.dataset.id;
    if (typeof groupId !== 'string' || groupId.length === 0) {
      return;
    }
    const confirmed = await confirmAction('恢复群组', '恢复后群组与成员关系将原样回来。');
    if (!confirmed) {
      return;
    }
    this.setData({ errorMessage: '', infoMessage: '', submitting: true });
    try {
      await restoreGroup(groupId);
      wx.showToast({ icon: 'success', title: '群组已恢复' });
      await this.loadAll();
    } catch (error) {
      this.setData({ errorMessage: toErrorMessage(error) });
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

function toErrorMessage(error: unknown): string {
  return error instanceof Error && error.message.length > 0
    ? error.message
    : '操作失败，请稍后重试。';
}
