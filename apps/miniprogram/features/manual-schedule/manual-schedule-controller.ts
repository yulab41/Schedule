import type {
  CreateManualScheduleTemplateRequest,
  HolidayReadModel,
  ManualScheduleTemplate,
  SchedulePeriodHistoryItem,
  SchedulingConfig,
  UpdateManualScheduleTemplateRequest,
} from '@schedule/contracts';

import { ApiClientError } from '../../api/client.js';
import {
  applySelectedShift,
  applyLockedShift,
  clearManualCell,
  clearManualColumn,
  clearManualRow,
  createManualScheduleDraft,
  manualDraftCells,
  lockManualShift,
  selectManualCell,
  undoManualDraft,
  unlockManualShift,
  type ManualCellSelection,
  type ManualScheduleDraft,
  type ManualShiftChoice,
} from './manual-grid-logic.js';

export interface ManualScheduleContext {
  readonly groupId: string;
  readonly groupRole: 'administrator' | 'owner';
  readonly groupVersion: number;
  readonly userId: string;
}

export interface ManualScheduleDependencies {
  createManualScheduleTemplate(
    groupId: string,
    input: CreateManualScheduleTemplateRequest,
  ): Promise<ManualScheduleTemplate>;
  deleteManualScheduleTemplate(groupId: string, templateId: string): Promise<void>;
  getHolidays(year: number): Promise<HolidayReadModel>;
  getSchedulingConfig(groupId: string): Promise<SchedulingConfig>;
  listManualScheduleTemplates(groupId: string): Promise<ManualScheduleTemplate[]>;
  listSchedulePeriodHistory(groupId: string): Promise<SchedulePeriodHistoryItem[]>;
  publish(state: ManualScheduleState): void;
  updateManualScheduleTemplate(
    groupId: string,
    templateId: string,
    input: UpdateManualScheduleTemplateRequest,
  ): Promise<ManualScheduleTemplate>;
}

export interface ManualScheduleState {
  readonly config: SchedulingConfig | undefined;
  readonly conflict: { readonly latestData?: unknown; readonly message: string } | undefined;
  readonly context: ManualScheduleContext | undefined;
  readonly draft: ManualScheduleDraft | undefined;
  readonly errorMessage: string | undefined;
  readonly holidays: HolidayReadModel | undefined;
  readonly history: readonly SchedulePeriodHistoryItem[];
  readonly isLoading: boolean;
  readonly isSaving: boolean;
  readonly selectedTemplateId: string | undefined;
  readonly templates: readonly ManualScheduleTemplate[];
}

const initialState: ManualScheduleState = {
  config: undefined,
  conflict: undefined,
  context: undefined,
  draft: undefined,
  errorMessage: undefined,
  holidays: undefined,
  history: [],
  isLoading: false,
  isSaving: false,
  selectedTemplateId: undefined,
  templates: [],
};

function todayInChina(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const value = (name: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === name)?.value ?? '';
  return `${value('year')}-${value('month')}-${value('day')}`;
}

function contextKey(context: ManualScheduleContext): string {
  return `${context.userId}:${context.groupId}:${context.groupVersion}`;
}

function errorDetails(error: unknown): {
  readonly isConflict: boolean;
  readonly latestData?: unknown;
  readonly message: string;
} {
  if (error instanceof ApiClientError)
    return {
      isConflict: error.status === 409,
      latestData: error.latestData,
      message: error.message,
    };
  return {
    isConflict: false,
    message: error instanceof Error ? error.message : '手动排班暂时不可用，请稍后重试。',
  };
}

function requestFrom(draft: ManualScheduleDraft): CreateManualScheduleTemplateRequest {
  return {
    cells: manualDraftCells(draft),
    cycleDays: draft.cycleDays,
    membershipIds: draft.membershipIds,
    scheduleRoleId: draft.scheduleRoleId,
    startDate: draft.startDate,
  };
}

function draftFromTemplate(template: ManualScheduleTemplate): ManualScheduleDraft {
  const draft = createManualScheduleDraft({
    cycleDays: template.cycleDays,
    membershipIds: template.members.map(({ membershipId }) => membershipId),
    scheduleRoleId: template.scheduleRoleId,
    startDate: template.startDate,
  });
  return {
    ...draft,
    cells: Object.fromEntries(
      template.cells.map((cell) => [
        `${cell.cycleDay}:${cell.membershipId}`,
        { cycleDay: cell.cycleDay, membershipId: cell.membershipId, shiftTypeId: cell.shiftTypeId },
      ]),
    ),
  };
}

export function createManualScheduleController(dependencies: ManualScheduleDependencies) {
  let state = initialState;
  let generation = 0;
  let loadFlight: Promise<void> | undefined;
  let loadKey: string | undefined;

  const publish = (next: ManualScheduleState): void => {
    state = next;
    dependencies.publish(state);
  };
  const current = (operationGeneration: number) => operationGeneration === generation;
  const load = (): Promise<void> => {
    const context = state.context;
    if (context === undefined) return Promise.resolve();
    const key = contextKey(context);
    if (loadFlight !== undefined && loadKey === key) return loadFlight;
    const operationGeneration = generation;
    publish({ ...state, errorMessage: undefined, isLoading: true });
    const year = Number((state.draft?.startDate ?? todayInChina()).slice(0, 4));
    const call = <T>(action: () => Promise<T>): Promise<T> => Promise.resolve().then(action);
    const flight = Promise.all([
      call(() => dependencies.getSchedulingConfig(context.groupId)),
      call(() => dependencies.listManualScheduleTemplates(context.groupId)),
      call(() => dependencies.listSchedulePeriodHistory(context.groupId)),
      call(() => dependencies.getHolidays(year)),
    ])
      .then(([config, templates, history, holidays]) => {
        if (!current(operationGeneration)) return;
        const existing = state.draft;
        const role = config.roles[0];
        const draft =
          existing ??
          (role === undefined
            ? undefined
            : createManualScheduleDraft({
                cycleDays: 7,
                membershipIds: role.members.map(({ membershipId }) => membershipId),
                scheduleRoleId: role.id,
                startDate: todayInChina(),
              }));
        publish({
          ...state,
          config,
          draft,
          errorMessage: undefined,
          history,
          holidays,
          isLoading: false,
          templates,
        });
      })
      .catch((error: unknown) => {
        if (current(operationGeneration))
          publish({ ...state, errorMessage: errorDetails(error).message, isLoading: false });
      })
      .finally(() => {
        if (loadFlight === flight) {
          loadFlight = undefined;
          loadKey = undefined;
        }
      });
    loadFlight = flight;
    loadKey = key;
    return flight;
  };

  const replaceDraft = (draft: ManualScheduleDraft | undefined) => {
    if (draft !== undefined) publish({ ...state, draft });
  };
  const refreshAfterMutation = async () => {
    await load();
  };

  return {
    get state(): ManualScheduleState {
      return state;
    },
    activate(context: ManualScheduleContext): void {
      if (state.context !== undefined && contextKey(state.context) === contextKey(context)) return;
      generation += 1;
      loadFlight = undefined;
      loadKey = undefined;
      publish({ ...initialState, context });
    },
    deactivate(): void {
      generation += 1;
      loadFlight = undefined;
      loadKey = undefined;
      publish(initialState);
    },
    load,
    selectCell(selection: ManualCellSelection): void {
      if (state.draft !== undefined) replaceDraft(selectManualCell(state.draft, selection));
    },
    configureDraft(input: {
      readonly cycleDays: number;
      readonly membershipIds: readonly string[];
      readonly scheduleRoleId: string;
      readonly startDate: string;
    }): void {
      replaceDraft(createManualScheduleDraft(input));
    },
    applyShift(shift: ManualShiftChoice): void {
      if (state.draft !== undefined) replaceDraft(applySelectedShift(state.draft, shift));
    },
    lockShift(shift: ManualShiftChoice): void {
      if (state.draft !== undefined) replaceDraft(lockManualShift(state.draft, shift));
    },
    unlockShift(): void {
      if (state.draft !== undefined) replaceDraft(unlockManualShift(state.draft));
    },
    applyLockedShift(selection: ManualCellSelection): void {
      if (state.draft !== undefined) replaceDraft(applyLockedShift(state.draft, selection));
    },
    clearCell(selection: ManualCellSelection): void {
      if (state.draft !== undefined) replaceDraft(clearManualCell(state.draft, selection));
    },
    clearRow(membershipId: string): void {
      if (state.draft !== undefined) replaceDraft(clearManualRow(state.draft, membershipId));
    },
    clearColumn(cycleDay: number): void {
      if (state.draft !== undefined) replaceDraft(clearManualColumn(state.draft, cycleDay));
    },
    undo(): void {
      if (state.draft !== undefined) replaceDraft(undoManualDraft(state.draft));
    },
    chooseTemplate(templateId: string | undefined): void {
      const template =
        templateId === undefined ? undefined : state.templates.find(({ id }) => id === templateId);
      if (template === undefined) return;
      publish({
        ...state,
        conflict: undefined,
        draft: draftFromTemplate(template),
        selectedTemplateId: template.id,
      });
    },
    discardConflict(): void {
      publish({ ...state, conflict: undefined });
    },
    async reloadAuthoritativeDraft(): Promise<void> {
      await load();
      const template = state.templates.find(({ id }) => id === state.selectedTemplateId);
      if (template !== undefined)
        publish({ ...state, conflict: undefined, draft: draftFromTemplate(template) });
      else publish({ ...state, conflict: undefined });
    },
    async save(): Promise<void> {
      const { context, draft, selectedTemplateId } = state;
      if (
        context === undefined ||
        draft === undefined ||
        state.isSaving ||
        state.conflict !== undefined
      )
        return;
      const operationGeneration = generation;
      publish({ ...state, errorMessage: undefined, isSaving: true });
      try {
        if (selectedTemplateId === undefined)
          await dependencies.createManualScheduleTemplate(context.groupId, requestFrom(draft));
        else {
          const template = state.templates.find(({ id }) => id === selectedTemplateId);
          if (template === undefined) throw new Error('模板已不存在，请重新加载。');
          await dependencies.updateManualScheduleTemplate(context.groupId, template.id, {
            ...requestFrom(draft),
            expectedVersion: template.version,
          });
        }
        if (current(operationGeneration)) {
          publish({ ...state, isSaving: false });
          await refreshAfterMutation();
        }
      } catch (error) {
        if (!current(operationGeneration)) return;
        const detail = errorDetails(error);
        publish({
          ...state,
          conflict: detail.isConflict
            ? { latestData: detail.latestData, message: detail.message }
            : undefined,
          errorMessage: detail.message,
          isSaving: false,
        });
        if (detail.isConflict) void load();
      }
    },
    async removeSelectedTemplate(): Promise<void> {
      const { context, selectedTemplateId } = state;
      if (context === undefined || selectedTemplateId === undefined || state.isSaving) return;
      const operationGeneration = generation;
      publish({ ...state, errorMessage: undefined, isSaving: true });
      try {
        await dependencies.deleteManualScheduleTemplate(context.groupId, selectedTemplateId);
        if (current(operationGeneration)) {
          publish({ ...state, draft: undefined, isSaving: false, selectedTemplateId: undefined });
          await refreshAfterMutation();
        }
      } catch (error) {
        if (current(operationGeneration))
          publish({ ...state, errorMessage: errorDetails(error).message, isSaving: false });
      }
    },
  };
}
