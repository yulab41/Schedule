import type {
  AppliedManualScheduleTemplateResult,
  CalendarReadModel,
  GroupSummary,
  ManualApplyPreview,
  ManualScheduleTemplate,
  ScheduleChangeImpactPreview,
  ScheduleDraftSummary,
  ScheduleGenerationPreview,
  SchedulePeriodHistoryItem,
  ScheduleWorkflowImpact,
  SchedulingConfig,
} from '@schedule/contracts';

import {
  applyManualScheduleTemplate,
  createManualScheduleTemplate,
  deleteManualScheduleTemplate,
  deleteScheduleDraft,
  getScheduleDraftPreview,
  getSchedulePeriodCalendar,
  getSchedulePublishMode,
  getSchedulingConfig,
  listGroups,
  listManualScheduleTemplates,
  listScheduleDrafts,
  listSchedulePeriodHistory,
  previewManualTemplateApply,
  previewScheduleChange,
  publishScheduleDraftBatch,
  publishSchedulePeriod,
  updateManualScheduleTemplate,
  withdrawSchedulePeriod,
} from '../../api/endpoints.js';
import { getStoredToken } from '../../api/client.js';
import { getSelectedGroupId, resolveSelectedGroup, setSelectedGroupId } from '../../store/group.js';
import {
  applyShiftToCell,
  clearCell,
  clearColumn,
  clearRow,
  createCellKey,
  createTemplateUndoStack,
  findPublishedOverlapMonths,
  formatScheduleDraftCode,
  getNextAvailableStartDate,
  getTemplateDateColumns,
  templateToCellMap,
  type ManualGridRow,
  type TemplateCellMap,
} from '../../utils/manual-schedule-logic.js';
import {
  getConflictLatestData,
  getConflictMessage,
  getVersionConflictSummary,
  isDataConflictError,
} from '../../utils/conflict.js';
import { getCurrentBusinessMonth } from '../../utils/china-time.js';
import { getBusinessDate } from '../../utils/calendar-views.js';
import { randomUuid } from '../../utils/uuid.js';
import { toUserMessage } from '../../utils/user-message.js';

interface TemplateOption {
  readonly id: string;
  readonly label: string;
}

interface RoleOption {
  readonly id: string;
  readonly name: string;
}

interface MemberCheckRow {
  readonly checked: boolean;
  readonly id: string;
  readonly name: string;
}

interface ColumnView {
  readonly cycleDay: number;
  readonly date: string;
  readonly weekday: string;
}

interface GridCellView {
  readonly abbreviation: string;
  readonly color: string;
  readonly cycleDay: number;
  readonly isStale: boolean;
  readonly key: string;
  readonly membershipId: string;
  readonly shiftTypeId: string;
  readonly shiftTypeName: string;
  readonly textColor: string;
}

interface GridRowView {
  readonly cells: readonly GridCellView[];
  readonly membershipId: string;
  readonly realName: string;
  readonly isStale: boolean;
}

interface DraftBatchView {
  readonly items: readonly SchedulePeriodHistoryItem[];
  readonly key: string;
  readonly months: readonly string[];
  readonly rangeEnd: string;
  readonly rangeStart: string;
  readonly roleName: string;
}

interface MonthGroupView {
  readonly archived: readonly SchedulePeriodHistoryItem[];
  readonly archivedViews: readonly VersionRowView[];
  readonly businessMonth: string;
  readonly current: readonly SchedulePeriodHistoryItem[];
  readonly currentViews: readonly VersionRowView[];
  readonly items: readonly SchedulePeriodHistoryItem[];
  readonly past: readonly SchedulePeriodHistoryItem[];
  readonly pastViews: readonly VersionRowView[];
  readonly roleName: string;
}

interface VersionRowView {
  readonly draftCode: string;
  readonly isPast: boolean;
  readonly item: SchedulePeriodHistoryItem;
}

interface BlockedBatch {
  readonly batch: DraftBatchView;
  readonly conflictingMonths: readonly string[];
  readonly message: string;
  readonly needsReplace: boolean;
  readonly workflowImpacts: readonly ScheduleWorkflowImpact[];
}

interface ManualPageData {
  readonly acknowledgeBlockers: boolean;
  readonly acknowledgePastDates: boolean;
  readonly acknowledgeWorkflowRevocations: boolean;
  readonly activeShiftTypeId: string;
  readonly applyAckBlockers: boolean;
  readonly applyAckWorkflows: boolean;
  readonly applyEndDate: string;
  readonly applyOverlappingDrafts: boolean;
  readonly applyNeedsReplacePublished: boolean;
  readonly applyPreview: ManualApplyPreview | undefined;
  readonly applyReplaceDrafts: boolean;
  readonly applyReplacePublished: boolean;
  readonly applyStartDate: string;
  readonly applyVisible: boolean;
  readonly applyWorkflowImpacts: readonly ScheduleWorkflowImpact[];
  readonly batchBlocked: BlockedBatch | undefined;
  readonly canUndo: boolean;
  readonly columns: readonly ColumnView[];
  readonly conflictMessage: string;
  readonly conflictSummary: string;
  readonly conflictVisible: boolean;
  readonly cycleDays: number;
  readonly draftBatches: readonly DraftBatchView[];
  readonly draftPreview: ScheduleGenerationPreview | undefined;
  readonly draftPreviewError: string;
  readonly errorMessage: string;
  readonly grid: readonly GridRowView[];
  readonly groups: readonly GroupSummary[];
  readonly infoMessage: string;
  readonly isDeletingDraftId: string;
  readonly isMutatingPeriod: boolean;
  readonly isPreviewingDraftId: string;
  readonly isPublishingId: string;
  readonly isSaving: boolean;
  readonly isLoading: boolean;
  readonly memberRows: readonly MemberCheckRow[];
  readonly mutationAction: 'publish' | 'withdraw';
  readonly mutationHasBlockers: boolean;
  readonly mutationHasPastDates: boolean;
  readonly mutationImpact: ScheduleChangeImpactPreview | undefined;
  readonly mutationPublishPreview: ScheduleGenerationPreview | undefined;
  readonly mutationTarget: SchedulePeriodHistoryItem | undefined;
  readonly mutationTargetLabel: string;
  readonly mutationVisible: boolean;
  readonly periodCalendar: CalendarReadModel | undefined;
  readonly previewTarget: SchedulePeriodHistoryItem | undefined;
  readonly previewTargetLabel: string;
  readonly previewVisible: boolean;
  readonly replacePublished: boolean;
  readonly repeatEnabled: boolean;
  readonly roleIndex: number;
  readonly roleOptions: readonly RoleOption[];
  readonly rows: readonly ManualGridRow[];
  readonly scheduleRoleId: string;
  readonly selectedCell: { readonly cycleDay: number; readonly membershipId: string } | undefined;
  readonly selectedGroupId: string;
  readonly selectedTemplateId: string;
  readonly shiftTypes: readonly {
    readonly abbreviation: string;
    readonly color: string;
    readonly id: string;
    readonly isEnabled: boolean;
    readonly name: string;
    readonly textColor: string;
  }[];
  readonly startDate: string;
  readonly staleWarning: boolean;
  readonly templateOptions: readonly TemplateOption[];
  readonly templateIndex: number;
  readonly templates: readonly ManualScheduleTemplate[];
  readonly versionMonthGroups: readonly MonthGroupView[];
}

Page({
  data: {
    acknowledgeBlockers: false,
    acknowledgePastDates: false,
    acknowledgeWorkflowRevocations: false,
    activeShiftTypeId: '',
    applyAckBlockers: false,
    applyAckWorkflows: false,
    applyEndDate: '',
    applyOverlappingDrafts: false,
    applyNeedsReplacePublished: false,
    applyPreview: undefined,
    applyReplaceDrafts: false,
    applyReplacePublished: false,
    applyStartDate: '',
    applyVisible: false,
    applyWorkflowImpacts: [],
    batchBlocked: undefined,
    canUndo: false,
    columns: [],
    conflictMessage: '',
    conflictSummary: '',
    conflictVisible: false,
    cycleDays: 7,
    draftBatches: [],
    draftPreview: undefined,
    draftPreviewError: '',
    errorMessage: '',
    grid: [],
    groups: [],
    infoMessage: '',
    isDeletingDraftId: '',
    isMutatingPeriod: false,
    isPreviewingDraftId: '',
    isPublishingId: '',
    isSaving: false,
    isLoading: false,
    memberRows: [],
    mutationAction: 'withdraw',
    mutationHasBlockers: false,
    mutationHasPastDates: false,
    mutationImpact: undefined,
    mutationPublishPreview: undefined,
    mutationTarget: undefined,
    mutationTargetLabel: '',
    mutationVisible: false,
    periodCalendar: undefined,
    previewTarget: undefined,
    previewTargetLabel: '',
    previewVisible: false,
    replacePublished: false,
    repeatEnabled: false,
    roleIndex: 0,
    roleOptions: [],
    rows: [],
    scheduleRoleId: '',
    selectedCell: undefined,
    selectedGroupId: '',
    selectedTemplateId: '',
    shiftTypes: [],
    startDate: '',
    staleWarning: false,
    templateIndex: 0,
    templateOptions: [],
    templates: [],
    versionMonthGroups: [],
  } as ManualPageData,

  // 非响应式编辑器状态
  cells: new Map<string, string>() as TemplateCellMap,
  membershipIds: [] as string[],
  activeShiftTypeId: undefined as string | undefined,
  undoStack: createTemplateUndoStack(),
  staleMemberIds: [] as string[],
  staleCellKeys: new Set<string>(),
  requestVersion: 0,

  onShow() {
    if (getStoredToken() === undefined) {
      wx.reLaunch({ url: '/pages/login/login' });
      return;
    }
    void this.loadAll();
  },

  async loadAll(): Promise<void> {
    const currentRequest = ++this.requestVersion;
    this.setData({ errorMessage: '', isLoading: true });
    try {
      const groups = await listGroups();
      const selected = resolveSelectedGroup(groups, getSelectedGroupId());
      if (selected === undefined) {
        this.setData({ errorMessage: '请先加入一个群组。', groups });
        return;
      }
      setSelectedGroupId(selected.id);
      const [config, templates, history] = await Promise.all([
        getSchedulingConfig(selected.id),
        listManualScheduleTemplates(selected.id),
        listSchedulePeriodHistory(selected.id),
      ]);
      if (currentRequest !== this.requestVersion) {
        return;
      }
      this.config = config;
      this.templates = templates;
      this.history = history;
      this.setData({
        groups,
        roleIndex: Math.max(
          0,
          config.roles.findIndex((role) => role.id === this.data.scheduleRoleId),
        ),
        selectedGroupId: selected.id,
        templateOptions: this.buildTemplateOptions(templates),
        roleOptions: config.roles.map((role) => ({ id: role.id, name: role.name })),
        shiftTypes: config.shiftTypes
          .filter((shiftType) => shiftType.isEnabled)
          .map((shiftType) => ({
            abbreviation: shiftType.abbreviation,
            color: shiftType.color,
            id: shiftType.id,
            isEnabled: shiftType.isEnabled,
            name: shiftType.name,
            textColor: shiftType.textColor,
          })),
      });
      this.buildDraftViews(history);
      if (this.data.selectedTemplateId !== '') {
        const template = templates.find((item) => item.id === this.data.selectedTemplateId);
        if (template !== undefined) {
          this.openTemplate(template);
        }
      } else if (this.data.scheduleRoleId === '') {
        this.resetEditor();
      }
    } catch (error) {
      if (currentRequest === this.requestVersion) {
        this.setData({ errorMessage: toUserMessage(error, '加载失败，请稍后重试。') });
      }
    } finally {
      if (currentRequest === this.requestVersion) {
        this.setData({ isLoading: false });
      }
    }
  },

  config: undefined as SchedulingConfig | undefined,
  templates: [] as ManualScheduleTemplate[],
  history: [] as SchedulePeriodHistoryItem[],

  buildTemplateOptions(templates: readonly ManualScheduleTemplate[]): readonly TemplateOption[] {
    return [
      { id: '', label: '新建模板' },
      ...templates.map((template) => ({
        id: template.id,
        label: `${template.scheduleRoleName} · ${template.startDate} · ${template.cycleDays}天`,
      })),
    ];
  },

  resetEditor(): void {
    this.cells = new Map();
    this.membershipIds = [];
    this.activeShiftTypeId = undefined;
    this.staleMemberIds = [];
    this.staleCellKeys = new Set();
    this.undoStack.clear();
    const startDate = getBusinessDate();
    this.setData({
      cycleDays: 7,
      activeShiftTypeId: '',
      memberRows:
        this.config?.groupMembers.map((member) => ({
          checked: false,
          id: member.membershipId,
          name: member.realName,
        })) ?? [],
      scheduleRoleId: '',
      selectedCell: undefined,
      selectedTemplateId: '',
      startDate,
      roleIndex: 0,
      templateIndex: 0,
    });
    this.rebuildEditorView();
  },

  openTemplate(template: ManualScheduleTemplate): void {
    this.cells = templateToCellMap(template);
    this.membershipIds = template.members.map((member) => member.membershipId);
    this.activeShiftTypeId = undefined;
    this.staleMemberIds = template.members
      .filter((member) => member.isStale)
      .map((member) => member.membershipId);
    this.staleCellKeys = new Set(
      template.cells
        .filter((cell) => cell.isStale)
        .map((cell) => createCellKey(cell.cycleDay, cell.membershipId)),
    );
    this.undoStack.clear();
    const startDate = getNextAvailableStartDate(
      this.history,
      template.scheduleRoleId,
      getBusinessDate(),
    );
    this.setData({
      cycleDays: template.cycleDays,
      activeShiftTypeId: '',
      memberRows:
        this.config?.groupMembers.map((member) => ({
          checked: this.membershipIds.includes(member.membershipId),
          id: member.membershipId,
          name: member.realName,
        })) ?? [],
      scheduleRoleId: template.scheduleRoleId,
      selectedCell: undefined,
      selectedTemplateId: template.id,
      startDate,
      roleIndex: Math.max(
        0,
        this.data.roleOptions.findIndex((role) => role.id === template.scheduleRoleId),
      ),
      templateIndex: Math.max(
        0,
        this.data.templateOptions.findIndex((option) => option.id === template.id),
      ),
    });
    this.rebuildEditorView();
  },

  onTemplateChange(event: WechatMiniprogram.PickerChange) {
    const index = Number(event.detail.value ?? 0);
    const option = this.data.templateOptions[index];
    if (option === undefined) {
      return;
    }
    if (option.id === '') {
      this.resetEditor();
      return;
    }
    const template = this.templates.find((item) => item.id === option.id);
    if (template !== undefined) {
      this.openTemplate(template);
    }
  },

  onRoleChange(event: WechatMiniprogram.PickerChange) {
    const index = Number(event.detail.value ?? 0);
    const role = this.data.roleOptions[index];
    if (role === undefined) {
      return;
    }
    this.cells = new Map();
    this.membershipIds = [];
    this.activeShiftTypeId = undefined;
    this.staleMemberIds = [];
    this.staleCellKeys = new Set();
    this.undoStack.clear();
    this.setData({
      activeShiftTypeId: '',
      memberRows:
        this.config?.groupMembers.map((member) => ({
          checked: false,
          id: member.membershipId,
          name: member.realName,
        })) ?? [],
      roleIndex: index,
      scheduleRoleId: role.id,
      selectedCell: undefined,
    });
    this.rebuildEditorView();
  },

  onStartDateChange(event: WechatMiniprogram.PickerChange) {
    this.setData({ startDate: String(event.detail.value ?? '') });
    this.rebuildEditorView();
  },

  onCycleDaysInput(event: WechatMiniprogram.Input) {
    const value = Number(event.detail.value);
    if (Number.isInteger(value) && value >= 1 && value <= 31) {
      this.setData({ cycleDays: value });
      this.rebuildEditorView();
    }
  },

  toggleMember(event: WechatMiniprogram.TouchEvent) {
    const membershipId = event.currentTarget.dataset.id;
    if (typeof membershipId !== 'string' || membershipId.length === 0) {
      return;
    }
    if (this.membershipIds.includes(membershipId)) {
      this.pushUndo();
      this.membershipIds = this.membershipIds.filter((id) => id !== membershipId);
      this.cells = clearRow(this.cells, membershipId);
    } else {
      this.membershipIds = [...this.membershipIds, membershipId];
    }
    this.setData({
      memberRows: this.data.memberRows.map((row) =>
        row.id === membershipId ? { ...row, checked: !row.checked } : row,
      ),
    });
    this.rebuildEditorView();
  },

  onCellTap(event: WechatMiniprogram.CustomEvent) {
    const selection = event.detail as { readonly cycleDay: number; readonly membershipId: string };
    const same =
      this.data.selectedCell !== undefined &&
      this.data.selectedCell.cycleDay === selection.cycleDay &&
      this.data.selectedCell.membershipId === selection.membershipId;
    this.setData({ selectedCell: same ? undefined : selection });
    if (this.activeShiftTypeId !== undefined) {
      this.pushUndo();
      const key = createCellKey(selection.cycleDay, selection.membershipId);
      const current = this.cells.get(key);
      this.cells =
        current === this.activeShiftTypeId
          ? clearCell(this.cells, selection.cycleDay, selection.membershipId)
          : applyShiftToCell(
              this.cells,
              selection.cycleDay,
              selection.membershipId,
              this.activeShiftTypeId,
            );
      this.setData({ infoMessage: '' });
      this.rebuildEditorView();
    }
  },

  selectShiftType(event: WechatMiniprogram.CustomEvent) {
    const shiftTypeId = event.detail.shiftTypeId;
    this.activeShiftTypeId = this.activeShiftTypeId === shiftTypeId ? undefined : shiftTypeId;
    this.setData({ activeShiftTypeId: this.activeShiftTypeId ?? '' });
  },

  clearSelectedCell() {
    const selection = this.data.selectedCell;
    if (selection === undefined) {
      return;
    }
    this.pushUndo();
    this.cells = clearCell(this.cells, selection.cycleDay, selection.membershipId);
    this.rebuildEditorView();
  },

  async clearSelectedRow(): Promise<void> {
    const selection = this.data.selectedCell;
    if (selection === undefined) {
      return;
    }
    const confirmed = await confirmAction('清空整行', '该操作可在保存前撤销。');
    if (!confirmed) {
      return;
    }
    this.pushUndo();
    this.cells = clearRow(this.cells, selection.membershipId);
    this.rebuildEditorView();
  },

  async clearSelectedColumn(): Promise<void> {
    const selection = this.data.selectedCell;
    if (selection === undefined) {
      return;
    }
    const confirmed = await confirmAction('清空整列', '该操作可在保存前撤销。');
    if (!confirmed) {
      return;
    }
    this.pushUndo();
    this.cells = clearColumn(this.cells, selection.cycleDay);
    this.rebuildEditorView();
  },

  undo() {
    const snapshot = this.undoStack.pop();
    if (snapshot !== undefined) {
      this.cells = snapshot;
      this.rebuildEditorView();
    }
  },

  pushUndo(): void {
    this.undoStack.push(this.cells);
  },

  rebuildEditorView(): void {
    let columns: readonly ColumnView[] = [];
    try {
      columns = getTemplateDateColumns(this.data.startDate, this.data.cycleDays);
    } catch {
      columns = [];
    }
    const role = this.config?.roles.find((item) => item.id === this.data.scheduleRoleId);
    const memberNames = new Map(
      role?.members.map((member) => [member.membershipId, member.realName]) ?? [],
    );
    const rows = this.membershipIds.map((membershipId) => ({
      isStale: this.staleMemberIds.includes(membershipId),
      membershipId,
      realName: memberNames.get(membershipId) ?? '未知成员',
    }));
    const shiftById = new Map(this.data.shiftTypes.map((shift) => [shift.id, shift]));
    const grid = rows.map((row) => ({
      cells: columns.map((column) => {
        const key = createCellKey(column.cycleDay, row.membershipId);
        const shiftTypeId = this.cells.get(key);
        const shift = shiftTypeId === undefined ? undefined : shiftById.get(shiftTypeId);
        return {
          abbreviation: shift?.abbreviation ?? '',
          color: shift?.color ?? '#FFFFFF',
          cycleDay: column.cycleDay,
          isStale: this.staleCellKeys.has(key),
          key,
          membershipId: row.membershipId,
          shiftTypeId: shiftTypeId ?? '',
          shiftTypeName: shift?.name ?? '',
          textColor: shift?.textColor ?? '#111827',
        };
      }),
      isStale: row.isStale,
      membershipId: row.membershipId,
      realName: row.realName,
    }));
    this.setData({
      canUndo: this.undoStack.canUndo(),
      columns,
      grid,
      rows,
      staleWarning: this.staleMemberIds.length > 0 || this.staleCellKeys.size > 0,
    });
  },

  buildDraftViews(history: readonly SchedulePeriodHistoryItem[]): void {
    const draftGroups = new Map<string, SchedulePeriodHistoryItem[]>();
    for (const item of history) {
      if (item.status !== 'draft') {
        continue;
      }
      const key = item.operationId ?? item.id;
      const list = draftGroups.get(key) ?? [];
      list.push(item);
      draftGroups.set(key, list);
    }
    const draftBatches = [...draftGroups.values()]
      .map((items) => {
        const sorted = [...items].sort(
          (first, second) =>
            first.businessMonth.localeCompare(second.businessMonth) ||
            first.revision - second.revision,
        );
        const first = sorted[0];
        const last = sorted[sorted.length - 1];
        return {
          items: sorted,
          key: first?.operationId ?? first?.id ?? '',
          months: sorted.map((item) => item.businessMonth.slice(0, 7)),
          rangeEnd: last?.applyEndDate ?? `${last?.businessMonth ?? ''}-01`,
          rangeStart: first?.applyStartDate ?? `${first?.businessMonth ?? ''}-01`,
          roleName: first?.scheduleRoleName ?? '',
        };
      })
      .sort((first, second) =>
        (second.items[0]?.businessMonth ?? '').localeCompare(first.items[0]?.businessMonth ?? ''),
      );

    const monthGroups = new Map<
      string,
      { businessMonth: string; items: SchedulePeriodHistoryItem[]; roleName: string }
    >();
    for (const item of history) {
      if (item.status === 'draft') {
        continue;
      }
      const key = `${item.businessMonth}|${item.scheduleRoleId}`;
      const group = monthGroups.get(key) ?? {
        businessMonth: item.businessMonth,
        items: [],
        roleName: item.scheduleRoleName,
      };
      group.items.push(item);
      monthGroups.set(key, group);
    }
    const versionMonthGroups = [...monthGroups.values()]
      .map((group) => ({
        ...group,
        archivedViews: [...group.items]
          .filter((item) => item.status === 'replaced' || item.status === 'withdrawn')
          .sort((first, second) => second.revision - first.revision)
          .map((item) => toVersionRowView(item)),
        archived: [...group.items]
          .filter((item) => item.status === 'replaced' || item.status === 'withdrawn')
          .sort((first, second) => second.revision - first.revision),
        currentViews: [...group.items]
          .filter((item) => item.status === 'published')
          .map((item) => toVersionRowView(item)),
        current: [...group.items].filter((item) => item.status === 'published'),
        pastViews: [...group.items]
          .filter((item) => item.status === 'past')
          .map((item) => toVersionRowView(item)),
        past: [...group.items].filter((item) => item.status === 'past'),
        items: [...group.items].sort((first, second) => second.revision - first.revision),
      }))
      .sort((first, second) => second.businessMonth.localeCompare(first.businessMonth));

    this.setData({ draftBatches, versionMonthGroups });
  },

  async handleSave(): Promise<void> {
    if (this.data.scheduleRoleId === '') {
      this.setData({ errorMessage: '请先选择排班岗位。' });
      return;
    }
    if (this.membershipIds.length === 0) {
      this.setData({ errorMessage: '请至少勾选一位值班人员。' });
      return;
    }
    if (this.data.columns.length === 0) {
      this.setData({ errorMessage: '请检查开始日期和周期天数（1 到 31 天）。' });
      return;
    }
    const request = {
      cells: [...this.cells.entries()].map(([key, shiftTypeId]) => {
        const [cycleDayText = '', ...membershipParts] = key.split(':');
        return {
          cycleDay: Number(cycleDayText),
          membershipId: membershipParts.join(':'),
          shiftTypeId,
        };
      }),
      cycleDays: this.data.cycleDays,
      membershipIds: this.membershipIds,
      scheduleRoleId: this.data.scheduleRoleId,
      startDate: this.data.startDate,
    };
    this.setData({ errorMessage: '', infoMessage: '', isSaving: true });
    try {
      let saved: ManualScheduleTemplate;
      if (this.data.selectedTemplateId !== '') {
        const template = this.templates.find((item) => item.id === this.data.selectedTemplateId);
        saved = await updateManualScheduleTemplate(
          this.data.selectedGroupId,
          this.data.selectedTemplateId,
          {
            ...request,
            expectedVersion: template?.version ?? 1,
          },
        );
      } else {
        saved = await createManualScheduleTemplate(this.data.selectedGroupId, request);
      }
      this.setData({ infoMessage: '模板已保存，尚未创建任何正式班次。' });
      await this.loadAll();
      this.openTemplate(saved);
    } catch (error) {
      this.handleConflictOrError(error, '模板暂时无法保存，请稍后重试。');
    } finally {
      this.setData({ isSaving: false });
    }
  },

  handleConflictOrError(error: unknown, fallback: string): void {
    if (isDataConflictError(error)) {
      this.setData({
        conflictMessage: getConflictMessage(error),
        conflictSummary: getVersionConflictSummary(getConflictLatestData(error)) ?? '',
        conflictVisible: true,
      });
    } else {
      this.setData({ errorMessage: toUserMessage(error, fallback) });
    }
  },

  refreshAfterConflict() {
    this.setData({ conflictVisible: false });
    void this.loadAll().then(() => {
      const template = this.templates.find((item) => item.id === this.data.selectedTemplateId);
      if (template !== undefined) {
        this.openTemplate(template);
      }
    });
  },

  async handleDeleteTemplate(): Promise<void> {
    const template = this.templates.find((item) => item.id === this.data.selectedTemplateId);
    if (template === undefined) {
      return;
    }
    const confirmed = await confirmAction('删除模板', '删除后不可恢复。');
    if (!confirmed) {
      return;
    }
    this.setData({ errorMessage: '', isSaving: true });
    try {
      await deleteManualScheduleTemplate(this.data.selectedGroupId, template.id);
      this.resetEditor();
      this.setData({ infoMessage: '模板已删除。' });
      await this.loadAll();
    } catch (error) {
      this.setData({ errorMessage: toUserMessage(error, '模板删除失败。') });
    } finally {
      this.setData({ isSaving: false });
    }
  },

  openApplyDialog() {
    const template = this.templates.find((item) => item.id === this.data.selectedTemplateId);
    if (template === undefined) {
      return;
    }
    this.applyTarget = template;
    this.setData({
      applyEndDate: this.defaultApplyEndDate(template),
      applyStartDate: this.data.startDate,
      applyVisible: true,
    });
    void this.loadApplyContext();
  },

  applyTarget: undefined as ManualScheduleTemplate | undefined,
  applyDrafts: [] as ScheduleDraftSummary[],
  applyPublishMode: 'draft' as 'draft' | 'published',
  applyNeedsReplacePublished: false,
  applyWorkflowImpacts: [] as readonly ScheduleWorkflowImpact[],

  async loadApplyContext(): Promise<void> {
    try {
      const [config, publishMode, drafts] = await Promise.all([
        getSchedulingConfig(this.data.selectedGroupId),
        getSchedulePublishMode(this.data.selectedGroupId),
        listScheduleDrafts(this.data.selectedGroupId),
      ]);
      this.config = config;
      this.applyPublishMode = publishMode.publishMode;
      this.applyDrafts = drafts;
      this.applyNeedsReplacePublished = false;
      this.applyWorkflowImpacts = [];
      this.setData({
        applyNeedsReplacePublished: false,
        applyWorkflowImpacts: [],
      });
    } catch (error) {
      this.setData({ errorMessage: toUserMessage(error, '应用模板配置加载失败。') });
    }
  },

  defaultApplyEndDate(template: ManualScheduleTemplate): string {
    const columns = getTemplateDateColumns(this.data.startDate, template.cycleDays);
    return columns[columns.length - 1]?.date ?? this.data.startDate;
  },

  onApplyEndDate(event: WechatMiniprogram.PickerChange) {
    this.setData({ applyEndDate: String(event.detail.value ?? '') });
  },

  onApplyFlag(event: WechatMiniprogram.CustomEvent) {
    const field = event.currentTarget.dataset.field;
    if (typeof field === 'string') {
      this.setData({ [field]: event.detail.value === true });
    }
  },

  async computeApplyPreview(): Promise<void> {
    const template = this.applyTarget;
    if (template === undefined || this.config === undefined) {
      return;
    }
    if (this.data.repeatEnabled && this.data.applyEndDate < this.data.applyStartDate) {
      this.setData({ errorMessage: '结束日期不能早于应用开始日期。' });
      return;
    }
    this.setData({ errorMessage: '', isPreviewingDraftId: template.id });
    try {
      const preview = await previewManualTemplateApply(this.data.selectedGroupId, template.id, {
        expectedRulesVersion: this.config.rulesVersion,
        ...(this.data.repeatEnabled ? { endDate: this.data.applyEndDate } : {}),
        startDate: this.data.applyStartDate,
      });
      this.setData({
        applyAckBlockers: false,
        applyAckWorkflows: false,
        applyOverlappingDrafts: this.overlappingDrafts(preview).length > 0,
        applyPreview: preview,
        applyReplaceDrafts: false,
        applyReplacePublished: false,
      });
      this.applyNeedsReplacePublished = false;
      this.applyWorkflowImpacts = [];
      this.setData({
        applyNeedsReplacePublished: false,
        applyWorkflowImpacts: [],
      });
    } catch (error) {
      if (isDataConflictError(error)) {
        await this.loadApplyContext();
      }
      this.setData({ errorMessage: toUserMessage(error, '模板暂时无法应用，请稍后重试。') });
    } finally {
      this.setData({ isPreviewingDraftId: '' });
    }
  },

  overlappingDrafts(preview: ManualApplyPreview): readonly ScheduleDraftSummary[] {
    const template = this.applyTarget;
    if (template === undefined) {
      return [];
    }
    const months = new Set(
      preview.assignments.map((assignment) => assignment.businessDate.slice(0, 7)),
    );
    return this.applyDrafts.filter(
      (draft) =>
        draft.scheduleRoleId === template.scheduleRoleId &&
        months.has(draft.businessMonth.slice(0, 7)),
    );
  },

  async handleApply(): Promise<void> {
    const template = this.applyTarget;
    if (template === undefined || this.config === undefined) {
      return;
    }
    if (this.data.applyPreview === undefined) {
      await this.computeApplyPreview();
      if (this.data.applyPreview === undefined) {
        return;
      }
    }
    if (this.data.applyOverlappingDrafts && !this.data.applyReplaceDrafts) {
      this.setData({ errorMessage: '目标月份已有该岗位的草稿，请勾选“覆盖已有草稿”后再应用。' });
      return;
    }
    if (this.applyNeedsReplacePublished && !this.data.applyReplacePublished) {
      this.setData({
        errorMessage: '目标月份已有该岗位的已发布排班，请勾选“覆盖已有排班”后再应用。',
      });
      return;
    }
    if (this.applyWorkflowImpacts.length > 0 && !this.data.applyAckWorkflows) {
      this.setData({ errorMessage: '覆盖会撤销已有换班或加扣班事件，请确认后再应用。' });
      return;
    }
    const hasBlockers =
      (this.data.applyPreview.conflicts?.length ?? 0) > 0 ||
      (this.data.applyPreview.vacancies?.length ?? 0) > 0;
    this.setData({ errorMessage: '', isSaving: true });
    try {
      const result = await applyManualScheduleTemplate(this.data.selectedGroupId, template.id, {
        ...(hasBlockers && this.data.applyAckBlockers ? { acknowledgeBlockers: true } : {}),
        ...(this.data.applyAckWorkflows ? { acknowledgeWorkflowRevocations: true } : {}),
        expectedRulesVersion: this.config.rulesVersion,
        operationId: randomUuid(),
        ...(this.data.applyReplacePublished ? { replacePublished: true } : {}),
        ...(this.data.applyReplaceDrafts ? { replaceExistingDrafts: true } : {}),
        ...(this.data.repeatEnabled ? { endDate: this.data.applyEndDate } : {}),
        startDate: this.data.applyStartDate,
      });
      this.onApplied(result);
    } catch (error) {
      if (isDataConflictError(error)) {
        const latest = getConflictLatestData(error) as
          | {
              existingPublishedPeriodId?: unknown;
              workflowImpacts?: readonly ScheduleWorkflowImpact[];
            }
          | undefined;
        this.applyWorkflowImpacts = Array.isArray(latest?.workflowImpacts)
          ? latest.workflowImpacts
          : [];
        if (latest?.existingPublishedPeriodId !== undefined) {
          this.applyNeedsReplacePublished = true;
          this.setData({
            applyNeedsReplacePublished: true,
            applyReplacePublished: false,
            applyWorkflowImpacts: this.applyWorkflowImpacts,
            errorMessage: '目标月份已有该岗位的已发布排班，请勾选“覆盖已有排班”后再应用。',
          });
          return;
        }
        if (this.applyWorkflowImpacts.length > 0) {
          this.setData({
            applyWorkflowImpacts: this.applyWorkflowImpacts,
            errorMessage: '覆盖会撤销以下换班或加扣班事件，请确认后再应用。',
          });
          return;
        }
        await this.loadApplyContext();
      }
      this.setData({ errorMessage: toUserMessage(error, '模板暂时无法应用，请稍后重试。') });
    } finally {
      this.setData({ isSaving: false });
    }
  },

  onApplied(result: AppliedManualScheduleTemplateResult): void {
    this.setData({
      applyVisible: false,
      infoMessage:
        result.status === 'published'
          ? `模板已应用并直接发布：${result.preview.applyStartDate} 至 ${result.preview.applyEndDate}。`
          : `模板已应用并保存为草稿：${result.preview.applyStartDate} 至 ${result.preview.applyEndDate}（共 ${result.periods.length} 个月），可在下方草稿区一次发布。`,
    });
    void this.loadAll();
  },

  async publishBatch(event: WechatMiniprogram.TouchEvent): Promise<void> {
    const key = event.currentTarget.dataset.key;
    const batch = this.data.draftBatches.find((item) => item.key === key);
    if (batch === undefined) {
      return;
    }
    await this.doPublishBatch(batch);
  },

  async doPublishBatch(
    batch: DraftBatchView,
    acknowledge = false,
    replace = false,
    acknowledgeWorkflows = false,
  ): Promise<void> {
    this.setData({
      batchBlocked: undefined,
      errorMessage: '',
      isPublishingId: batch.key,
      replacePublished: false,
    });
    try {
      const result = await publishScheduleDraftBatch(this.data.selectedGroupId, {
        ...(acknowledge ? { acknowledgeBlockers: true } : {}),
        ...(acknowledgeWorkflows ? { acknowledgeWorkflowRevocations: true } : {}),
        operationId: randomUuid(),
        ...(replace ? { replacePublished: true } : {}),
        schedulePeriodIds: batch.items.map((item) => item.id),
      });
      this.setData({
        infoMessage: `已发布 ${batch.rangeStart} 至 ${batch.rangeEnd} 的排班（共 ${result.periods.length} 个月）。`,
      });
      await this.loadAll();
    } catch (error) {
      if (isDataConflictError(error)) {
        const latest = getConflictLatestData(error) as
          | {
              existingPublishedPeriodId?: unknown;
              workflowImpacts?: readonly ScheduleWorkflowImpact[];
            }
          | undefined;
        const workflowImpacts = Array.isArray(latest?.workflowImpacts)
          ? latest.workflowImpacts
          : [];
        if (latest?.existingPublishedPeriodId !== undefined) {
          this.history = await listSchedulePeriodHistory(this.data.selectedGroupId).catch(
            () => this.history,
          );
          this.setData({
            batchBlocked: {
              batch,
              conflictingMonths: findPublishedOverlapMonths(batch.items, this.history),
              message: '发布范围包含已有已发布排班的月份，请确认覆盖发布。',
              needsReplace: true,
              workflowImpacts,
            },
          });
        } else {
          this.setData({
            batchBlocked: {
              batch,
              conflictingMonths: [],
              message: getConflictMessage(error),
              needsReplace: false,
              workflowImpacts,
            },
          });
        }
      } else {
        this.setData({ errorMessage: toUserMessage(error, '发布失败，请稍后重试。') });
      }
    } finally {
      this.setData({ isPublishingId: '' });
    }
  },

  confirmBlockedPublish() {
    const blocked = this.data.batchBlocked;
    if (blocked === undefined) {
      return;
    }
    if (blocked.needsReplace) {
      void this.doPublishBatch(
        blocked.batch,
        false,
        this.data.applyReplacePublished,
        this.data.acknowledgeWorkflowRevocations,
      );
    } else {
      void this.doPublishBatch(blocked.batch, this.data.acknowledgeBlockers);
    }
  },

  async deleteBatch(event: WechatMiniprogram.TouchEvent): Promise<void> {
    const key = event.currentTarget.dataset.key;
    const batch = this.data.draftBatches.find((item) => item.key === key);
    if (batch === undefined) {
      return;
    }
    const confirmed = await confirmAction(
      '删除草稿',
      `确定删除 ${batch.rangeStart} 至 ${batch.rangeEnd} 的排班草稿吗（共 ${batch.items.length} 个月）？`,
    );
    if (!confirmed) {
      return;
    }
    this.setData({ errorMessage: '', isDeletingDraftId: batch.key });
    try {
      for (const item of batch.items) {
        await deleteScheduleDraft(this.data.selectedGroupId, item.id);
      }
      this.setData({ infoMessage: `已删除 ${batch.rangeStart} 至 ${batch.rangeEnd} 的排班草稿。` });
      await this.loadAll();
    } catch (error) {
      this.setData({ errorMessage: toUserMessage(error, '删除草稿失败。') });
    } finally {
      this.setData({ isDeletingDraftId: '' });
    }
  },

  async openDraftPreview(event: WechatMiniprogram.TouchEvent): Promise<void> {
    const id = event.currentTarget.dataset.id;
    const item = this.history.find((entry) => entry.id === id);
    if (item === undefined) {
      return;
    }
    this.setData({
      draftPreview: undefined,
      draftPreviewError: '',
      isPreviewingDraftId: id,
      periodCalendar: undefined,
      previewTarget: item,
      previewTargetLabel: `${item.businessMonth.slice(0, 7)} · ${item.scheduleRoleName}`,
      previewVisible: true,
    });
    try {
      if (item.status === 'draft') {
        this.setData({
          draftPreview: await getScheduleDraftPreview(this.data.selectedGroupId, item.id),
        });
      } else {
        this.setData({
          periodCalendar: await getSchedulePeriodCalendar(this.data.selectedGroupId, item.id),
        });
      }
    } catch (error) {
      this.setData({ draftPreviewError: toUserMessage(error, '预览生成失败。') });
    } finally {
      this.setData({ isPreviewingDraftId: '' });
    }
  },

  closeDraftPreview() {
    this.setData({
      draftPreview: undefined,
      draftPreviewError: '',
      periodCalendar: undefined,
      previewTarget: undefined,
      previewVisible: false,
    });
  },

  closeApply() {
    this.setData({ applyVisible: false });
    this.applyTarget = undefined;
  },

  closeMutation() {
    this.setData({ mutationVisible: false });
  },

  closeConflict() {
    this.setData({ conflictVisible: false });
  },

  async preparePeriodMutation(event: WechatMiniprogram.TouchEvent): Promise<void> {
    const id = event.currentTarget.dataset.id;
    const action = event.currentTarget.dataset.action;
    const item = this.history.find((entry) => entry.id === id);
    if (item === undefined || (action !== 'publish' && action !== 'withdraw')) {
      return;
    }
    this.setData({
      acknowledgePastDates: false,
      acknowledgeWorkflowRevocations: false,
      isMutatingPeriod: true,
      mutationAction: action,
      mutationHasBlockers: false,
      mutationHasPastDates: this.hasPastDatesInVersion(item),
      mutationImpact: undefined,
      mutationPublishPreview: undefined,
      mutationTarget: item,
      mutationTargetLabel: `${item.businessMonth.slice(0, 7)} · ${item.scheduleRoleName}`,
      mutationVisible: true,
    });
    try {
      const impact = await previewScheduleChange(this.data.selectedGroupId, item.id, action);
      const publishPreview =
        action === 'publish'
          ? await getScheduleDraftPreview(this.data.selectedGroupId, item.id)
          : undefined;
      this.setData({
        mutationHasBlockers:
          action === 'publish' &&
          ((publishPreview?.hardConflicts?.length ?? 0) > 0 ||
            (publishPreview?.vacancies?.length ?? 0) > 0),
        mutationImpact: impact,
        mutationPublishPreview: publishPreview,
      });
    } catch (error) {
      this.setData({
        mutationVisible: false,
        errorMessage: toUserMessage(error, '影响检查失败。'),
      });
    } finally {
      this.setData({ isMutatingPeriod: false });
    }
  },

  async confirmPeriodMutation(): Promise<void> {
    const target = this.data.mutationTarget;
    if (target === undefined) {
      return;
    }
    const requiresAck =
      (this.data.mutationAction === 'publish' &&
        ((this.data.mutationPublishPreview?.hardConflicts?.length ?? 0) > 0 ||
          (this.data.mutationPublishPreview?.vacancies?.length ?? 0) > 0)) ||
      this.hasPastDatesInVersion(target) ||
      (this.data.mutationImpact?.workflowImpacts?.length ?? 0) > 0;
    const needsPastAck =
      this.data.mutationAction === 'publish' && this.hasPastDatesInVersion(target);
    if (
      (requiresAck && !this.data.acknowledgeWorkflowRevocations) ||
      (needsPastAck && !this.data.acknowledgePastDates)
    ) {
      this.setData({ errorMessage: '请先确认影响后继续。' });
      return;
    }
    this.setData({ errorMessage: '', isMutatingPeriod: true });
    try {
      if (this.data.mutationAction === 'withdraw') {
        await withdrawSchedulePeriod(this.data.selectedGroupId, target.id, {
          ...(this.data.acknowledgeWorkflowRevocations
            ? { acknowledgeWorkflowRevocations: true }
            : {}),
          expectedVersion: target.version,
          operationId: randomUuid(),
        });
        this.setData({
          infoMessage: `${target.businessMonth.slice(0, 7)} 的当前排班已撤销并归档。`,
        });
      } else {
        await publishSchedulePeriod(this.data.selectedGroupId, target.id, {
          ...((this.data.mutationPublishPreview?.hardConflicts?.length ?? 0) > 0 ||
          (this.data.mutationPublishPreview?.vacancies?.length ?? 0) > 0
            ? { acknowledgeBlockers: true }
            : {}),
          ...(this.data.acknowledgeWorkflowRevocations
            ? { acknowledgeWorkflowRevocations: true }
            : {}),
          expectedVersion: target.version,
          operationId: randomUuid(),
          replacePublished: true,
        });
        this.setData({ infoMessage: `${target.businessMonth.slice(0, 7)} 的归档排班已重新发布。` });
      }
      this.setData({ mutationVisible: false });
      await this.loadAll();
    } catch (error) {
      this.setData({ errorMessage: toUserMessage(error, '排班变更失败。') });
    } finally {
      this.setData({ isMutatingPeriod: false });
    }
  },

  async deleteDraft(event: WechatMiniprogram.TouchEvent): Promise<void> {
    const id = event.currentTarget.dataset.id;
    const item = this.history.find((entry) => entry.id === id);
    if (item === undefined) {
      return;
    }
    const confirmed = await confirmAction(
      '删除记录',
      `确定删除 ${item.businessMonth.slice(0, 7)} 的记录吗？`,
    );
    if (!confirmed) {
      return;
    }
    this.setData({ errorMessage: '', isDeletingDraftId: id });
    try {
      await deleteScheduleDraft(this.data.selectedGroupId, item.id);
      this.setData({ infoMessage: `已删除 ${item.businessMonth.slice(0, 7)} 的记录。` });
      await this.loadAll();
    } catch (error) {
      this.setData({ errorMessage: toUserMessage(error, '删除失败。') });
    } finally {
      this.setData({ isDeletingDraftId: '' });
    }
  },

  draftCode(item: SchedulePeriodHistoryItem): string {
    return formatScheduleDraftCode(item.createdAt);
  },

  isPastMonth(item: SchedulePeriodHistoryItem): boolean {
    return item.businessMonth.slice(0, 7) < getCurrentBusinessMonth();
  },

  hasPastDatesInVersion(item: SchedulePeriodHistoryItem): boolean {
    if (this.isPastMonth(item)) {
      return true;
    }
    const month = item.businessMonth.slice(0, 7);
    if (month > getCurrentBusinessMonth()) {
      return false;
    }
    const startDate = item.applyStartDate ?? `${month}-01`;
    return startDate < getBusinessDate();
  },

  workflowKindLabel(impact: ScheduleWorkflowImpact): string {
    return impact.kind === 'swap' ? '换班' : '加扣班';
  },

  openBackfill() {
    wx.navigateTo({ url: '/pages/schedule/backfill' });
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

function toVersionRowView(item: SchedulePeriodHistoryItem): VersionRowView {
  return {
    draftCode: formatScheduleDraftCode(item.createdAt),
    isPast: item.businessMonth.slice(0, 7) < getCurrentBusinessMonth(),
    item,
  };
}
