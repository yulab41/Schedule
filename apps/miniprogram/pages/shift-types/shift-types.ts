import type { GroupSummary } from '@schedule/contracts';

import {
  createShiftType,
  deleteShiftType,
  getSchedulingConfig,
  listGroups,
  updateShiftType,
} from '../../api/endpoints.js';
import { resolveSelectedGroup, setSelectedGroupId } from '../../store/group.js';

interface ShiftTypeRow {
  readonly abbreviation: string;
  readonly color: string;
  readonly countsTowardStatistics: boolean;
  readonly crossesMidnight: boolean;
  readonly endTime: string;
  readonly id: string;
  readonly isAllDay: boolean;
  readonly isBuiltIn: boolean;
  readonly isEnabled: boolean;
  readonly name: string;
  readonly startTime: string;
}

interface ShiftTypesPageData {
  readonly errorMessage: string;
  readonly groupId: string;
  readonly groups: readonly GroupSummary[];
  readonly loading: boolean;
  readonly newShift: ShiftTypeRow;
  readonly shiftTypes: readonly ShiftTypeRow[];
  readonly submitting: boolean;
}

Page({
  data: {
    errorMessage: '',
    groupId: '',
    groups: [],
    loading: false,
    newShift: createEmptyShift(),
    shiftTypes: [],
    submitting: false,
  } as ShiftTypesPageData,

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
        this.setData({ groups, shiftTypes: [] });
        return;
      }
      setSelectedGroupId(selected.id);
      const config = await getSchedulingConfig(selected.id);
      this.setData({
        groupId: selected.id,
        groups,
        shiftTypes: config.shiftTypes.map(toShiftTypeRow),
      });
    } catch (error) {
      this.setData({ errorMessage: toErrorMessage(error) });
    } finally {
      this.setData({ loading: false });
    }
  },

  handleNewFieldInput(event: WechatMiniprogram.Input) {
    const field = event.currentTarget.dataset.field;
    if (typeof field !== 'string') {
      return;
    }
    this.setData({ [`newShift.${field}`]: event.detail.value });
  },

  handleNewTimeChange(event: WechatMiniprogram.PickerChange) {
    const field = event.currentTarget.dataset.field;
    if (typeof field !== 'string') {
      return;
    }
    this.setData({ [`newShift.${field}`]: String(event.detail.value ?? '') });
  },

  handleNewSwitchChange(event: WechatMiniprogram.SwitchChange) {
    const field = event.currentTarget.dataset.field;
    if (typeof field !== 'string') {
      return;
    }
    this.setData({ [`newShift.${field}`]: event.detail.value });
  },

  async handleCreateShift(): Promise<void> {
    const shift = this.data.newShift;
    const errorMessage = validateShift(shift);
    if (errorMessage !== '') {
      this.setData({ errorMessage });
      return;
    }
    this.setData({ errorMessage: '', submitting: true });
    try {
      await createShiftType(this.data.groupId, toShiftTypeInput(shift));
      this.setData({ newShift: createEmptyShift() });
      wx.showToast({ icon: 'success', title: '班种已创建' });
      await this.loadAll();
    } catch (error) {
      this.setData({ errorMessage: toErrorMessage(error) });
    } finally {
      this.setData({ submitting: false });
    }
  },

  handleFieldInput(event: WechatMiniprogram.Input) {
    const index = Number(event.currentTarget.dataset.index ?? -1);
    const field = event.currentTarget.dataset.field;
    if (index < 0 || index >= this.data.shiftTypes.length || typeof field !== 'string') {
      return;
    }
    this.setData({ [`shiftTypes[${index}].${field}`]: event.detail.value });
  },

  handleTimeChange(event: WechatMiniprogram.PickerChange) {
    const index = Number(event.currentTarget.dataset.index ?? -1);
    const field = event.currentTarget.dataset.field;
    if (index < 0 || index >= this.data.shiftTypes.length || typeof field !== 'string') {
      return;
    }
    this.setData({ [`shiftTypes[${index}].${field}`]: String(event.detail.value ?? '') });
  },

  handleSwitchChange(event: WechatMiniprogram.SwitchChange) {
    const index = Number(event.currentTarget.dataset.index ?? -1);
    const field = event.currentTarget.dataset.field;
    if (index < 0 || index >= this.data.shiftTypes.length || typeof field !== 'string') {
      return;
    }
    this.setData({ [`shiftTypes[${index}].${field}`]: event.detail.value });
  },

  async handleSaveShift(event: WechatMiniprogram.TouchEvent): Promise<void> {
    const index = Number(event.currentTarget.dataset.index ?? -1);
    if (index < 0 || index >= this.data.shiftTypes.length) {
      return;
    }
    const shift = this.data.shiftTypes[index];
    const errorMessage = validateShift(shift);
    if (errorMessage !== '') {
      this.setData({ errorMessage });
      return;
    }
    this.setData({ errorMessage: '', submitting: true });
    try {
      await updateShiftType(this.data.groupId, shift.id, toShiftTypeInput(shift));
      wx.showToast({ icon: 'success', title: '班种已保存' });
      await this.loadAll();
    } catch (error) {
      this.setData({ errorMessage: toErrorMessage(error) });
    } finally {
      this.setData({ submitting: false });
    }
  },

  async handleDeleteShift(event: WechatMiniprogram.TouchEvent): Promise<void> {
    const index = Number(event.currentTarget.dataset.index ?? -1);
    if (index < 0 || index >= this.data.shiftTypes.length) {
      return;
    }
    const shift = this.data.shiftTypes[index];
    const confirmed = await confirmAction('删除班种', `确定删除班种“${shift.name}”吗？`);
    if (!confirmed) {
      return;
    }
    this.setData({ errorMessage: '', submitting: true });
    try {
      await deleteShiftType(this.data.groupId, shift.id);
      wx.showToast({ icon: 'success', title: '班种已删除' });
      await this.loadAll();
    } catch (error) {
      this.setData({ errorMessage: toErrorMessage(error) });
    } finally {
      this.setData({ submitting: false });
    }
  },
});

function toShiftTypeRow(shiftType: {
  readonly abbreviation: string;
  readonly color: string;
  readonly countsTowardStatistics: boolean;
  readonly crossesMidnight: boolean;
  readonly endTime?: string;
  readonly id: string;
  readonly isAllDay: boolean;
  readonly isBuiltIn: boolean;
  readonly isEnabled: boolean;
  readonly name: string;
  readonly startTime?: string;
}): ShiftTypeRow {
  return {
    abbreviation: shiftType.abbreviation,
    color: shiftType.color,
    countsTowardStatistics: shiftType.countsTowardStatistics,
    crossesMidnight: shiftType.crossesMidnight,
    endTime: shiftType.endTime ?? '',
    id: shiftType.id,
    isAllDay: shiftType.isAllDay,
    isBuiltIn: shiftType.isBuiltIn,
    isEnabled: shiftType.isEnabled,
    name: shiftType.name,
    startTime: shiftType.startTime ?? '',
  };
}

function createEmptyShift(): ShiftTypeRow {
  return {
    abbreviation: '',
    color: '#1F5AA6',
    countsTowardStatistics: true,
    crossesMidnight: false,
    endTime: '',
    id: '',
    isAllDay: false,
    isBuiltIn: false,
    isEnabled: false,
    name: '',
    startTime: '',
  };
}

function validateShift(shift: ShiftTypeRow): string {
  if (shift.name.trim().length === 0) {
    return '请填写班种名称。';
  }
  if (shift.abbreviation.trim().length === 0) {
    return '请填写班种简称。';
  }
  if (!/^#[0-9a-fA-F]{6}$/u.test(shift.color)) {
    return '颜色必须是 #RRGGBB 格式。';
  }
  if (!shift.isAllDay) {
    if (shift.startTime.length === 0 || shift.endTime.length === 0) {
      return '非全天班种必须填写开始与结束时间。';
    }
  }
  return '';
}

function toShiftTypeInput(shift: ShiftTypeRow) {
  return {
    abbreviation: shift.abbreviation.trim(),
    color: shift.color.toUpperCase(),
    countsTowardStatistics: shift.countsTowardStatistics,
    crossesMidnight: shift.crossesMidnight,
    endTime: shift.endTime.length === 0 ? null : shift.endTime,
    isEnabled: shift.isEnabled,
    name: shift.name.trim(),
    startTime: shift.startTime.length === 0 ? null : shift.startTime,
  };
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
