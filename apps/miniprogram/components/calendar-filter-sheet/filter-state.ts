export interface CalendarFilterSheetOption {
  readonly hint?: string;
  readonly id: string;
  readonly label: string;
  readonly searchText?: string;
}

export interface CalendarFilterDraft {
  readonly options: readonly CalendarFilterSheetOption[];
  readonly query: string;
  readonly selectionIntentIds: readonly string[];
  readonly selectedIds: readonly string[];
}

export interface CalendarFilterSheetOptionView extends CalendarFilterSheetOption {
  readonly isSelected: boolean;
}

export interface CalendarFilterDraftView {
  readonly allSelected: boolean;
  readonly canApply: boolean;
  readonly emptyMessage: string;
  readonly items: readonly CalendarFilterSheetOptionView[];
  readonly selectionIntentCount: number;
  readonly selectedCount: number;
  readonly selectionSummary: string;
  readonly totalCount: number;
}

export interface CalendarFilterLifecycleIdentity {
  readonly filterKey: string;
  readonly sheetKey: number;
}

export interface CalendarFilterControlledSelectionSync {
  readonly controlledSelectionIds: readonly string[];
  readonly didChange: boolean;
  readonly draft: CalendarFilterDraft;
}

function normalizeOptions(
  options: readonly CalendarFilterSheetOption[],
): readonly CalendarFilterSheetOption[] {
  const seen = new Set<string>();
  const normalized: CalendarFilterSheetOption[] = [];
  for (const option of options) {
    const candidate: unknown = option;
    if (candidate === null || typeof candidate !== 'object') continue;
    const record = candidate as Record<string, unknown>;
    const id = record.id;
    const label = record.label;
    if (
      typeof id !== 'string' ||
      typeof label !== 'string' ||
      id.length === 0 ||
      label.trim().length === 0 ||
      seen.has(id)
    ) {
      continue;
    }
    seen.add(id);
    normalized.push({
      ...(typeof record.hint === 'string' ? { hint: record.hint } : {}),
      id,
      label,
      ...(typeof record.searchText === 'string' ? { searchText: record.searchText } : {}),
    });
  }
  return normalized;
}

function canonicalizeSelectedIds(
  options: readonly CalendarFilterSheetOption[],
  selectedIds: readonly string[],
): readonly string[] {
  const selected = new Set(selectedIds);
  return options.filter(({ id }) => selected.has(id)).map(({ id }) => id);
}

function normalizeSelectionIntent(selectedIds: readonly string[]): readonly string[] {
  const candidates: unknown = selectedIds;
  if (!Array.isArray(candidates)) return [];
  const seen = new Set<string>();
  const normalized: string[] = [];
  for (const candidate of candidates) {
    if (typeof candidate !== 'string' || candidate.length === 0 || seen.has(candidate)) continue;
    seen.add(candidate);
    normalized.push(candidate);
  }
  return normalized;
}

function sameStringArray(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

export function createCalendarFilterDraft(
  options: readonly CalendarFilterSheetOption[],
  selectedIds: readonly string[],
): CalendarFilterDraft {
  const normalizedOptions = normalizeOptions(options);
  const selectionIntentIds = normalizeSelectionIntent(selectedIds);
  return {
    options: normalizedOptions,
    query: '',
    selectionIntentIds,
    selectedIds: canonicalizeSelectedIds(normalizedOptions, selectionIntentIds),
  };
}

export function setCalendarFilterQuery(
  draft: CalendarFilterDraft,
  query: string,
): CalendarFilterDraft {
  return draft.query === query ? draft : { ...draft, query };
}

export function toggleCalendarFilterOption(
  draft: CalendarFilterDraft,
  optionId: string,
): CalendarFilterDraft {
  if (!draft.options.some(({ id }) => id === optionId)) return draft;
  const selected = new Set(draft.selectionIntentIds);
  if (selected.has(optionId)) selected.delete(optionId);
  else selected.add(optionId);
  const selectionIntentIds = draft.selectionIntentIds.filter((id) => selected.has(id));
  if (selected.has(optionId) && !selectionIntentIds.includes(optionId)) {
    selectionIntentIds.push(optionId);
  }
  return {
    ...draft,
    selectionIntentIds,
    selectedIds: canonicalizeSelectedIds(draft.options, selectionIntentIds),
  };
}

export function selectAllCalendarFilterOptions(draft: CalendarFilterDraft): CalendarFilterDraft {
  const selectedIds = draft.options.map(({ id }) => id);
  const selectionIntentIds = normalizeSelectionIntent([
    ...draft.selectionIntentIds,
    ...selectedIds,
  ]);
  return sameStringArray(draft.selectedIds, selectedIds) &&
    sameStringArray(draft.selectionIntentIds, selectionIntentIds)
    ? draft
    : { ...draft, selectionIntentIds, selectedIds };
}

export function clearCalendarFilterSelection(draft: CalendarFilterDraft): CalendarFilterDraft {
  return draft.selectedIds.length === 0 && draft.selectionIntentIds.length === 0
    ? draft
    : { ...draft, selectionIntentIds: [], selectedIds: [] };
}

export function replaceCalendarFilterOptions(
  draft: CalendarFilterDraft,
  options: readonly CalendarFilterSheetOption[],
  selectedIds: readonly string[] = draft.selectionIntentIds,
): CalendarFilterDraft {
  const normalizedOptions = normalizeOptions(options);
  const selectionIntentIds = normalizeSelectionIntent(selectedIds);
  return {
    options: normalizedOptions,
    query: draft.query,
    selectionIntentIds,
    selectedIds: canonicalizeSelectedIds(normalizedOptions, selectionIntentIds),
  };
}

function sameSelection(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((id) => right.includes(id));
}

export function syncCalendarFilterControlledSelection(
  draft: CalendarFilterDraft,
  previousControlledIds: readonly string[],
  nextControlledIds: readonly string[],
): CalendarFilterControlledSelectionSync {
  const previous = normalizeSelectionIntent(previousControlledIds);
  const next = normalizeSelectionIntent(nextControlledIds);
  if (sameSelection(previous, next)) {
    return { controlledSelectionIds: previous, didChange: false, draft };
  }
  return {
    controlledSelectionIds: next,
    didChange: true,
    draft: replaceCalendarFilterOptions(draft, draft.options, next),
  };
}

export function getCalendarFilterApplySelection(
  draft: CalendarFilterDraft,
  optionsReady: boolean,
): readonly string[] | null {
  return optionsReady ? [...draft.selectionIntentIds] : null;
}

export function resolveCalendarFilterLifecycleIdentity(
  filterKey: string,
  sheetKey: number,
  eventSheetKey: unknown,
): CalendarFilterLifecycleIdentity | null {
  if (!Number.isInteger(sheetKey)) return null;
  if (
    typeof eventSheetKey !== 'number' ||
    !Number.isInteger(eventSheetKey) ||
    eventSheetKey !== sheetKey
  ) {
    return null;
  }
  return { filterKey, sheetKey };
}

export function getCalendarFilterDraftView(
  draft: CalendarFilterDraft,
  optionsReady = true,
): CalendarFilterDraftView {
  const normalizedQuery = draft.query.trim().toLocaleLowerCase();
  const selected = new Set(draft.selectedIds);
  const items = draft.options
    .filter((option) => {
      if (normalizedQuery.length === 0) return true;
      const searchable = `${option.label}\n${option.hint ?? ''}\n${option.searchText ?? ''}`;
      return searchable.toLocaleLowerCase().includes(normalizedQuery);
    })
    .map((option) => ({ ...option, isSelected: selected.has(option.id) }));
  const totalCount = draft.options.length;
  const selectedCount = draft.selectedIds.length;
  const selectionIntentCount = draft.selectionIntentIds.length;
  const selectionSummary = !optionsReady
    ? '选项加载中，暂不可应用'
    : totalCount === 0 && selectionIntentCount > 0
      ? `已保留 ${selectionIntentCount} 项筛选，当前范围无匹配选项`
      : totalCount === 0
        ? '暂无可选项'
        : selectedCount === 0
          ? `未筛选，显示全部 ${totalCount} 项`
          : selectedCount === totalCount
            ? `已选全部 ${totalCount} 项`
            : `已选 ${selectedCount} / ${totalCount} 项`;
  return {
    allSelected: totalCount > 0 && selectedCount === totalCount,
    canApply: optionsReady,
    emptyMessage: !optionsReady ? '正在加载选项' : totalCount === 0 ? '暂无可选项' : '未找到匹配项',
    items,
    selectionIntentCount,
    selectedCount,
    selectionSummary,
    totalCount,
  };
}
