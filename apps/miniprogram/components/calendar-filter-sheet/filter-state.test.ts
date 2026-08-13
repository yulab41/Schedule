import { describe, expect, it } from 'vitest';

import {
  clearCalendarFilterSelection,
  createCalendarFilterDraft,
  getCalendarFilterApplySelection,
  getCalendarFilterDraftView,
  replaceCalendarFilterOptions,
  resolveCalendarFilterLifecycleIdentity,
  selectAllCalendarFilterOptions,
  setCalendarFilterQuery,
  syncCalendarFilterControlledSelection,
  toggleCalendarFilterOption,
  type CalendarFilterSheetOption,
} from './filter-state.js';

const options: readonly CalendarFilterSheetOption[] = [
  { id: '', label: '全部岗位' },
  { id: 'role-2', label: '二线', searchText: 'backup ICU' },
  { id: 'role-1', label: '一线', searchText: 'primary' },
  { id: 'role-2', label: '重复的二线' },
];

describe('calendar filter sheet draft state', () => {
  it('copies and canonicalizes options and selected ids without mutating its inputs', () => {
    const optionSnapshot = JSON.stringify(options);
    const selectedIds = ['missing', 'role-1', 'role-2', 'role-1'] as const;
    const selectedSnapshot = JSON.stringify(selectedIds);

    const draft = createCalendarFilterDraft(options, selectedIds);

    expect(draft).toEqual({
      options: [
        { id: 'role-2', label: '二线', searchText: 'backup ICU' },
        { id: 'role-1', label: '一线', searchText: 'primary' },
      ],
      query: '',
      selectionIntentIds: ['missing', 'role-1', 'role-2'],
      selectedIds: ['role-2', 'role-1'],
    });
    expect(JSON.stringify(options)).toBe(optionSnapshot);
    expect(JSON.stringify(selectedIds)).toBe(selectedSnapshot);
  });

  it('ignores malformed values crossing the WXML property boundary', () => {
    const malformed = [
      null,
      { id: 1, label: '数字 ID' },
      { id: 'missing-label' },
      { id: 'valid', label: '有效选项', hint: 42, searchText: false },
    ] as unknown as readonly CalendarFilterSheetOption[];

    expect(createCalendarFilterDraft(malformed, ['valid'])).toEqual({
      options: [{ id: 'valid', label: '有效选项' }],
      query: '',
      selectionIntentIds: ['valid'],
      selectedIds: ['valid'],
    });
  });

  it('searches labels and aliases case-insensitively while preserving selection markers', () => {
    const source = createCalendarFilterDraft(options, ['role-1']);
    const searched = setCalendarFilterQuery(source, '  BACK  ');
    const view = getCalendarFilterDraftView(searched);

    expect(source.query).toBe('');
    expect(searched.query).toBe('  BACK  ');
    expect(view.items).toEqual([
      {
        id: 'role-2',
        isSelected: false,
        label: '二线',
        searchText: 'backup ICU',
      },
    ]);
    expect(getCalendarFilterDraftView(setCalendarFilterQuery(source, '一线')).items).toEqual([
      {
        id: 'role-1',
        isSelected: true,
        label: '一线',
        searchText: 'primary',
      },
    ]);
  });

  it('toggles only known ids and keeps option-order selection canonicalization', () => {
    const empty = clearCalendarFilterSelection(createCalendarFilterDraft(options, ['role-1']));
    const selectedFirst = toggleCalendarFilterOption(empty, 'role-1');
    const selectedBoth = toggleCalendarFilterOption(selectedFirst, 'role-2');

    expect(empty.selectedIds).toEqual([]);
    expect(selectedFirst.selectedIds).toEqual(['role-1']);
    expect(selectedBoth.selectedIds).toEqual(['role-2', 'role-1']);
    expect(toggleCalendarFilterOption(selectedBoth, 'role-1').selectedIds).toEqual(['role-2']);
    expect(toggleCalendarFilterOption(selectedBoth, 'missing')).toBe(selectedBoth);
  });

  it('selects every option regardless of the current search and clears explicitly', () => {
    const searched = setCalendarFilterQuery(createCalendarFilterDraft(options, []), '一线');
    const selected = selectAllCalendarFilterOptions(searched);
    const cleared = clearCalendarFilterSelection(selected);

    expect(selected.query).toBe('一线');
    expect(selected.selectedIds).toEqual(['role-2', 'role-1']);
    expect(cleared.selectedIds).toEqual([]);
    expect(cleared.query).toBe('一线');
  });

  it('preserves the query and surviving draft selection when options refresh', () => {
    const source = setCalendarFilterQuery(
      createCalendarFilterDraft(options, ['role-2', 'role-1']),
      'ICU',
    );
    const replaced = replaceCalendarFilterOptions(source, [
      { id: 'role-3', label: '夜班' },
      { id: 'role-2', label: '二线新名称', searchText: 'ICU' },
    ]);

    expect(replaced).toEqual({
      options: [
        { id: 'role-3', label: '夜班' },
        { id: 'role-2', label: '二线新名称', searchText: 'ICU' },
      ],
      query: 'ICU',
      selectionIntentIds: ['role-2', 'role-1'],
      selectedIds: ['role-2'],
    });
  });

  it('recovers controlled selections when options arrive after the sheet opens', () => {
    const source = setCalendarFilterQuery(createCalendarFilterDraft([], ['role-1']), '一线');
    const replaced = replaceCalendarFilterOptions(
      source,
      [{ id: 'role-1', label: '一线' }],
      ['role-1'],
    );

    expect(replaced).toEqual({
      options: [{ id: 'role-1', label: '一线' }],
      query: '一线',
      selectionIntentIds: ['role-1'],
      selectedIds: ['role-1'],
    });
    expect(replaceCalendarFilterOptions(source, [{ id: 'role-1', label: '一线' }], [])).toEqual({
      options: [{ id: 'role-1', label: '一线' }],
      query: '一线',
      selectionIntentIds: [],
      selectedIds: [],
    });
  });

  it('preserves unresolved selections after editing an already loaded option', () => {
    const partial = createCalendarFilterDraft(
      [{ id: 'role-1', label: '一线' }],
      ['role-1', 'role-2'],
    );
    const touched = toggleCalendarFilterOption(partial, 'role-1');
    const completed = replaceCalendarFilterOptions(touched, [
      { id: 'role-1', label: '一线' },
      { id: 'role-2', label: '二线' },
    ]);

    expect(touched.selectionIntentIds).toEqual(['role-2']);
    expect(completed.selectedIds).toEqual(['role-2']);
  });

  it('preserves selection intent across a temporary empty option refresh', () => {
    const touched = toggleCalendarFilterOption(
      createCalendarFilterDraft(
        [
          { id: 'role-1', label: '一线' },
          { id: 'role-2', label: '二线' },
        ],
        ['role-1', 'role-2'],
      ),
      'role-1',
    );
    const emptyRefresh = replaceCalendarFilterOptions(touched, []);
    const restored = replaceCalendarFilterOptions(emptyRefresh, [
      { id: 'role-1', label: '一线' },
      { id: 'role-2', label: '二线' },
    ]);

    expect(emptyRefresh.selectedIds).toEqual([]);
    expect(emptyRefresh.selectionIntentIds).toEqual(['role-2']);
    expect(restored.selectedIds).toEqual(['role-2']);
  });

  it('preserves an edited draft when the parent re-sends the same controlled selection', () => {
    const edited = setCalendarFilterQuery(
      toggleCalendarFilterOption(createCalendarFilterDraft(options, ['role-1']), 'role-2'),
      'ICU',
    );
    const unchanged = syncCalendarFilterControlledSelection(
      edited,
      ['role-1'],
      ['role-1', 'role-1'],
    );
    const changed = syncCalendarFilterControlledSelection(edited, ['role-1'], ['role-2']);

    expect(unchanged.didChange).toBe(false);
    expect(unchanged.draft).toBe(edited);
    expect(changed.didChange).toBe(true);
    expect(changed.draft.query).toBe('ICU');
    expect(changed.draft.selectedIds).toEqual(['role-2']);
  });

  it('blocks apply until options are authoritative and preserves unresolved intent', () => {
    const partial = createCalendarFilterDraft(
      [{ id: 'role-1', label: '一线' }],
      ['role-1', 'role-2'],
    );
    const unavailable = createCalendarFilterDraft([], ['role-1']);

    expect(getCalendarFilterApplySelection(partial, false)).toBeNull();
    expect(getCalendarFilterApplySelection(unavailable, false)).toBeNull();
    expect(getCalendarFilterApplySelection(partial, true)).toEqual(['role-1', 'role-2']);
  });

  it('rejects delayed lifecycle events from an older sheet instance', () => {
    expect(resolveCalendarFilterLifecycleIdentity('members', 12, 12)).toEqual({
      filterKey: 'members',
      sheetKey: 12,
    });
    for (const staleOrMalformedKey of [undefined, 11, '12', Number.NaN, 12.5, null, {}]) {
      expect(resolveCalendarFilterLifecycleIdentity('members', 12, staleOrMalformedKey)).toBeNull();
    }
    expect(resolveCalendarFilterLifecycleIdentity('members', Number.NaN, undefined)).toBeNull();
  });

  it('builds truthful selection summaries for empty, partial, complete, and unavailable states', () => {
    const empty = createCalendarFilterDraft(options, []);
    const partial = createCalendarFilterDraft(options, ['role-1']);
    const all = selectAllCalendarFilterOptions(empty);
    const unavailable = createCalendarFilterDraft([], []);
    const unavailableSelected = createCalendarFilterDraft([], ['role-1']);

    expect(getCalendarFilterDraftView(empty)).toMatchObject({
      selectedCount: 0,
      selectionSummary: '未筛选，显示全部 2 项',
      totalCount: 2,
    });
    expect(getCalendarFilterDraftView(partial)).toMatchObject({
      selectionIntentCount: 1,
      selectedCount: 1,
      selectionSummary: '已选 1 / 2 项',
      totalCount: 2,
    });
    expect(getCalendarFilterDraftView(all)).toMatchObject({
      selectedCount: 2,
      selectionSummary: '已选全部 2 项',
      totalCount: 2,
    });
    expect(getCalendarFilterDraftView(unavailable)).toMatchObject({
      selectedCount: 0,
      selectionSummary: '暂无可选项',
      totalCount: 0,
    });
    expect(getCalendarFilterDraftView(unavailableSelected)).toMatchObject({
      selectionIntentCount: 1,
      selectionSummary: '已保留 1 项筛选，当前范围无匹配选项',
      totalCount: 0,
    });
    expect(getCalendarFilterApplySelection(unavailableSelected, true)).toEqual(['role-1']);
    expect(
      getCalendarFilterDraftView(createCalendarFilterDraft([], ['role-1']), false),
    ).toMatchObject({
      canApply: false,
      emptyMessage: '正在加载选项',
      selectionIntentCount: 1,
      selectionSummary: '选项加载中，暂不可应用',
    });
  });
});
