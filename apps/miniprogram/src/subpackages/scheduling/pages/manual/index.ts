import type {
  CalendarReadModel,
  ConfirmedHolidayDate,
  ManualApplyPreview,
  ManualScheduleTemplate,
  ScheduleChangeImpactPreview,
  ScheduleGenerationPreview,
  SchedulePeriodHistoryItem,
  ScheduleRole,
  ScheduleRoleMember,
  ScheduleWorkflowImpact,
  SchedulingConfig,
  ShiftType,
} from '@schedule/contracts';
import {
  MAX_MANUAL_CELLS,
  MAX_MANUAL_DAYS,
  MAX_MANUAL_MEMBERS,
} from '@schedule/contracts/manual-schedule-limits';
import {
  applyManualCellMutation,
  canConfirmSchedulePeriodMutation,
  createScheduleDraftBatchPublishIntent,
  createSchedulePeriodMutationIntent,
  groupScheduleDraftBatches,
  groupScheduleVersionMonths,
  hasSchedulePeriodMutationBlockers,
  hasSchedulePeriodPastDates,
  requiresSchedulePeriodMutationAcknowledgement,
  resolveManualCellMutation,
  resolveManualSelection,
} from '@schedule/presentation-core';
import { ClientCoreError } from '@schedule/client-core';

import { buildInfo } from '../../../../platform/build-info.js';
import {
  createRuntimeManualScheduleClient,
  createRuntimeSchedulePublicationClient,
} from '../../../../platform/client-core-calendar.js';
import {
  getStoredWechatProfile,
  getStoredWechatToken,
  getWechatRequestAuthentication,
} from '../../../../platform/wechat-identity.js';
import {
  createWorkbenchReadClient,
  readStoredWorkbenchGroupId,
  writeStoredWorkbenchGroupId,
} from '../../../../platform/workbench-read.js';

type ManualPageState = 'editor' | 'error' | 'loading' | 'preview' | 'release';
type ReleaseDialogKind = '' | 'delete' | 'preview' | 'republish' | 'withdraw';

interface SelectorOption {
  readonly label: string;
  readonly value: string;
}

interface MemberOption {
  readonly checked: boolean;
  readonly disabled: boolean;
  readonly membershipId: string;
  readonly realName: string;
}

interface MatrixShiftType {
  readonly abbreviation: string;
  readonly color: string;
  readonly id: string;
  readonly name: string;
  readonly textColor: string;
}

interface MatrixAssignment {
  readonly abbreviation: string;
  readonly color: string;
  readonly shiftTypeId: string;
  readonly textColor: string;
}

interface MatrixCell extends MatrixAssignment {
  readonly ariaLabel: string;
  readonly businessDate: string;
  readonly columnIndex: number;
  readonly isSelected: boolean;
  readonly isStale: boolean;
  readonly key: string;
  readonly membershipId: string;
  readonly rowIndex: number;
}

interface MatrixColumn {
  readonly businessDate: string;
  readonly cycleDay: number;
  readonly dateLabel: string;
  readonly holidayLabel: string;
  readonly isWeekend: boolean;
  readonly isWorkday: boolean;
  readonly weekdayLabel: string;
}

interface MatrixRow {
  readonly cells: readonly MatrixCell[];
  readonly isStale: boolean;
  readonly membershipId: string;
  readonly realName: string;
  readonly rowIndex: number;
}

interface MatrixLocation {
  readonly columnIndex: number;
  readonly rowIndex: number;
}

interface MatrixGestureConfig {
  readonly horizontalOffset: number;
  readonly maxHorizontalOffset: number;
  readonly maxVerticalOffset: number;
  readonly resetToken: string;
  readonly syncRevision: number;
  readonly verticalOffset: number;
}

interface MatrixGestureSettled {
  readonly horizontalOffset: number;
  readonly progress: number;
  readonly verticalOffset: number;
}

interface MatrixModel {
  readonly columns: readonly MatrixColumn[];
  readonly contentWidth: number;
  readonly logicalCellCount: number;
  readonly matrixBodyViewportHeight: number;
  readonly matrixContentHeight: number;
  readonly matrixViewportHeight: number;
  readonly rows: readonly MatrixRow[];
  readonly shiftTypes: readonly MatrixShiftType[];
}

interface ReleaseDraftBatchView {
  readonly isBlocked: boolean;
  readonly key: string;
  readonly monthCountLabel: string;
  readonly months: readonly string[];
  readonly rangeEnd: string;
  readonly rangeStart: string;
  readonly revisionLabel: string;
  readonly roleName: string;
}

interface ReleaseVersionView {
  readonly canBackfill: boolean;
  readonly canDelete: boolean;
  readonly canRepublish: boolean;
  readonly canWithdraw: boolean;
  readonly id: string;
  readonly revisionLabel: string;
  readonly statusClass: string;
  readonly statusLabel: string;
}

interface ReleaseMonthGroupView {
  readonly archived: readonly ReleaseVersionView[];
  readonly archivedExpanded: boolean;
  readonly businessMonth: string;
  readonly current: readonly ReleaseVersionView[];
  readonly key: string;
  readonly past: readonly ReleaseVersionView[];
  readonly roleName: string;
}

interface ReleaseImpactView {
  readonly key: string;
  readonly summary: string;
}

interface ReleaseCalloutView {
  readonly message: string;
  readonly tone: 'danger' | 'info' | 'warning';
}

interface ManualPageData extends MatrixModel {
  readonly activeShiftTypeId: string;
  readonly buildLabel: string;
  readonly canApplyDraft: boolean;
  readonly canPreview: boolean;
  readonly canSave: boolean;
  readonly currentGroupName: string;
  readonly cycleDayIndex: number;
  readonly cycleDayOptions: readonly number[];
  readonly cycleDays: number;
  readonly errorMessage: string;
  readonly infoMessage: string;
  readonly isBusy: boolean;
  readonly limitNotice: string;
  readonly logicalCellCount: number;
  readonly matrixGestureConfig: MatrixGestureConfig;
  readonly memberCount: number;
  readonly memberOptions: readonly MemberOption[];
  readonly memberPanelOpen: boolean;
  readonly pageScrollStyle: string;
  readonly previewAssignmentCount: number;
  readonly previewConflictCount: number;
  readonly previewCycleNote: string;
  readonly previewDayCount: number;
  readonly previewEndLabel: string;
  readonly previewStartLabel: string;
  readonly previewVacancyCount: number;
  readonly previewWarningCount: number;
  readonly riskAccepted: boolean;
  readonly releaseAccepted: boolean;
  readonly releaseBlockedMessage: string;
  readonly releaseBlockedNeedsAcknowledgement: boolean;
  readonly releaseBlockedNeedsReplace: boolean;
  readonly releaseCallouts: readonly ReleaseCalloutView[];
  readonly releaseConfirmDisabled: boolean;
  readonly releaseConfirmLabel: string;
  readonly releaseDeleteIsBatch: boolean;
  readonly releaseDialogDanger: boolean;
  readonly releaseDialogKind: ReleaseDialogKind;
  readonly releaseDialogKicker: string;
  readonly releaseDialogMeta: string;
  readonly releaseDialogTitle: string;
  readonly releaseDraftBatches: readonly ReleaseDraftBatchView[];
  readonly releaseHasPastDates: boolean;
  readonly releaseMonthGroups: readonly ReleaseMonthGroupView[];
  readonly releasePastAccepted: boolean;
  readonly releasePreviewSummary: string;
  readonly releaseReplaceAccepted: boolean;
  readonly releaseRequiresAcknowledgement: boolean;
  readonly releaseWorkflowAccepted: boolean;
  readonly releaseWorkflowImpacts: readonly ReleaseImpactView[];
  readonly roleIndex: number;
  readonly roleOptions: readonly SelectorOption[];
  readonly scheduleRoleName: string;
  readonly scrollHint: string;
  readonly scrollProgressOffset: number;
  readonly scrollProgressPercent: number;
  readonly selectedTemplateId: string;
  readonly shellHeaderStyle: string;
  readonly stageIndex: number;
  readonly stages: readonly {
    readonly className: string;
    readonly index: number;
    readonly label: string;
    readonly marker: string;
  }[];
  readonly startDate: string;
  readonly startMonthLabel: string;
  readonly state: ManualPageState;
  readonly templateIndex: number;
  readonly templateLabel: string;
  readonly templateOptions: readonly SelectorOption[];
  readonly templateTitle: string;
}

interface PickerChangeEvent {
  readonly detail: { readonly value: number | string };
}

interface CheckboxChangeEvent {
  readonly currentTarget: {
    readonly dataset: { readonly field?: string; readonly membershipId?: string };
  };
  readonly detail: { readonly checked: boolean };
}

interface MatrixCellTapEvent {
  readonly currentTarget: {
    readonly dataset: {
      readonly columnIndex?: number | string;
      readonly key?: string;
      readonly rowIndex?: number | string;
    };
  };
}

interface ShiftTapEvent {
  readonly currentTarget: { readonly dataset: { readonly shiftTypeId?: string } };
}

interface ReleaseActionEvent {
  readonly currentTarget: {
    readonly dataset: {
      readonly batchKey?: string;
      readonly groupKey?: string;
      readonly periodId?: string;
    };
  };
}

interface ManualPageInstance {
  _applyOperationId: string;
  _cellValues: Map<string, string>;
  _config: SchedulingConfig | undefined;
  _currentGroupId: string;
  _holidays: ReadonlyMap<string, ConfirmedHolidayDate>;
  _history: readonly SchedulePeriodHistoryItem[];
  _isDirty: boolean;
  _matrixGestureRevision: number;
  _memberIds: string[];
  _memberNames: Map<string, string>;
  _releaseArchivedExpanded: Set<string>;
  _releaseBlockedBatchKey: string;
  _releaseDeleteTarget:
    | { readonly kind: 'batch'; readonly key: string }
    | { readonly kind: 'period'; readonly key: string }
    | undefined;
  _releaseImpact: ScheduleChangeImpactPreview | undefined;
  _releaseMutationAction: 'publish' | 'withdraw';
  _releaseMutationTargetId: string;
  _releaseOperationIds: Map<string, string>;
  _releasePublishPreview: ScheduleGenerationPreview | undefined;
  _selectedLocation: MatrixLocation | undefined;
  _staleCellKeys: Set<string>;
  _staleMemberIds: Set<string>;
  _templates: readonly ManualScheduleTemplate[];
  readonly data: ManualPageData;
  setData(patch: Partial<ManualPageData> & Record<string, unknown>, callback?: () => void): void;
  updateMatrixViewport(): void;
}

const MEMBER_COLUMN_WIDTH = 104;
const DATE_COLUMN_WIDTH = 72;
const MATRIX_HEADER_HEIGHT = 82;
const MATRIX_ROW_HEIGHT = 44;
const MATRIX_VISIBLE_ROWS = 7;
const MATRIX_VIEWPORT_HEIGHT = MATRIX_HEADER_HEIGHT + MATRIX_VISIBLE_ROWS * MATRIX_ROW_HEIGHT;
const MATRIX_PAGE_HORIZONTAL_CHROME = 30;
const MATRIX_VIEWPORT_FALLBACK_WIDTH = 290;
const EMPTY_ASSIGNMENT: MatrixAssignment = {
  abbreviation: '',
  color: '',
  shiftTypeId: '',
  textColor: '',
};
const cycleDayOptions = Array.from({ length: MAX_MANUAL_DAYS }, (_, index) => index + 1);
const requestAuthentication = getWechatRequestAuthentication();
const manualClient = createRuntimeManualScheduleClient(getStoredWechatToken, requestAuthentication);
const publicationClient = createRuntimeSchedulePublicationClient(
  getStoredWechatToken,
  requestAuthentication,
);
const workbenchClient = createWorkbenchReadClient();
const today = getTodayBusinessDate();
const emptyMatrix = createMatrixModel({
  activeShiftTypeId: '',
  cellValues: new Map(),
  cycleDays: 7,
  holidays: new Map(),
  memberIds: [],
  memberNames: new Map(),
  selectedLocation: undefined,
  shiftTypes: [],
  staleCellKeys: new Set(),
  staleMemberIds: new Set(),
  startDate: today,
});

Page({
  data: {
    ...emptyMatrix,
    activeShiftTypeId: '',
    buildLabel: buildInfo.buildLabel,
    canApplyDraft: false,
    canPreview: false,
    canSave: false,
    currentGroupName: '正在读取群组',
    cycleDayIndex: 6,
    cycleDayOptions,
    cycleDays: 7,
    errorMessage: '',
    infoMessage: '',
    isBusy: false,
    limitNotice: '',
    matrixGestureConfig: createMatrixGestureConfig(emptyMatrix, 0, 'initial'),
    memberCount: 0,
    memberOptions: [],
    memberPanelOpen: false,
    pageScrollStyle: 'height:calc(100% - 64px);',
    previewAssignmentCount: 0,
    previewConflictCount: 0,
    previewCycleNote: '',
    previewDayCount: MAX_MANUAL_DAYS,
    previewEndLabel: '',
    previewStartLabel: '',
    previewVacancyCount: 0,
    previewWarningCount: 0,
    riskAccepted: false,
    releaseAccepted: false,
    releaseBlockedMessage: '',
    releaseBlockedNeedsAcknowledgement: false,
    releaseBlockedNeedsReplace: false,
    releaseCallouts: [],
    releaseConfirmDisabled: true,
    releaseConfirmLabel: '',
    releaseDeleteIsBatch: false,
    releaseDialogDanger: false,
    releaseDialogKind: '' as ReleaseDialogKind,
    releaseDialogKicker: '',
    releaseDialogMeta: '',
    releaseDialogTitle: '',
    releaseDraftBatches: [],
    releaseHasPastDates: false,
    releaseMonthGroups: [],
    releasePastAccepted: false,
    releasePreviewSummary: '',
    releaseReplaceAccepted: false,
    releaseRequiresAcknowledgement: false,
    releaseWorkflowAccepted: false,
    releaseWorkflowImpacts: [],
    roleIndex: 0,
    roleOptions: [],
    scheduleRoleName: '',
    scrollHint: '向左滑动查看其余日期，人员列保持固定',
    scrollProgressOffset: 0,
    scrollProgressPercent: 0,
    selectedTemplateId: '',
    shellHeaderStyle: 'height:64px;min-height:64px;padding-top:8px;',
    stageIndex: 0,
    stages: createStages(0),
    startDate: today,
    startMonthLabel: today.slice(0, 7),
    state: 'loading' as ManualPageState,
    templateIndex: 0,
    templateLabel: '新建模板',
    templateOptions: [{ label: '新建模板', value: '' }],
    templateTitle: '七日循环模板',
  } satisfies ManualPageData,

  _applyOperationId: createOperationId(),
  _cellValues: new Map<string, string>(),
  _config: undefined,
  _currentGroupId: '',
  _holidays: new Map<string, ConfirmedHolidayDate>(),
  _history: [] as readonly SchedulePeriodHistoryItem[],
  _isDirty: false,
  _matrixGestureRevision: 0,
  _memberIds: [] as string[],
  _memberNames: new Map<string, string>(),
  _releaseArchivedExpanded: new Set<string>(),
  _releaseBlockedBatchKey: '',
  _releaseDeleteTarget: undefined,
  _releaseImpact: undefined,
  _releaseMutationAction: 'withdraw' as 'publish' | 'withdraw',
  _releaseMutationTargetId: '',
  _releaseOperationIds: new Map<string, string>(),
  _releasePublishPreview: undefined,
  _selectedLocation: undefined,
  _staleCellKeys: new Set<string>(),
  _staleMemberIds: new Set<string>(),
  _templates: [] as readonly ManualScheduleTemplate[],

  onLoad(this: ManualPageInstance): void {
    this.setData(createShellLayoutPatch());
    void loadManualPage(this);
  },

  onResize(this: ManualPageInstance): void {
    this.updateMatrixViewport();
  },

  handleReload(this: ManualPageInstance): void {
    void loadManualPage(this);
  },

  handleBack(): void {
    wx.navigateBack({ delta: 1 });
  },

  noop(): void {},

  handleTemplateChange(this: ManualPageInstance, event: PickerChangeEvent): void {
    if (this.data.isBusy) return;
    const index = Number(event.detail.value);
    const option = this.data.templateOptions[index];
    if (!Number.isInteger(index) || option === undefined) return;
    if (option.value === '') initializeNewTemplate(this);
    else {
      const template = this._templates.find((candidate) => candidate.id === option.value);
      if (template !== undefined) openTemplate(this, template);
    }
  },

  handleRoleChange(this: ManualPageInstance, event: PickerChangeEvent): void {
    if (this.data.isBusy) return;
    const index = Number(event.detail.value);
    const option = this.data.roleOptions[index];
    if (!Number.isInteger(index) || option === undefined || this._config === undefined) return;
    const role = this._config.roles.find((candidate) => candidate.id === option.value);
    if (role === undefined) return;
    this._memberIds = role.members.slice(0, 7).map((member) => member.membershipId);
    this._memberNames = new Map(
      role.members.map((member) => [member.membershipId, member.realName]),
    );
    this._cellValues.clear();
    this._staleCellKeys.clear();
    this._staleMemberIds.clear();
    this._selectedLocation = undefined;
    this._isDirty = true;
    syncEditor(this, {
      roleIndex: index,
      scheduleRoleName: role.name,
      selectedTemplateId: '',
      templateIndex: 0,
      templateLabel: '新建模板',
    });
  },

  handleStartDateChange(this: ManualPageInstance, event: PickerChangeEvent): void {
    if (this.data.isBusy) return;
    const startDate = String(event.detail.value);
    if (!isBusinessDate(startDate)) return;
    this._isDirty = true;
    syncEditor(this, { startDate, startMonthLabel: startDate.slice(0, 7) });
    void refreshHolidays(this, startDate);
  },

  handleCycleDaysChange(this: ManualPageInstance, event: PickerChangeEvent): void {
    if (this.data.isBusy) return;
    const index = Number(event.detail.value);
    const cycleDays = cycleDayOptions[index];
    if (cycleDays === undefined) return;
    for (const key of [...this._cellValues.keys()]) {
      if (Number(key.split(':')[0]) > cycleDays) this._cellValues.delete(key);
    }
    this._selectedLocation = undefined;
    this._isDirty = true;
    syncEditor(this, { cycleDayIndex: index, cycleDays });
  },

  handleMemberPanelToggle(this: ManualPageInstance): void {
    this.setData({ memberPanelOpen: !this.data.memberPanelOpen });
  },

  handleMemberToggle(this: ManualPageInstance, event: CheckboxChangeEvent): void {
    if (this.data.isBusy) return;
    const membershipId = event.currentTarget.dataset.membershipId;
    if (membershipId === undefined) return;
    if (event.detail.checked) {
      if (this._memberIds.length >= MAX_MANUAL_MEMBERS) {
        this.setData({ errorMessage: `单个模板最多选择 ${MAX_MANUAL_MEMBERS} 位值班人员。` });
        return;
      }
      if (!this._memberIds.includes(membershipId)) this._memberIds.push(membershipId);
    } else {
      this._memberIds = this._memberIds.filter((id) => id !== membershipId);
      for (const key of [...this._cellValues.keys()]) {
        if (key.endsWith(`:${membershipId}`)) this._cellValues.delete(key);
      }
      this._staleMemberIds.delete(membershipId);
      for (const key of [...this._staleCellKeys]) {
        if (key.endsWith(`:${membershipId}`)) this._staleCellKeys.delete(key);
      }
    }
    this._selectedLocation = undefined;
    this._isDirty = true;
    syncEditor(this, { errorMessage: '' });
  },

  handleShiftSelect(this: ManualPageInstance, event: ShiftTapEvent): void {
    if (this.data.isBusy) return;
    const shiftTypeId = event.currentTarget.dataset.shiftTypeId;
    if (!this.data.shiftTypes.some((shiftType) => shiftType.id === shiftTypeId)) return;
    this.setData({
      activeShiftTypeId: this.data.activeShiftTypeId === shiftTypeId ? '' : (shiftTypeId ?? ''),
    });
  },

  handleCellTap(this: ManualPageInstance, event: MatrixCellTapEvent): void {
    if (this.data.isBusy) return;
    const columnIndex = Number(event.currentTarget.dataset.columnIndex);
    const rowIndex = Number(event.currentTarget.dataset.rowIndex);
    const key = event.currentTarget.dataset.key;
    if (!Number.isInteger(columnIndex) || !Number.isInteger(rowIndex) || key === undefined) return;
    const cell = this.data.rows[rowIndex]?.cells[columnIndex];
    const shiftType = this.data.shiftTypes.find(
      (candidate) => candidate.id === this.data.activeShiftTypeId,
    );
    if (cell === undefined || cell.key !== key || cell.isStale || shiftType === undefined) return;

    const active = assignmentFromShiftType(shiftType);
    const before = assignmentFromCell(cell);
    const mutation = resolveManualCellMutation({
      active,
      before,
      isSameValue: (left, right) => left.shiftTypeId === right.shiftTypeId,
      key,
      mode: 'toggle',
    });
    const previousLocation = this._selectedLocation;
    const nextLocation = resolveManualSelection(
      previousLocation,
      { columnIndex, rowIndex },
      {
        isSame: isSameLocation,
        mode: 'toggle',
      },
    );
    const patch: Record<string, unknown> = {
      infoMessage: '',
    };
    if (
      previousLocation !== undefined &&
      !isSameLocation(previousLocation, { columnIndex, rowIndex })
    ) {
      const previousCell =
        this.data.rows[previousLocation.rowIndex]?.cells[previousLocation.columnIndex];
      if (previousCell !== undefined) {
        patch[cellPath(previousLocation)] = { ...previousCell, isSelected: false };
      }
    }
    this._cellValues = new Map(
      applyManualCellMutation(this._cellValues, {
        after: mutation.after?.shiftTypeId,
        before: mutation.before?.shiftTypeId,
        key,
      }),
    );
    patch[cellPath({ columnIndex, rowIndex })] = updateMatrixCell(
      cell,
      mutation.after,
      nextLocation !== undefined,
      this._memberNames.get(cell.membershipId) ?? '未知成员',
      this.data.shiftTypes,
    );
    patch['logicalCellCount'] = this._memberIds.length * this.data.cycleDays;
    patch['canPreview'] = false;
    this._isDirty = true;
    this._selectedLocation = nextLocation;
    this.setData(patch);
  },

  handleSaveTemplate(this: ManualPageInstance): void {
    void persistTemplate(this);
  },

  handlePreview(this: ManualPageInstance): void {
    void openPreview(this);
  },

  handleReturnToEditor(this: ManualPageInstance): void {
    if (this.data.isBusy) return;
    this.setData({
      errorMessage: '',
      riskAccepted: false,
      stageIndex: 0,
      stages: createStages(0),
      state: 'editor',
    });
  },

  handleRiskToggle(this: ManualPageInstance, event: CheckboxChangeEvent): void {
    if (this.data.isBusy) return;
    const riskAccepted = event.detail.checked;
    this.setData({
      canApplyDraft:
        this.data.previewConflictCount === 0 &&
        this.data.previewVacancyCount === 0 &&
        (this.data.previewWarningCount === 0 || riskAccepted),
      riskAccepted,
    });
  },

  handleApplyDraft(this: ManualPageInstance): void {
    void applyDraft(this);
  },

  handlePublishBatch(this: ManualPageInstance, event: ReleaseActionEvent): void {
    const batchKey = event.currentTarget.dataset.batchKey;
    if (batchKey !== undefined) void publishReleaseBatch(this, batchKey);
  },

  handleConfirmBlockedPublish(this: ManualPageInstance): void {
    if (
      this._releaseBlockedBatchKey === '' ||
      (this.data.releaseBlockedNeedsReplace && !this.data.releaseReplaceAccepted) ||
      (this.data.releaseBlockedNeedsAcknowledgement && !this.data.releaseWorkflowAccepted)
    ) {
      return;
    }
    void publishReleaseBatch(this, this._releaseBlockedBatchKey, {
      acknowledgeBlockers: true,
      acknowledgeWorkflowRevocations: this.data.releaseWorkflowAccepted,
      replacePublished: this.data.releaseReplaceAccepted,
    });
  },

  handleCancelBlockedPublish(this: ManualPageInstance): void {
    clearBlockedRelease(this);
  },

  handleReleaseBlockedToggle(this: ManualPageInstance, event: CheckboxChangeEvent): void {
    const field = event.currentTarget.dataset.field;
    if (field === 'replace') this.setData({ releaseReplaceAccepted: event.detail.checked });
    if (field === 'workflow') this.setData({ releaseWorkflowAccepted: event.detail.checked });
  },

  handleOpenDeleteDialog(this: ManualPageInstance, event: ReleaseActionEvent): void {
    const batchKey = event.currentTarget.dataset.batchKey;
    const periodId = event.currentTarget.dataset.periodId;
    if (batchKey !== undefined) {
      const batch = groupScheduleDraftBatches(this._history).find(
        (candidate) => candidate.key === batchKey,
      );
      if (batch === undefined) return;
      this._releaseDeleteTarget = { key: batchKey, kind: 'batch' };
      openDeleteDialog(
        this,
        `${batch.rangeStart} 至 ${batch.rangeEnd} · 共 ${batch.items.length} 个月`,
        `确定删除 ${batch.rangeStart} 至 ${batch.rangeEnd} 的排班草稿吗？删除后不可恢复。`,
        true,
      );
      return;
    }
    const period = this._history.find((item) => item.id === periodId);
    if (period === undefined) return;
    this._releaseDeleteTarget = { key: period.id, kind: 'period' };
    openDeleteDialog(
      this,
      `${period.businessMonth.slice(0, 7)} · ${period.scheduleRoleName}`,
      `确定删除 ${period.businessMonth.slice(0, 7)} 的归档排班吗？删除后不可恢复。`,
      false,
    );
  },

  handleConfirmReleaseDelete(this: ManualPageInstance): void {
    void confirmReleaseDelete(this);
  },

  handlePrepareWithdraw(this: ManualPageInstance, event: ReleaseActionEvent): void {
    const periodId = event.currentTarget.dataset.periodId;
    if (periodId !== undefined) void prepareReleaseMutation(this, periodId, 'withdraw');
  },

  handlePrepareRepublish(this: ManualPageInstance, event: ReleaseActionEvent): void {
    const periodId = event.currentTarget.dataset.periodId;
    if (periodId !== undefined) void prepareReleaseMutation(this, periodId, 'publish');
  },

  handleReleaseAcknowledgement(this: ManualPageInstance, event: CheckboxChangeEvent): void {
    const releaseAccepted =
      event.currentTarget.dataset.field === 'impact'
        ? event.detail.checked
        : this.data.releaseAccepted;
    const releasePastAccepted =
      event.currentTarget.dataset.field === 'past'
        ? event.detail.checked
        : this.data.releasePastAccepted;
    const releaseConfirmDisabled = !canConfirmSchedulePeriodMutation({
      acknowledgePastDates: releasePastAccepted,
      acknowledgeWorkflowRevocations: releaseAccepted,
      action: this.data.releaseDialogKind === 'republish' ? 'publish' : 'withdraw',
      hasPastDates: this.data.releaseHasPastDates,
      hasTarget: this._releaseMutationTargetId !== '',
      requiresAcknowledgement: this.data.releaseRequiresAcknowledgement,
    });
    this.setData({ releaseAccepted, releaseConfirmDisabled, releasePastAccepted });
  },

  handleConfirmReleaseMutation(this: ManualPageInstance): void {
    void confirmReleaseMutation(this);
  },

  handleCloseReleaseDialog(this: ManualPageInstance): void {
    closeReleaseDialog(this);
  },

  handleToggleArchived(this: ManualPageInstance, event: ReleaseActionEvent): void {
    const groupKey = event.currentTarget.dataset.groupKey;
    if (groupKey === undefined) return;
    if (this._releaseArchivedExpanded.has(groupKey)) this._releaseArchivedExpanded.delete(groupKey);
    else this._releaseArchivedExpanded.add(groupKey);
    syncReleaseHistory(this);
  },

  handlePreviewReleaseVersion(this: ManualPageInstance, event: ReleaseActionEvent): void {
    const periodId = event.currentTarget.dataset.periodId;
    if (periodId !== undefined) void previewReleaseVersion(this, periodId);
  },

  handleNavigateBackfill(this: ManualPageInstance, event: ReleaseActionEvent): void {
    const periodId = event.currentTarget.dataset.periodId;
    if (periodId === undefined) return;
    wx.navigateTo({
      url: `/subpackages/scheduling/pages/backfill/index?schedulePeriodId=${encodeURIComponent(periodId)}`,
    });
  },

  updateMatrixViewport(this: ManualPageInstance): void {
    const matrix = createMatrixModelFromPage(this);
    const matrixGestureConfig = createMatrixGestureConfig(
      matrix,
      resolveMaxHorizontalOffset(matrix),
      createMatrixResetToken(this.data),
      this.data.matrixGestureConfig.horizontalOffset,
      this.data.matrixGestureConfig.verticalOffset,
      this._matrixGestureRevision,
    );
    this.setData({ matrixGestureConfig, ...createScrollProgressPatch(matrix.columns.length, 0) });
  },

  handleMatrixGestureSettled(this: ManualPageInstance, result: MatrixGestureSettled): void {
    if (
      !Number.isFinite(result.horizontalOffset) ||
      !Number.isFinite(result.progress) ||
      !Number.isFinite(result.verticalOffset)
    ) {
      return;
    }
    const progress = Math.max(0, Math.min(1, result.progress));
    this._matrixGestureRevision += 1;
    this.setData({
      ...createScrollProgressPatch(this.data.columns.length, progress),
      matrixGestureConfig: createMatrixGestureConfig(
        this.data,
        this.data.matrixGestureConfig.maxHorizontalOffset,
        createMatrixResetToken(this.data),
        result.horizontalOffset,
        result.verticalOffset,
        this._matrixGestureRevision,
      ),
    });
  },

  commitScrollProgress(this: ManualPageInstance, progress: number): void {
    this.setData(createScrollProgressPatch(this.data.columns.length, progress));
  },
});

async function loadManualPage(page: ManualPageInstance): Promise<void> {
  page.setData({ errorMessage: '', isBusy: true, state: 'loading' });
  try {
    const groups = await workbenchClient.listGroups();
    const ownerId = getStoredWechatProfile()?.id;
    if (ownerId === undefined) throw new Error('登录状态已失效，请重新登录。');
    const storedGroupId = readStoredWorkbenchGroupId(ownerId);
    const group =
      groups.find(
        (candidate) =>
          candidate.id === storedGroupId &&
          (candidate.role === 'administrator' ||
            candidate.role === 'owner' ||
            candidate.isDeveloperAdmin),
      ) ??
      groups.find(
        (candidate) =>
          candidate.role === 'administrator' ||
          candidate.role === 'owner' ||
          candidate.isDeveloperAdmin,
      );
    if (group === undefined) throw new Error('仅管理员与群主可以使用手动排班。');
    page._currentGroupId = group.id;
    writeStoredWorkbenchGroupId(ownerId, group.id);
    const [config, templates, history] = await Promise.all([
      manualClient.getConfig(group.id),
      manualClient.listTemplates(group.id),
      publicationClient.listHistory(group.id),
    ]);
    page._config = config;
    page._templates = templates;
    page._history = history;
    page._holidays = await loadHolidayMap(today).catch(() => new Map());
    page.setData({ currentGroupName: group.name, isBusy: false });
    if (templates[0] !== undefined) openTemplate(page, templates[0]);
    else initializeNewTemplate(page);
  } catch (error) {
    page.setData({
      errorMessage: toUserMessage(error, '手动排班暂时无法加载，请稍后重试。'),
      isBusy: false,
      state: 'error',
    });
  }
}

function initializeNewTemplate(page: ManualPageInstance): void {
  const role = page._config?.roles[0];
  page._cellValues.clear();
  page._staleCellKeys.clear();
  page._staleMemberIds.clear();
  page._selectedLocation = undefined;
  page._isDirty = true;
  page._memberIds = role?.members.slice(0, 7).map((member) => member.membershipId) ?? [];
  page._memberNames = new Map(
    (role?.members ?? []).map((member) => [member.membershipId, member.realName]),
  );
  syncEditor(page, {
    activeShiftTypeId: firstEnabledShiftTypeId(page._config),
    cycleDayIndex: 6,
    cycleDays: 7,
    errorMessage: '',
    infoMessage: '',
    roleIndex: 0,
    scheduleRoleName: role?.name ?? '',
    selectedTemplateId: '',
    stageIndex: 0,
    startDate: today,
    startMonthLabel: today.slice(0, 7),
    state: 'editor',
    templateIndex: 0,
    templateLabel: '新建模板',
    templateTitle: '七日循环模板',
  });
}

function openTemplate(
  page: ManualPageInstance,
  template: ManualScheduleTemplate,
  startDate = today,
): void {
  const roleIndex = Math.max(
    0,
    (page._config?.roles ?? []).findIndex((role) => role.id === template.scheduleRoleId),
  );
  const role = page._config?.roles[roleIndex];
  page._memberIds = template.members.map((member) => member.membershipId);
  page._memberNames = new Map([
    ...(role?.members.map((member) => [member.membershipId, member.realName] as const) ?? []),
    ...template.members.map((member) => [member.membershipId, member.realName] as const),
  ]);
  page._cellValues = new Map(
    template.cells.map((cell) => [`${cell.cycleDay}:${cell.membershipId}`, cell.shiftTypeId]),
  );
  page._staleMemberIds = new Set(
    template.members.filter((member) => member.isStale).map((member) => member.membershipId),
  );
  page._staleCellKeys = new Set(
    template.cells
      .filter((cell) => cell.isStale)
      .map((cell) => `${cell.cycleDay}:${cell.membershipId}`),
  );
  page._selectedLocation = undefined;
  page._isDirty = false;
  const templateIndex = page._templates.findIndex((candidate) => candidate.id === template.id) + 1;
  syncEditor(page, {
    activeShiftTypeId: firstEnabledShiftTypeId(page._config),
    cycleDayIndex: template.cycleDays - 1,
    cycleDays: template.cycleDays,
    errorMessage: '',
    infoMessage: '',
    roleIndex,
    scheduleRoleName: template.scheduleRoleName,
    selectedTemplateId: template.id,
    stageIndex: 0,
    startDate,
    startMonthLabel: startDate.slice(0, 7),
    state: 'editor',
    templateIndex,
    templateLabel: templateOptionLabel(template),
    templateTitle: `${template.cycleDays} 日循环模板`,
  });
}

function syncEditor(page: ManualPageInstance, patch: Partial<ManualPageData>): void {
  const data = { ...page.data, ...patch };
  const role = roleForIndex(page._config, data.roleIndex);
  const shiftTypes = enabledShiftTypes(page._config);
  const activeShiftTypeId = shiftTypes.some((item) => item.id === data.activeShiftTypeId)
    ? data.activeShiftTypeId
    : (shiftTypes[0]?.id ?? '');
  const matrix = createMatrixModel({
    activeShiftTypeId,
    cellValues: page._cellValues,
    cycleDays: data.cycleDays,
    holidays: page._holidays,
    memberIds: page._memberIds,
    memberNames: page._memberNames,
    selectedLocation: page._selectedLocation,
    shiftTypes,
    staleCellKeys: page._staleCellKeys,
    staleMemberIds: page._staleMemberIds,
    startDate: data.startDate,
  });
  const logicalCellCount = page._memberIds.length * data.cycleDays;
  const withinLimits =
    page._memberIds.length > 0 &&
    page._memberIds.length <= MAX_MANUAL_MEMBERS &&
    data.cycleDays <= MAX_MANUAL_DAYS &&
    logicalCellCount <= MAX_MANUAL_CELLS &&
    page._cellValues.size <= MAX_MANUAL_CELLS;
  const templateOptions = createTemplateOptions(page._templates);
  const templateIndex = Math.max(
    0,
    templateOptions.findIndex((option) => option.value === data.selectedTemplateId),
  );
  const matrixGestureConfig = createMatrixGestureConfig(
    matrix,
    resolveMaxHorizontalOffset(matrix),
    `${data.selectedTemplateId || 'new'}:${data.cycleDays}:${page._memberIds.join(',')}:${data.startDate}`,
    0,
    0,
    ++page._matrixGestureRevision,
  );
  page.setData({
    ...matrix,
    ...patch,
    activeShiftTypeId,
    canPreview:
      withinLimits &&
      role !== undefined &&
      shiftTypes.length > 0 &&
      data.selectedTemplateId !== '' &&
      !page._isDirty,
    canSave: withinLimits && role !== undefined && shiftTypes.length > 0,
    isBusy: false,
    limitNotice: logicalCellCount === MAX_MANUAL_CELLS ? '已达到 20 人 × 30 天 = 600 格上限。' : '',
    logicalCellCount,
    matrixGestureConfig,
    memberCount: page._memberIds.length,
    memberOptions: createMemberOptions(page, role),
    roleOptions: createRoleOptions(page._config),
    scheduleRoleName: patch.scheduleRoleName ?? role?.name ?? data.scheduleRoleName,
    selectedTemplateId: data.selectedTemplateId,
    templateIndex,
    templateLabel: templateOptions[templateIndex]?.label ?? '新建模板',
    templateOptions,
    stages: createStages(patch.stageIndex ?? data.stageIndex),
  });
}

async function persistTemplate(
  page: ManualPageInstance,
): Promise<ManualScheduleTemplate | undefined> {
  if (page.data.isBusy) return undefined;
  const role = roleForIndex(page._config, page.data.roleIndex);
  if (!page.data.canSave || role === undefined) {
    page.setData({ errorMessage: '请选择排班岗位、值班人员和可用班种。' });
    return undefined;
  }
  page.setData({ errorMessage: '', infoMessage: '', isBusy: true });
  const request = {
    cells: [...page._cellValues.entries()].map(([key, shiftTypeId]) => {
      const [cycleDayText = '', ...membershipParts] = key.split(':');
      return {
        cycleDay: Number(cycleDayText),
        membershipId: membershipParts.join(':'),
        shiftTypeId,
      };
    }),
    cycleDays: page.data.cycleDays,
    membershipIds: [...page._memberIds],
    scheduleRoleId: role.id,
    startDate: page.data.startDate,
  };
  try {
    const selected = page._templates.find(
      (template) => template.id === page.data.selectedTemplateId,
    );
    const saved =
      selected === undefined
        ? await manualClient.createTemplate(page._currentGroupId, request)
        : await manualClient.updateTemplate(page._currentGroupId, selected.id, {
            ...request,
            expectedVersion: selected.version,
          });
    page._templates = [saved, ...page._templates.filter((template) => template.id !== saved.id)];
    openTemplate(page, saved, saved.startDate);
    page.setData({ infoMessage: '模板已保存，尚未创建正式班次。', isBusy: false });
    return saved;
  } catch (error) {
    page.setData({
      errorMessage: toUserMessage(error, '模板暂时无法保存，请稍后重试。'),
      isBusy: false,
    });
    return undefined;
  }
}

async function openPreview(page: ManualPageInstance): Promise<void> {
  if (page.data.isBusy) return;
  const template = page._templates.find(
    (candidate) => candidate.id === page.data.selectedTemplateId,
  );
  if (!page.data.canPreview || page._isDirty || template === undefined) {
    page.setData({ errorMessage: '请先保存模板，再生成排班预览。' });
    return;
  }
  if (page._config === undefined) return;
  page.setData({ errorMessage: '', infoMessage: '', isBusy: true });
  const endDate = addBusinessDays(page.data.startDate, MAX_MANUAL_DAYS - 1);
  try {
    const preview = await manualClient.preview(page._currentGroupId, template.id, {
      endDate,
      expectedRulesVersion: page._config.rulesVersion,
      startDate: page.data.startDate,
    });
    applyPreviewData(page, preview);
  } catch (error) {
    page.setData({
      errorMessage: toUserMessage(error, '排班预览暂时无法生成，请稍后重试。'),
      isBusy: false,
    });
  }
}

function applyPreviewData(page: ManualPageInstance, preview: ManualApplyPreview): void {
  const dayCount = getInclusiveDayCount(preview.applyStartDate, preview.applyEndDate);
  const blockers = preview.conflicts.length + preview.vacancies.length;
  page._applyOperationId = createOperationId();
  page.setData({
    canApplyDraft: blockers === 0 && preview.continuousDutyWarnings.length === 0,
    isBusy: false,
    previewAssignmentCount: preview.assignments.length,
    previewConflictCount: preview.conflicts.length,
    previewCycleNote: `${preview.cycleDays} 日模板循环生成 ${preview.assignments.length} 个班次。`,
    previewDayCount: dayCount,
    previewEndLabel: formatShortDate(preview.applyEndDate),
    previewStartLabel: formatShortDate(preview.applyStartDate),
    previewVacancyCount: preview.vacancies.length,
    previewWarningCount: preview.continuousDutyWarnings.length,
    riskAccepted: false,
    stageIndex: 1,
    stages: createStages(1),
    state: 'preview',
  });
}

async function applyDraft(page: ManualPageInstance): Promise<void> {
  const templateId = page.data.selectedTemplateId;
  const config = page._config;
  if (page.data.isBusy || !page.data.canApplyDraft || templateId === '' || config === undefined) {
    return;
  }
  page.setData({ errorMessage: '', infoMessage: '', isBusy: true });
  const endDate = addBusinessDays(page.data.startDate, MAX_MANUAL_DAYS - 1);
  try {
    const result = await manualClient.apply(page._currentGroupId, templateId, {
      acknowledgeBlockers: page.data.riskAccepted,
      endDate,
      expectedRulesVersion: config.rulesVersion,
      operationId: page._applyOperationId,
      publishMode: 'draft',
      startDate: page.data.startDate,
    });
    await reloadReleaseHistory(
      page,
      `已保存 ${result.preview.applyStartDate} 至 ${result.preview.applyEndDate} 的排班草稿。`,
    );
  } catch (error) {
    page.setData({
      errorMessage: toUserMessage(error, '排班草稿暂时无法保存，请稍后重试。'),
      isBusy: false,
    });
  }
}

async function reloadReleaseHistory(page: ManualPageInstance, infoMessage = ''): Promise<void> {
  let refreshError = '';
  try {
    page._history = await publicationClient.listHistory(page._currentGroupId);
  } catch {
    refreshError = '操作已完成，但发布记录刷新失败，请稍后重新进入本页。';
  }
  page._releaseBlockedBatchKey = '';
  page._releaseDeleteTarget = undefined;
  page._releaseImpact = undefined;
  page._releaseMutationTargetId = '';
  page._releasePublishPreview = undefined;
  syncReleaseHistory(page, {
    errorMessage: refreshError,
    infoMessage,
    isBusy: false,
    releaseDialogKind: '',
    riskAccepted: false,
    stageIndex: 3,
    state: 'release',
  });
}

function syncReleaseHistory(page: ManualPageInstance, patch: Partial<ManualPageData> = {}): void {
  const draftBatches = groupScheduleDraftBatches(page._history).map((batch) => ({
    isBlocked: batch.key === page._releaseBlockedBatchKey,
    key: batch.key,
    monthCountLabel: `共 ${batch.items.length} 个月`,
    months: batch.items.map((item) => item.businessMonth.slice(0, 7)),
    rangeEnd: batch.rangeEnd,
    rangeStart: batch.rangeStart,
    revisionLabel: `草稿 #${Math.max(...batch.items.map((item) => item.revision))}`,
    roleName: batch.roleName,
  }));
  const monthGroups = groupScheduleVersionMonths(page._history).map((group) => {
    const key = `${group.businessMonth}|${group.items[0]?.scheduleRoleId ?? ''}`;
    return {
      archived: group.archived.map(toReleaseVersionView),
      archivedExpanded: page._releaseArchivedExpanded.has(key),
      businessMonth: group.businessMonth.slice(0, 7),
      current: group.current.map(toReleaseVersionView),
      key,
      past: group.past.map(toReleaseVersionView),
      roleName: group.roleName,
    };
  });
  page.setData({
    ...patch,
    releaseDraftBatches: draftBatches,
    releaseMonthGroups: monthGroups,
    stages: createStages(patch.stageIndex ?? page.data.stageIndex),
  });
}

function toReleaseVersionView(item: SchedulePeriodHistoryItem): ReleaseVersionView {
  const status = item.status;
  return {
    canBackfill: status === 'past',
    canDelete: status === 'replaced' || status === 'withdrawn',
    canRepublish: status === 'replaced' || status === 'withdrawn',
    canWithdraw: status === 'published',
    id: item.id,
    revisionLabel: `草稿 #${item.revision}`,
    statusClass: status === 'published' ? 'is-current' : status === 'past' ? 'is-past' : '',
    statusLabel:
      status === 'published' ? '当前已发布' : status === 'past' ? '既往排班（锁定）' : '已归档',
  };
}

async function publishReleaseBatch(
  page: ManualPageInstance,
  batchKey: string,
  options: {
    readonly acknowledgeBlockers?: boolean;
    readonly acknowledgeWorkflowRevocations?: boolean;
    readonly replacePublished?: boolean;
  } = {},
): Promise<void> {
  if (page.data.isBusy) return;
  const batch = groupScheduleDraftBatches(page._history).find(
    (candidate) => candidate.key === batchKey,
  );
  if (batch === undefined) return;
  page.setData({ errorMessage: '', infoMessage: '', isBusy: true });
  const operationKey = `publish-batch:${batch.key}`;
  try {
    const intent = createScheduleDraftBatchPublishIntent(batch, options);
    const result = await publicationClient.publishBatch(page._currentGroupId, {
      ...intent,
      operationId: getReleaseOperationId(page, operationKey),
    });
    page._releaseOperationIds.delete(operationKey);
    await reloadReleaseHistory(
      page,
      `已发布 ${batch.rangeStart} 至 ${batch.rangeEnd} 的排班（共 ${result.periods.length} 个月）。`,
    );
  } catch (error) {
    if (error instanceof ClientCoreError && error.code === 'CONFLICT') {
      const latest = error.latestData;
      const needsReplace = typeof latest?.['existingPublishedPeriodId'] === 'string';
      const workflowImpacts = readWorkflowImpacts(latest?.['workflowImpacts']);
      if (needsReplace) {
        page._history = await publicationClient
          .listHistory(page._currentGroupId)
          .catch(() => page._history);
      }
      page._releaseBlockedBatchKey = batch.key;
      syncReleaseHistory(page, {
        isBusy: false,
        releaseBlockedMessage: error.message,
        releaseBlockedNeedsAcknowledgement:
          workflowImpacts.length > 0 || latest?.['preview'] !== undefined,
        releaseBlockedNeedsReplace: needsReplace,
        releaseReplaceAccepted: false,
        releaseWorkflowAccepted: false,
        releaseWorkflowImpacts: workflowImpacts.map(toReleaseImpactView),
      });
    } else {
      page.setData({
        errorMessage: toUserMessage(error, '排班草稿暂时无法发布，请稍后重试。'),
        isBusy: false,
      });
    }
  }
}

function clearBlockedRelease(page: ManualPageInstance): void {
  page._releaseBlockedBatchKey = '';
  syncReleaseHistory(page, {
    releaseBlockedMessage: '',
    releaseBlockedNeedsAcknowledgement: false,
    releaseBlockedNeedsReplace: false,
    releaseReplaceAccepted: false,
    releaseWorkflowAccepted: false,
    releaseWorkflowImpacts: [],
  });
}

function openDeleteDialog(
  page: ManualPageInstance,
  meta: string,
  message: string,
  isBatch: boolean,
): void {
  page.setData({
    releaseCallouts: [{ message, tone: 'danger' }],
    releaseConfirmDisabled: false,
    releaseConfirmLabel: isBatch ? '删除草稿' : '删除版本',
    releaseDeleteIsBatch: isBatch,
    releaseDialogDanger: true,
    releaseDialogKind: 'delete',
    releaseDialogKicker: '不可恢复操作',
    releaseDialogMeta: meta,
    releaseDialogTitle: isBatch ? '删除排班草稿' : '删除归档排班',
    releasePreviewSummary: '',
    releaseWorkflowImpacts: [],
  });
}

async function confirmReleaseDelete(page: ManualPageInstance): Promise<void> {
  if (page.data.isBusy || page._releaseDeleteTarget === undefined) return;
  const target = page._releaseDeleteTarget;
  const periodIds =
    target.kind === 'batch'
      ? (groupScheduleDraftBatches(page._history)
          .find((batch) => batch.key === target.key)
          ?.items.map((item) => item.id) ?? [])
      : [target.key];
  if (periodIds.length === 0) return;
  page.setData({ errorMessage: '', isBusy: true });
  try {
    for (const periodId of periodIds) {
      const operationKey = `delete-period:${periodId}`;
      await publicationClient.deleteDraft(
        page._currentGroupId,
        periodId,
        getReleaseOperationId(page, operationKey),
      );
      page._releaseOperationIds.delete(operationKey);
    }
    await reloadReleaseHistory(page, '排班草稿或归档版本已删除。');
  } catch (error) {
    page.setData({
      errorMessage: toUserMessage(error, '排班版本暂时无法删除，请稍后重试。'),
      isBusy: false,
    });
  }
}

async function prepareReleaseMutation(
  page: ManualPageInstance,
  periodId: string,
  action: 'publish' | 'withdraw',
): Promise<void> {
  if (page.data.isBusy) return;
  const target = page._history.find((item) => item.id === periodId);
  if (target === undefined) return;
  page._releaseMutationTargetId = periodId;
  page._releaseMutationAction = action;
  page._releaseImpact = undefined;
  page._releasePublishPreview = undefined;
  page.setData({ errorMessage: '', isBusy: true });
  try {
    const [impact, preview] = await Promise.all([
      publicationClient.previewChangeImpact(page._currentGroupId, periodId, action),
      action === 'publish'
        ? publicationClient.getDraftPreview(page._currentGroupId, periodId)
        : Promise.resolve(undefined),
    ]);
    page._releaseImpact = impact;
    page._releasePublishPreview = preview;
    const hasBlockers = hasSchedulePeriodMutationBlockers(action, preview);
    const hasPastDates = hasSchedulePeriodPastDates(target, {
      getBusinessDate: getTodayBusinessDate,
      getCurrentBusinessMonth: () => getTodayBusinessDate().slice(0, 7),
    });
    const requiresAcknowledgement = requiresSchedulePeriodMutationAcknowledgement({
      hasBlockers,
      hasPastDates,
      workflowImpacts: impact.workflowImpacts,
    });
    const impacts = impact.workflowImpacts.map(toReleaseImpactView);
    const callouts: ReleaseCalloutView[] =
      action === 'withdraw'
        ? [
            {
              message:
                '撤销后仅未来日期失效；已过日期将保留为既往排班（锁定），仍在月历中显示且不可修改。',
              tone: 'warning',
            },
          ]
        : [
            {
              message: '重新发布后，该版本将成为当前排班，原当前版本自动进入归档。',
              tone: 'info',
            },
            ...(hasPastDates
              ? [
                  {
                    message:
                      '该版本包含已过日期；已过日期不可修改，发布后仍保持既往排班（锁定）状态，是否发布？',
                    tone: 'warning' as const,
                  },
                ]
              : []),
            ...(hasBlockers
              ? [
                  {
                    message: `该归档版本包含 ${preview?.hardConflicts.length ?? 0} 处硬冲突和 ${preview?.vacancies.length ?? 0} 个空缺。`,
                    tone: 'warning' as const,
                  },
                ]
              : []),
          ];
    page.setData({
      isBusy: false,
      releaseAccepted: false,
      releaseCallouts: callouts,
      releaseConfirmDisabled: requiresAcknowledgement,
      releaseConfirmLabel: action === 'withdraw' ? '确认撤销发布' : '确认重新发布',
      releaseDialogDanger: action === 'withdraw',
      releaseDialogKind: action === 'withdraw' ? 'withdraw' : 'republish',
      releaseDialogKicker: '排班版本变更',
      releaseDialogMeta: `${target.businessMonth.slice(0, 7)} · ${target.scheduleRoleName}`,
      releaseDialogTitle: action === 'withdraw' ? '撤销当前排班' : '重新发布归档排班',
      releaseHasPastDates: hasPastDates,
      releasePastAccepted: false,
      releasePreviewSummary: '',
      releaseRequiresAcknowledgement: requiresAcknowledgement,
      releaseWorkflowImpacts: impacts,
    });
  } catch (error) {
    page._releaseMutationTargetId = '';
    page.setData({
      errorMessage: toUserMessage(error, '排班变更影响暂时无法读取，请稍后重试。'),
      isBusy: false,
    });
  }
}

async function confirmReleaseMutation(page: ManualPageInstance): Promise<void> {
  const target = page._history.find((item) => item.id === page._releaseMutationTargetId);
  if (page.data.isBusy || target === undefined || page.data.releaseConfirmDisabled) return;
  const action = page._releaseMutationAction;
  const hasBlockers = hasSchedulePeriodMutationBlockers(action, page._releasePublishPreview);
  const intent = createSchedulePeriodMutationIntent(target, {
    acknowledgeWorkflowRevocations: page.data.releaseAccepted,
    action,
    hasBlockers,
  });
  const operationKey = `${action === 'publish' ? 'publish' : 'withdraw'}-period:${target.id}`;
  page.setData({ errorMessage: '', isBusy: true });
  try {
    if (intent.action === 'publish') {
      await publicationClient.publish(page._currentGroupId, target.id, {
        ...intent.request,
        operationId: getReleaseOperationId(page, operationKey),
      });
    } else {
      await publicationClient.withdraw(page._currentGroupId, target.id, {
        ...intent.request,
        operationId: getReleaseOperationId(page, operationKey),
      });
    }
    page._releaseOperationIds.delete(operationKey);
    await reloadReleaseHistory(
      page,
      action === 'publish'
        ? `${target.businessMonth.slice(0, 7)} 的归档排班已重新发布。`
        : `${target.businessMonth.slice(0, 7)} 的当前排班已撤销并归档。`,
    );
  } catch (error) {
    page.setData({
      errorMessage: toUserMessage(error, '排班版本暂时无法变更，请稍后重试。'),
      isBusy: false,
    });
  }
}

async function previewReleaseVersion(page: ManualPageInstance, periodId: string): Promise<void> {
  if (page.data.isBusy) return;
  const target = page._history.find((item) => item.id === periodId);
  if (target === undefined) return;
  page.setData({ errorMessage: '', isBusy: true });
  try {
    const model: ScheduleGenerationPreview | CalendarReadModel =
      target.status === 'draft'
        ? await publicationClient.getDraftPreview(page._currentGroupId, periodId)
        : await publicationClient.getPeriodCalendar(page._currentGroupId, periodId);
    const summary =
      'statistics' in model
        ? `${model.assignments.length} 个班次 · ${model.vacancies.length} 个空缺 · ${model.hardConflicts.length} 个冲突`
        : `${model.assignments.length} 个班次 · ${model.members.length} 位成员`;
    page.setData({
      isBusy: false,
      releaseCallouts: [{ message: summary, tone: 'info' }],
      releaseConfirmDisabled: false,
      releaseConfirmLabel: '关闭',
      releaseDialogDanger: false,
      releaseDialogKind: 'preview',
      releaseDialogKicker: '排班版本预览',
      releaseDialogMeta: `${target.businessMonth.slice(0, 7)} · ${target.scheduleRoleName}`,
      releaseDialogTitle: target.status === 'draft' ? '草稿预览' : '排班版本预览',
      releasePreviewSummary: summary,
      releaseWorkflowImpacts: [],
    });
  } catch (error) {
    page.setData({
      errorMessage: toUserMessage(error, '排班版本暂时无法预览，请稍后重试。'),
      isBusy: false,
    });
  }
}

function closeReleaseDialog(page: ManualPageInstance): void {
  page._releaseDeleteTarget = undefined;
  page._releaseImpact = undefined;
  page._releaseMutationTargetId = '';
  page._releasePublishPreview = undefined;
  page.setData({
    releaseAccepted: false,
    releaseCallouts: [],
    releaseDialogKind: '',
    releasePastAccepted: false,
    releasePreviewSummary: '',
    releaseWorkflowImpacts: [],
  });
}

function readWorkflowImpacts(value: unknown): readonly ScheduleWorkflowImpact[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is ScheduleWorkflowImpact => {
    if (item === null || typeof item !== 'object') return false;
    const record = item as Readonly<Record<string, unknown>>;
    return (
      typeof record['id'] === 'string' &&
      (record['kind'] === 'swap' || record['kind'] === 'duty_adjustment') &&
      Array.isArray(record['businessDates']) &&
      Array.isArray(record['memberNames']) &&
      typeof record['status'] === 'string'
    );
  });
}

function toReleaseImpactView(impact: ScheduleWorkflowImpact): ReleaseImpactView {
  return {
    key: impact.id,
    summary: `${impact.kind === 'swap' ? '换班' : '加扣班'} · ${impact.memberNames.join('、')} · ${impact.businessDates.join('、')}`,
  };
}

function getReleaseOperationId(page: ManualPageInstance, key: string): string {
  const existing = page._releaseOperationIds.get(key);
  if (existing !== undefined) return existing;
  const created = createOperationId();
  page._releaseOperationIds.set(key, created);
  return created;
}

function createMatrixModel(options: {
  readonly activeShiftTypeId: string;
  readonly cellValues: ReadonlyMap<string, string>;
  readonly cycleDays: number;
  readonly holidays: ReadonlyMap<string, ConfirmedHolidayDate>;
  readonly memberIds: readonly string[];
  readonly memberNames: ReadonlyMap<string, string>;
  readonly selectedLocation: MatrixLocation | undefined;
  readonly shiftTypes: readonly MatrixShiftType[];
  readonly staleCellKeys: ReadonlySet<string>;
  readonly staleMemberIds: ReadonlySet<string>;
  readonly startDate: string;
}): MatrixModel {
  const columns = Array.from({ length: options.cycleDays }, (_, index) =>
    createColumn(options.startDate, index, options.holidays),
  );
  const shiftTypesById = new Map(options.shiftTypes.map((shiftType) => [shiftType.id, shiftType]));
  const rows = options.memberIds.map((membershipId, rowIndex) => {
    const realName = options.memberNames.get(membershipId) ?? '未知成员';
    const isStale = options.staleMemberIds.has(membershipId);
    return {
      cells: columns.map((column, columnIndex) => {
        const key = `${column.cycleDay}:${membershipId}`;
        const shiftType = shiftTypesById.get(options.cellValues.get(key) ?? '');
        return createCell({
          column,
          columnIndex,
          isSelected:
            options.selectedLocation?.rowIndex === rowIndex &&
            options.selectedLocation.columnIndex === columnIndex,
          isStale: isStale || options.staleCellKeys.has(key),
          key,
          membershipId,
          realName,
          rowIndex,
          shiftType,
        });
      }),
      isStale,
      membershipId,
      realName,
      rowIndex,
    };
  });
  return {
    columns,
    contentWidth: MEMBER_COLUMN_WIDTH + columns.length * DATE_COLUMN_WIDTH,
    logicalCellCount: rows.length * columns.length,
    matrixBodyViewportHeight: MATRIX_VIEWPORT_HEIGHT - MATRIX_HEADER_HEIGHT,
    matrixContentHeight: MATRIX_HEADER_HEIGHT + rows.length * MATRIX_ROW_HEIGHT,
    matrixViewportHeight: MATRIX_VIEWPORT_HEIGHT,
    rows,
    shiftTypes: options.shiftTypes,
  };
}

function createColumn(
  startDate: string,
  columnIndex: number,
  holidays: ReadonlyMap<string, ConfirmedHolidayDate>,
): MatrixColumn {
  const businessDate = addBusinessDays(startDate, columnIndex);
  const date = parseBusinessDate(businessDate);
  const holiday = holidays.get(businessDate);
  return {
    businessDate,
    cycleDay: columnIndex + 1,
    dateLabel: businessDate.slice(5),
    holidayLabel: holiday?.isOffDay === true ? holiday.holidayName : '',
    isWeekend: date.getUTCDay() === 0 || date.getUTCDay() === 6,
    isWorkday: holiday?.isWorkday === true,
    weekdayLabel: `周${['日', '一', '二', '三', '四', '五', '六'][date.getUTCDay()] ?? '日'}`,
  };
}

function createCell(options: {
  readonly column: MatrixColumn;
  readonly columnIndex: number;
  readonly isSelected: boolean;
  readonly isStale: boolean;
  readonly key: string;
  readonly membershipId: string;
  readonly realName: string;
  readonly rowIndex: number;
  readonly shiftType: MatrixShiftType | undefined;
}): MatrixCell {
  const state = options.shiftType === undefined ? '未排班' : `已排${options.shiftType.name}`;
  return {
    abbreviation: options.shiftType?.abbreviation ?? '',
    ariaLabel: `${options.column.businessDate}，${options.realName}，${state}${options.isStale ? '，配置失效' : ''}`,
    businessDate: options.column.businessDate,
    color: options.shiftType?.color ?? '',
    columnIndex: options.columnIndex,
    isSelected: options.isSelected,
    isStale: options.isStale,
    key: options.key,
    membershipId: options.membershipId,
    rowIndex: options.rowIndex,
    shiftTypeId: options.shiftType?.id ?? '',
    textColor: options.shiftType?.textColor ?? '',
  };
}

function updateMatrixCell(
  cell: MatrixCell,
  assignment: MatrixAssignment | undefined,
  isSelected: boolean,
  realName: string,
  shiftTypes: readonly MatrixShiftType[],
): MatrixCell {
  const next = assignment ?? EMPTY_ASSIGNMENT;
  const shiftType = shiftTypes.find((candidate) => candidate.id === next.shiftTypeId);
  return {
    ...cell,
    ...next,
    ariaLabel: `${cell.businessDate}，${realName}，${shiftType === undefined ? '未排班' : `已排${shiftType.name}`}${cell.isStale ? '，配置失效' : ''}`,
    isSelected,
  };
}

function assignmentFromCell(cell: MatrixCell): MatrixAssignment | undefined {
  return cell.shiftTypeId === ''
    ? undefined
    : {
        abbreviation: cell.abbreviation,
        color: cell.color,
        shiftTypeId: cell.shiftTypeId,
        textColor: cell.textColor,
      };
}

function assignmentFromShiftType(shiftType: MatrixShiftType): MatrixAssignment {
  return {
    abbreviation: shiftType.abbreviation,
    color: shiftType.color,
    shiftTypeId: shiftType.id,
    textColor: shiftType.textColor,
  };
}

function enabledShiftTypes(config: SchedulingConfig | undefined): readonly MatrixShiftType[] {
  return (config?.shiftTypes ?? [])
    .filter((shiftType) => shiftType.isEnabled)
    .map(toMatrixShiftType);
}

function toMatrixShiftType(shiftType: ShiftType): MatrixShiftType {
  return {
    abbreviation: shiftType.abbreviation,
    color: shiftType.color,
    id: shiftType.id,
    name: shiftType.name,
    textColor: shiftType.textColor,
  };
}

function createMemberOptions(
  page: ManualPageInstance,
  role: ScheduleRole | undefined,
): readonly MemberOption[] {
  const roleMembers = role?.members ?? [];
  const currentIds = new Set(roleMembers.map((member) => member.membershipId));
  const members: ScheduleRoleMember[] = [...roleMembers];
  for (const membershipId of page._memberIds) {
    if (!currentIds.has(membershipId)) {
      members.push({
        id: `stale:${membershipId}`,
        membershipId,
        position: members.length + 1,
        realName: `${page._memberNames.get(membershipId) ?? '未知成员'}（已离岗）`,
        version: 1,
      });
    }
  }
  return members.map((member) => ({
    checked: page._memberIds.includes(member.membershipId),
    disabled:
      !page._memberIds.includes(member.membershipId) &&
      page._memberIds.length >= MAX_MANUAL_MEMBERS,
    membershipId: member.membershipId,
    realName: member.realName,
  }));
}

function createRoleOptions(config: SchedulingConfig | undefined): readonly SelectorOption[] {
  return (config?.roles ?? []).map((role) => ({ label: role.name, value: role.id }));
}

function createTemplateOptions(
  templates: readonly ManualScheduleTemplate[],
): readonly SelectorOption[] {
  return [
    { label: '新建模板', value: '' },
    ...templates.map((template) => ({
      label: templateOptionLabel(template),
      value: template.id,
    })),
  ];
}

function templateOptionLabel(template: ManualScheduleTemplate): string {
  return `${template.scheduleRoleName} · ${template.startDate} · ${template.cycleDays}天`;
}

function roleForIndex(
  config: SchedulingConfig | undefined,
  roleIndex: number,
): ScheduleRole | undefined {
  return config?.roles[roleIndex];
}

function firstEnabledShiftTypeId(config: SchedulingConfig | undefined): string {
  return config?.shiftTypes.find((shiftType) => shiftType.isEnabled)?.id ?? '';
}

async function refreshHolidays(page: ManualPageInstance, startDate: string): Promise<void> {
  const holidays = await loadHolidayMap(startDate).catch(() => new Map());
  if (page.data.startDate !== startDate) return;
  page._holidays = holidays;
  syncEditor(page, {});
}

async function loadHolidayMap(
  startDate: string,
): Promise<ReadonlyMap<string, ConfirmedHolidayDate>> {
  const years = new Set([
    Number(startDate.slice(0, 4)),
    Number(addBusinessDays(startDate, MAX_MANUAL_DAYS - 1).slice(0, 4)),
  ]);
  const results = await Promise.all([...years].map((year) => workbenchClient.getHolidays(year)));
  return new Map(
    results.flatMap((result) => result.dates.map((date) => [date.date, date] as const)),
  );
}

function createMatrixGestureConfig(
  matrix: MatrixModel,
  maxHorizontalOffset: number,
  resetToken: string,
  horizontalOffset = 0,
  verticalOffset = 0,
  syncRevision = 0,
): MatrixGestureConfig {
  const normalizedMaxHorizontalOffset = Math.max(0, maxHorizontalOffset);
  const maxVerticalOffset = Math.max(0, matrix.matrixContentHeight - matrix.matrixViewportHeight);
  return {
    horizontalOffset: Math.max(-normalizedMaxHorizontalOffset, Math.min(0, horizontalOffset)),
    maxHorizontalOffset: normalizedMaxHorizontalOffset,
    maxVerticalOffset,
    resetToken,
    syncRevision,
    verticalOffset: Math.max(-maxVerticalOffset, Math.min(0, verticalOffset)),
  };
}

function resolveMaxHorizontalOffset(matrix: MatrixModel): number {
  return Math.max(0, matrix.contentWidth - resolveMatrixViewportWidth());
}

function resolveMatrixViewportWidth(): number {
  if (typeof wx === 'undefined' || typeof wx.getWindowInfo !== 'function') {
    return MATRIX_VIEWPORT_FALLBACK_WIDTH;
  }
  const width = wx.getWindowInfo().windowWidth;
  return Number.isFinite(width)
    ? Math.max(1, width - MATRIX_PAGE_HORIZONTAL_CHROME)
    : MATRIX_VIEWPORT_FALLBACK_WIDTH;
}

function createScrollProgressPatch(columnCount: number, progress: number): Partial<ManualPageData> {
  const normalized = Math.max(0, Math.min(1, progress));
  return {
    scrollHint:
      normalized <= 0.02
        ? '向左滑动查看其余日期，人员列保持固定'
        : normalized >= 0.98
          ? '向右滑动返回较早日期，人员列保持固定'
          : `左右滑动查看全部 ${columnCount} 天，人员列保持固定`,
    scrollProgressOffset: Math.round(normalized * 36),
    scrollProgressPercent: Math.round(normalized * 100),
  };
}

function createMatrixModelFromPage(page: ManualPageInstance): MatrixModel {
  return {
    columns: page.data.columns,
    contentWidth: page.data.contentWidth,
    logicalCellCount: page.data.logicalCellCount,
    matrixBodyViewportHeight: page.data.matrixBodyViewportHeight,
    matrixContentHeight: page.data.matrixContentHeight,
    matrixViewportHeight: page.data.matrixViewportHeight,
    rows: page.data.rows,
    shiftTypes: page.data.shiftTypes,
  };
}

function createMatrixResetToken(data: ManualPageData): string {
  return `${data.selectedTemplateId || 'new'}:${data.cycleDays}:${data.startDate}`;
}

function createShellLayoutPatch(): Partial<ManualPageData> {
  if (typeof wx === 'undefined' || typeof wx.getWindowInfo !== 'function') return {};
  const info = wx.getWindowInfo();
  const statusBarHeight = Math.max(0, info.statusBarHeight ?? info.safeArea?.top ?? 0);
  const headerHeight = Math.max(64, statusBarHeight + 52);
  return {
    pageScrollStyle: `height:calc(100% - ${headerHeight}px);`,
    shellHeaderStyle: `height:${headerHeight}px;min-height:${headerHeight}px;padding-top:${statusBarHeight}px;`,
  };
}

function cellPath(location: MatrixLocation): string {
  return `rows[${location.rowIndex}].cells[${location.columnIndex}]`;
}

function isSameLocation(left: MatrixLocation, right: MatrixLocation): boolean {
  return left.rowIndex === right.rowIndex && left.columnIndex === right.columnIndex;
}

function getTodayBusinessDate(): string {
  return new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function isBusinessDate(value: string): boolean {
  return (
    /^\d{4}-\d{2}-\d{2}$/u.test(value) && formatBusinessDate(parseBusinessDate(value)) === value
  );
}

function parseBusinessDate(value: string): Date {
  const [year = 0, month = 0, day = 0] = value.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function formatBusinessDate(value: Date): string {
  return `${String(value.getUTCFullYear()).padStart(4, '0')}-${String(value.getUTCMonth() + 1).padStart(2, '0')}-${String(value.getUTCDate()).padStart(2, '0')}`;
}

function addBusinessDays(value: string, days: number): string {
  const date = parseBusinessDate(value);
  date.setUTCDate(date.getUTCDate() + days);
  return formatBusinessDate(date);
}

function getInclusiveDayCount(startDate: string, endDate: string): number {
  return (
    Math.floor(
      (parseBusinessDate(endDate).getTime() - parseBusinessDate(startDate).getTime()) / 86_400_000,
    ) + 1
  );
}

function formatShortDate(value: string): string {
  return `${value.slice(5, 7)}月${value.slice(8, 10)}日`;
}

function createOperationId(): string {
  const hex = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/gu, (marker) => {
    const random = Math.floor(Math.random() * 16);
    return (marker === 'x' ? random : (random & 0x3) | 0x8).toString(16);
  });
  return hex;
}

function createStages(activeIndex: number): ManualPageData['stages'] {
  return ['编辑', '预览', '草稿', '发布'].map((label, index) => ({
    className: index === activeIndex ? 'is-active' : index < activeIndex ? 'is-complete' : '',
    index,
    label,
    marker: index < activeIndex ? '✓' : String(index + 1),
  }));
}

function toUserMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message.length > 0 ? error.message : fallback;
}
