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
import { getCycleDateColumns } from '../../../../features/manual-schedule/manual-grid-logic.js';
import { resolveManualScheduleRouteContext } from '../../../../features/navigation/workbench-navigation.js';
import { guardMiniprogramRoute } from '../../../../features/navigation/route-guard.js';
import { getCalendarCacheRuntime } from '../../../../store/calendar-cache-runtime.js';
import { sessionStore } from '../../../../store/session.js';
import { createLeaveWorkflowOperationId } from '../../../../features/workflows/leave-workflow.js';

interface EditorData {
  readonly draftGroups: readonly {
    readonly businessMonths: string;
    readonly operationId: string;
    readonly periodIds: string;
    readonly scheduleRoleNames: string;
  }[];
  readonly errorMessage: string;
  readonly gridColumns: readonly unknown[];
  readonly gridRows: readonly unknown[];
  readonly isSaving: boolean;
  readonly isApplying: boolean;
  readonly lockedShiftName: string;
  readonly shifts: readonly unknown[];
  readonly state: ManualScheduleState;
  readonly templateNames: readonly string[];
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
  const columns =
    draft === undefined
      ? []
      : getCycleDateColumns(draft.startDate, draft.cycleDays).map((column) => ({
          ...column,
          holidayName:
            state.holidays?.dates.find(({ date }) => date === column.date)?.holidayName ?? '',
        }));
  const shifts = (state.config?.shiftTypes ?? []).map((shift) => ({
    abbreviation: shift.abbreviation,
    color: shift.color,
    id: shift.id,
    isEnabled: shift.isEnabled,
    name: shift.name,
    textColor: shift.textColor,
  }));
  const template = state.templates.find(({ id }) => id === state.selectedTemplateId);
  const lockedShiftName = shifts.find(({ id }) => id === draft?.lockedShiftTypeId)?.name ?? '';
  const staleCells = new Set(
    template?.cells
      .filter(({ isStale }) => isStale)
      .map(({ cycleDay, membershipId }) => `${cycleDay}:${membershipId}`) ?? [],
  );
  const role = state.config?.roles.find(({ id }) => id === draft?.scheduleRoleId);
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
  const gridRows = (draft?.membershipIds ?? []).map((membershipId) => ({
    cells: columns.map((column) => {
      const cell = draft?.cells[`${column.cycleDay}:${membershipId}`];
      const shift = shifts.find(({ id }) => id === cell?.shiftTypeId);
      return {
        abbreviation: shift?.abbreviation ?? '',
        color: shift?.color ?? '',
        cycleDay: column.cycleDay,
        isSelected:
          draft?.selectedCell?.cycleDay === column.cycleDay &&
          draft.selectedCell.membershipId === membershipId,
        isStale: staleCells.has(`${column.cycleDay}:${membershipId}`),
        key: `${column.cycleDay}:${membershipId}`,
        textColor: shift?.textColor ?? '',
      };
    }),
    isStale:
      template?.members.some((member) => member.membershipId === membershipId && member.isStale) ??
      false,
    membershipId,
    realName: names.get(membershipId) ?? '已离岗成员',
  }));
  return {
    draftGroups,
    errorMessage: state.conflict?.message ?? state.errorMessage ?? '',
    gridColumns: columns,
    gridRows,
    isSaving: state.isSaving,
    isApplying: state.isApplying,
    lockedShiftName,
    shifts,
    state,
    templateIds: state.templates.map(({ id }) => id),
    templateNames: state.templates.map(({ scheduleRoleName }) => scheduleRoleName),
  };
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
    const index = Number(event.detail.value);
    const id = viewData().templateIds[index];
    if (id !== undefined) {
      controller.chooseTemplate(id);
      this.sync();
    }
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
    void controller.previewApply().finally(() => this.sync());
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
