import type { GroupSummary, ScheduleRole, SchedulingConfig, ShiftType } from '@schedule/contracts';

import {
  createScheduleRole,
  createShiftType,
  deleteScheduleRole,
  deleteShiftType,
  getSchedulingConfig,
  listGroups,
  replaceScheduleRoleMembers,
  updateShiftType,
} from '../../api/endpoints.js';
import { getStoredToken } from '../../api/client.js';
import { getSelectedGroupId, resolveSelectedGroup, setSelectedGroupId } from '../../store/group.js';

interface ShiftTypeForm {
  readonly abbreviation: string;
  readonly color: string;
  readonly countsTowardStatistics: boolean;
  readonly crossesMidnight: boolean;
  readonly endTime: string;
  readonly id: string;
  readonly isAllDay: boolean;
  readonly isEnabled: boolean;
  readonly name: string;
  readonly startTime: string;
  readonly textColor: string;
}

interface ConfigPageData {
  readonly errorMessage: string;
  readonly groups: readonly GroupSummary[];
  readonly groupMembers: readonly { readonly id: string; readonly name: string }[];
  readonly infoMessage: string;
  readonly loading: boolean;
  readonly memberRows: readonly {
    readonly checked: boolean;
    readonly id: string;
    readonly name: string;
  }[];
  readonly membersByMembershipId: ReadonlyMap<string, string>;
  readonly newRoleName: string;
  readonly roleMemberIds: readonly string[];
  readonly roleNames: readonly string[];
  readonly roles: readonly ScheduleRole[];
  readonly selectedRoleId: string;
  readonly selectedGroupId: string;
  readonly shiftForm: ShiftTypeForm;
  readonly shiftTypes: readonly ShiftType[];
  readonly showShiftForm: boolean;
  readonly submitting: boolean;
}

const emptyShiftForm: ShiftTypeForm = {
  abbreviation: '',
  color: '#1F5AA6',
  countsTowardStatistics: true,
  crossesMidnight: false,
  endTime: '08:00',
  id: '',
  isAllDay: true,
  isEnabled: true,
  name: '',
  startTime: '08:00',
  textColor: '#FFFFFF',
};

Page({
  data: {
    errorMessage: '',
    groups: [],
    groupMembers: [],
    infoMessage: '',
    loading: false,
    memberRows: [],
    membersByMembershipId: new Map(),
    newRoleName: '',
    roleMemberIds: [],
    roleNames: [],
    roles: [],
    selectedRoleIndex: 0,
    selectedRoleId: '',
    selectedGroupId: '',
    shiftForm: emptyShiftForm,
    shiftTypes: [],
    showShiftForm: false,
    submitting: false,
  } as ConfigPageData,

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
      const selected = resolveSelectedGroup(groups, getSelectedGroupId());
      if (selected === undefined) {
        this.setData({ errorMessage: '请先加入一个群组。', groups });
        return;
      }
      setSelectedGroupId(selected.id);
      const config = await getSchedulingConfig(selected.id);
      this.applyConfig(config, groups, selected.id);
    } catch (error) {
      this.setData({ errorMessage: toMessage(error, '配置加载失败。') });
    } finally {
      this.setData({ loading: false });
    }
  },

  applyConfig(
    config: SchedulingConfig,
    groups: readonly GroupSummary[],
    selectedGroupId: string,
  ): void {
    const membersByMembershipId = new Map(
      config.groupMembers.map((member) => [member.membershipId, member.realName]),
    );
    const selectedRoleId = config.roles[0]?.id ?? '';
    const selectedRole = config.roles.find((role) => role.id === selectedRoleId);
    this.setData({
      groupMembers: config.groupMembers.map((member) => ({
        id: member.membershipId,
        name: member.realName,
      })),
      groups,
      memberRows: this.buildMemberRows(selectedRole),
      membersByMembershipId,
      roleMemberIds: selectedRole?.members.map((member) => member.membershipId) ?? [],
      roleNames: config.roles.map((role) => role.name),
      roles: config.roles,
      selectedRoleIndex: Math.max(
        0,
        config.roles.findIndex((role) => role.id === selectedRoleId),
      ),
      selectedGroupId,
      selectedRoleId,
      shiftTypes: config.shiftTypes,
    });
  },

  handleGroupChange(event: WechatMiniprogram.CustomEvent) {
    const groupId = event.detail.groupId;
    if (typeof groupId === 'string' && groupId.length > 0) {
      setSelectedGroupId(groupId);
      this.setData({ selectedGroupId: groupId });
      void this.loadAll();
    }
  },

  onNewRoleInput(event: WechatMiniprogram.Input) {
    this.setData({ newRoleName: event.detail.value });
  },

  async handleCreateRole(): Promise<void> {
    const name = this.data.newRoleName.trim();
    if (name.length === 0) {
      this.setData({ errorMessage: '请填写岗位名称。' });
      return;
    }
    this.setData({ errorMessage: '', infoMessage: '', submitting: true });
    try {
      await createScheduleRole(this.data.selectedGroupId, { name });
      this.setData({ newRoleName: '' });
      wx.showToast({ icon: 'success', title: '岗位已创建' });
      await this.loadAll();
    } catch (error) {
      this.setData({ errorMessage: toMessage(error, '岗位创建失败。') });
    } finally {
      this.setData({ submitting: false });
    }
  },

  async handleDeleteRole(event: WechatMiniprogram.TouchEvent): Promise<void> {
    const roleId = event.currentTarget.dataset.id;
    if (typeof roleId !== 'string' || roleId.length === 0) {
      return;
    }
    const confirmed = await confirmAction('删除岗位', '已用于排班的岗位不能删除。');
    if (!confirmed) {
      return;
    }
    this.setData({ errorMessage: '', infoMessage: '', submitting: true });
    try {
      await deleteScheduleRole(this.data.selectedGroupId, roleId);
      wx.showToast({ icon: 'success', title: '岗位已删除' });
      await this.loadAll();
    } catch (error) {
      this.setData({ errorMessage: toMessage(error, '岗位删除失败。') });
    } finally {
      this.setData({ submitting: false });
    }
  },

  onRoleChange(event: WechatMiniprogram.PickerChange) {
    const index = Number(event.detail.value ?? 0);
    const role = this.data.roles[index];
    if (role !== undefined) {
      this.setData({
        memberRows: this.buildMemberRowsFromRole(role),
        roleMemberIds: role.members.map((member) => member.membershipId),
        selectedRoleId: role.id,
      });
    }
  },

  buildMemberRows(
    role: ScheduleRole | undefined,
  ): readonly { readonly checked: boolean; readonly id: string; readonly name: string }[] {
    const checked = new Set(role?.members.map((member) => member.membershipId) ?? []);
    return this.data.groupMembers.map((member) => ({
      checked: checked.has(member.id),
      id: member.id,
      name: member.name,
    }));
  },

  buildMemberRowsFromRole(
    role: ScheduleRole,
  ): readonly { readonly checked: boolean; readonly id: string; readonly name: string }[] {
    const checked = new Set(role.members.map((member) => member.membershipId));
    return this.data.groupMembers.map((member) => ({
      checked: checked.has(member.id),
      id: member.id,
      name: member.name,
    }));
  },

  onMemberToggle(event: WechatMiniprogram.TouchEvent) {
    const membershipId = event.currentTarget.dataset.id;
    if (typeof membershipId !== 'string' || membershipId.length === 0) {
      return;
    }
    const current = this.data.roleMemberIds;
    const next = current.includes(membershipId)
      ? current.filter((id) => id !== membershipId)
      : [...current, membershipId];
    this.setData({
      memberRows: this.data.memberRows.map((row) =>
        row.id === membershipId ? { ...row, checked: !row.checked } : row,
      ),
      roleMemberIds: next,
    });
  },

  async handleSaveRoleMembers(): Promise<void> {
    if (this.data.selectedRoleId.length === 0) {
      return;
    }
    this.setData({ errorMessage: '', infoMessage: '', submitting: true });
    try {
      await replaceScheduleRoleMembers(this.data.selectedGroupId, this.data.selectedRoleId, {
        membershipIds: this.data.roleMemberIds,
      });
      wx.showToast({ icon: 'success', title: '岗位成员已更新' });
      await this.loadAll();
    } catch (error) {
      this.setData({ errorMessage: toMessage(error, '保存失败。') });
    } finally {
      this.setData({ submitting: false });
    }
  },

  startCreateShift() {
    this.setData({ shiftForm: { ...emptyShiftForm }, showShiftForm: true });
  },

  startEditShift(event: WechatMiniprogram.TouchEvent) {
    const shiftTypeId = event.currentTarget.dataset.id;
    const shift = this.data.shiftTypes.find((item) => item.id === shiftTypeId);
    if (shift === undefined) {
      return;
    }
    this.setData({
      shiftForm: {
        abbreviation: shift.abbreviation,
        color: shift.color,
        countsTowardStatistics: shift.countsTowardStatistics,
        crossesMidnight: shift.crossesMidnight,
        endTime: shift.endTime ?? '',
        id: shift.id,
        isAllDay: shift.isAllDay,
        isEnabled: shift.isEnabled,
        name: shift.name,
        startTime: shift.startTime ?? '',
        textColor: shift.textColor,
      },
      showShiftForm: true,
    });
  },

  onShiftField(event: WechatMiniprogram.CustomEvent) {
    const field = event.currentTarget.dataset.field;
    const value = event.detail.value;
    if (typeof field === 'string' && typeof value === 'string') {
      this.setData({ [`shiftForm.${field}`]: value });
    }
  },

  onShiftSwitch(event: WechatMiniprogram.CustomEvent) {
    const field = event.currentTarget.dataset.field;
    const value = event.detail.value;
    if (typeof field === 'string' && typeof value === 'boolean') {
      this.setData({ [`shiftForm.${field}`]: value });
    }
  },

  async handleSaveShift(): Promise<void> {
    const form = this.data.shiftForm;
    const input = {
      abbreviation: form.abbreviation.trim(),
      color: form.color.trim(),
      countsTowardStatistics: form.countsTowardStatistics,
      crossesMidnight: form.crossesMidnight,
      endTime: form.isAllDay ? null : form.endTime.trim(),
      isEnabled: form.isEnabled,
      name: form.name.trim(),
      startTime: form.isAllDay ? null : form.startTime.trim(),
    };
    if (input.name.length === 0 || input.abbreviation.length === 0) {
      this.setData({ errorMessage: '班种名称和缩写不能为空。' });
      return;
    }
    this.setData({ errorMessage: '', infoMessage: '', submitting: true });
    try {
      if (form.id.length > 0) {
        await updateShiftType(this.data.selectedGroupId, form.id, input);
      } else {
        await createShiftType(this.data.selectedGroupId, input);
      }
      wx.showToast({ icon: 'success', title: '班种已保存' });
      await this.loadAll();
    } catch (error) {
      this.setData({ errorMessage: toMessage(error, '班种保存失败。') });
    } finally {
      this.setData({ submitting: false });
    }
  },

  async handleDeleteShift(event: WechatMiniprogram.TouchEvent): Promise<void> {
    const shiftTypeId = event.currentTarget.dataset.id;
    if (typeof shiftTypeId !== 'string' || shiftTypeId.length === 0) {
      return;
    }
    const confirmed = await confirmAction('删除班种', '已用于排班的班种不能删除。');
    if (!confirmed) {
      return;
    }
    this.setData({ errorMessage: '', infoMessage: '', submitting: true });
    try {
      await deleteShiftType(this.data.selectedGroupId, shiftTypeId);
      wx.showToast({ icon: 'success', title: '班种已删除' });
      await this.loadAll();
    } catch (error) {
      this.setData({ errorMessage: toMessage(error, '班种删除失败。') });
    } finally {
      this.setData({ submitting: false });
    }
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
