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
  type CalendarFilterDraft,
  type CalendarFilterSheetOption,
  type CalendarFilterSheetOptionView,
} from './filter-state.js';

type CalendarFilterSearchEvent = WechatMiniprogram.CustomEvent<{ readonly value?: unknown }>;
type CalendarFilterOptionEvent = WechatMiniprogram.BaseEvent<
  Record<string, never>,
  { readonly optionId?: unknown }
>;
type CalendarFilterSheetLifecycleEvent = WechatMiniprogram.CustomEvent<{
  readonly sheetKey: unknown;
}>;

interface BottomSheetInstance {
  requestClose(): void;
}

const emptyDraft = createCalendarFilterDraft([], []);
const emptyView = getCalendarFilterDraftView(emptyDraft);

Component({
  properties: {
    filterKey: {
      type: String,
      value: '',
      observer(): void {
        if (this.properties.visible) this.ensureControlledSession();
      },
    },
    options: {
      type: Array,
      value: [],
      observer(): void {
        this.handleOptionsChanged();
      },
    },
    optionsReady: {
      type: Boolean,
      value: false,
      observer(): void {
        this.applyDraft(this.data.draft);
      },
    },
    searchPlaceholder: {
      type: String,
      value: '搜索选项',
    },
    selectedIds: {
      type: Array,
      value: [],
      observer(): void {
        if (this.properties.visible) this.handleControlledSelectionChanged();
      },
    },
    sheetKey: {
      type: Number,
      value: 0,
      observer(): void {
        if (this.properties.visible) this.ensureControlledSession();
      },
    },
    title: {
      type: String,
      value: '筛选',
    },
    visible: {
      type: Boolean,
      value: false,
      observer(): void {
        if (this.properties.visible) this.ensureControlledSession();
        else if (this.data.sessionOpen) this.setData({ sessionOpen: false });
      },
    },
  },
  data: {
    allSelected: emptyView.allSelected,
    activeFilterKey: '',
    activeSheetKey: 0,
    controlledSelectionIds: [] as readonly string[],
    draft: emptyDraft as CalendarFilterDraft,
    emptyMessage: emptyView.emptyMessage,
    items: emptyView.items as readonly CalendarFilterSheetOptionView[],
    selectedCount: emptyView.selectedCount,
    selectionIntentCount: emptyView.selectionIntentCount,
    selectionSummary: emptyView.selectionSummary,
    sessionOpen: false,
    totalCount: emptyView.totalCount,
  },
  methods: {
    applyDraft(draft: CalendarFilterDraft): void {
      const view = getCalendarFilterDraftView(draft, this.properties.optionsReady);
      this.setData({
        allSelected: view.allSelected,
        draft,
        emptyMessage: view.emptyMessage,
        items: view.items,
        selectedCount: view.selectedCount,
        selectionIntentCount: view.selectionIntentCount,
        selectionSummary: view.selectionSummary,
        totalCount: view.totalCount,
      });
    },
    ensureControlledSession(): void {
      if (
        this.data.sessionOpen &&
        this.data.activeFilterKey === this.properties.filterKey &&
        this.data.activeSheetKey === this.properties.sheetKey
      ) {
        return;
      }
      const draft = createCalendarFilterDraft(this.getOptions(), this.getSelectedIds());
      this.setData({
        activeFilterKey: this.properties.filterKey,
        activeSheetKey: this.properties.sheetKey,
        controlledSelectionIds: draft.selectionIntentIds,
        sessionOpen: true,
      });
      this.applyDraft(draft);
    },
    getOptions(): readonly CalendarFilterSheetOption[] {
      return this.properties.options as unknown as readonly CalendarFilterSheetOption[];
    },
    getSelectedIds(): readonly string[] {
      return this.properties.selectedIds as unknown as readonly string[];
    },
    handleApply(): void {
      const selectedIds = getCalendarFilterApplySelection(
        this.data.draft,
        this.properties.optionsReady,
      );
      if (selectedIds === null) return;
      this.triggerEvent('apply', {
        filterKey: this.properties.filterKey,
        selectedIds: [...selectedIds],
        sheetKey: this.properties.sheetKey,
      });
      this.requestInnerClose();
    },
    handleCancel(): void {
      this.requestInnerClose();
    },
    handleClearSearch(): void {
      this.applyDraft(setCalendarFilterQuery(this.data.draft, ''));
    },
    handleClearSelection(): void {
      this.applyDraft(clearCalendarFilterSelection(this.data.draft));
    },
    handleControlledSelectionChanged(): void {
      this.ensureControlledSession();
      const result = syncCalendarFilterControlledSelection(
        this.data.draft,
        this.data.controlledSelectionIds,
        this.getSelectedIds(),
      );
      if (!result.didChange) return;
      this.setData({ controlledSelectionIds: result.controlledSelectionIds });
      this.applyDraft(result.draft);
    },
    handleInnerClosed(event: CalendarFilterSheetLifecycleEvent): void {
      const identity = resolveCalendarFilterLifecycleIdentity(
        this.properties.filterKey,
        this.properties.sheetKey,
        event.detail.sheetKey,
      );
      if (identity !== null) this.triggerEvent('closed', identity);
    },
    handleInnerRequestClose(event: CalendarFilterSheetLifecycleEvent): void {
      const identity = resolveCalendarFilterLifecycleIdentity(
        this.properties.filterKey,
        this.properties.sheetKey,
        event.detail.sheetKey,
      );
      if (identity !== null) this.triggerEvent('request-close', identity);
    },
    handleOptionTap(event: CalendarFilterOptionEvent): void {
      const optionId = event.currentTarget.dataset.optionId;
      if (typeof optionId !== 'string' || optionId.length === 0) return;
      this.applyDraft(toggleCalendarFilterOption(this.data.draft, optionId));
    },
    handleOptionsChanged(): void {
      const options = this.getOptions();
      this.applyDraft(
        this.properties.visible
          ? replaceCalendarFilterOptions(this.data.draft, options)
          : createCalendarFilterDraft(options, this.getSelectedIds()),
      );
    },
    handleSearchInput(event: CalendarFilterSearchEvent): void {
      const query = event.detail.value;
      if (typeof query === 'string')
        this.applyDraft(setCalendarFilterQuery(this.data.draft, query));
    },
    handleSelectAll(): void {
      if (!this.properties.optionsReady) return;
      this.applyDraft(selectAllCalendarFilterOptions(this.data.draft));
    },
    requestInnerClose(): void {
      const sheet = this.selectComponent(
        '#calendar-filter-sheet-shell',
      ) as unknown as BottomSheetInstance | null;
      if (sheet !== null && typeof sheet.requestClose === 'function') {
        sheet.requestClose();
        return;
      }
      this.triggerEvent('request-close', {
        filterKey: this.properties.filterKey,
        sheetKey: this.properties.sheetKey,
      });
    },
  },
});
