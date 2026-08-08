<script setup lang="ts">
import type {
  AppliedManualScheduleTemplateResult,
  CalendarReadModel,
  ConfirmedHolidayDate,
  CreateManualScheduleTemplateRequest,
  GroupSummary,
  ManualScheduleTemplate,
  ScheduleChangeImpactPreview,
  ScheduleGenerationPreview,
  SchedulePeriodHistoryItem,
  ScheduleWorkflowImpact,
  SchedulingConfig,
} from '@schedule/contracts';
import { toChinaStandardTimeUtcTimestamp } from '@schedule/scheduling-domain';
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import type { SelectValue } from 'tdesign-vue-next';

import { createApiClient } from '../../api/client.js';
import { toUserMessage } from '../../utils/user-message.js';
import {
  getConflictLatestData,
  getConflictMessage,
  getVersionConflictSummary,
  isDataConflictError,
} from '../../api/conflict-handler.js';
import { localAuth } from '../../auth/local-auth.js';
import DataConflictDialog from '../../components/DataConflictDialog.vue';
import { getCurrentBusinessMonth } from '../../features/calendar/calendar-logic.js';
import { getBusinessDate } from '../../features/calendar/calendar-views.js';
import MonthGrid from '../../features/calendar/MonthGrid.vue';
import ApplyTemplateDialog from '../../features/manual-schedule/ApplyTemplateDialog.vue';
import ClearActions from '../../features/manual-schedule/ClearActions.vue';
import ManualGrid from '../../features/manual-schedule/ManualGrid.vue';
import ShiftPalette from '../../features/manual-schedule/ShiftPalette.vue';
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
  type ManualGridSelection,
  type TemplateCellMap,
} from '../../features/manual-schedule/manual-schedule-logic.js';

const props = defineProps<{
  readonly group: GroupSummary;
}>();
const emit = defineEmits<{
  navigate: [tab: 'backfill'];
}>();

const api = createApiClient({ auth: localAuth });
const config = ref<SchedulingConfig>();
const templates = ref<ManualScheduleTemplate[]>([]);
const history = ref<SchedulePeriodHistoryItem[]>([]);
const holidays = ref<ReadonlyMap<string, ConfirmedHolidayDate>>(new Map());
const selectedTemplateId = ref('');
const scheduleRoleId = ref('');
const membershipIds = ref<string[]>([]);
const startDate = ref(getCurrentBusinessMonth() + '-01');
const cycleDays = ref(7);
const cells = ref<TemplateCellMap>(new Map());
const selectedCell = ref<ManualGridSelection>();
const activeShiftTypeId = ref<string>();
const staleMemberIds = ref<string[]>([]);
const staleCellKeys = ref<ReadonlySet<string>>(new Set());
const undoStack = reactive(createTemplateUndoStack());
const errorMessage = ref<string>();
const infoMessage = ref<string>();
const conflictMessage = ref('');
const conflictSummary = ref<string>();
const conflictVisible = ref(false);
const isLoading = ref(false);
const isSaving = ref(false);
const isDeleting = ref(false);
const isPublishingId = ref<string>();
const isDeletingDraftId = ref<string>();
const batchBlocked = ref<BlockedBatch>();
const acknowledgeBlockers = ref(false);
const acknowledgeWorkflowRevocations = ref(false);
const replacePublished = ref(false);
const previewDialogVisible = ref(false);
const previewTarget = ref<SchedulePeriodHistoryItem>();
const draftPreview = ref<ScheduleGenerationPreview>();
const periodCalendar = ref<CalendarReadModel>();
const isPreviewingDraftId = ref<string>();
const draftPreviewError = ref<string>();
const applyTarget = ref<ManualScheduleTemplate>();
const applyStartDate = ref('');
const periodMutationVisible = ref(false);
const periodMutationTarget = ref<SchedulePeriodHistoryItem>();
const periodMutationAction = ref<'publish' | 'withdraw'>('withdraw');
const periodMutationImpact = ref<ScheduleChangeImpactPreview>();
const periodMutationPublishPreview = ref<ScheduleGenerationPreview>();
const acknowledgePastDates = ref(false);
const isLoadingPeriodMutation = ref(false);
const isMutatingPeriod = ref(false);
let requestVersion = 0;
let midnightRefreshTimer: number | undefined;

interface DraftBatch {
  readonly items: readonly SchedulePeriodHistoryItem[];
  readonly key: string;
  readonly rangeEnd: string;
  readonly rangeStart: string;
  readonly roleName: string;
}

interface BlockedBatch {
  readonly batch: DraftBatch;
  readonly conflictingMonths: readonly string[];
  readonly message: string;
  readonly needsReplace: boolean;
  readonly workflowImpacts: readonly ScheduleWorkflowImpact[];
}

const hasPeriodMutationBlockers = computed(
  () =>
    periodMutationAction.value === 'publish' &&
    ((periodMutationPublishPreview.value?.hardConflicts.length ?? 0) > 0 ||
      (periodMutationPublishPreview.value?.vacancies.length ?? 0) > 0),
);
const periodMutationHasPastDates = computed(
  () =>
    periodMutationTarget.value !== undefined && hasPastDatesInVersion(periodMutationTarget.value),
);
const periodMutationRequiresAcknowledgement = computed(
  () =>
    hasPeriodMutationBlockers.value ||
    periodMutationHasPastDates.value ||
    (periodMutationImpact.value?.workflowImpacts.length ?? 0) > 0,
);

const roleOptions = computed(() =>
  (config.value?.roles ?? []).map((role) => ({ label: role.name, value: role.id })),
);
const templateOptions = computed(() => [
  { label: '新建模板', value: '' },
  ...(templates.value ?? []).map((template) => ({
    label: `${template.scheduleRoleName} · ${template.startDate} · ${template.cycleDays}天`,
    value: template.id,
  })),
]);
const roleMembers = computed(() => {
  const role = (config.value?.roles ?? []).find(
    (candidate) => candidate.id === scheduleRoleId.value,
  );
  return role?.members ?? [];
});
const enabledShiftTypes = computed(() =>
  (config.value?.shiftTypes ?? []).filter((shiftType) => shiftType.isEnabled),
);
const columns = computed(() => {
  try {
    return getTemplateDateColumns(startDate.value, cycleDays.value);
  } catch {
    return [];
  }
});
const rows = computed<readonly ManualGridRow[]>(() => {
  const memberNamesById = new Map(
    roleMembers.value.map((member) => [member.membershipId, member.realName]),
  );
  const staleIds = new Set(staleMemberIds.value);

  return membershipIds.value.map((membershipId) => ({
    isStale: staleIds.has(membershipId),
    membershipId,
    realName: memberNamesById.get(membershipId) ?? '未知成员',
  }));
});
const isEditing = computed(() => selectedTemplateId.value !== '');
const canApply = computed(() => isEditing.value && applyTarget.value === undefined);
const canClearCell = computed(() => selectedCell.value !== undefined);
const canUndo = computed(() => undoStack.canUndo());
const staleWarning = computed(
  () => staleMemberIds.value.length > 0 || staleCellKeys.value.size > 0,
);
const draftBatches = computed<readonly DraftBatch[]>(() => {
  const groups = new Map<string, SchedulePeriodHistoryItem[]>();
  for (const item of history.value) {
    if (item.status !== 'draft') {
      continue;
    }
    const key = item.operationId ?? item.id;
    const list = groups.get(key) ?? [];
    list.push(item);
    groups.set(key, list);
  }

  return [...groups.values()]
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
        rangeEnd: last?.applyEndDate ?? `${last?.businessMonth ?? ''}-01`,
        rangeStart: first?.applyStartDate ?? `${first?.businessMonth ?? ''}-01`,
        roleName: first?.scheduleRoleName ?? '',
      };
    })
    .sort((first, second) =>
      (second.items[0]?.businessMonth ?? '').localeCompare(first.items[0]?.businessMonth ?? ''),
    );
});
const versionMonthGroups = computed(() => {
  const groups = new Map<
    string,
    {
      businessMonth: string;
      items: SchedulePeriodHistoryItem[];
      roleName: string;
    }
  >();
  for (const item of history.value) {
    if (item.status === 'draft') {
      continue;
    }
    const key = `${item.businessMonth}|${item.scheduleRoleId}`;
    const group = groups.get(key) ?? {
      businessMonth: item.businessMonth,
      items: [],
      roleName: item.scheduleRoleName,
    };
    group.items.push(item);
    groups.set(key, group);
  }

  return [...groups.values()]
    .map((group) => ({
      ...group,
      archived: [...group.items]
        .filter((item) => item.status === 'replaced' || item.status === 'withdrawn')
        .sort((first, second) => second.revision - first.revision),
      current: [...group.items].filter((item) => item.status === 'published'),
      past: [...group.items].filter((item) => item.status === 'past'),
      items: [...group.items].sort((first, second) => second.revision - first.revision),
    }))
    .sort((first, second) => second.businessMonth.localeCompare(first.businessMonth));
});

watch(startDate, () => {
  void loadHolidays();
});

function loadData(): Promise<void> {
  const currentRequest = ++requestVersion;
  errorMessage.value = undefined;
  isLoading.value = true;

  return Promise.all([
    api.getSchedulingConfig(props.group.id),
    api.listManualScheduleTemplates(props.group.id),
    api.listSchedulePeriodHistory(props.group.id),
  ])
    .then(([nextConfig, nextTemplates, nextHistory]) => {
      if (currentRequest === requestVersion) {
        config.value = nextConfig;
        templates.value = nextTemplates;
        history.value = nextHistory;
      }
    })
    .catch((error: unknown) => {
      if (currentRequest === requestVersion) {
        errorMessage.value = toUserMessage(error, '模板暂时无法保存，请稍后重试。');
      }
    })
    .finally(() => {
      if (currentRequest === requestVersion) {
        isLoading.value = false;
      }
    });
}

async function loadHolidays(): Promise<void> {
  const years = new Set<number>([Number(startDate.value.slice(0, 4))]);
  const lastColumn = columns.value[columns.value.length - 1];
  if (lastColumn !== undefined) {
    years.add(Number(lastColumn.date.slice(0, 4)));
  }

  try {
    const results = await Promise.all([...years].map((year) => api.getHolidays(year)));
    holidays.value = new Map(
      results.flatMap((result) => result.dates.map((date) => [date.date, date] as const)),
    );
  } catch {
    holidays.value = new Map();
  }
}

function onTemplateChange(value: SelectValue): void {
  if (typeof value !== 'string') {
    return;
  }

  if (value === '') {
    resetEditor();
    return;
  }

  const template = templates.value.find((candidate) => candidate.id === value);
  if (template !== undefined) {
    openTemplate(template);
  }
}

function onRoleChange(value: SelectValue): void {
  if (typeof value !== 'string' || !roleOptions.value.some((option) => option.value === value)) {
    return;
  }

  scheduleRoleId.value = value;
  membershipIds.value = [];
  cells.value = new Map();
  selectedCell.value = undefined;
  staleMemberIds.value = [];
  staleCellKeys.value = new Set();
  undoStack.clear();
}

function openTemplate(template: ManualScheduleTemplate): void {
  selectedTemplateId.value = template.id;
  scheduleRoleId.value = template.scheduleRoleId;
  membershipIds.value = template.members.map((member) => member.membershipId);
  startDate.value = getNextAvailableStartDate(
    history.value,
    template.scheduleRoleId,
    getBusinessDate(),
  );
  cycleDays.value = template.cycleDays;
  cells.value = templateToCellMap(template);
  staleMemberIds.value = template.members
    .filter((member) => member.isStale)
    .map((member) => member.membershipId);
  staleCellKeys.value = new Set(
    template.cells
      .filter((cell) => cell.isStale)
      .map((cell) => createCellKey(cell.cycleDay, cell.membershipId)),
  );
  selectedCell.value = undefined;
  activeShiftTypeId.value = undefined;
  undoStack.clear();
}

function resetEditor(): void {
  selectedTemplateId.value = '';
  scheduleRoleId.value = '';
  membershipIds.value = [];
  startDate.value = `${getCurrentBusinessMonth()}-01`;
  cycleDays.value = 7;
  cells.value = new Map();
  selectedCell.value = undefined;
  activeShiftTypeId.value = undefined;
  applyStartDate.value = '';
  staleMemberIds.value = [];
  staleCellKeys.value = new Set();
  undoStack.clear();
}

function toggleMember(membershipId: string): void {
  if (membershipIds.value.includes(membershipId)) {
    pushUndo();
    membershipIds.value = membershipIds.value.filter((id) => id !== membershipId);
    cells.value = clearRow(cells.value, membershipId);
    if (selectedCell.value?.membershipId === membershipId) {
      selectedCell.value = undefined;
    }
  } else {
    membershipIds.value = [...membershipIds.value, membershipId];
  }
}

function handleCellClick(selection: ManualGridSelection): void {
  selectedCell.value =
    selectedCell.value !== undefined &&
    selectedCell.value.cycleDay === selection.cycleDay &&
    selectedCell.value.membershipId === selection.membershipId
      ? undefined
      : selection;
  if (activeShiftTypeId.value !== undefined) {
    pushUndo();
    const currentShiftTypeId = cells.value.get(
      createCellKey(selection.cycleDay, selection.membershipId),
    );
    cells.value =
      currentShiftTypeId === activeShiftTypeId.value
        ? clearCell(cells.value, selection.cycleDay, selection.membershipId)
        : applyShiftToCell(
            cells.value,
            selection.cycleDay,
            selection.membershipId,
            activeShiftTypeId.value,
          );
    infoMessage.value = undefined;
  }
}

function selectShiftType(shiftTypeId: string): void {
  activeShiftTypeId.value = activeShiftTypeId.value === shiftTypeId ? undefined : shiftTypeId;
}

function clearSelectedCell(): void {
  if (selectedCell.value === undefined) {
    return;
  }

  pushUndo();
  cells.value = clearCell(
    cells.value,
    selectedCell.value.cycleDay,
    selectedCell.value.membershipId,
  );
}

function clearSelectedRow(): void {
  const selection = selectedCell.value;
  if (selection === undefined) {
    return;
  }

  const member = roleMembers.value.find(
    (candidate) => candidate.membershipId === selection.membershipId,
  );
  const realName = member?.realName ?? '该成员';
  if (!window.confirm(`确定清空 ${realName} 的整行吗？此操作可在保存前撤销。`)) {
    return;
  }

  pushUndo();
  cells.value = clearRow(cells.value, selection.membershipId);
}

function clearSelectedColumn(): void {
  const selection = selectedCell.value;
  if (selection === undefined) {
    return;
  }

  const column = columns.value.find((candidate) => candidate.cycleDay === selection.cycleDay);
  const dateLabel = column?.date ?? '该列';
  if (!window.confirm(`确定清空 ${dateLabel} 这一列吗？此操作可在保存前撤销。`)) {
    return;
  }

  pushUndo();
  cells.value = clearColumn(cells.value, selection.cycleDay);
}

function undo(): void {
  const snapshot = undoStack.pop();
  if (snapshot !== undefined) {
    cells.value = snapshot;
  }
}

function pushUndo(): void {
  undoStack.push(cells.value);
}

async function save(): Promise<void> {
  errorMessage.value = undefined;
  infoMessage.value = undefined;

  if (scheduleRoleId.value === '') {
    errorMessage.value = '请先选择排班岗位。';
    return;
  }
  if (membershipIds.value.length === 0) {
    errorMessage.value = '请至少勾选一位值班人员。';
    return;
  }
  if (columns.value.length === 0) {
    errorMessage.value = '请检查开始日期和周期天数（1 到 31 天）。';
    return;
  }

  const request: CreateManualScheduleTemplateRequest = {
    cells: [...cells.value.entries()].map(([key, shiftTypeId]) => {
      const [cycleDayText = '', ...membershipParts] = key.split(':');
      return {
        cycleDay: Number(cycleDayText),
        membershipId: membershipParts.join(':'),
        shiftTypeId,
      };
    }),
    cycleDays: cycleDays.value,
    membershipIds: membershipIds.value,
    scheduleRoleId: scheduleRoleId.value,
    startDate: startDate.value,
  };

  isSaving.value = true;
  try {
    let saved: ManualScheduleTemplate;
    if (isEditing.value) {
      const template = templates.value.find(
        (candidate) => candidate.id === selectedTemplateId.value,
      );
      saved = await api.updateManualScheduleTemplate(props.group.id, selectedTemplateId.value, {
        ...request,
        expectedVersion: template?.version ?? 1,
      });
    } else {
      saved = await api.createManualScheduleTemplate(props.group.id, request);
    }

    infoMessage.value = '模板已保存，尚未创建任何正式班次。';
    await loadData();
    openTemplate(saved);
    startDate.value = saved.startDate;
  } catch (error) {
    if (isDataConflictError(error)) {
      conflictMessage.value = getConflictMessage(error);
      conflictSummary.value = getVersionConflictSummary(getConflictLatestData(error));
      conflictVisible.value = true;
    } else {
      errorMessage.value = toUserMessage(error, '模板暂时无法保存，请稍后重试。');
    }
  } finally {
    isSaving.value = false;
  }
}

function refreshAfterConflict(): void {
  conflictVisible.value = false;
  void loadData().then(() => {
    const template = templates.value.find((candidate) => candidate.id === selectedTemplateId.value);
    if (template !== undefined) {
      openTemplate(template);
    }
  });
}

function openApplyDialog(): void {
  const template = templates.value.find((candidate) => candidate.id === selectedTemplateId.value);
  if (template !== undefined) {
    applyStartDate.value = startDate.value;
    applyTarget.value = template;
  }
}

async function deleteTemplate(): Promise<void> {
  const template = templates.value.find((candidate) => candidate.id === selectedTemplateId.value);
  if (template === undefined) {
    return;
  }
  if (
    !window.confirm(
      `确定删除模板“${template.scheduleRoleName} · ${template.startDate} · ${template.cycleDays}天”吗？删除后不可恢复。`,
    )
  ) {
    return;
  }

  errorMessage.value = undefined;
  isDeleting.value = true;
  try {
    await api.deleteManualScheduleTemplate(props.group.id, template.id);
    resetEditor();
    infoMessage.value = '模板已删除。';
    await loadData();
  } catch (error) {
    errorMessage.value = toUserMessage(error, '模板暂时无法保存，请稍后重试。');
  } finally {
    isDeleting.value = false;
  }
}

function onApplied(result: AppliedManualScheduleTemplateResult): void {
  applyTarget.value = undefined;
  infoMessage.value =
    result.status === 'published'
      ? `模板已应用并直接发布：${result.preview.applyStartDate} 至 ${result.preview.applyEndDate}。`
      : `模板已应用并保存为草稿：${result.preview.applyStartDate} 至 ${result.preview.applyEndDate}（共 ${result.periods.length} 个月），可在下方草稿区一次发布。`;
  void loadData();
}

async function publishBatch(
  batch: DraftBatch,
  acknowledge = false,
  replace = false,
  acknowledgeWorkflows = false,
): Promise<void> {
  errorMessage.value = undefined;
  batchBlocked.value = undefined;
  acknowledgeBlockers.value = false;
  acknowledgeWorkflowRevocations.value = false;
  replacePublished.value = false;
  isPublishingId.value = batch.key;

  try {
    const result = await api.publishScheduleDraftBatch(props.group.id, {
      ...(acknowledge ? { acknowledgeBlockers: true } : {}),
      ...(acknowledgeWorkflows ? { acknowledgeWorkflowRevocations: true } : {}),
      operationId: crypto.randomUUID(),
      ...(replace ? { replacePublished: true } : {}),
      schedulePeriodIds: batch.items.map((item) => item.id),
    });
    infoMessage.value = `已发布 ${batch.rangeStart} 至 ${batch.rangeEnd} 的排班（共 ${result.periods.length} 个月）。`;
    await loadData();
  } catch (error) {
    if (isDataConflictError(error)) {
      const latest = getConflictLatestData(error) as
        | {
            existingPublishedPeriodId?: unknown;
            workflowImpacts?: readonly ScheduleWorkflowImpact[];
          }
        | undefined;
      const workflowImpacts = Array.isArray(latest?.workflowImpacts) ? latest.workflowImpacts : [];
      if (latest?.existingPublishedPeriodId !== undefined) {
        try {
          history.value = await api.listSchedulePeriodHistory(props.group.id);
        } catch {
          // Keep the existing snapshot; the conflict itself remains actionable.
        }
        batchBlocked.value = {
          batch,
          conflictingMonths: findPublishedOverlapMonths(batch.items, history.value),
          message: '发布范围包含已有已发布排班的月份，请确认覆盖发布。',
          needsReplace: true,
          workflowImpacts,
        };
      } else {
        batchBlocked.value = {
          batch,
          conflictingMonths: [],
          message: getConflictMessage(error),
          needsReplace: false,
          workflowImpacts,
        };
      }
    } else {
      errorMessage.value = toUserMessage(error, '模板暂时无法保存，请稍后重试。');
    }
  } finally {
    isPublishingId.value = undefined;
  }
}

async function deleteBatch(batch: DraftBatch): Promise<void> {
  if (
    !window.confirm(
      `确定删除 ${batch.rangeStart} 至 ${batch.rangeEnd} 的排班草稿吗（共 ${batch.items.length} 个月）？删除后不可恢复。`,
    )
  ) {
    return;
  }

  errorMessage.value = undefined;
  isDeletingDraftId.value = batch.key;
  try {
    for (const item of batch.items) {
      await api.deleteScheduleDraft(props.group.id, item.id);
    }
    infoMessage.value = `已删除 ${batch.rangeStart} 至 ${batch.rangeEnd} 的排班草稿。`;
    await loadData();
  } catch (error) {
    errorMessage.value = toUserMessage(error, '模板暂时无法保存，请稍后重试。');
  } finally {
    isDeletingDraftId.value = undefined;
  }
}

async function openDraftPreview(draft: SchedulePeriodHistoryItem): Promise<void> {
  previewTarget.value = draft;
  draftPreview.value = undefined;
  periodCalendar.value = undefined;
  draftPreviewError.value = undefined;
  previewDialogVisible.value = true;
  isPreviewingDraftId.value = draft.id;

  try {
    if (draft.status === 'draft') {
      draftPreview.value = await api.getScheduleDraftPreview(props.group.id, draft.id);
    } else {
      periodCalendar.value = await api.getSchedulePeriodCalendar(props.group.id, draft.id);
    }
  } catch (error) {
    draftPreviewError.value = toUserMessage(error, '模板暂时无法保存，请稍后重试。');
  } finally {
    isPreviewingDraftId.value = undefined;
  }
}

function closeDraftPreview(): void {
  previewDialogVisible.value = false;
  previewTarget.value = undefined;
  draftPreview.value = undefined;
  periodCalendar.value = undefined;
  draftPreviewError.value = undefined;
}

async function preparePeriodMutation(
  item: SchedulePeriodHistoryItem,
  action: 'publish' | 'withdraw',
): Promise<void> {
  periodMutationTarget.value = item;
  periodMutationAction.value = action;
  periodMutationImpact.value = undefined;
  periodMutationPublishPreview.value = undefined;
  acknowledgeWorkflowRevocations.value = false;
  acknowledgePastDates.value = false;
  periodMutationVisible.value = true;
  isLoadingPeriodMutation.value = true;

  try {
    const [impact, publishPreview] = await Promise.all([
      api.previewScheduleChange(props.group.id, item.id, action),
      action === 'publish'
        ? api.getScheduleDraftPreview(props.group.id, item.id)
        : Promise.resolve(undefined),
    ]);
    periodMutationImpact.value = impact;
    periodMutationPublishPreview.value = publishPreview;
  } catch (error) {
    periodMutationVisible.value = false;
    errorMessage.value = toUserMessage(error, '模板暂时无法保存，请稍后重试。');
  } finally {
    isLoadingPeriodMutation.value = false;
  }
}

async function confirmPeriodMutation(): Promise<void> {
  const target = periodMutationTarget.value;
  if (
    target === undefined ||
    (periodMutationRequiresAcknowledgement.value && !acknowledgeWorkflowRevocations.value) ||
    (periodMutationHasPastDates.value && !acknowledgePastDates.value)
  ) {
    return;
  }

  isMutatingPeriod.value = true;
  errorMessage.value = undefined;
  try {
    if (periodMutationAction.value === 'withdraw') {
      await api.withdrawSchedulePeriod(props.group.id, target.id, {
        ...(acknowledgeWorkflowRevocations.value ? { acknowledgeWorkflowRevocations: true } : {}),
        expectedVersion: target.version,
        operationId: crypto.randomUUID(),
      });
      infoMessage.value = `${target.businessMonth.slice(0, 7)} 的当前排班已撤销并归档。`;
    } else {
      await api.publishSchedulePeriod(props.group.id, target.id, {
        ...(hasPeriodMutationBlockers.value ? { acknowledgeBlockers: true } : {}),
        ...(acknowledgeWorkflowRevocations.value ? { acknowledgeWorkflowRevocations: true } : {}),
        expectedVersion: target.version,
        operationId: crypto.randomUUID(),
        replacePublished: true,
      });
      infoMessage.value = `${target.businessMonth.slice(0, 7)} 的归档排班已重新发布。`;
    }
    periodMutationVisible.value = false;
    await loadData();
  } catch (error) {
    errorMessage.value = toUserMessage(error, '模板暂时无法保存，请稍后重试。');
  } finally {
    isMutatingPeriod.value = false;
  }
}

function workflowKindLabel(impact: ScheduleWorkflowImpact): string {
  return impact.kind === 'swap' ? '换班' : '加扣班';
}

async function deleteDraft(draft: SchedulePeriodHistoryItem): Promise<void> {
  const label = draft.status === 'draft' ? '排班草稿' : `草稿 ${draftCode(draft)} 归档记录`;
  if (
    !window.confirm(`确定删除 ${draft.businessMonth.slice(0, 7)} 的${label}吗？删除后不可恢复。`)
  ) {
    return;
  }

  errorMessage.value = undefined;
  isDeletingDraftId.value = draft.id;
  try {
    await api.deleteScheduleDraft(props.group.id, draft.id);
    history.value = history.value.filter((item) => item.id !== draft.id);
    infoMessage.value = `已删除 ${draft.businessMonth.slice(0, 7)} 的${label}。`;
    await loadData();
  } catch (error) {
    errorMessage.value = toUserMessage(error, '模板暂时无法保存，请稍后重试。');
  } finally {
    isDeletingDraftId.value = undefined;
  }
}

function draftCode(item: SchedulePeriodHistoryItem): string {
  return formatScheduleDraftCode(item.createdAt);
}

function isPastMonth(item: SchedulePeriodHistoryItem): boolean {
  return item.businessMonth.slice(0, 7) < getCurrentBusinessMonth();
}

function hasPastDatesInVersion(item: SchedulePeriodHistoryItem): boolean {
  if (isPastMonth(item)) {
    return true;
  }
  const month = item.businessMonth.slice(0, 7);
  if (month > getCurrentBusinessMonth()) {
    return false;
  }
  const startDate = item.applyStartDate ?? `${month}-01`;
  return startDate < getBusinessDate();
}

function navigateBackfill(): void {
  emit('navigate', 'backfill');
}

void loadData();
void loadHolidays();
onMounted(() => {
  window.addEventListener('focus', onWindowFocus);
  scheduleMidnightRefresh();
});

onBeforeUnmount(() => {
  window.removeEventListener('focus', onWindowFocus);
  if (midnightRefreshTimer !== undefined) {
    window.clearTimeout(midnightRefreshTimer);
    midnightRefreshTimer = undefined;
  }
});

function onWindowFocus(): void {
  void loadData();
}

function scheduleMidnightRefresh(): void {
  if (midnightRefreshTimer !== undefined) {
    window.clearTimeout(midnightRefreshTimer);
  }
  const now = Date.now();
  const today = getBusinessDate();
  const nextMidnightUtc =
    toChinaStandardTimeUtcTimestamp(today, '00:00').valueOf() + 24 * 60 * 60 * 1000;
  const delay = Math.max(1000, nextMidnightUtc - now + 5000);
  midnightRefreshTimer = window.setTimeout(() => {
    void loadData();
    void loadHolidays();
    scheduleMidnightRefresh();
  }, delay);
}
</script>

<template>
  <section class="manual-schedule-view" :aria-busy="isLoading || isSaving">
    <h2>手动排班模板</h2>
    <t-alert v-if="errorMessage !== undefined" theme="error" :message="errorMessage" />
    <t-alert v-if="infoMessage !== undefined" theme="success" :message="infoMessage" />
    <t-loading v-if="isLoading" text="正在加载排班配置" />
    <template v-else-if="config !== undefined">
      <div class="editor-config">
        <label>
          模板
          <t-select
            :value="selectedTemplateId"
            :options="templateOptions"
            @change="onTemplateChange"
          />
        </label>
        <label>
          排班岗位
          <t-select :value="scheduleRoleId" :options="roleOptions" @change="onRoleChange" />
        </label>
        <label>
          开始日期
          <input v-model="startDate" type="date" />
        </label>
        <label>
          周期天数
          <input v-model.number="cycleDays" min="1" max="31" type="number" />
        </label>
      </div>

      <fieldset class="member-selector">
        <legend>值班人员</legend>
        <p v-if="roleMembers.length === 0" class="member-empty">
          该排班岗位还没有成员，请先在排班配置中添加。
        </p>
        <label v-for="member in roleMembers" :key="member.membershipId">
          <input
            type="checkbox"
            :checked="membershipIds.includes(member.membershipId)"
            @change="toggleMember(member.membershipId)"
          />
          {{ member.realName }}
        </label>
      </fieldset>

      <t-alert
        v-if="staleWarning"
        theme="warning"
        message="模板包含失效引用（成员已不在岗位中，或班种已停用/配置已变更）。保存时会重新校验，请确认后再继续。"
      />

      <template v-if="rows.length > 0 && columns.length > 0">
        <p class="grid-hint">
          表格方向：值班人员为行（↓），日期为列（→）；先点击班种保持选中，再点击单元格即可填充；再次点击同班种取消选择。
        </p>
        <ManualGrid
          :cells="cells"
          :columns="columns"
          :holidays="holidays"
          :rows="rows"
          :selected-cell="selectedCell"
          :shift-types="enabledShiftTypes"
          :stale-cell-keys="staleCellKeys"
          @select-cell="handleCellClick"
        />
        <ShiftPalette
          :active-shift-type-id="activeShiftTypeId"
          :shift-types="enabledShiftTypes"
          @select="selectShiftType"
        />
        <ClearActions
          :can-clear-cell="canClearCell"
          :can-undo="canUndo"
          @clear-cell="clearSelectedCell"
          @clear-column="clearSelectedColumn"
          @clear-row="clearSelectedRow"
          @undo="undo"
        />
        <t-button theme="primary" :loading="isSaving" @click="save">
          {{ isEditing ? '保存模板' : '创建模板' }}
        </t-button>
        <t-button v-if="isEditing" variant="outline" :disabled="!canApply" @click="openApplyDialog">
          应用模板
        </t-button>
        <t-button
          v-if="isEditing"
          theme="danger"
          variant="outline"
          :loading="isDeleting"
          @click="deleteTemplate"
        >
          删除模板
        </t-button>
      </template>
      <p v-else class="editor-hint">请选择排班岗位并勾选至少一位值班人员。</p>

      <section v-if="draftBatches.length > 0" class="draft-section">
        <h3>排班草稿</h3>
        <p class="draft-hint">
          模板应用后按开始到结束时间保存为一条草稿，可一次发布整个范围；重复应用时可选择覆盖旧草稿。
        </p>
        <div class="draft-list">
          <article v-for="batch in draftBatches" :key="batch.key" class="draft-row">
            <div class="draft-summary">
              <strong>{{ batch.rangeStart }} 至 {{ batch.rangeEnd }}</strong>
              <span>草稿 {{ draftCode(batch.items[0]!) }}</span>
              <span>{{ batch.roleName }}</span>
              <span>共 {{ batch.items.length }} 个月</span>
              <span class="month-chips">
                <button
                  v-for="item in batch.items"
                  :key="item.id"
                  type="button"
                  class="month-chip"
                  :title="`预览 ${item.businessMonth.slice(0, 7)}`"
                  @click="openDraftPreview(item)"
                >
                  {{ item.businessMonth.slice(0, 7) }}
                </button>
              </span>
            </div>
            <t-space size="small">
              <t-button
                size="small"
                theme="primary"
                :loading="isPublishingId === batch.key"
                @click="publishBatch(batch)"
              >
                发布整个排班
              </t-button>
              <t-button
                size="small"
                theme="danger"
                variant="text"
                :loading="isDeletingDraftId === batch.key"
                @click="deleteBatch(batch)"
              >
                删除草稿
              </t-button>
            </t-space>
          </article>
        </div>
        <div v-if="batchBlocked !== undefined" class="blocker-panel">
          <t-alert theme="warning" :message="batchBlocked.message" />
          <template v-if="batchBlocked.needsReplace">
            <div v-if="batchBlocked.conflictingMonths.length > 0" class="month-chips">
              <span
                v-for="month in batchBlocked.conflictingMonths"
                :key="month"
                class="month-chip is-conflict"
              >
                {{ month }}
              </span>
            </div>
            <label class="replace-field">
              <input v-model="replacePublished" type="checkbox" />
              覆盖已发布排班（替换同岗位同月份的旧排班）
            </label>
            <div v-if="batchBlocked.workflowImpacts.length > 0" class="workflow-impact-list">
              <strong>覆盖后将撤销以下已生效或处理中事件：</strong>
              <span v-for="impact in batchBlocked.workflowImpacts" :key="impact.id">
                {{ workflowKindLabel(impact) }} · {{ impact.memberNames.join('、') }} ·
                {{ impact.businessDates.join('、') }}
              </span>
              <label class="acknowledge-field">
                <input v-model="acknowledgeWorkflowRevocations" type="checkbox" />
                我已了解这些事件将因排班变更被撤销
              </label>
            </div>
            <t-button
              theme="danger"
              variant="outline"
              :disabled="
                !replacePublished ||
                (batchBlocked.workflowImpacts.length > 0 && !acknowledgeWorkflowRevocations)
              "
              :loading="isPublishingId === batchBlocked.batch.key"
              @click="
                publishBatch(
                  batchBlocked.batch,
                  false,
                  replacePublished,
                  acknowledgeWorkflowRevocations,
                )
              "
            >
              确认覆盖发布
            </t-button>
          </template>
          <template v-else>
            <label class="acknowledge-field">
              <input v-model="acknowledgeBlockers" type="checkbox" />
              我已了解冲突和空缺，确认发布
            </label>
            <t-button
              theme="danger"
              variant="outline"
              :disabled="!acknowledgeBlockers"
              :loading="isPublishingId === batchBlocked.batch.key"
              @click="publishBatch(batchBlocked.batch, acknowledgeBlockers)"
            >
              确认发布
            </t-button>
          </template>
        </div>
      </section>

      <section v-if="versionMonthGroups.length > 0" class="draft-section">
        <h3>排班发布记录</h3>
        <p class="draft-hint">
          月份已过的排班自动转为“既往排班（锁定）”，已过日期不可修改；已归档版本会随月份过期自动清理。
        </p>
        <div class="draft-list">
          <article
            v-for="monthGroup in versionMonthGroups"
            :key="`${monthGroup.businessMonth}|${monthGroup.roleName}`"
            class="month-group"
          >
            <div class="month-group-header">
              <strong>{{ monthGroup.businessMonth.slice(0, 7) }}</strong>
              <span>{{ monthGroup.roleName }}</span>
            </div>
            <div v-for="item in monthGroup.current" :key="item.id" class="version-row">
              <div class="draft-summary">
                <span
                  class="version-badge"
                  :class="{ 'is-current': !isPastMonth(item), 'is-past': isPastMonth(item) }"
                >
                  {{ isPastMonth(item) ? '既往排班（锁定）' : '当前已发布' }}
                </span>
                <span>草稿 {{ draftCode(item) }}</span>
              </div>
              <t-space size="small">
                <t-button
                  size="small"
                  variant="outline"
                  :loading="isPreviewingDraftId === item.id"
                  @click="openDraftPreview(item)"
                >
                  查看
                </t-button>
                <t-button
                  v-if="isPastMonth(item)"
                  size="small"
                  variant="outline"
                  @click="navigateBackfill"
                >
                  排班补录
                </t-button>
                <t-button
                  v-if="!isPastMonth(item)"
                  size="small"
                  theme="danger"
                  variant="outline"
                  @click="preparePeriodMutation(item, 'withdraw')"
                >
                  撤销发布
                </t-button>
              </t-space>
            </div>
            <div v-for="item in monthGroup.past" :key="item.id" class="version-row">
              <div class="draft-summary">
                <span class="version-badge is-past">既往排班（锁定）</span>
                <span>草稿 {{ draftCode(item) }}</span>
              </div>
              <t-space size="small">
                <t-button
                  size="small"
                  variant="outline"
                  :loading="isPreviewingDraftId === item.id"
                  @click="openDraftPreview(item)"
                >
                  查看
                </t-button>
                <t-button size="small" variant="outline" @click="navigateBackfill">
                  排班补录
                </t-button>
              </t-space>
            </div>
            <details v-if="monthGroup.archived.length > 0" class="archived-details">
              <summary>已归档（{{ monthGroup.archived.length }}）</summary>
              <div v-for="item in monthGroup.archived" :key="item.id" class="version-row">
                <div class="draft-summary">
                  <span class="version-badge">已归档</span>
                  <span>草稿 {{ draftCode(item) }}</span>
                </div>
                <t-space size="small">
                  <t-button
                    size="small"
                    variant="outline"
                    :loading="isPreviewingDraftId === item.id"
                    @click="openDraftPreview(item)"
                  >
                    查看
                  </t-button>
                  <t-button
                    size="small"
                    theme="primary"
                    variant="outline"
                    @click="preparePeriodMutation(item, 'publish')"
                  >
                    重新发布
                  </t-button>
                  <t-button
                    size="small"
                    theme="danger"
                    variant="text"
                    :loading="isDeletingDraftId === item.id"
                    @click="deleteDraft(item)"
                  >
                    删除
                  </t-button>
                </t-space>
              </div>
            </details>
          </article>
        </div>
      </section>
    </template>
    <ApplyTemplateDialog
      v-if="applyTarget !== undefined"
      :group="group"
      :start-date="applyStartDate"
      :template="applyTarget"
      @applied="onApplied"
      @close="applyTarget = undefined"
    />
    <t-dialog
      v-model:visible="previewDialogVisible"
      :header="previewTarget?.status === 'draft' ? '草稿预览' : '排班版本月历'"
      :footer="false"
      :width="previewTarget?.status === 'draft' ? '640px' : 'min(1100px, 96vw)'"
      @close="closeDraftPreview"
    >
      <template v-if="previewTarget !== undefined">
        <p class="draft-preview-meta">
          {{ previewTarget.businessMonth.slice(0, 7) }} · {{ previewTarget.scheduleRoleName }}
        </p>
        <t-loading v-if="isPreviewingDraftId === previewTarget.id" text="正在生成预览" />
        <template v-else>
          <t-alert
            v-if="draftPreviewError !== undefined"
            theme="error"
            :message="draftPreviewError"
          />
          <template v-else-if="draftPreview !== undefined">
            <div class="preview-stats">
              <span>班次 {{ draftPreview.statistics.assignmentCount }}</span>
              <span>计入值班 {{ draftPreview.statistics.countedAssignmentCount }}</span>
              <span>空缺 {{ draftPreview.statistics.vacancyCount }}</span>
            </div>
            <table
              v-if="draftPreview.statistics.byShiftType.length > 0"
              class="draft-preview-table"
            >
              <thead>
                <tr>
                  <th>班种</th>
                  <th>班次数</th>
                  <th>计入值班</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="shiftType in draftPreview.statistics.byShiftType"
                  :key="shiftType.shiftTypeId"
                >
                  <td>{{ shiftType.shiftTypeName }}（{{ shiftType.shiftTypeAbbreviation }}）</td>
                  <td>{{ shiftType.assignmentCount }}</td>
                  <td>{{ shiftType.countedAssignmentCount }}</td>
                </tr>
              </tbody>
            </table>
            <t-alert
              v-if="draftPreview.hardConflicts.length > 0"
              theme="error"
              :message="`发现 ${draftPreview.hardConflicts.length} 处硬冲突。`"
            />
            <t-alert
              v-if="draftPreview.continuousDutyWarnings.length > 0"
              theme="warning"
              :message="`发现 ${draftPreview.continuousDutyWarnings.length} 处连续值班风险。`"
            />
            <t-alert
              v-if="draftPreview.vacancies.length > 0"
              theme="warning"
              :message="`发现 ${draftPreview.vacancies.length} 个待处理空缺。`"
            />
          </template>
          <MonthGrid
            v-else-if="periodCalendar !== undefined"
            :assignments="periodCalendar.assignments"
            :business-month="periodCalendar.businessMonth"
            :holidays="holidays"
            :members="periodCalendar.members"
          />
        </template>
      </template>
    </t-dialog>
    <t-dialog
      v-model:visible="periodMutationVisible"
      :confirm-btn="{
        content: periodMutationAction === 'withdraw' ? '确认撤销发布' : '确认重新发布',
        disabled:
          isLoadingPeriodMutation ||
          (periodMutationRequiresAcknowledgement && !acknowledgeWorkflowRevocations) ||
          (periodMutationHasPastDates && !acknowledgePastDates),
        loading: isMutatingPeriod,
        theme: periodMutationAction === 'withdraw' ? 'danger' : 'primary',
      }"
      :header="periodMutationAction === 'withdraw' ? '撤销当前排班' : '重新发布归档排班'"
      width="640px"
      @confirm="confirmPeriodMutation"
    >
      <t-loading v-if="isLoadingPeriodMutation" text="正在检查排班变更影响" />
      <template v-else-if="periodMutationTarget !== undefined">
        <p class="draft-preview-meta">
          {{ periodMutationTarget.businessMonth.slice(0, 7) }} ·
          {{ periodMutationTarget.scheduleRoleName }}
        </p>
        <t-alert
          v-if="periodMutationAction === 'withdraw'"
          theme="warning"
          :message="
            periodMutationHasPastDates
              ? '撤销后仅未来日期失效；已过日期将保留为既往排班（锁定），仍在月历中显示且不可修改。'
              : '撤销后该版本将进入归档，本月将不再显示此版本的排班。'
          "
        />
        <t-alert
          v-else
          theme="info"
          message="重新发布后，该版本将成为当前排班，原当前版本自动进入归档。"
        />
        <t-alert
          v-if="periodMutationAction === 'publish' && periodMutationHasPastDates"
          theme="warning"
          message="该版本包含已过日期；已过日期不可修改，发布后仍保持既往排班（锁定）状态，是否发布？"
        />
        <div
          v-if="(periodMutationImpact?.workflowImpacts.length ?? 0) > 0"
          class="workflow-impact-list"
        >
          <strong>本次变更将撤销以下事件，撤销原因为“排班变更”：</strong>
          <span v-for="impact in periodMutationImpact?.workflowImpacts ?? []" :key="impact.id">
            {{ workflowKindLabel(impact) }} · {{ impact.memberNames.join('、') }} ·
            {{ impact.businessDates.join('、') }}
          </span>
        </div>
        <t-alert
          v-if="hasPeriodMutationBlockers"
          theme="warning"
          :message="`该归档版本包含 ${periodMutationPublishPreview?.hardConflicts.length ?? 0} 处硬冲突和 ${periodMutationPublishPreview?.vacancies.length ?? 0} 个空缺。`"
        />
        <label v-if="periodMutationRequiresAcknowledgement" class="acknowledge-field">
          <input v-model="acknowledgeWorkflowRevocations" type="checkbox" />
          我已了解上述影响，确认继续
        </label>
        <label
          v-if="periodMutationAction === 'publish' && periodMutationHasPastDates"
          class="acknowledge-field"
        >
          <input v-model="acknowledgePastDates" type="checkbox" />
          我已了解已过日期不可修改，确认发布
        </label>
      </template>
    </t-dialog>
    <DataConflictDialog
      :message="conflictMessage"
      :summary="conflictSummary"
      :visible="conflictVisible"
      @close="conflictVisible = false"
      @refresh="refreshAfterConflict"
    />
  </section>
</template>

<style scoped>
.manual-schedule-view {
  display: grid;
  gap: 16px;
}

.manual-schedule-view h2 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
}

.grid-hint {
  margin: 0;
  color: #6b7280;
  font-size: 13px;
}

.editor-config {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  align-items: end;
  padding: 12px;
  background: #ffffff;
  border: 1px solid #dbe3ea;
  border-radius: 6px;
}

.editor-config label {
  display: grid;
  gap: 4px;
  color: #374151;
  font-size: 14px;
}

.editor-config input {
  min-height: 32px;
  padding: 4px 8px;
  border: 1px solid #9ca3af;
  border-radius: 4px;
}

.member-selector {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
  padding: 12px;
  background: #ffffff;
  border: 1px solid #dbe3ea;
  border-radius: 6px;
}

.member-selector legend {
  color: #374151;
  font-weight: 600;
}

.member-selector label {
  display: inline-flex;
  gap: 6px;
  align-items: center;
  color: #1f2937;
  font-size: 14px;
}

.member-empty,
.editor-hint {
  margin: 0;
  color: #6b7280;
  font-size: 13px;
}

.draft-section {
  display: grid;
  gap: 10px;
  padding: 12px;
  background: #ffffff;
  border: 1px solid #dbe3ea;
  border-radius: 6px;
}

.draft-section h3 {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
}

.draft-hint {
  margin: 0;
  color: #6b7280;
  font-size: 13px;
}

.draft-list {
  display: grid;
  gap: 8px;
}

.draft-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 16px;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  background: #f8fafc;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
}

.draft-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 16px;
  align-items: center;
  color: #6b7280;
  font-size: 13px;
}

.draft-summary strong {
  color: #111827;
  font-size: 14px;
}

.month-chips {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 4px;
}

.month-chip {
  padding: 2px 8px;
  color: #1f5aa6;
  background: #eff6ff;
  border: 1px solid #bfdbfe;
  border-radius: 12px;
  cursor: pointer;
  font-size: 12px;
}

.month-chip:hover {
  background: #dbeafe;
}

.month-chip.is-conflict {
  color: #92400e;
  background: #fffbeb;
  border-color: #f59e0b;
  cursor: default;
}

.month-group {
  display: grid;
  gap: 6px;
  padding: 10px 12px;
  background: #f8fafc;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
}

.month-group-header {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 16px;
  align-items: center;
  color: #6b7280;
  font-size: 13px;
}

.month-group-header strong {
  color: #111827;
  font-size: 14px;
}

.archived-details {
  border-top: 1px dashed #e5e7eb;
}

.archived-details summary {
  padding: 8px 0 4px;
  color: #1f5aa6;
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
}

.version-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 16px;
  align-items: center;
  justify-content: space-between;
  padding: 6px 0;
  border-top: 1px dashed #e5e7eb;
}

.version-badge {
  padding: 1px 6px;
  color: #6b7280;
  background: #e5e7eb;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
}

.version-badge.is-current {
  color: #166534;
  background: #dcfce7;
}

.version-badge.is-past {
  color: #4b5563;
  background: #e5e7eb;
}

.blocker-panel {
  display: grid;
  gap: 10px;
}

.workflow-impact-list {
  display: grid;
  gap: 6px;
  padding: 10px 12px;
  color: #92400e;
  background: #fffbeb;
  border: 1px solid #f59e0b;
  border-radius: 6px;
  font-size: 13px;
}

.acknowledge-field {
  display: inline-flex;
  gap: 6px;
  align-items: center;
  color: #92400e;
  font-size: 13px;
}

.replace-field {
  display: inline-flex;
  gap: 6px;
  align-items: center;
  color: #1f5aa6;
  font-size: 13px;
  font-weight: 600;
}

.draft-preview-meta {
  margin: 0 0 12px;
  color: #6b7280;
  font-size: 13px;
  font-weight: 600;
}

.preview-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  padding: 10px 12px;
  color: #111827;
  background: #eff6ff;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 600;
}

.draft-preview-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.draft-preview-table th,
.draft-preview-table td {
  padding: 6px 8px;
  text-align: left;
  border-bottom: 1px solid #e5e7eb;
}

.draft-preview-table th {
  color: #374151;
  background: #f8fafc;
}
</style>
