import {
  applyManualScheduleTemplate,
  createManualScheduleTemplate,
  deleteManualScheduleTemplate,
  getHolidays,
  getSchedulingConfig,
  listManualScheduleTemplates,
  listScheduleDrafts,
  listSchedulePeriodHistory,
  previewManualTemplateApply,
  previewScheduleChange,
  publishScheduleDraftBatch,
  updateManualScheduleTemplate,
  withdrawSchedulePeriod,
} from '../../../../api/endpoints.js';
import { navigateForCurrentSession } from '../../../../features/auth/auth-runtime.js';
import {
  createManualScheduleController,
  type ManualScheduleState,
} from '../../../../features/manual-schedule/manual-schedule-controller.js';
import {
  getCycleDateColumns,
  isManualTemplateCellSnapshotCurrent,
} from '../../../../features/manual-schedule/manual-grid-logic.js';
import { resolveManualScheduleRouteContext } from '../../../../features/navigation/workbench-navigation.js';
import { guardMiniprogramRoute } from '../../../../features/navigation/route-guard.js';
import { getCalendarCacheRuntime } from '../../../../store/calendar-cache-runtime.js';
import { sessionStore } from '../../../../store/session.js';
import { createLeaveWorkflowOperationId } from '../../../../features/workflows/leave-workflow.js';

interface EditorData {
  readonly availableShifts: readonly unknown[];
  readonly canSave: boolean;
  readonly canUndo: boolean;
  readonly cycleDayIndex: number;
  readonly cycleDayOptions: readonly { readonly label: string; readonly value: number }[];
  readonly draftGroups: readonly {
    readonly businessMonths: string;
    readonly operationId: string;
    readonly periodIds: string;
    readonly scheduleRoleNames: string;
  }[];
  readonly errorMessage: string;
  readonly gridColumns: readonly unknown[];
  readonly gridRows: readonly unknown[];
  readonly hasSelectedRole: boolean;
  readonly isSaving: boolean;
  readonly isApplying: boolean;
  readonly lockedShiftName: string;
  readonly memberOptions: readonly {
    readonly checked: boolean;
    readonly isStale: boolean;
    readonly membershipId: string;
    readonly realName: string;
  }[];
  readonly roleIds: readonly string[];
  readonly roleIndex: number;
  readonly roleOptions: readonly { readonly id: string; readonly label: string }[];
  readonly selectedCycleDays: number;
  readonly selectedRoleName: string;
  readonly selectedStartDate: string;
  readonly selectedTemplateIndex: number;
  readonly selectedTemplateLabel: string;
  readonly state: ManualScheduleState;
  readonly templateOptions: readonly { readonly id: string; readonly label: string }[];
  readonly templateIds: readonly string[];
}
const controller = createManualScheduleController({
  applyManualScheduleTemplate,
  createManualScheduleTemplate,
  createOperationId: createLeaveWorkflowOperationId,
  deleteManualScheduleTemplate,
  getHolidays,
  getSchedulingConfig,
  invalidateCalendarMonth: (identity) => getCalendarCacheRuntime().invalidate(identity),
  listManualScheduleTemplates,
  listScheduleDrafts,
  listSchedulePeriodHistory,
  previewManualTemplateApply,
  previewScheduleChange,
  publishScheduleDraftBatch,
  publish: () => undefined,
  updateManualScheduleTemplate,
  withdrawSchedulePeriod,
});

function viewData(): EditorData {
  const state = controller.state;
  const draft = state.draft;
  const holidayNames = new Map(
    state.holidays.flatMap(({ dates }) =>
      dates.map(({ date, holidayName }) => [date, holidayName] as const),
    ),
  );
  const columns =
    draft === undefined
      ? []
      : getCycleDateColumns(draft.startDate, draft.cycleDays).map((column) => ({
          ...column,
          holidayName: holidayNames.get(column.date) ?? '',
        }));
  const allShifts = (state.config?.shiftTypes ?? []).map((shift) => ({
    abbreviation: shift.abbreviation,
    color: shift.color,
    id: shift.id,
    isEnabled: shift.isEnabled,
    name: shift.name,
    textColor: shift.textColor,
  }));
  const template = state.templates.find(({ id }) => id === state.selectedTemplateId);
  const lockedShiftName = allShifts.find(({ id }) => id === draft?.lockedShiftTypeId)?.name ?? '';
  const role = state.config?.roles.find(({ id }) => id === draft?.scheduleRoleId);
  const roleOptions = [
    { id: '', label: '请选择排班岗位' },
    ...(state.config?.roles ?? []).map(({ id, name }) => ({ id, label: name })),
  ];
  const roleIndex = Math.max(
    0,
    roleOptions.findIndex(({ id }) => id === draft?.scheduleRoleId),
  );
  const operationIdsByPeriod = new Map(
    state.history.map(({ id, operationId }) => [id, operationId] as const),
  );
  const draftGroups = Array.from(
    state.drafts.reduce((groups, period) => {
      const operationId = operationIdsByPeriod.get(period.id) ?? period.id;
      const current = groups.get(operationId) ?? [];
      groups.set(operationId, [...current, period]);
      return groups;
    }, new Map<string, readonly (typeof state.drafts)[number][]>()),
  ).map(([operationId, periods]) => ({
    businessMonths: periods.map(({ businessMonth }) => businessMonth).join('、'),
    operationId,
    periodIds: periods.map(({ id }) => id).join(','),
    scheduleRoleNames: periods.map(({ scheduleRoleName }) => scheduleRoleName).join('、'),
  }));
  const names = new Map<string, string>([
    ...(role?.members ?? []).map(({ membershipId, realName }) => [membershipId, realName] as const),
    ...(template?.members ?? []).map(
      ({ membershipId, realName }) => [membershipId, realName] as const,
    ),
  ]);
  const currentMemberIds = new Set((role?.members ?? []).map(({ membershipId }) => membershipId));
  const memberOptions = [
    ...(role?.members ?? []).map(({ membershipId, realName }) => ({
      checked: draft?.membershipIds.includes(membershipId) ?? false,
      isStale: false,
      membershipId,
      realName,
    })),
    ...(draft?.membershipIds ?? [])
      .filter((membershipId) => !currentMemberIds.has(membershipId))
      .map((membershipId) => ({
        checked: true,
        isStale: true,
        membershipId,
        realName: names.get(membershipId) ?? '已离岗成员',
      })),
  ];
  const gridRows = (draft?.membershipIds ?? []).map((membershipId) => ({
    cells: columns.map((column) => {
      const cell = draft?.cells[`${column.cycleDay}:${membershipId}`];
      const shift = allShifts.find(({ id }) => id === cell?.shiftTypeId);
      const savedCell = template?.cells.find(
        (candidate) =>
          candidate.cycleDay === column.cycleDay && candidate.membershipId === membershipId,
      );
      const currentSavedCell = isManualTemplateCellSnapshotCurrent(cell, savedCell)
        ? savedCell
        : undefined;
      return {
        abbreviation: shift?.abbreviation ?? currentSavedCell?.shiftTypeAbbreviation ?? '',
        color: shift?.color ?? currentSavedCell?.shiftTypeColor ?? '',
        cycleDay: column.cycleDay,
        isSelected:
          draft?.selectedCell?.cycleDay === column.cycleDay &&
          draft.selectedCell.membershipId === membershipId,
        isStale: currentSavedCell?.isStale ?? false,
        key: `${column.cycleDay}:${membershipId}`,
        textColor: shift?.textColor ?? currentSavedCell?.shiftTypeTextColor ?? '',
      };
    }),
    isStale:
      template?.members.some((member) => member.membershipId === membershipId && member.isStale) ??
      false,
    membershipId,
    realName: names.get(membershipId) ?? '已离岗成员',
  }));
  const templateOptions = [
    { id: '', label: '新建模板' },
    ...state.templates.map((item) => ({
      id: item.id,
      label: `${item.scheduleRoleName} · ${item.startDate} · ${item.cycleDays}天`,
    })),
  ];
  const selectedTemplateIndex = Math.max(
    0,
    templateOptions.findIndex(({ id }) => id === state.selectedTemplateId),
  );
  const cycleDayOptions = Array.from({ length: 31 }, (_, index) => ({
    label: `${index + 1} 天`,
    value: index + 1,
  }));
  return {
    availableShifts: allShifts.filter((shift) => shift.isEnabled),
    canSave: draft !== undefined && draft.membershipIds.length > 0 && columns.length > 0,
    canUndo: (draft?.undo.length ?? 0) > 0,
    cycleDayIndex: Math.max(0, (draft?.cycleDays ?? 1) - 1),
    cycleDayOptions,
    draftGroups,
    errorMessage: state.conflict?.message ?? state.errorMessage ?? '',
    gridColumns: columns,
    gridRows,
    hasSelectedRole: role !== undefined,
    isSaving: state.isSaving,
    isApplying: state.isApplying,
    lockedShiftName,
    memberOptions,
    roleIds: roleOptions.map(({ id }) => id),
    roleIndex,
    roleOptions,
    selectedCycleDays: draft?.cycleDays ?? 7,
    selectedRoleName: role?.name ?? roleOptions[0]?.label ?? '请选择排班岗位',
    selectedStartDate: draft?.startDate ?? '',
    selectedTemplateIndex,
    selectedTemplateLabel: templateOptions[selectedTemplateIndex]?.label ?? '新建模板',
    state,
    templateIds: templateOptions.map(({ id }) => id),
    templateOptions,
  };
}

function pickerIndex(value: unknown, optionCount: number): number | undefined {
  if (typeof value !== 'string' || !/^(0|[1-9]\d*)$/u.test(value)) return undefined;
  const index = Number(value);
  return index >= 0 && index < optionCount ? index : undefined;
}

Page({
  data: viewData(),
  selectedGroupId: undefined as string | undefined,
  onLoad(options: Record<string, string | undefined>): void {
    this.selectedGroupId = typeof options.groupId === 'string' ? options.groupId : undefined;
  },
  onHide(): void {
    controller.deactivate();
  },
  onShow(): void {
    this.refresh();
  },
  refresh(): void {
    const session = sessionStore.state;
    if (session.status !== 'authenticated' || session.profile === undefined) {
      navigateForCurrentSession();
      return;
    }
    if (
      !guardMiniprogramRoute(
        session,
        '/subpackages/manual-schedule/pages/editor/index',
        {
          hideTabBar: () => wx.hideTabBar({}),
          reLaunch: (options) => wx.reLaunch(options),
          showTabBar: () => wx.showTabBar({}),
          switchTab: (options) => wx.switchTab(options),
        },
        this.selectedGroupId,
      )
    )
      return;
    const context =
      this.selectedGroupId === undefined
        ? undefined
        : resolveManualScheduleRouteContext(session.groups, this.selectedGroupId);
    if (context === undefined) {
      wx.switchTab({ url: '/pages/workbench/index' });
      return;
    }
    controller.activate({ ...context, userId: session.profile.id });
    this.sync();
    void controller.load().finally(() => this.sync());
  },
  sync(): void {
    this.setData(viewData());
  },
  handleCell(
    event: WechatMiniprogram.CustomEvent<{
      readonly cycleDay?: unknown;
      readonly membershipId?: unknown;
    }>,
  ): void {
    const { cycleDay, membershipId } = event.detail;
    if (typeof cycleDay === 'number' && typeof membershipId === 'string') {
      if (controller.state.draft?.lockedShiftTypeId === undefined)
        controller.selectCell({ cycleDay, membershipId });
      else controller.applyLockedShift({ cycleDay, membershipId });
      this.sync();
    }
  },
  handleShift(event: WechatMiniprogram.CustomEvent<{ readonly shiftId?: unknown }>): void {
    const shiftId = event.detail.shiftId;
    const shift = controller.state.config?.shiftTypes.find(({ id }) => id === shiftId);
    if (shift !== undefined) {
      if (controller.state.draft?.selectedCell === undefined)
        controller.lockShift({ id: shift.id, isEnabled: shift.isEnabled });
      else controller.applyShift({ id: shift.id, isEnabled: shift.isEnabled });
      this.sync();
    }
  },
  handleLongPress(
    event: WechatMiniprogram.CustomEvent<{
      readonly cycleDay?: unknown;
      readonly membershipId?: unknown;
    }>,
  ): void {
    const { cycleDay, membershipId } = event.detail;
    if (typeof cycleDay !== 'number' || typeof membershipId !== 'string') return;
    wx.showActionSheet({
      itemList: ['清空此格', '清空此行', '清空此列'],
      success: ({ tapIndex }) => {
        if (tapIndex === 0) controller.clearCell({ cycleDay, membershipId });
        else
          wx.showModal({
            title: '确认清空',
            content: tapIndex === 1 ? '确认清空该成员整行吗？' : '确认清空该日期整列吗？',
            success: ({ confirm }) => {
              if (confirm) {
                if (tapIndex === 1) controller.clearRow(membershipId);
                else controller.clearColumn(cycleDay);
                this.sync();
              }
            },
          });
        this.sync();
      },
    });
  },
  handleUndo(): void {
    controller.undo();
    this.sync();
  },
  handleUnlockShift(): void {
    controller.unlockShift();
    this.sync();
  },
  handleContinueEditing(): void {
    controller.discardConflict();
    this.sync();
  },
  handleReloadAuthority(): void {
    void controller.reloadAuthoritativeDraft().finally(() => this.sync());
  },
  handleTemplate(event: WechatMiniprogram.PickerChange): void {
    const data = viewData();
    const index = pickerIndex(event.detail.value, data.templateIds.length);
    const id = index === undefined ? undefined : data.templateIds[index];
    if (id === undefined) return;
    if (id === '') controller.startNewTemplate();
    else controller.chooseTemplate(id);
    this.sync();
    if (id !== '') void controller.refreshHolidays().finally(() => this.sync());
  },
  handleRole(event: WechatMiniprogram.PickerChange): void {
    const data = viewData();
    const index = pickerIndex(event.detail.value, data.roleIds.length);
    const roleId = index === undefined ? undefined : data.roleIds[index];
    if (roleId !== undefined) {
      const previousDraft = controller.state.draft;
      controller.selectScheduleRole(roleId);
      this.sync();
      if (previousDraft === undefined) void controller.refreshHolidays().finally(() => this.sync());
    }
  },
  handleStartDate(event: WechatMiniprogram.PickerChange): void {
    const value = event.detail.value;
    if (typeof value !== 'string') return;
    controller.setStartDate(value);
    this.sync();
    void controller.refreshHolidays().finally(() => this.sync());
  },
  handleCycleDays(event: WechatMiniprogram.PickerChange): void {
    const data = viewData();
    const index = pickerIndex(event.detail.value, data.cycleDayOptions.length);
    const option = index === undefined ? undefined : data.cycleDayOptions[index];
    if (option === undefined) return;
    controller.setCycleDays(option.value);
    this.sync();
    void controller.refreshHolidays().finally(() => this.sync());
  },
  handleMembers(event: WechatMiniprogram.CustomEvent<{ readonly value?: unknown }>): void {
    const value = event.detail.value;
    if (!Array.isArray(value) || !value.every((item) => typeof item === 'string')) return;
    controller.setMembershipIds(value);
    this.sync();
  },
  handleSave(): void {
    void controller.save().finally(() => this.sync());
  },
  handleDelete(): void {
    wx.showModal({
      title: '删除模板',
      content: '删除后不可恢复，确认继续吗？',
      success: ({ confirm }) => {
        if (confirm) void controller.removeSelectedTemplate().finally(() => this.sync());
      },
    });
  },
  handlePreviewApply(): void {
    void controller.previewApply(controller.state.draft?.startDate).finally(() => this.sync());
  },
  handleApplyPreview(): void {
    wx.showModal({
      title: '确认应用模板',
      content: '确认后将由服务端重新校验并生成排班草稿或发布版本。',
      success: ({ confirm }) => {
        if (confirm) void controller.applyPreview().finally(() => this.sync());
      },
    });
  },
  handlePublishDrafts(
    event: WechatMiniprogram.BaseEvent<Record<string, never>, { readonly periodIds?: unknown }>,
  ): void {
    const joinedPeriodIds = event.currentTarget.dataset.periodIds;
    const periodIds =
      typeof joinedPeriodIds === 'string'
        ? joinedPeriodIds.split(',').filter((id) => id.length > 0)
        : [];
    if (periodIds.length === 0) return;
    wx.showModal({
      title: '确认发布草稿',
      content: '将发布本次应用生成的草稿，服务端仍会最终校验。',
      success: ({ confirm }) => {
        if (confirm) void controller.publishDrafts(periodIds).finally(() => this.sync());
      },
    });
  },
  handleWithdraw(
    event: WechatMiniprogram.BaseEvent<Record<string, never>, { readonly periodId?: unknown }>,
  ): void {
    const periodId = event.currentTarget.dataset.periodId;
    if (typeof periodId !== 'string') return;
    void controller.previewWithdraw(periodId).finally(() => this.sync());
  },
  handleWithdrawPreview(): void {
    wx.showModal({
      title: '确认撤回',
      content: '将先检查受影响的工作流，再由服务端确认撤回。',
      success: ({ confirm }) => {
        if (confirm) void controller.withdrawPreview().finally(() => this.sync());
      },
    });
  },
});
