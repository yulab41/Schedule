import {
  createManualScheduleTemplate,
  deleteManualScheduleTemplate,
  getHolidays,
  getSchedulingConfig,
  listManualScheduleTemplates,
  listSchedulePeriodHistory,
  updateManualScheduleTemplate,
} from '../../../../api/endpoints.js';
import { navigateForCurrentSession } from '../../../../features/auth/auth-runtime.js';
import {
  createManualScheduleController,
  type ManualScheduleState,
} from '../../../../features/manual-schedule/manual-schedule-controller.js';
import { getCycleDateColumns } from '../../../../features/manual-schedule/manual-grid-logic.js';
import { resolveManualScheduleRouteContext } from '../../../../features/navigation/workbench-navigation.js';
import { guardMiniprogramRoute } from '../../../../features/navigation/route-guard.js';
import { sessionStore } from '../../../../store/session.js';

interface EditorData {
  readonly errorMessage: string;
  readonly gridColumns: readonly unknown[];
  readonly gridRows: readonly unknown[];
  readonly isSaving: boolean;
  readonly shifts: readonly unknown[];
  readonly state: ManualScheduleState;
  readonly templateNames: readonly string[];
  readonly templateIds: readonly string[];
}
const controller = createManualScheduleController({
  createManualScheduleTemplate,
  deleteManualScheduleTemplate,
  getHolidays,
  getSchedulingConfig,
  listManualScheduleTemplates,
  listSchedulePeriodHistory,
  publish: () => undefined,
  updateManualScheduleTemplate,
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
  const staleCells = new Set(
    template?.cells
      .filter(({ isStale }) => isStale)
      .map(({ cycleDay, membershipId }) => `${cycleDay}:${membershipId}`) ?? [],
  );
  const role = state.config?.roles.find(({ id }) => id === draft?.scheduleRoleId);
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
    errorMessage: state.conflict?.message ?? state.errorMessage ?? '',
    gridColumns: columns,
    gridRows,
    isSaving: state.isSaving,
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
      controller.selectCell({ cycleDay, membershipId });
      this.sync();
    }
  },
  handleShift(event: WechatMiniprogram.CustomEvent<{ readonly shiftId?: unknown }>): void {
    const shiftId = event.detail.shiftId;
    const shift = controller.state.config?.shiftTypes.find(({ id }) => id === shiftId);
    if (shift !== undefined) {
      controller.applyShift({ id: shift.id, isEnabled: shift.isEnabled });
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
});
