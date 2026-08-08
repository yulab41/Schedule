import type { GroupSummary, ScheduleRole, SchedulingConfig, ShiftType } from '@schedule/contracts';

import {
  createScheduleRole,
  deleteScheduleRole,
  getSchedulingConfig,
  listGroups,
  reorderRotationMembers,
  replaceScheduleRoleMembers,
  updateRotationRule,
} from '../../api/endpoints.js';
import { resolveSelectedGroup, setSelectedGroupId } from '../../store/group.js';

interface RotationMemberRow {
  readonly membershipId: string;
  readonly realName: string;
  readonly scheduleRoleMemberId: string;
}

interface RoleRow {
  readonly defaultShiftTypeIndex: number;
  readonly id: string;
  readonly memberChecked: readonly boolean[];
  readonly name: string;
  readonly requiredMembersPerDay: string;
  readonly startDate: string;
  readonly version: number;
}

interface ScheduleRolesPageData {
  readonly currentPositionInputs: readonly string[];
  readonly errorMessage: string;
  readonly groupId: string;
  readonly groupMembers: readonly { readonly membershipId: string; readonly realName: string }[];
  readonly groups: readonly GroupSummary[];
  readonly loading: boolean;
  readonly memberNames: readonly string[];
  readonly newRoleName: string;
  readonly roleRows: readonly RoleRow[];
  readonly rotationMembers: readonly (readonly RotationMemberRow[])[];
  readonly rotationNames: readonly (readonly string[])[];
  readonly shiftTypeNames: readonly string[];
  readonly shiftTypes: readonly ShiftType[];
  readonly startingMemberIndexes: readonly number[];
  readonly submitting: boolean;
}

Page({
  data: {
    currentPositionInputs: [],
    errorMessage: '',
    groupId: '',
    groupMembers: [],
    groups: [],
    loading: false,
    memberNames: [],
    newRoleName: '',
    roleRows: [],
    rotationMembers: [],
    rotationNames: [],
    shiftTypeNames: [],
    shiftTypes: [],
    startingMemberIndexes: [],
    submitting: false,
  } as ScheduleRolesPageData,

  onLoad(options: Record<string, string | undefined>) {
    const groupId = options.groupId;
    if (typeof groupId === 'string' && groupId.length > 0) {
      this.setData({ groupId });
    }
  },

  onShow() {
    void this.loadAll();
  },

  async loadAll(): Promise<void> {
    this.setData({ errorMessage: '', loading: true });
    try {
      const groups = await listGroups();
      const selected = resolveSelectedGroup(groups, this.data.groupId);
      if (selected === undefined) {
        this.setData({ groups, roleRows: [], rotationMembers: [] });
        return;
      }
      setSelectedGroupId(selected.id);
      const config = await getSchedulingConfig(selected.id);
      this.setData({
        groupId: selected.id,
        groups,
        ...buildRows(config),
      });
    } catch (error) {
      this.setData({ errorMessage: toErrorMessage(error) });
    } finally {
      this.setData({ loading: false });
    }
  },

  handleNewRoleInput(event: WechatMiniprogram.Input) {
    this.setData({ newRoleName: event.detail.value });
  },

  async handleCreateRole(): Promise<void> {
    const name = this.data.newRoleName.trim();
    if (name.length === 0) {
      this.setData({ errorMessage: '请填写岗位名称。' });
      return;
    }
    this.setData({ errorMessage: '', submitting: true });
    try {
      await createScheduleRole(this.data.groupId, { name });
      this.setData({ newRoleName: '' });
      wx.showToast({ icon: 'success', title: '岗位已创建' });
      await this.loadAll();
    } catch (error) {
      this.setData({ errorMessage: toErrorMessage(error) });
    } finally {
      this.setData({ submitting: false });
    }
  },

  async handleRoleMembersChange(event: WechatMiniprogram.CustomEvent): Promise<void> {
    const index = Number(event.currentTarget.dataset.index ?? -1);
    const memberIds = (event.detail.value ?? []) as string[];
    if (index < 0 || index >= this.data.roleRows.length) {
      return;
    }
    const memberChecked = this.data.groupMembers.map((member) =>
      memberIds.includes(member.membershipId),
    );
    this.setData({ [`roleRows[${index}].memberChecked`]: memberChecked });
    this.setData({ errorMessage: '', submitting: true });
    try {
      await replaceScheduleRoleMembers(this.data.groupId, this.data.roleRows[index].id, {
        membershipIds: memberIds,
      });
      wx.showToast({ icon: 'success', title: '成员已保存' });
      await this.loadAll();
    } catch (error) {
      this.setData({ errorMessage: toErrorMessage(error) });
    } finally {
      this.setData({ submitting: false });
    }
  },

  handleCurrentPositionInput(event: WechatMiniprogram.Input) {
    const index = Number(event.currentTarget.dataset.index ?? -1);
    if (index < 0 || index >= this.data.currentPositionInputs.length) {
      return;
    }
    this.setData({ [`currentPositionInputs[${index}]`]: event.detail.value });
  },

  handleRequiredCountInput(event: WechatMiniprogram.Input) {
    const index = Number(event.currentTarget.dataset.index ?? -1);
    if (index < 0 || index >= this.data.roleRows.length) {
      return;
    }
    this.setData({ [`roleRows[${index}].requiredMembersPerDay`]: event.detail.value });
  },

  handleDefaultShiftChange(event: WechatMiniprogram.PickerChange) {
    const index = Number(event.currentTarget.dataset.index ?? -1);
    if (index < 0 || index >= this.data.roleRows.length) {
      return;
    }
    this.setData({ [`roleRows[${index}].defaultShiftTypeIndex`]: Number(event.detail.value ?? 0) });
  },

  handleStartDateChange(event: WechatMiniprogram.PickerChange) {
    const index = Number(event.currentTarget.dataset.index ?? -1);
    if (index < 0 || index >= this.data.roleRows.length) {
      return;
    }
    this.setData({ [`roleRows[${index}].startDate`]: String(event.detail.value ?? '') });
  },

  handleStartingMemberChange(event: WechatMiniprogram.PickerChange) {
    const index = Number(event.currentTarget.dataset.index ?? -1);
    if (index < 0 || index >= this.data.startingMemberIndexes.length) {
      return;
    }
    this.setData({ [`startingMemberIndexes[${index}]`]: Number(event.detail.value ?? 0) });
  },

  async handleSaveRotationRule(event: WechatMiniprogram.TouchEvent): Promise<void> {
    const index = Number(event.currentTarget.dataset.index ?? -1);
    if (index < 0 || index >= this.data.roleRows.length) {
      return;
    }
    const role = this.data.roleRows[index];
    const members = this.data.rotationMembers[index];
    const currentPosition = Number(this.data.currentPositionInputs[index]);
    const requiredMembersPerDay = Number(role.requiredMembersPerDay);
    const defaultShiftType = this.data.shiftTypes[role.defaultShiftTypeIndex];
    if (!Number.isInteger(currentPosition) || currentPosition < 1) {
      this.setData({ errorMessage: '当前轮值位置必须为正整数。' });
      return;
    }
    if (!Number.isInteger(requiredMembersPerDay) || requiredMembersPerDay < 1) {
      this.setData({ errorMessage: '每日需要人数必须为正整数。' });
      return;
    }
    if (defaultShiftType === undefined) {
      this.setData({ errorMessage: '请选择默认班种。' });
      return;
    }
    const startingMember = members[this.data.startingMemberIndexes[index]];
    this.setData({ errorMessage: '', submitting: true });
    try {
      await updateRotationRule(this.data.groupId, role.id, {
        currentPosition,
        defaultShiftTypeId: defaultShiftType.id,
        requiredMembersPerDay,
        ...(role.startDate.length === 0 ? {} : { startDate: role.startDate }),
        ...(startingMember === undefined
          ? {}
          : { startingMemberScheduleRoleId: startingMember.scheduleRoleMemberId }),
      });
      wx.showToast({ icon: 'success', title: '轮值规则已保存' });
      await this.loadAll();
    } catch (error) {
      this.setData({ errorMessage: toErrorMessage(error) });
    } finally {
      this.setData({ submitting: false });
    }
  },

  async handleMoveMember(event: WechatMiniprogram.TouchEvent): Promise<void> {
    const roleIndex = Number(event.currentTarget.dataset.roleIndex ?? -1);
    const memberIndex = Number(event.currentTarget.dataset.memberIndex ?? -1);
    const delta = Number(event.currentTarget.dataset.delta ?? 0);
    if (roleIndex < 0 || roleIndex >= this.data.rotationMembers.length) {
      return;
    }
    const members = [...this.data.rotationMembers[roleIndex]];
    const target = memberIndex + delta;
    if (memberIndex < 0 || target < 0 || target >= members.length) {
      return;
    }
    const [moved] = members.splice(memberIndex, 1);
    members.splice(target, 0, moved);
    const next = members.map((member, position) => ({
      position: position + 1,
      scheduleRoleMemberId: member.scheduleRoleMemberId,
    }));
    this.setData({ errorMessage: '', submitting: true });
    try {
      await reorderRotationMembers(this.data.groupId, this.data.roleRows[roleIndex].id, {
        members: next,
      });
      await this.loadAll();
    } catch (error) {
      this.setData({ errorMessage: toErrorMessage(error) });
    } finally {
      this.setData({ submitting: false });
    }
  },

  async handleDeleteRole(event: WechatMiniprogram.TouchEvent): Promise<void> {
    const index = Number(event.currentTarget.dataset.index ?? -1);
    if (index < 0 || index >= this.data.roleRows.length) {
      return;
    }
    const role = this.data.roleRows[index];
    const confirmed = await confirmAction('删除岗位', `确定删除排班岗位“${role.name}”吗？`);
    if (!confirmed) {
      return;
    }
    this.setData({ errorMessage: '', submitting: true });
    try {
      await deleteScheduleRole(this.data.groupId, role.id);
      wx.showToast({ icon: 'success', title: '岗位已删除' });
      await this.loadAll();
    } catch (error) {
      this.setData({ errorMessage: toErrorMessage(error) });
    } finally {
      this.setData({ submitting: false });
    }
  },
});

function buildRows(config: SchedulingConfig): {
  readonly currentPositionInputs: readonly string[];
  readonly groupMembers: readonly { readonly membershipId: string; readonly realName: string }[];
  readonly memberNames: readonly string[];
  readonly roleRows: readonly RoleRow[];
  readonly rotationMembers: readonly (readonly RotationMemberRow[])[];
  readonly rotationNames: readonly (readonly string[])[];
  readonly shiftTypeNames: readonly string[];
  readonly shiftTypes: readonly ShiftType[];
  readonly startingMemberIndexes: readonly number[];
} {
  const memberNames = config.groupMembers.map((member) => member.realName);
  const shiftTypeNames = config.shiftTypes.map((shiftType) => shiftType.name);
  const groupMembers = config.groupMembers.map((member) => ({
    membershipId: member.membershipId,
    realName: member.realName,
  }));
  return {
    currentPositionInputs: config.roles.map((role) => String(role.rotationRule.currentPosition)),
    groupMembers,
    memberNames,
    roleRows: config.roles.map((role) => buildRoleRow(role, memberNames, config.shiftTypes)),
    rotationMembers: config.roles.map((role) => {
      const rotationMembers = role.members.map((member) => ({
        membershipId: member.membershipId,
        realName: member.realName,
        scheduleRoleMemberId: member.id,
      }));
      return rotationMembers;
    }),
    rotationNames: config.roles.map((role) => role.members.map((member) => member.realName)),
    shiftTypeNames,
    shiftTypes: config.shiftTypes,
    startingMemberIndexes: config.roles.map((role) => {
      const startingId = role.rotationRule.startingMemberScheduleRoleId;
      const index = role.members.findIndex((member) => member.id === startingId);
      return index < 0 ? 0 : index;
    }),
  };
}

function buildRoleRow(
  role: ScheduleRole,
  memberNames: readonly string[],
  shiftTypes: readonly ShiftType[],
): RoleRow {
  const selected = new Set(role.members.map((member) => member.membershipId));
  return {
    defaultShiftTypeIndex: defaultShiftTypeIndex(role, shiftTypes),
    id: role.id,
    memberChecked: memberNames.map((_, index) => selected.has(memberNames[index])),
    name: role.name,
    requiredMembersPerDay: String(role.rotationRule.requiredMembersPerDay),
    startDate: role.rotationRule.startDate ?? '',
    version: role.version,
  };
}

function defaultShiftTypeIndex(role: ScheduleRole, shiftTypes: readonly ShiftType[]): number {
  const index = shiftTypes.findIndex(
    (shiftType) => shiftType.id === role.rotationRule.defaultShiftTypeId,
  );
  return index < 0 ? 0 : index;
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
