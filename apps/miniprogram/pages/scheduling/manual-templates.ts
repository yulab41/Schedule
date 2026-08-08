import type {
  AppliedManualScheduleTemplateResult,
  GroupSummary,
  ManualApplyPreview,
  ManualScheduleTemplate,
  SchedulingConfig,
  ShiftType,
} from '@schedule/contracts';

import {
  applyManualScheduleTemplate,
  createManualScheduleTemplate,
  deleteManualScheduleTemplate,
  getSchedulingConfig,
  listGroups,
  listManualScheduleTemplates,
  previewManualTemplateApply,
  updateManualScheduleTemplate,
} from '../../api/endpoints.js';
import { resolveSelectedGroup, setSelectedGroupId } from '../../store/group.js';
import { randomUuid } from '../../utils/uuid.js';

interface TemplateRow {
  readonly id: string;
  readonly title: string;
  readonly version: number;
}

interface ApplyPreviewSummary {
  readonly assignmentCount: number;
  readonly conflictCount: number;
  readonly vacancyCount: number;
  readonly warningCount: number;
}

interface ManualTemplatesPageData {
  readonly applyEndDate: string;
  readonly applyPreview: ManualApplyPreview | undefined;
  readonly applyPreviewSummary: ApplyPreviewSummary | undefined;
  readonly applyPublishModeIndex: number;
  readonly applyReplaceDrafts: boolean;
  readonly applyReplacePublished: boolean;
  readonly applyStartDate: string;
  readonly applyTemplateId: string;
  readonly cellOptions: readonly string[];
  readonly cycleDays: string;
  readonly days: readonly number[];
  readonly editingId: string;
  readonly editingVersion: number;
  readonly errorMessage: string;
  readonly grid: readonly (readonly number[])[];
  readonly groupId: string;
  readonly groups: readonly GroupSummary[];
  readonly infoMessage: string;
  readonly loading: boolean;
  readonly memberIds: readonly string[];
  readonly memberNames: readonly string[];
  readonly roleIndex: number;
  readonly roleNames: readonly string[];
  readonly roles: SchedulingConfig['roles'];
  readonly shiftTypeNames: readonly string[];
  readonly shiftTypes: readonly ShiftType[];
  readonly startDate: string;
  readonly submitting: boolean;
  readonly templates: readonly TemplateRow[];
}

Page({
  data: {
    applyEndDate: '',
    applyPreview: undefined,
    applyPreviewSummary: undefined,
    applyPublishModeIndex: 0,
    applyReplaceDrafts: false,
    applyReplacePublished: false,
    applyStartDate: '',
    applyTemplateId: '',
    cellOptions: ['不排'],
    cycleDays: '7',
    days: [1, 2, 3, 4, 5, 6, 7],
    editingId: '',
    editingVersion: 0,
    errorMessage: '',
    grid: [],
    groupId: '',
    groups: [],
    infoMessage: '',
    loading: false,
    memberIds: [],
    memberNames: [],
    roleIndex: 0,
    roleNames: [],
    roles: [],
    shiftTypeNames: [],
    shiftTypes: [],
    startDate: '',
    submitting: false,
    templates: [],
  } as ManualTemplatesPageData,

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
        this.setData({ groups, templates: [] });
        return;
      }
      setSelectedGroupId(selected.id);
      const [config, templates] = await Promise.all([
        getSchedulingConfig(selected.id),
        listManualScheduleTemplates(selected.id),
      ]);
      const roleNames = config.roles.map((role) => role.name);
      const shiftTypeNames = config.shiftTypes.map((shiftType) => shiftType.name);
      this.setData({
        cellOptions: ['不排', ...shiftTypeNames],
        groupId: selected.id,
        groups,
        roleNames,
        roles: config.roles,
        shiftTypeNames,
        shiftTypes: config.shiftTypes,
        templates: templates.map((template) => buildTemplateRow(template)),
      });
    } catch (error) {
      this.setData({ errorMessage: toErrorMessage(error) });
    } finally {
      this.setData({ loading: false });
    }
  },

  handleRoleChange(event: WechatMiniprogram.PickerChange) {
    const roleIndex = Number(event.detail.value ?? 0);
    const role = this.data.roles[roleIndex];
    const memberIds = role === undefined ? [] : role.members.map((member) => member.membershipId);
    const memberNames = role === undefined ? [] : role.members.map((member) => member.realName);
    const cycleDays = clampCycleDays(this.data.cycleDays);
    this.setData({
      editingId: '',
      editingVersion: 0,
      grid: emptyGrid(cycleDays, memberIds.length),
      memberIds,
      memberNames,
      roleIndex,
    });
  },

  handleCycleDaysInput(event: WechatMiniprogram.Input) {
    this.setData({ cycleDays: event.detail.value });
  },

  applyCycleDays(): void {
    const cycleDays = clampCycleDays(this.data.cycleDays);
    const current = this.data.grid;
    const next = emptyGrid(cycleDays, this.data.memberIds.length);
    for (let day = 0; day < Math.min(current.length, cycleDays); day += 1) {
      for (
        let member = 0;
        member < Math.min(current[day].length, this.data.memberIds.length);
        member += 1
      ) {
        next[day][member] = current[day][member];
      }
    }
    this.setData({
      cycleDays: String(cycleDays),
      days: Array.from({ length: cycleDays }, (_, index) => index + 1),
      grid: next,
    });
  },

  handleStartDateChange(event: WechatMiniprogram.PickerChange) {
    this.setData({ startDate: String(event.detail.value ?? '') });
  },

  handleCellChange(event: WechatMiniprogram.PickerChange) {
    const day = Number(event.currentTarget.dataset.day ?? -1);
    const member = Number(event.currentTarget.dataset.member ?? -1);
    if (day < 0 || member < 0) {
      return;
    }
    this.setData({ [`grid[${day}][${member}]`]: Number(event.detail.value ?? 0) });
  },

  handleStartCreate(): void {
    const role = this.data.roles[this.data.roleIndex];
    const memberIds = role === undefined ? [] : role.members.map((member) => member.membershipId);
    const memberNames = role === undefined ? [] : role.members.map((member) => member.realName);
    const cycleDays = clampCycleDays(this.data.cycleDays);
    this.setData({
      applyPreview: undefined,
      applyPreviewSummary: undefined,
      applyTemplateId: '',
      editingId: '',
      editingVersion: 0,
      errorMessage: '',
      grid: emptyGrid(cycleDays, memberIds.length),
      memberIds,
      memberNames,
      startDate: '',
    });
  },

  handleStartEdit(event: WechatMiniprogram.TouchEvent) {
    const templateId = event.currentTarget.dataset.id;
    if (typeof templateId !== 'string') {
      return;
    }
    void this.loadTemplateForEdit(templateId);
  },

  async loadTemplateForEdit(templateId: string): Promise<void> {
    this.setData({ loading: true, errorMessage: '' });
    try {
      const [config, templates] = await Promise.all([
        getSchedulingConfig(this.data.groupId),
        listManualScheduleTemplates(this.data.groupId),
      ]);
      const template = templates.find((item) => item.id === templateId);
      if (template === undefined) {
        this.setData({ errorMessage: '模板不存在，请刷新后重试。' });
        return;
      }
      const roleIndex = Math.max(
        0,
        config.roles.findIndex((role) => role.id === template.scheduleRoleId),
      );
      const memberIds = template.members.map((member) => member.membershipId);
      const memberNames = template.members.map((member) => member.realName);
      const grid = buildGridFromTemplate(template, config.shiftTypes, memberIds);
      this.setData({
        applyPreview: undefined,
        applyPreviewSummary: undefined,
        applyTemplateId: '',
        cycleDays: String(template.cycleDays),
        days: Array.from({ length: template.cycleDays }, (_, index) => index + 1),
        editingId: template.id,
        editingVersion: template.version,
        grid,
        memberIds,
        memberNames,
        roleIndex,
        roles: config.roles,
        roleNames: config.roles.map((role) => role.name),
        shiftTypeNames: config.shiftTypes.map((shiftType) => shiftType.name),
        shiftTypes: config.shiftTypes,
        startDate: template.startDate,
      });
    } catch (error) {
      this.setData({ errorMessage: toErrorMessage(error) });
    } finally {
      this.setData({ loading: false });
    }
  },

  async handleSaveTemplate(): Promise<void> {
    const role = this.data.roles[this.data.roleIndex];
    const cycleDays = clampCycleDays(this.data.cycleDays);
    if (role === undefined) {
      this.setData({ errorMessage: '请选择排班岗位。' });
      return;
    }
    if (this.data.startDate.length === 0) {
      this.setData({ errorMessage: '请选择模板起始日期。' });
      return;
    }
    const cells: { cycleDay: number; membershipId: string; shiftTypeId: string }[] = [];
    this.data.grid.forEach((dayCells, day) => {
      dayCells.forEach((shiftTypeIndex, member) => {
        if (shiftTypeIndex <= 0) {
          return;
        }
        const shiftType = this.data.shiftTypes[shiftTypeIndex - 1];
        const membershipId = this.data.memberIds[member];
        if (shiftType !== undefined && membershipId !== undefined) {
          cells.push({
            cycleDay: day + 1,
            membershipId,
            shiftTypeId: shiftType.id,
          });
        }
      });
    });
    if (cells.length === 0) {
      this.setData({ errorMessage: '请至少为一个班次选择班种。' });
      return;
    }
    const base = {
      cells,
      cycleDays,
      membershipIds: this.data.memberIds,
      scheduleRoleId: role.id,
      startDate: this.data.startDate,
    };
    this.setData({ errorMessage: '', infoMessage: '', submitting: true });
    try {
      if (this.data.editingId.length === 0) {
        await createManualScheduleTemplate(this.data.groupId, base);
        wx.showToast({ icon: 'success', title: '模板已创建' });
      } else {
        await updateManualScheduleTemplate(this.data.groupId, this.data.editingId, {
          ...base,
          expectedVersion: this.data.editingVersion,
        });
        wx.showToast({ icon: 'success', title: '模板已保存' });
      }
      this.handleStartCreate();
      await this.loadAll();
    } catch (error) {
      this.setData({ errorMessage: toErrorMessage(error) });
    } finally {
      this.setData({ submitting: false });
    }
  },

  async handleDeleteTemplate(event: WechatMiniprogram.TouchEvent): Promise<void> {
    const templateId = event.currentTarget.dataset.id;
    if (typeof templateId !== 'string') {
      return;
    }
    const confirmed = await confirmAction('删除模板', '确定删除该手动排班模板吗？');
    if (!confirmed) {
      return;
    }
    this.setData({ errorMessage: '', infoMessage: '', submitting: true });
    try {
      await deleteManualScheduleTemplate(this.data.groupId, templateId);
      wx.showToast({ icon: 'success', title: '模板已删除' });
      await this.loadAll();
    } catch (error) {
      this.setData({ errorMessage: toErrorMessage(error) });
    } finally {
      this.setData({ submitting: false });
    }
  },

  handleSelectApply(event: WechatMiniprogram.TouchEvent) {
    const templateId = event.currentTarget.dataset.id;
    if (typeof templateId !== 'string') {
      return;
    }
    this.setData({
      applyEndDate: '',
      applyPreview: undefined,
      applyPreviewSummary: undefined,
      applyPublishModeIndex: 0,
      applyReplaceDrafts: false,
      applyReplacePublished: false,
      applyStartDate: '',
      applyTemplateId: templateId,
      errorMessage: '',
    });
  },

  handleApplyStartDateChange(event: WechatMiniprogram.PickerChange) {
    this.setData({ applyStartDate: String(event.detail.value ?? '') });
  },

  handleApplyEndDateChange(event: WechatMiniprogram.PickerChange) {
    this.setData({ applyEndDate: String(event.detail.value ?? '') });
  },

  handleApplyPublishModeChange(event: WechatMiniprogram.PickerChange) {
    this.setData({ applyPublishModeIndex: Number(event.detail.value ?? 0) });
  },

  handleApplyReplaceDraftsChange(event: WechatMiniprogram.SwitchChange) {
    this.setData({ applyReplaceDrafts: event.detail.value });
  },

  handleApplyReplacePublishedChange(event: WechatMiniprogram.SwitchChange) {
    this.setData({ applyReplacePublished: event.detail.value });
  },

  async handlePreviewApply(): Promise<void> {
    if (this.data.applyTemplateId.length === 0) {
      return;
    }
    this.setData({ errorMessage: '', infoMessage: '', submitting: true });
    try {
      const config = await getSchedulingConfig(this.data.groupId);
      const preview = await previewManualTemplateApply(
        this.data.groupId,
        this.data.applyTemplateId,
        {
          expectedRulesVersion: config.rulesVersion,
          ...(this.data.applyStartDate.length === 0 ? {} : { startDate: this.data.applyStartDate }),
          ...(this.data.applyEndDate.length === 0 ? {} : { endDate: this.data.applyEndDate }),
        },
      );
      this.setData({
        applyPreview: preview,
        applyPreviewSummary: {
          assignmentCount: preview.assignments.length,
          conflictCount: preview.conflicts.length,
          vacancyCount: preview.vacancies.length,
          warningCount: preview.continuousDutyWarnings.length,
        },
      });
    } catch (error) {
      this.setData({ errorMessage: toErrorMessage(error) });
    } finally {
      this.setData({ submitting: false });
    }
  },

  async handleApply(): Promise<void> {
    const preview = this.data.applyPreview;
    if (preview === undefined || this.data.applyTemplateId.length === 0) {
      return;
    }
    const confirmed = await confirmAction(
      '应用手动模板',
      `将按模板生成 ${preview.assignments.length} 条排班记录，确定应用吗？`,
    );
    if (!confirmed) {
      return;
    }
    this.setData({ errorMessage: '', infoMessage: '', submitting: true });
    try {
      const config = await getSchedulingConfig(this.data.groupId);
      const result: AppliedManualScheduleTemplateResult = await applyManualScheduleTemplate(
        this.data.groupId,
        this.data.applyTemplateId,
        {
          acknowledgeBlockers: preview.conflicts.length > 0,
          expectedRulesVersion: config.rulesVersion,
          operationId: randomUuid(),
          publishMode: this.data.applyPublishModeIndex === 1 ? 'published' : 'draft',
          replaceExistingDrafts: this.data.applyReplaceDrafts,
          replacePublished: this.data.applyReplacePublished,
          ...(this.data.applyStartDate.length === 0 ? {} : { startDate: this.data.applyStartDate }),
          ...(this.data.applyEndDate.length === 0 ? {} : { endDate: this.data.applyEndDate }),
        },
      );
      this.setData({
        applyPreview: undefined,
        applyPreviewSummary: undefined,
        applyTemplateId: '',
        infoMessage: result.status === 'published' ? '模板已应用并发布。' : '模板已应用为草稿。',
      });
      await this.loadAll();
    } catch (error) {
      this.setData({ errorMessage: toErrorMessage(error) });
    } finally {
      this.setData({ submitting: false });
    }
  },
});

function buildTemplateRow(template: ManualScheduleTemplate): TemplateRow {
  return {
    id: template.id,
    title: `${template.scheduleRoleName} · ${template.startDate} · ${template.cycleDays} 天`,
    version: template.version,
  };
}

function buildGridFromTemplate(
  template: ManualScheduleTemplate,
  shiftTypes: readonly ShiftType[],
  memberIds: readonly string[],
): number[][] {
  const grid = emptyGrid(template.cycleDays, memberIds.length);
  template.cells.forEach((cell) => {
    const day = cell.cycleDay - 1;
    const member = memberIds.indexOf(cell.membershipId);
    const shiftTypeIndex = shiftTypes.findIndex((shiftType) => shiftType.id === cell.shiftTypeId);
    if (day >= 0 && day < grid.length && member >= 0 && shiftTypeIndex >= 0) {
      grid[day][member] = shiftTypeIndex + 1;
    }
  });
  return grid;
}

function emptyGrid(cycleDays: number, memberCount: number): number[][] {
  return Array.from({ length: cycleDays }, () => Array.from({ length: memberCount }, () => 0));
}

function clampCycleDays(value: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) {
    return 7;
  }
  return Math.min(31, Math.max(1, parsed));
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
