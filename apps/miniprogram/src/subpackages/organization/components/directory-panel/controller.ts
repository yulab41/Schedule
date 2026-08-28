import type { DirectoryReadClient } from '@schedule/client-core';
import { ClientCoreError } from '@schedule/client-core';
import type {
  DirectoryEntry,
  DirectoryFacetOption,
  DirectoryFacetSnapshot,
  DirectoryKind,
  DirectoryQuery,
} from '@schedule/contracts';
import {
  canDialDirectoryNumber,
  getCompatibleDirectoryFacetOptionsByKey,
  getDirectoryGroupContexts,
  getDirectoryGroupEmployeeCodes,
  getDirectoryGroupJobTitles,
  getDirectoryGroupKindLabel,
  getDirectoryGroupNotes,
  getDirectoryGroupTitle,
  getDirectoryNumberLabel,
  getDirectoryPreferenceEntryIds,
  getDirectoryPriorityGroups,
  getMeaningfulDirectoryFilterKeys,
  getSafeInternalExtension,
  groupDirectoryEntriesByContact,
  hasActiveDirectoryCriteria,
  isDirectoryGroupFavorite,
  normalizeDirectoryDialNumber,
  parseDirectoryPreferences,
  recordDirectoryUse,
  toDirectoryQuery,
  toggleDirectoryFavorite,
  updateDirectoryFilterSelection,
  type DirectoryEntryDisplayGroup,
  type DirectoryFilterKey,
  type DirectoryFilters,
  type DirectoryPreferences,
} from '@schedule/presentation-core';
import {
  ClientCapabilityDisabledError,
  requireClientCapability,
} from '../../../../app/client-capability-store.js';
import { createRuntimeDirectoryReadClient } from '../../../../platform/client-core-calendar.js';
import { DIRECTORY_PREFERENCES_PREFIX } from '../../../../platform/private-storage.js';
import { recordMiniTelemetryBoundary } from '../../../../platform/telemetry.js';
import {
  getStoredWechatProfile,
  getStoredWechatToken,
  getWechatRequestAuthentication,
} from '../../../../platform/wechat-identity.js';

type DirectoryState = 'disabled' | 'empty' | 'error' | 'idle' | 'loading' | 'ready';
type DirectoryModeIndex = 0 | 1;

interface DirectoryNumberCard {
  readonly dialable: boolean;
  readonly dialNumber: string | undefined;
  readonly id: string;
  readonly label: string;
  readonly number: string;
}

interface DirectoryContactCard {
  readonly id: string;
  readonly label: string;
  readonly numbers: readonly DirectoryNumberCard[];
  readonly showLabel: boolean;
}

interface DirectoryCard {
  readonly contacts: readonly DirectoryContactCard[];
  readonly contexts: readonly string[];
  readonly employeeCodeLabel: string;
  readonly employeeCodes: readonly string[];
  readonly favorite: boolean;
  readonly id: string;
  readonly jobTitles: readonly string[];
  readonly kindLabel: string;
  readonly mergeCountLabel: string;
  readonly merged: boolean;
  readonly notes: string;
  readonly title: string;
}

interface DirectoryPrioritySectionView {
  readonly entries: readonly DirectoryCard[];
  readonly key: 'favorites' | 'frequent';
  readonly title: string;
}

interface DirectoryFilterOptionView extends DirectoryFacetOption {
  readonly selected: boolean;
  readonly value: string;
}

interface DirectoryFilterSectionView {
  readonly expanded: boolean;
  readonly key: DirectoryFilterKey;
  readonly label: string;
  readonly optionCount: number;
  readonly options: readonly DirectoryFilterOptionView[];
  readonly selectedLabel: string;
}

interface DirectoryPaneData {
  readonly activeFilterCount: number;
  readonly directoryKind: DirectoryKind;
  readonly entries: readonly DirectoryCard[];
  readonly errorMessage: string;
  readonly facetsLoading: boolean;
  readonly filterAdjustmentMessage: string;
  readonly filterScrollTarget: string;
  readonly filterSections: readonly DirectoryFilterSectionView[];
  readonly filterSheetOpen: boolean;
  readonly hasCriteria: boolean;
  readonly loadingMore: boolean;
  readonly mergedGroupCount: number;
  readonly nextCursor: string;
  readonly prioritySections: readonly DirectoryPrioritySectionView[];
  readonly resultSummary: string;
  readonly searchQuery: string;
  readonly searching: boolean;
  readonly state: DirectoryState;
  readonly title: string;
}

interface DirectoryPageData {
  readonly activeModeIndex: DirectoryModeIndex;
  readonly departmentAnimating: boolean;
  readonly directoryKind: DirectoryKind;
  readonly employeePane: DirectoryPaneData;
  readonly embedded: boolean;
  readonly filterSheetOpen: boolean;
  readonly groupId: string;
  readonly internalPane: DirectoryPaneData;
  readonly largeText: boolean;
  readonly peopleAnimating: boolean;
  readonly shellContentStyle: string;
  readonly shellHeaderStyle: string;
  readonly swiperDuration: number;
  readonly viewportClass: string;
}

interface DirectoryModeRuntime {
  readonly collapsedFilterKeys: Set<DirectoryFilterKey>;
  contextSerial: number;
  facets: DirectoryFacetSnapshot | undefined;
  filters: DirectoryFilters;
  groupId: string;
  nextCursor: string | undefined;
  preferences: DirectoryPreferences;
  priorityEntries: readonly DirectoryEntry[];
  rawEntries: readonly DirectoryEntry[];
  requestSerial: number;
  searchTimer: unknown;
}

interface DirectoryPageInstance {
  readonly data: DirectoryPageData;
  readonly properties: {
    readonly directoryKind: DirectoryKind;
    readonly embedded: boolean;
    readonly groupId: string;
  };
  _detached: boolean;
  _directoryClient: DirectoryReadClient;
  _modeIconTimers: Partial<Record<DirectoryKind, unknown>>;
  _modeRuntimes: Record<DirectoryKind, DirectoryModeRuntime>;
  setData(patch: Record<string, unknown>, callback?: () => void): void;
  triggerEvent?(name: 'panelready'): void;
}

interface ModeDataset {
  readonly directoryKind?: DirectoryKind;
  readonly filter?: DirectoryFilterKey;
  readonly groupId?: string;
  readonly number?: string;
  readonly value?: string;
}

interface ModeTargetEvent {
  readonly currentTarget?: { readonly dataset: ModeDataset };
}

interface InputEvent extends ModeTargetEvent {
  readonly detail: { readonly value: string };
}

interface FilterOptionEvent extends ModeTargetEvent {
  readonly currentTarget: {
    readonly dataset: ModeDataset & { readonly filter?: DirectoryFilterKey };
  };
}

interface DirectoryCardEvent extends ModeTargetEvent {
  readonly detail: { readonly groupId?: string; readonly number?: string };
}

interface ModeSwiperEvent {
  readonly detail: { readonly current: number };
}

const directoryClient = createRuntimeDirectoryReadClient(
  getStoredWechatToken,
  getWechatRequestAuthentication(),
);
const directoryKinds: readonly DirectoryKind[] = ['internal', 'employee'];
const filterLabels: Readonly<Record<DirectoryFilterKey, string>> = {
  building: '楼宇',
  campusCode: '院区',
  department: '科室',
  entryKind: '类型',
  floor: '楼层',
  section: '片区',
  subunit: '单元',
};

export function createDirectoryPanelControllerDefinition() {
  const data: DirectoryPageData = {
    activeModeIndex: 0,
    departmentAnimating: false,
    directoryKind: 'internal',
    employeePane: createPaneData('employee'),
    embedded: false,
    filterSheetOpen: false,
    groupId: '',
    internalPane: createPaneData('internal'),
    largeText: false,
    peopleAnimating: false,
    shellContentStyle: 'height:calc(100% - 76px);',
    shellHeaderStyle: 'height:76px;min-height:76px;padding-top:24px;',
    swiperDuration: 240,
    viewportClass: '',
  };

  return {
    data,
    properties: {
      directoryKind: { type: String, value: 'internal' },
      embedded: { type: Boolean, value: false },
      groupId: { type: String, value: '' },
    },
    observers: {
      groupId(this: DirectoryPageInstance): void {
        startLoad(this);
      },
      directoryKind(this: DirectoryPageInstance): void {
        activateMode(this, normalizeDirectoryKind(this.properties.directoryKind), false);
      },
    },
    lifetimes: {
      attached(this: DirectoryPageInstance): void {
        recordMiniTelemetryBoundary('directory:controller-attached');
        initializeRuntimeState(this);
        this._detached = false;
        const windowInfo = wx.getWindowInfo();
        const statusBarHeight = Math.max(0, windowInfo.statusBarHeight ?? 0);
        const headerHeight = statusBarHeight + 52;
        const embedded = this.properties.embedded;
        this.setData(
          {
            embedded,
            largeText:
              ((windowInfo as unknown as { readonly fontSizeSetting?: number }).fontSizeSetting ??
                16) >= 20,
            shellContentStyle: embedded ? 'height:100%;' : `height:calc(100% - ${headerHeight}px);`,
            shellHeaderStyle: `height:${headerHeight}px;min-height:${headerHeight}px;padding-top:${statusBarHeight}px;`,
            viewportClass: windowInfo.windowWidth <= 340 ? 'is-compact' : '',
          },
          () => this.triggerEvent?.('panelready'),
        );
        startLoad(this);
      },
      detached(this: DirectoryPageInstance): void {
        initializeRuntimeState(this);
        this._detached = true;
        for (const kind of directoryKinds) invalidateRuntime(this._modeRuntimes[kind]);
        clearModeIconTimers(this);
      },
    },
    methods: {
      preventTouchMove(): void {},
      handleBack(): void {
        wx.navigateBack({ delta: 1 });
      },
      handleInternalMode(this: DirectoryPageInstance): void {
        activateMode(this, 'internal', true);
      },
      handleEmployeeMode(this: DirectoryPageInstance): void {
        activateMode(this, 'employee', true);
      },
      handleModeSwiperChange(this: DirectoryPageInstance, event: ModeSwiperEvent): void {
        if (event.detail.current === 0 || event.detail.current === 1) {
          activateMode(this, event.detail.current === 0 ? 'internal' : 'employee', true);
        }
      },
      handleRetry(this: DirectoryPageInstance, event?: ModeTargetEvent): void {
        const kind = eventKind(this, event);
        const pane = getPaneData(this, kind);
        if (pane.state === 'disabled') {
          for (const directoryKind of directoryKinds) void loadFacets(this, directoryKind);
          return;
        }
        const runtime = getRuntime(this, kind);
        if (runtime.facets === undefined) void loadFacets(this, kind);
        else void search(this, kind);
      },
      handleSearchInput(this: DirectoryPageInstance, event: InputEvent): void {
        const kind = eventKind(this, event);
        setPaneData(this, kind, { searchQuery: event.detail.value });
        scheduleSearch(this, kind);
      },
      handleSearch(this: DirectoryPageInstance, event?: ModeTargetEvent): void {
        void search(this, eventKind(this, event));
      },
      handleClearSearch(this: DirectoryPageInstance, event?: ModeTargetEvent): void {
        clearSearch(this, eventKind(this, event));
      },
      handleOpenFilters(this: DirectoryPageInstance, event?: ModeTargetEvent): void {
        openFilters(this, eventKind(this, event));
      },
      handleOpenFilterAt(this: DirectoryPageInstance, event: FilterOptionEvent): void {
        const kind = eventKind(this, event);
        const key = event.currentTarget.dataset.filter;
        if (key !== undefined) openFilters(this, kind, key);
      },
      handleCloseFilters(this: DirectoryPageInstance, event?: ModeTargetEvent): void {
        closeFilters(this, eventKind(this, event));
      },
      handleToggleFilterSection(this: DirectoryPageInstance, event: FilterOptionEvent): void {
        const kind = eventKind(this, event);
        const key = event.currentTarget.dataset.filter;
        if (key !== undefined) toggleFilterSection(this, kind, key);
      },
      handleFilterOption(this: DirectoryPageInstance, event: FilterOptionEvent): void {
        void selectFilter(this, eventKind(this, event), event);
      },
      handleClearFilters(this: DirectoryPageInstance, event?: ModeTargetEvent): void {
        clearAllFilters(this, eventKind(this, event));
      },
      handleResetSearch(this: DirectoryPageInstance, event?: ModeTargetEvent): void {
        resetDirectorySearch(this, eventKind(this, event));
      },
      handleLoadMore(this: DirectoryPageInstance, event?: ModeTargetEvent): void {
        void loadMore(this, eventKind(this, event));
      },
      handleToggleFavorite(this: DirectoryPageInstance, event: ModeTargetEvent): void {
        const kind = eventKind(this, event);
        toggleFavorite(this, kind, event.currentTarget?.dataset.groupId);
      },
      handleDirectoryCardFavorite(this: DirectoryPageInstance, event: DirectoryCardEvent): void {
        toggleFavorite(this, eventKind(this, event), event.detail.groupId);
      },
      handleDirectoryCardCall(this: DirectoryPageInstance, event: DirectoryCardEvent): void {
        const number = event.detail.number;
        if (number !== undefined && /^\+?\d{3,20}$/u.test(number)) {
          recordUse(this, eventKind(this, event), event.detail.groupId);
          wx.makePhoneCall({ phoneNumber: number });
        }
      },
      handleCall(this: DirectoryPageInstance, event: ModeTargetEvent): void {
        const number = event.currentTarget?.dataset.number;
        if (number !== undefined && /^\+?\d{3,20}$/u.test(number)) {
          recordUse(this, eventKind(this, event), event.currentTarget?.dataset.groupId);
          wx.makePhoneCall({ phoneNumber: number });
        }
      },
    },
  };
}

function createPaneData(kind: DirectoryKind): DirectoryPaneData {
  return {
    activeFilterCount: 0,
    directoryKind: kind,
    entries: [],
    errorMessage: '',
    facetsLoading: true,
    filterAdjustmentMessage: '',
    filterScrollTarget: '',
    filterSections: [],
    filterSheetOpen: false,
    hasCriteria: false,
    loadingMore: false,
    mergedGroupCount: 0,
    nextCursor: '',
    prioritySections: [],
    resultSummary: '',
    searchQuery: '',
    searching: false,
    state: 'loading',
    title: kind === 'employee' ? '人员通讯录' : '科室通讯录',
  };
}

function createModeRuntime(groupId = ''): DirectoryModeRuntime {
  return {
    collapsedFilterKeys: new Set(),
    contextSerial: 0,
    facets: undefined,
    filters: {},
    groupId,
    nextCursor: undefined,
    preferences: parseDirectoryPreferences(undefined),
    priorityEntries: [],
    rawEntries: [],
    requestSerial: 0,
    searchTimer: undefined,
  };
}

function initializeRuntimeState(page: DirectoryPageInstance): void {
  page._directoryClient = directoryClient;
  if (
    page._modeRuntimes === undefined ||
    page._modeRuntimes.internal === undefined ||
    page._modeRuntimes.employee === undefined
  ) {
    page._modeRuntimes = {
      employee: createModeRuntime(page.data.groupId),
      internal: createModeRuntime(page.data.groupId),
    };
  }
  if (page._modeIconTimers === undefined || typeof page._modeIconTimers !== 'object') {
    page._modeIconTimers = {};
  }
  if (typeof page._detached !== 'boolean') page._detached = false;
}

function startLoad(page: DirectoryPageInstance): void {
  initializeRuntimeState(page);
  const groupId = page.properties.groupId;
  const initialKind = normalizeDirectoryKind(page.properties.directoryKind);
  if (groupId.length === 0) {
    setMissingGroupError(page, initialKind);
    return;
  }
  if (
    page.data.groupId === groupId &&
    directoryKinds.every((kind) => page._modeRuntimes[kind].groupId === groupId)
  ) {
    activateMode(page, initialKind, false);
    return;
  }
  for (const kind of directoryKinds) invalidateRuntime(page._modeRuntimes[kind]);
  page._modeRuntimes = {
    employee: createModeRuntime(groupId),
    internal: createModeRuntime(groupId),
  };
  page._detached = false;
  page.setData({
    activeModeIndex: modeIndex(initialKind),
    directoryKind: initialKind,
    employeePane: createPaneData('employee'),
    filterSheetOpen: false,
    groupId,
    internalPane: createPaneData('internal'),
  });
  for (const kind of directoryKinds) void loadFacets(page, kind);
}

function normalizeDirectoryKind(value: DirectoryKind): DirectoryKind {
  return value === 'employee' ? 'employee' : 'internal';
}

function modeIndex(kind: DirectoryKind): DirectoryModeIndex {
  return kind === 'employee' ? 1 : 0;
}

function paneField(kind: DirectoryKind): 'employeePane' | 'internalPane' {
  return kind === 'employee' ? 'employeePane' : 'internalPane';
}

function getPaneData(page: DirectoryPageInstance, kind: DirectoryKind): DirectoryPaneData {
  return page.data[paneField(kind)];
}

function getRuntime(page: DirectoryPageInstance, kind: DirectoryKind): DirectoryModeRuntime {
  initializeRuntimeState(page);
  return page._modeRuntimes[kind];
}

function setPaneData(
  page: DirectoryPageInstance,
  kind: DirectoryKind,
  patch: Partial<DirectoryPaneData>,
  callback?: () => void,
): void {
  const field = paneField(kind);
  const dataPatch: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(patch)) dataPatch[`${field}.${key}`] = value;
  page.setData(dataPatch, callback);
}

function eventKind(page: DirectoryPageInstance, event?: ModeTargetEvent): DirectoryKind {
  const value = event?.currentTarget?.dataset.directoryKind;
  return value === 'employee' || value === 'internal' ? value : page.data.directoryKind;
}

function activateMode(page: DirectoryPageInstance, kind: DirectoryKind, animate: boolean): void {
  initializeRuntimeState(page);
  const normalized = normalizeDirectoryKind(kind);
  const index = modeIndex(normalized);
  if (page.data.directoryKind === normalized && page.data.activeModeIndex === index) return;
  page.setData({ activeModeIndex: index, directoryKind: normalized });
  if (animate) playModeIcon(page, normalized);
}

function playModeIcon(page: DirectoryPageInstance, kind: DirectoryKind): void {
  const field = kind === 'employee' ? 'peopleAnimating' : 'departmentAnimating';
  const timer = page._modeIconTimers[kind];
  if (timer !== undefined) clearTimeout(timer);
  page.setData({ [field]: false }, () => {
    page.setData({ [field]: true });
    page._modeIconTimers[kind] = setTimeout(
      () => {
        page._modeIconTimers[kind] = undefined;
        if (!page._detached) page.setData({ [field]: false });
      },
      kind === 'employee' ? 520 : 500,
    );
  });
}

function clearModeIconTimers(page: DirectoryPageInstance): void {
  for (const kind of directoryKinds) {
    const timer = page._modeIconTimers[kind];
    if (timer !== undefined) clearTimeout(timer);
    page._modeIconTimers[kind] = undefined;
  }
}

function invalidateRuntime(runtime: DirectoryModeRuntime): void {
  clearSearchTimer(runtime);
  runtime.contextSerial += 1;
  runtime.requestSerial += 1;
  runtime.facets = undefined;
  runtime.filters = {};
  runtime.nextCursor = undefined;
  runtime.priorityEntries = [];
  runtime.rawEntries = [];
  runtime.collapsedFilterKeys.clear();
}

function clearSearchTimer(runtime: DirectoryModeRuntime): void {
  if (runtime.searchTimer === undefined) return;
  clearTimeout(runtime.searchTimer);
  runtime.searchTimer = undefined;
}

function isContextCurrent(
  page: DirectoryPageInstance,
  kind: DirectoryKind,
  runtime: DirectoryModeRuntime,
  serial: number,
  groupId: string,
): boolean {
  return (
    !page._detached &&
    page._modeRuntimes[kind] === runtime &&
    runtime.contextSerial === serial &&
    runtime.groupId === groupId &&
    page.data.groupId === groupId
  );
}

function isRequestCurrent(
  page: DirectoryPageInstance,
  kind: DirectoryKind,
  runtime: DirectoryModeRuntime,
  serial: number,
  groupId: string,
): boolean {
  return (
    !page._detached &&
    page._modeRuntimes[kind] === runtime &&
    runtime.requestSerial === serial &&
    runtime.groupId === groupId &&
    page.data.groupId === groupId
  );
}

function setMissingGroupError(page: DirectoryPageInstance, initialKind: DirectoryKind): void {
  initializeRuntimeState(page);
  for (const kind of directoryKinds) invalidateRuntime(page._modeRuntimes[kind]);
  const message = '当前群组信息缺失，请返回工作台后重试。';
  page.setData({
    activeModeIndex: modeIndex(initialKind),
    directoryKind: initialKind,
    employeePane: {
      ...createPaneData('employee'),
      errorMessage: message,
      facetsLoading: false,
      state: 'error',
    },
    filterSheetOpen: false,
    groupId: '',
    internalPane: {
      ...createPaneData('internal'),
      errorMessage: message,
      facetsLoading: false,
      state: 'error',
    },
  });
}

function setDirectoryDisabled(page: DirectoryPageInstance, message: string): void {
  initializeRuntimeState(page);
  for (const kind of directoryKinds) {
    const runtime = page._modeRuntimes[kind];
    invalidateRuntime(runtime);
    setPaneData(page, kind, {
      activeFilterCount: 0,
      entries: [],
      errorMessage: message,
      facetsLoading: false,
      filterAdjustmentMessage: '',
      filterScrollTarget: '',
      filterSections: [],
      filterSheetOpen: false,
      hasCriteria: false,
      loadingMore: false,
      mergedGroupCount: 0,
      nextCursor: '',
      prioritySections: [],
      resultSummary: '',
      searchQuery: '',
      searching: false,
      state: 'disabled',
    });
  }
  page.setData({ filterSheetOpen: false });
}

async function loadFacets(page: DirectoryPageInstance, kind: DirectoryKind): Promise<void> {
  initializeRuntimeState(page);
  const runtime = getRuntime(page, kind);
  const groupId = runtime.groupId || page.data.groupId;
  if (groupId.length === 0) {
    setMissingGroupError(page, page.data.directoryKind);
    return;
  }
  clearSearchTimer(runtime);
  const serial = ++runtime.contextSerial;
  runtime.requestSerial += 1;
  runtime.facets = undefined;
  runtime.filters = {};
  runtime.nextCursor = undefined;
  runtime.preferences = readDirectoryPreferences(page, kind);
  runtime.priorityEntries = [];
  runtime.rawEntries = [];
  runtime.collapsedFilterKeys.clear();
  setPaneData(page, kind, {
    activeFilterCount: 0,
    entries: [],
    errorMessage: '',
    facetsLoading: true,
    filterAdjustmentMessage: '',
    filterScrollTarget: '',
    filterSections: [],
    filterSheetOpen: false,
    hasCriteria: false,
    loadingMore: false,
    mergedGroupCount: 0,
    nextCursor: '',
    prioritySections: [],
    resultSummary: '',
    searchQuery: '',
    searching: false,
    state: 'loading',
  });
  try {
    await requireClientCapability('organization');
    const facets = await page._directoryClient.getFacets(groupId, kind);
    if (!isContextCurrent(page, kind, runtime, serial, groupId)) return;
    runtime.facets = facets;
    runtime.filters = {};
    setPaneData(page, kind, { facetsLoading: false, state: 'idle' });
    syncFilterSections(page, kind);
    void loadPriorityEntries(page, kind, runtime, serial, groupId);
  } catch (error) {
    if (!isContextCurrent(page, kind, runtime, serial, groupId)) return;
    if (error instanceof ClientCapabilityDisabledError) {
      setDirectoryDisabled(page, error.message);
      return;
    }
    setPaneData(page, kind, {
      errorMessage: toUserMessage(
        error,
        `${getPaneData(page, kind).title}筛选项暂时无法加载，请稍后重试。`,
      ),
      facetsLoading: false,
      state: 'error',
    });
  }
}

function syncFilterSections(page: DirectoryPageInstance, kind: DirectoryKind): void {
  const runtime = getRuntime(page, kind);
  const snapshot = runtime.facets;
  if (snapshot === undefined) {
    setPaneData(page, kind, { activeFilterCount: 0, filterSections: [] });
    return;
  }
  const compatible = getCompatibleDirectoryFacetOptionsByKey(snapshot, runtime.filters);
  const meaningful = getMeaningfulDirectoryFilterKeys(snapshot, runtime.filters, compatible);
  const sections = meaningful.map((key): DirectoryFilterSectionView => {
    const selectedValue = runtime.filters[key] ?? '';
    const compatibleOptions = compatible.get(key) ?? [];
    const options: readonly DirectoryFilterOptionView[] = [
      { count: snapshot.totalCount, label: '全部', selected: selectedValue === '', value: '' },
      ...compatibleOptions.map((option) => ({
        ...option,
        selected: option.value === selectedValue,
      })),
    ];
    return {
      expanded: !runtime.collapsedFilterKeys.has(key),
      key,
      label: filterLabel(kind, key),
      optionCount: compatibleOptions.length,
      options,
      selectedLabel: options.find((option) => option.selected)?.label ?? '全部',
    };
  });
  setPaneData(page, kind, {
    activeFilterCount: Object.keys(runtime.filters).length,
    filterSections: sections,
  });
}

function filterLabel(kind: DirectoryKind, key: DirectoryFilterKey): string {
  if (kind === 'employee') {
    return (
      {
        building: '二级组织',
        campusCode: '组织根',
        department: '四级组织',
        entryKind: '类型',
        floor: '三级组织',
        section: '一级组织',
        subunit: '五级组织',
      } satisfies Readonly<Record<DirectoryFilterKey, string>>
    )[key];
  }
  return filterLabels[key];
}

function openFilters(
  page: DirectoryPageInstance,
  kind: DirectoryKind,
  targetKey?: DirectoryFilterKey,
): void {
  const runtime = getRuntime(page, kind);
  if (targetKey !== undefined) runtime.collapsedFilterKeys.delete(targetKey);
  syncFilterSections(page, kind);
  setPaneData(page, kind, {
    filterScrollTarget: targetKey === undefined ? '' : `directory-filter-${kind}-${targetKey}`,
    filterSheetOpen: true,
  });
  page.setData({ filterSheetOpen: true });
}

function closeFilters(page: DirectoryPageInstance, kind: DirectoryKind): void {
  setPaneData(page, kind, { filterScrollTarget: '', filterSheetOpen: false });
  page.setData({ filterSheetOpen: false });
}

function toggleFilterSection(
  page: DirectoryPageInstance,
  kind: DirectoryKind,
  key: DirectoryFilterKey,
): void {
  const runtime = getRuntime(page, kind);
  if (runtime.collapsedFilterKeys.has(key)) runtime.collapsedFilterKeys.delete(key);
  else runtime.collapsedFilterKeys.add(key);
  syncFilterSections(page, kind);
}

async function selectFilter(
  page: DirectoryPageInstance,
  kind: DirectoryKind,
  event: FilterOptionEvent,
): Promise<void> {
  const key = event.currentTarget.dataset.filter;
  const runtime = getRuntime(page, kind);
  const snapshot = runtime.facets;
  if (key === undefined || snapshot === undefined) return;
  const rawValue = event.currentTarget.dataset.value;
  const value = rawValue === undefined || rawValue === '' ? undefined : rawValue;
  if (
    runtime.filters[key] === value ||
    (value === undefined && runtime.filters[key] === undefined)
  ) {
    return;
  }
  const result = updateDirectoryFilterSelection(snapshot, runtime.filters, key, value);
  runtime.filters = result.filters;
  setPaneData(page, kind, {
    filterAdjustmentMessage:
      result.clearedKeys.length === 0
        ? ''
        : `已自动清除不再适用的${result.clearedKeys.map((clearedKey) => filterLabel(kind, clearedKey)).join('、')}筛选。`,
  });
  syncFilterSections(page, kind);
  await search(page, kind);
}

function clearAllFilters(page: DirectoryPageInstance, kind: DirectoryKind): void {
  const runtime = getRuntime(page, kind);
  if (Object.keys(runtime.filters).length === 0) return;
  runtime.filters = {};
  setPaneData(page, kind, { filterAdjustmentMessage: '' });
  syncFilterSections(page, kind);
  void search(page, kind);
}

function clearSearch(page: DirectoryPageInstance, kind: DirectoryKind): void {
  if (getPaneData(page, kind).searchQuery.length === 0) return;
  setPaneData(page, kind, { searchQuery: '' });
  void search(page, kind);
}

function resetDirectorySearch(page: DirectoryPageInstance, kind: DirectoryKind): void {
  const runtime = getRuntime(page, kind);
  clearSearchTimer(runtime);
  runtime.filters = {};
  setPaneData(page, kind, { filterAdjustmentMessage: '', searchQuery: '' });
  syncFilterSections(page, kind);
  resetSearchResults(page, kind);
}

function resetSearchResults(page: DirectoryPageInstance, kind: DirectoryKind): void {
  const runtime = getRuntime(page, kind);
  runtime.requestSerial += 1;
  runtime.nextCursor = undefined;
  runtime.rawEntries = [];
  setPaneData(page, kind, {
    entries: [],
    errorMessage: '',
    hasCriteria: false,
    loadingMore: false,
    mergedGroupCount: 0,
    nextCursor: '',
    resultSummary: '',
    searching: false,
    state: 'idle',
  });
  syncPrioritySections(page, kind);
}

function scheduleSearch(page: DirectoryPageInstance, kind: DirectoryKind): void {
  const runtime = getRuntime(page, kind);
  clearSearchTimer(runtime);
  const pane = getPaneData(page, kind);
  if (!hasActiveDirectoryCriteria(pane.searchQuery, runtime.filters)) {
    resetSearchResults(page, kind);
    return;
  }
  setPaneData(page, kind, {
    hasCriteria: true,
    resultSummary: pane.entries.length === 0 ? `正在查找${pane.title}号码` : pane.resultSummary,
    searching: true,
    state: 'loading',
  });
  runtime.searchTimer = setTimeout(() => {
    runtime.searchTimer = undefined;
    void search(page, kind);
  }, 240);
}

async function search(page: DirectoryPageInstance, kind: DirectoryKind): Promise<void> {
  const runtime = getRuntime(page, kind);
  clearSearchTimer(runtime);
  const pane = getPaneData(page, kind);
  if (!hasActiveDirectoryCriteria(pane.searchQuery, runtime.filters)) {
    resetSearchResults(page, kind);
    return;
  }
  const groupId = runtime.groupId;
  const serial = ++runtime.requestSerial;
  runtime.nextCursor = undefined;
  setPaneData(page, kind, {
    errorMessage: '',
    hasCriteria: true,
    loadingMore: false,
    nextCursor: '',
    resultSummary: pane.entries.length === 0 ? `正在查找${pane.title}号码` : pane.resultSummary,
    searching: true,
    state: 'loading',
  });
  try {
    await requireClientCapability('organization');
    const result = await page._directoryClient.list(
      groupId,
      kind,
      toDirectoryQuery(getPaneData(page, kind).searchQuery, runtime.filters) as DirectoryQuery,
    );
    if (!isRequestCurrent(page, kind, runtime, serial, groupId)) return;
    runtime.nextCursor = result.nextCursor;
    runtime.rawEntries = result.entries;
    const cards = createDirectoryCards(runtime, kind);
    const mergedGroupCount = cards.filter((card) => card.merged).length;
    setPaneData(page, kind, {
      entries: cards,
      mergedGroupCount,
      nextCursor: result.nextCursor ?? '',
      resultSummary: resultSummary(result.totalCount, mergedGroupCount),
      searching: false,
      state: cards.length === 0 ? 'empty' : 'ready',
    });
    syncPrioritySections(page, kind);
  } catch (error) {
    if (!isRequestCurrent(page, kind, runtime, serial, groupId)) return;
    if (error instanceof ClientCapabilityDisabledError) {
      setDirectoryDisabled(page, error.message);
      return;
    }
    setPaneData(page, kind, {
      errorMessage: toUserMessage(error, '搜索没有完成，请检查网络后重试。'),
      searching: false,
      state: 'error',
    });
  }
}

async function loadMore(page: DirectoryPageInstance, kind: DirectoryKind): Promise<void> {
  const runtime = getRuntime(page, kind);
  const pane = getPaneData(page, kind);
  const cursor = runtime.nextCursor;
  const groupId = runtime.groupId;
  if (cursor === undefined || pane.loadingMore || groupId.length === 0) return;
  const serial = runtime.requestSerial;
  setPaneData(page, kind, { errorMessage: '', loadingMore: true });
  try {
    await requireClientCapability('organization');
    if (!isRequestCurrent(page, kind, runtime, serial, groupId)) return;
    const result = await page._directoryClient.list(
      groupId,
      kind,
      toDirectoryQuery(pane.searchQuery, runtime.filters, cursor) as DirectoryQuery,
    );
    if (!isRequestCurrent(page, kind, runtime, serial, groupId)) return;
    runtime.nextCursor = result.nextCursor;
    runtime.rawEntries = [...runtime.rawEntries, ...result.entries];
    const cards = createDirectoryCards(runtime, kind);
    const mergedGroupCount = cards.filter((card) => card.merged).length;
    setPaneData(page, kind, {
      entries: cards,
      loadingMore: false,
      mergedGroupCount,
      nextCursor: result.nextCursor ?? '',
      resultSummary: resultSummary(result.totalCount, mergedGroupCount),
    });
    syncPrioritySections(page, kind);
  } catch (error) {
    if (!isRequestCurrent(page, kind, runtime, serial, groupId)) return;
    if (error instanceof ClientCapabilityDisabledError) {
      setDirectoryDisabled(page, error.message);
      return;
    }
    setPaneData(page, kind, {
      errorMessage: toUserMessage(error, '更多通讯录记录暂时无法加载。'),
      loadingMore: false,
    });
  }
}

function createDirectoryCards(
  runtime: DirectoryModeRuntime,
  kind: DirectoryKind,
): readonly DirectoryCard[] {
  return groupDirectoryEntriesByContact(runtime.rawEntries).map((group) =>
    toCard(group, kind, runtime.preferences),
  );
}

function toCard(
  group: DirectoryEntryDisplayGroup,
  directoryKind: DirectoryKind,
  preferences: DirectoryPreferences,
): DirectoryCard {
  const merged = group.entries.length > 1;
  const employeeCodes = getDirectoryGroupEmployeeCodes(group);
  return {
    contacts: group.contacts.map((contact) => toContactCard(contact, directoryKind, merged)),
    contexts: getDirectoryGroupContexts(group),
    employeeCodeLabel: employeeCodes.join(' / '),
    employeeCodes,
    favorite: isDirectoryGroupFavorite(preferences, group),
    id: group.id,
    jobTitles: getDirectoryGroupJobTitles(group),
    kindLabel: getDirectoryGroupKindLabel(group),
    mergeCountLabel: merged ? `${group.entries.length} 项同号` : '',
    merged,
    notes: getDirectoryGroupNotes(group) ?? '',
    title: getDirectoryGroupTitle(group),
  };
}

function toContactCard(
  contact: DirectoryEntry['contacts'][number],
  directoryKind: DirectoryKind,
  merged: boolean,
): DirectoryContactCard {
  const heading =
    (merged ? undefined : contact.label) ?? getDirectoryNumberLabel(contact.type, 'full');
  const extension = getSafeInternalExtension(contact);
  const numbers: DirectoryNumberCard[] = [];
  if (contact.fullNumber !== undefined) {
    const dialable = canDialDirectoryNumber(contact.type, 'full');
    numbers.push({
      dialable,
      dialNumber: dialable ? normalizeDirectoryDialNumber(contact.fullNumber) : undefined,
      id: `${contact.id}:full`,
      label: extension === undefined ? '' : '长号',
      number: contact.fullNumber,
    });
  }
  if (extension !== undefined) {
    const dialable = canDialDirectoryNumber(contact.type, 'extension');
    numbers.push({
      dialable,
      dialNumber: dialable ? normalizeDirectoryDialNumber(extension) : undefined,
      id: `${contact.id}:extension`,
      label: '短号',
      number: extension,
    });
  }
  return {
    id: contact.id,
    label: heading,
    numbers,
    showLabel:
      directoryKind !== 'internal' &&
      !(
        directoryKind === 'employee' &&
        (contact.type === 'mobile' || heading.startsWith('移动电话'))
      ),
  };
}

function resultSummary(totalCount: number, mergedGroupCount: number): string {
  return `找到 ${totalCount} 条通讯录记录${mergedGroupCount > 0 ? ` · 已合并 ${mergedGroupCount} 组同号条目` : ''}`;
}

async function loadPriorityEntries(
  page: DirectoryPageInstance,
  kind: DirectoryKind,
  runtime: DirectoryModeRuntime,
  serial: number,
  groupId: string,
): Promise<void> {
  const entryIds = getDirectoryPreferenceEntryIds(runtime.preferences);
  if (entryIds.length === 0) {
    syncPrioritySections(page, kind);
    return;
  }
  const chunks = Array.from({ length: Math.ceil(entryIds.length / 100) }, (_, index) =>
    entryIds.slice(index * 100, index * 100 + 100),
  );
  try {
    const responses = await Promise.all(
      chunks.map((chunk) => page._directoryClient.lookup(groupId, kind, chunk)),
    );
    if (!isContextCurrent(page, kind, runtime, serial, groupId)) return;
    runtime.priorityEntries = responses.flatMap((response) => response.entries);
    syncPrioritySections(page, kind);
  } catch {
    // Preferred entries are an enhancement; search and filtering remain available.
  }
}

function knownEntryGroups(runtime: DirectoryModeRuntime): readonly DirectoryEntryDisplayGroup[] {
  const entriesById = new Map<string, DirectoryEntry>();
  for (const entry of [...runtime.priorityEntries, ...runtime.rawEntries]) {
    entriesById.set(entry.id, entry);
  }
  return groupDirectoryEntriesByContact([...entriesById.values()]);
}

function syncPrioritySections(page: DirectoryPageInstance, kind: DirectoryKind): void {
  const runtime = getRuntime(page, kind);
  const priority = getDirectoryPriorityGroups(runtime.preferences, knownEntryGroups(runtime));
  const sections: DirectoryPrioritySectionView[] = [];
  if (priority.favorites.length > 0) {
    sections.push({
      entries: priority.favorites.map((group) => toCard(group, kind, runtime.preferences)),
      key: 'favorites',
      title: '收藏通讯录',
    });
  }
  if (priority.frequent.length > 0) {
    sections.push({
      entries: priority.frequent.map((group) => toCard(group, kind, runtime.preferences)),
      key: 'frequent',
      title: '常用通讯录',
    });
  }
  setPaneData(page, kind, { prioritySections: sections });
}

function findDirectoryGroup(
  runtime: DirectoryModeRuntime,
  groupId: string | undefined,
): DirectoryEntryDisplayGroup | undefined {
  return groupId === undefined
    ? undefined
    : knownEntryGroups(runtime).find((group) => group.id === groupId);
}

function rememberPriorityEntries(
  runtime: DirectoryModeRuntime,
  group: DirectoryEntryDisplayGroup,
): void {
  const entriesById = new Map(runtime.priorityEntries.map((entry) => [entry.id, entry]));
  for (const entry of group.entries as readonly DirectoryEntry[]) entriesById.set(entry.id, entry);
  runtime.priorityEntries = [...entriesById.values()];
}

function toggleFavorite(
  page: DirectoryPageInstance,
  kind: DirectoryKind,
  groupId: string | undefined,
): void {
  const runtime = getRuntime(page, kind);
  const group = findDirectoryGroup(runtime, groupId);
  if (group === undefined) return;
  rememberPriorityEntries(runtime, group);
  runtime.preferences = toggleDirectoryFavorite(runtime.preferences, group);
  persistDirectoryPreferences(page, kind, runtime.preferences);
  setPaneData(page, kind, { entries: createDirectoryCards(runtime, kind) });
  syncPrioritySections(page, kind);
}

function recordUse(
  page: DirectoryPageInstance,
  kind: DirectoryKind,
  groupId: string | undefined,
): void {
  const runtime = getRuntime(page, kind);
  const group = findDirectoryGroup(runtime, groupId);
  if (group === undefined) return;
  rememberPriorityEntries(runtime, group);
  runtime.preferences = recordDirectoryUse(runtime.preferences, group);
  persistDirectoryPreferences(page, kind, runtime.preferences);
  syncPrioritySections(page, kind);
}

function directoryPreferenceStorageKey(
  page: DirectoryPageInstance,
  kind: DirectoryKind,
): string | undefined {
  const ownerId = getStoredWechatProfile()?.id;
  return ownerId === undefined
    ? undefined
    : `${DIRECTORY_PREFERENCES_PREFIX}${ownerId}:${page.data.groupId}:${kind}`;
}

function readDirectoryPreferences(
  page: DirectoryPageInstance,
  kind: DirectoryKind,
): DirectoryPreferences {
  const key = directoryPreferenceStorageKey(page, kind);
  if (key === undefined) return parseDirectoryPreferences(undefined);
  try {
    const value = wx.getStorageSync(key);
    return parseDirectoryPreferences(typeof value === 'string' ? value : undefined);
  } catch {
    return parseDirectoryPreferences(undefined);
  }
}

function persistDirectoryPreferences(
  page: DirectoryPageInstance,
  kind: DirectoryKind,
  preferences: DirectoryPreferences,
): void {
  const key = directoryPreferenceStorageKey(page, kind);
  if (key === undefined) return;
  try {
    wx.setStorageSync(key, JSON.stringify(preferences));
  } catch {
    // Favorites remain effective in memory when storage is unavailable.
  }
}

function toUserMessage(error: unknown, fallback: string): string {
  return error instanceof ClientCoreError && error.message.length > 0
    ? error.message
    : error instanceof Error && error.message.length > 0
      ? error.message
      : fallback;
}
