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
  DIRECTORY_FILTER_KEYS,
  createBaseQueryKey,
  createContextKey,
  createDirectoryFilterStates,
  createPageRequestKey,
  resetDirectoryFilterStates,
  setDirectoryFilterState,
  stableSerialize,
  type DirectoryFilterState,
} from './query-runtime.js';
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
type DirectoryRetryKind = '' | 'facets' | 'pagination' | 'search';

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
  readonly value: string;
}

interface DirectoryFilterSectionView {
  readonly expanded: boolean;
  readonly key: DirectoryFilterKey;
  readonly label: string;
  readonly optionCount: number;
  readonly options: readonly DirectoryFilterOptionView[];
  readonly selectedLabel: string;
  readonly selectedValue: string;
}

interface DirectoryGuideStopView {
  readonly key: DirectoryFilterKey;
  readonly label: string;
  readonly selected: boolean;
  readonly selectedLabel: string;
}

interface DirectorySheetData {
  readonly activeFilterCount: number;
  readonly directoryKind: DirectoryKind;
  readonly emptyMessage: string;
  readonly filterAdjustmentMessage: string;
  readonly open: boolean;
  readonly scrollTarget: string;
  readonly scrollTop: number;
  readonly sections: readonly DirectoryFilterSectionView[];
  readonly title: string;
}

interface DirectoryFilterProjection {
  readonly compatible: ReadonlyMap<DirectoryFilterKey, readonly DirectoryFacetOption[]>;
  readonly meaningful: readonly DirectoryFilterKey[];
}

interface DirectoryPaneData {
  readonly activeFilterCount: number;
  readonly canRefreshFromStart: boolean;
  readonly directoryKind: DirectoryKind;
  readonly entries: readonly DirectoryCard[];
  readonly errorMessage: string;
  readonly facetsErrorMessage: string;
  readonly facetsLoading: boolean;
  readonly guideStops: readonly DirectoryGuideStopView[];
  readonly hasCriteria: boolean;
  readonly hasMore: boolean;
  readonly interactionDisabled: boolean;
  readonly loadingMore: boolean;
  readonly mainScrollTop: number;
  readonly mergedGroupCount: number;
  readonly prioritySections: readonly DirectoryPrioritySectionView[];
  readonly resultSummary: string;
  readonly retryKind: DirectoryRetryKind;
  readonly searchQuery: string;
  readonly searching: boolean;
  readonly state: DirectoryState;
  readonly title: string;
}

interface DirectoryPageData {
  readonly activeSheet: DirectorySheetData;
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
  readonly inFlightPages: Map<string, Promise<void>>;
  readonly loadedPageKeys: Set<string>;
  completedBaseQueryKey: string | undefined;
  contextSerial: number;
  currentBaseQueryKey: string | undefined;
  facets: DirectoryFacetSnapshot | undefined;
  filterAdjustmentMessage: string;
  filterProjection: DirectoryFilterProjection;
  filterStates: readonly DirectoryFilterState[];
  filters: DirectoryFilters;
  groupId: string;
  mainScrollTop: number;
  nextCursor: string | undefined;
  preferences: DirectoryPreferences;
  priorityEntries: readonly DirectoryEntry[];
  querySerial: number;
  rawEntries: readonly DirectoryEntry[];
  searchTimer: unknown;
  sheetScrollTop: number;
  sheetScrollVersion: string | undefined;
  totalCount: number;
}

interface DirectoryPageInstance {
  readonly data: DirectoryPageData;
  readonly properties: {
    readonly directoryKind: DirectoryKind;
    readonly embedded: boolean;
    readonly contextRefreshRevision?: number;
    readonly groupId: string;
    readonly groupIsDeveloperAdmin?: boolean;
    readonly groupRole?: string;
    readonly groupVersion?: number;
    readonly permissionContextReady?: boolean;
  };
  _contextSignature: string;
  _detached: boolean;
  _directoryClient: DirectoryReadClient;
  _foregroundRefreshPromise: Promise<void> | undefined;
  _foregroundRefreshSerial: number;
  _instanceId: number;
  _modeIconTimers: Partial<Record<DirectoryKind, unknown>>;
  _modeRuntimes: Record<DirectoryKind, DirectoryModeRuntime>;
  createSelectorQuery?(): DirectorySelectorQuery;
  setData(patch: Record<string, unknown>, callback?: () => void): void;
  triggerEvent?(name: 'panelready' | 'workspacerequest'): void;
}

interface DirectorySelectorQuery {
  in(instance: DirectoryPageInstance): DirectorySelectorQuery;
  select(selector: string): {
    boundingClientRect(): DirectorySelectorQuery;
  };
  exec(callback: (results: readonly ({ readonly height?: number } | null)[]) => void): void;
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

interface ScrollEvent extends ModeTargetEvent {
  readonly detail: { readonly scrollTop?: number };
}

const directoryClient = createRuntimeDirectoryReadClient(
  getStoredWechatToken,
  getWechatRequestAuthentication(),
);
const directoryKinds: readonly DirectoryKind[] = ['internal', 'employee'];
const DIRECTORY_PAGE_SIZE = 30;
let nextDirectoryInstanceId = 0;
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
    activeSheet: createSheetData(),
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
      contextRefreshRevision: { type: Number, value: 0 },
      directoryKind: { type: String, value: 'internal' },
      embedded: { type: Boolean, value: false },
      groupId: { type: String, value: '' },
      groupIsDeveloperAdmin: { type: Boolean, value: false },
      groupRole: { type: String, value: '' },
      groupVersion: { type: Number, value: 0 },
      permissionContextReady: { type: Boolean, value: false },
    },
    observers: {
      contextRefreshRevision(this: DirectoryPageInstance): void {
        void revalidateForegroundContext(this);
      },
      groupId(this: DirectoryPageInstance): void {
        startLoad(this);
      },
      groupIsDeveloperAdmin(this: DirectoryPageInstance): void {
        startLoad(this);
      },
      groupRole(this: DirectoryPageInstance): void {
        startLoad(this);
      },
      groupVersion(this: DirectoryPageInstance): void {
        startLoad(this);
      },
      permissionContextReady(this: DirectoryPageInstance): void {
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
        this._instanceId = ++nextDirectoryInstanceId;
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
        invalidateForegroundRefresh(this);
        for (const kind of directoryKinds) invalidateRuntime(this._modeRuntimes[kind]);
        clearModeIconTimers(this);
      },
    },
    methods: {
      preventTouchMove(): void {},
      handleBack(): void {
        wx.navigateBack({ delta: 1 });
      },
      handleForegroundRefresh(this: DirectoryPageInstance): void {
        void revalidateForegroundContext(this);
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
        if (pane.retryKind === 'pagination') void loadMore(this, kind, true);
        else if (pane.retryKind === 'search') void search(this, kind, true);
        else if (runtime.facets === undefined || pane.retryKind === 'facets') {
          void loadFacets(this, kind);
        } else void search(this, kind, true);
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
      handleFilterSheetSwipeDismiss(this: DirectoryPageInstance): void {
        closeFilters(this, this.data.activeSheet.directoryKind);
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
      handleRefreshFromStart(this: DirectoryPageInstance, event?: ModeTargetEvent): void {
        void search(this, eventKind(this, event), true);
      },
      handleMainScroll(this: DirectoryPageInstance, event: ScrollEvent): void {
        const value = event.detail.scrollTop;
        if (typeof value === 'number' && Number.isFinite(value)) {
          getRuntime(this, eventKind(this, event)).mainScrollTop = Math.max(0, value);
        }
      },
      handleSheetScroll(this: DirectoryPageInstance, event: ScrollEvent): void {
        const value = event.detail.scrollTop;
        if (typeof value === 'number' && Number.isFinite(value)) {
          getRuntime(this, eventKind(this, event)).sheetScrollTop = Math.max(0, value);
        }
      },
      handleToggleFavorite(this: DirectoryPageInstance, event: ModeTargetEvent): void {
        const kind = eventKind(this, event);
        if (getPaneData(this, kind).interactionDisabled) return;
        toggleFavorite(this, kind, event.currentTarget?.dataset.groupId);
      },
      handleDirectoryCardFavorite(this: DirectoryPageInstance, event: DirectoryCardEvent): void {
        const kind = eventKind(this, event);
        if (getPaneData(this, kind).interactionDisabled) return;
        toggleFavorite(this, kind, event.detail.groupId);
      },
      handleDirectoryCardCall(this: DirectoryPageInstance, event: DirectoryCardEvent): void {
        const kind = eventKind(this, event);
        if (getPaneData(this, kind).interactionDisabled) return;
        const number = event.detail.number;
        if (number !== undefined && /^\+?\d{3,20}$/u.test(number)) {
          recordUse(this, kind, event.detail.groupId);
          wx.makePhoneCall({ phoneNumber: number });
        }
      },
      handleCall(this: DirectoryPageInstance, event: ModeTargetEvent): void {
        const kind = eventKind(this, event);
        if (getPaneData(this, kind).interactionDisabled) return;
        const number = event.currentTarget?.dataset.number;
        if (number !== undefined && /^\+?\d{3,20}$/u.test(number)) {
          recordUse(this, kind, event.currentTarget?.dataset.groupId);
          wx.makePhoneCall({ phoneNumber: number });
        }
      },
    },
  };
}

function createPaneData(kind: DirectoryKind): DirectoryPaneData {
  return {
    activeFilterCount: 0,
    canRefreshFromStart: false,
    directoryKind: kind,
    entries: [],
    errorMessage: '',
    facetsErrorMessage: '',
    facetsLoading: true,
    guideStops: [],
    hasCriteria: false,
    hasMore: false,
    interactionDisabled: false,
    loadingMore: false,
    mainScrollTop: 0,
    mergedGroupCount: 0,
    prioritySections: [],
    resultSummary: '',
    retryKind: '',
    searchQuery: '',
    searching: false,
    state: 'loading',
    title: kind === 'employee' ? '人员通讯录' : '科室通讯录',
  };
}

function createSheetData(): DirectorySheetData {
  return {
    activeFilterCount: 0,
    directoryKind: 'internal',
    emptyMessage: '',
    filterAdjustmentMessage: '',
    open: false,
    scrollTarget: '',
    scrollTop: 0,
    sections: [],
    title: '科室通讯录',
  };
}

function createModeRuntime(groupId = ''): DirectoryModeRuntime {
  return {
    collapsedFilterKeys: new Set(),
    completedBaseQueryKey: undefined,
    contextSerial: 0,
    currentBaseQueryKey: undefined,
    facets: undefined,
    filterAdjustmentMessage: '',
    filterProjection: { compatible: new Map(), meaningful: [] },
    filterStates: createDirectoryFilterStates(),
    filters: {},
    groupId,
    inFlightPages: new Map(),
    loadedPageKeys: new Set(),
    mainScrollTop: 0,
    nextCursor: undefined,
    preferences: parseDirectoryPreferences(undefined),
    priorityEntries: [],
    querySerial: 0,
    rawEntries: [],
    searchTimer: undefined,
    sheetScrollTop: 0,
    sheetScrollVersion: undefined,
    totalCount: 0,
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
  if (typeof page._contextSignature !== 'string') page._contextSignature = '';
  if (typeof page._foregroundRefreshSerial !== 'number') page._foregroundRefreshSerial = 0;
  if (typeof page._instanceId !== 'number') page._instanceId = 0;
}

function startLoad(page: DirectoryPageInstance): void {
  initializeRuntimeState(page);
  if (page._instanceId === 0 || page._detached) return;
  const groupId = page.properties.groupId;
  const initialKind = normalizeDirectoryKind(page.properties.directoryKind);
  const contextSignature = createClientContextSignature(page);
  if (groupId.length === 0) {
    setMissingGroupError(page, initialKind);
    return;
  }
  if (
    page.data.groupId === groupId &&
    page._contextSignature === contextSignature &&
    directoryKinds.every((kind) => page._modeRuntimes[kind].groupId === groupId)
  ) {
    activateMode(page, initialKind, false);
    return;
  }
  invalidateForegroundRefresh(page);
  for (const kind of directoryKinds) invalidateRuntime(page._modeRuntimes[kind]);
  page._modeRuntimes = {
    employee: createModeRuntime(groupId),
    internal: createModeRuntime(groupId),
  };
  page._contextSignature = contextSignature;
  page._detached = false;
  page.triggerEvent?.('workspacerequest');
  page.setData({
    activeSheet: createSheetData(),
    activeModeIndex: modeIndex(initialKind),
    directoryKind: initialKind,
    employeePane: createPaneData('employee'),
    filterSheetOpen: false,
    groupId,
    internalPane: createPaneData('internal'),
  });
  for (const kind of directoryKinds) {
    const runtime = page._modeRuntimes[kind];
    void Promise.resolve().then(() => loadFacets(page, kind, runtime));
  }
}

function createClientContextSignature(page: DirectoryPageInstance): string {
  return stableSerialize([
    'directory-client-context-v1',
    getStoredWechatProfile()?.id ?? 'account-unknown',
    page.properties.groupId,
    page.properties.permissionContextReady === true
      ? [page.properties.groupRole ?? '', page.properties.groupIsDeveloperAdmin === true]
      : 'permission-unknown',
    page.properties.groupVersion ?? 0,
  ]);
}

function invalidateForegroundRefresh(page: DirectoryPageInstance): void {
  page._foregroundRefreshSerial += 1;
  page._foregroundRefreshPromise = undefined;
}

function revalidateForegroundContext(page: DirectoryPageInstance): Promise<void> {
  initializeRuntimeState(page);
  if (page._instanceId === 0 || page._detached) return Promise.resolve();
  const contextSignature = createClientContextSignature(page);
  if (page._contextSignature !== contextSignature) {
    startLoad(page);
    return Promise.resolve();
  }
  const inFlight = page._foregroundRefreshPromise;
  if (inFlight !== undefined) return inFlight;
  const groupId = page.data.groupId;
  const instanceId = page._instanceId;
  const runtimes = {
    employee: page._modeRuntimes.employee,
    internal: page._modeRuntimes.internal,
  };
  const serial = ++page._foregroundRefreshSerial;
  let tracked: Promise<void> = Promise.resolve();
  const operation = (async () => {
    try {
      await requireClientCapability('organization');
      const snapshots = await Promise.all(
        directoryKinds.map((kind) => page._directoryClient.getFacets(groupId, kind)),
      );
      if (
        !isForegroundRefreshCurrent(page, runtimes, serial, contextSignature, groupId, instanceId)
      ) {
        return;
      }
      const versionChanged = directoryKinds.some((kind, index) => {
        const previous = runtimes[kind].facets?.publishedImportVersion;
        return previous === undefined || previous !== snapshots[index]?.publishedImportVersion;
      });
      if (versionChanged) {
        page._contextSignature = '';
        startLoad(page);
      }
    } catch (error) {
      if (
        !isForegroundRefreshCurrent(page, runtimes, serial, contextSignature, groupId, instanceId)
      ) {
        return;
      }
      if (error instanceof ClientCapabilityDisabledError) {
        setDirectoryDisabled(page, error.message);
      } else if (isAuthorizationError(error)) {
        clearDirectoryForAuthorizationError(page, toUserMessage(error, '当前账户无权读取通讯录。'));
      }
    }
  })();
  tracked = operation.finally(() => {
    if (page._foregroundRefreshPromise === tracked) page._foregroundRefreshPromise = undefined;
  });
  page._foregroundRefreshPromise = tracked;
  return tracked;
}

function isForegroundRefreshCurrent(
  page: DirectoryPageInstance,
  runtimes: Readonly<Record<DirectoryKind, DirectoryModeRuntime>>,
  serial: number,
  contextSignature: string,
  groupId: string,
  instanceId: number,
): boolean {
  return (
    !page._detached &&
    page._instanceId === instanceId &&
    page._foregroundRefreshSerial === serial &&
    page._contextSignature === contextSignature &&
    createClientContextSignature(page) === contextSignature &&
    page.data.groupId === groupId &&
    page._modeRuntimes.employee === runtimes.employee &&
    page._modeRuntimes.internal === runtimes.internal
  );
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
  const previous = page.data.directoryKind;
  const runtime = getRuntime(page, normalized);
  const cards = createDirectoryCards(runtime, normalized);
  const patch: Record<string, unknown> = {
    activeModeIndex: index,
    directoryKind: normalized,
    [`${paneField(previous)}.entries`]: [],
    [`${paneField(previous)}.prioritySections`]: [],
    [`${paneField(normalized)}.entries`]: cards,
    [`${paneField(normalized)}.mainScrollTop`]: runtime.mainScrollTop,
    [`${paneField(normalized)}.prioritySections`]: createPrioritySections(runtime, normalized),
  };
  page.setData(patch);
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
  runtime.querySerial += 1;
  runtime.currentBaseQueryKey = undefined;
  runtime.completedBaseQueryKey = undefined;
  runtime.facets = undefined;
  runtime.filterAdjustmentMessage = '';
  runtime.filterProjection = { compatible: new Map(), meaningful: [] };
  runtime.filterStates = createDirectoryFilterStates();
  runtime.filters = {};
  runtime.inFlightPages.clear();
  runtime.loadedPageKeys.clear();
  runtime.nextCursor = undefined;
  runtime.priorityEntries = [];
  runtime.rawEntries = [];
  runtime.sheetScrollTop = 0;
  runtime.sheetScrollVersion = undefined;
  runtime.totalCount = 0;
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
  instanceId: number,
): boolean {
  return (
    !page._detached &&
    page._instanceId === instanceId &&
    page._modeRuntimes[kind] === runtime &&
    runtime.contextSerial === serial &&
    runtime.groupId === groupId &&
    page.data.groupId === groupId
  );
}

function isQueryCurrent(
  page: DirectoryPageInstance,
  kind: DirectoryKind,
  runtime: DirectoryModeRuntime,
  contextSerial: number,
  querySerial: number,
  groupId: string,
  instanceId: number,
  baseQueryKey: string,
): boolean {
  return (
    !page._detached &&
    page._instanceId === instanceId &&
    page._modeRuntimes[kind] === runtime &&
    runtime.contextSerial === contextSerial &&
    runtime.querySerial === querySerial &&
    runtime.currentBaseQueryKey === baseQueryKey &&
    runtime.groupId === groupId &&
    page.data.groupId === groupId
  );
}

function setMissingGroupError(page: DirectoryPageInstance, initialKind: DirectoryKind): void {
  initializeRuntimeState(page);
  for (const kind of directoryKinds) invalidateRuntime(page._modeRuntimes[kind]);
  const message = '当前群组信息缺失，请返回工作台后重试。';
  page.setData({
    activeSheet: createSheetData(),
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
      canRefreshFromStart: false,
      entries: [],
      errorMessage: message,
      facetsErrorMessage: '',
      facetsLoading: false,
      guideStops: [],
      hasCriteria: false,
      hasMore: false,
      interactionDisabled: false,
      loadingMore: false,
      mergedGroupCount: 0,
      prioritySections: [],
      resultSummary: '',
      retryKind: '',
      searchQuery: '',
      searching: false,
      state: 'disabled',
    });
  }
  page.setData({ activeSheet: createSheetData(), filterSheetOpen: false });
}

function clearDirectoryForAuthorizationError(page: DirectoryPageInstance, message: string): void {
  initializeRuntimeState(page);
  for (const kind of directoryKinds) invalidateRuntime(page._modeRuntimes[kind]);
  page.setData({
    activeSheet: createSheetData(),
    employeePane: {
      ...createPaneData('employee'),
      errorMessage: message,
      facetsLoading: false,
      retryKind: '',
      state: 'error',
    },
    filterSheetOpen: false,
    internalPane: {
      ...createPaneData('internal'),
      errorMessage: message,
      facetsLoading: false,
      retryKind: '',
      state: 'error',
    },
  });
}

function isAuthorizationError(error: unknown): boolean {
  return error instanceof ClientCoreError && (error.status === 401 || error.status === 403);
}

function isInvalidCursorError(error: unknown): boolean {
  return (
    error instanceof ClientCoreError && error.status === 400 && /cursor|游标/iu.test(error.message)
  );
}

async function loadFacets(
  page: DirectoryPageInstance,
  kind: DirectoryKind,
  expectedRuntime?: DirectoryModeRuntime,
): Promise<void> {
  initializeRuntimeState(page);
  if (page._detached) return;
  const runtime = getRuntime(page, kind);
  if (expectedRuntime !== undefined && runtime !== expectedRuntime) return;
  const groupId = runtime.groupId || page.data.groupId;
  if (groupId.length === 0) {
    setMissingGroupError(page, page.data.directoryKind);
    return;
  }
  clearSearchTimer(runtime);
  const serial = ++runtime.contextSerial;
  const instanceId = page._instanceId;
  runtime.querySerial += 1;
  runtime.currentBaseQueryKey = undefined;
  runtime.completedBaseQueryKey = undefined;
  runtime.facets = undefined;
  runtime.filterAdjustmentMessage = '';
  runtime.filterProjection = { compatible: new Map(), meaningful: [] };
  runtime.filterStates = createDirectoryFilterStates();
  runtime.filters = {};
  runtime.inFlightPages.clear();
  runtime.loadedPageKeys.clear();
  runtime.nextCursor = undefined;
  runtime.preferences = readDirectoryPreferences(page, kind);
  runtime.priorityEntries = [];
  runtime.rawEntries = [];
  runtime.totalCount = 0;
  runtime.collapsedFilterKeys.clear();
  setPaneData(page, kind, {
    activeFilterCount: 0,
    canRefreshFromStart: false,
    entries: [],
    errorMessage: '',
    facetsErrorMessage: '',
    facetsLoading: true,
    guideStops: [],
    hasCriteria: false,
    hasMore: false,
    interactionDisabled: false,
    loadingMore: false,
    mergedGroupCount: 0,
    prioritySections: [],
    resultSummary: '',
    retryKind: '',
    searchQuery: '',
    searching: false,
    state: 'loading',
  });
  try {
    await requireClientCapability('organization');
    const facets = await page._directoryClient.getFacets(groupId, kind);
    if (!isContextCurrent(page, kind, runtime, serial, groupId, instanceId)) return;
    if (runtime.sheetScrollVersion !== facets.publishedImportVersion) runtime.sheetScrollTop = 0;
    runtime.facets = facets;
    runtime.filters = {};
    refreshFilterProjection(runtime);
    setPaneData(page, kind, {
      activeFilterCount: 0,
      facetsErrorMessage: '',
      facetsLoading: false,
      guideStops: buildGuideStops(runtime, kind),
      retryKind: '',
      state: 'idle',
    });
    void loadPriorityEntries(page, kind, runtime, serial, groupId, instanceId);
  } catch (error) {
    if (!isContextCurrent(page, kind, runtime, serial, groupId, instanceId)) return;
    if (error instanceof ClientCapabilityDisabledError) {
      setDirectoryDisabled(page, error.message);
      return;
    }
    if (isAuthorizationError(error)) {
      clearDirectoryForAuthorizationError(page, toUserMessage(error, '当前账户无权读取通讯录。'));
      return;
    }
    setPaneData(page, kind, {
      facetsErrorMessage: toUserMessage(
        error,
        `${getPaneData(page, kind).title}筛选项暂时无法加载，请稍后重试。`,
      ),
      facetsLoading: false,
      retryKind: 'facets',
      state: 'idle',
    });
  }
}

function buildGuideStops(
  runtime: DirectoryModeRuntime,
  kind: DirectoryKind,
): readonly DirectoryGuideStopView[] {
  const snapshot = runtime.facets;
  if (snapshot === undefined) return [];
  return runtime.filterProjection.meaningful.map((key): DirectoryGuideStopView => {
    const selectedValue = runtime.filters[key] ?? '';
    const compatibleOptions = runtime.filterProjection.compatible.get(key) ?? [];
    return {
      key,
      label: filterLabel(kind, key),
      selected: selectedValue !== '',
      selectedLabel:
        compatibleOptions.find((option) => option.value === selectedValue)?.label ?? '全部',
    };
  });
}

function syncGuideStops(page: DirectoryPageInstance, kind: DirectoryKind): void {
  const runtime = getRuntime(page, kind);
  refreshFilterProjection(runtime);
  setPaneData(page, kind, {
    activeFilterCount: Object.keys(runtime.filters).length,
    guideStops: buildGuideStops(runtime, kind),
  });
}

function refreshFilterProjection(runtime: DirectoryModeRuntime): void {
  const snapshot = runtime.facets;
  if (snapshot === undefined) {
    runtime.filterProjection = { compatible: new Map(), meaningful: [] };
    return;
  }
  const compatible = getCompatibleDirectoryFacetOptionsByKey(snapshot, runtime.filters);
  runtime.filterProjection = {
    compatible,
    meaningful: getMeaningfulDirectoryFilterKeys(snapshot, runtime.filters, compatible),
  };
}

function buildActiveSheetSections(
  runtime: DirectoryModeRuntime,
  guideStops: readonly DirectoryGuideStopView[],
): readonly DirectoryFilterSectionView[] {
  const snapshot = runtime.facets;
  if (snapshot === undefined) return [];
  const sections = new Array<DirectoryFilterSectionView>(guideStops.length);
  for (let guideIndex = 0; guideIndex < guideStops.length; guideIndex += 1) {
    const guide = guideStops[guideIndex];
    if (guide === undefined) continue;
    const key = guide.key;
    const selectedValue = runtime.filters[key] ?? '';
    const compatibleOptions = runtime.filterProjection.compatible.get(key) ?? [];
    const options = new Array<DirectoryFilterOptionView>(compatibleOptions.length + 1);
    options[0] = { count: snapshot.totalCount, label: '全部', value: '' };
    for (let optionIndex = 0; optionIndex < compatibleOptions.length; optionIndex += 1) {
      const option = compatibleOptions[optionIndex];
      if (option !== undefined) options[optionIndex + 1] = option;
    }
    sections[guideIndex] = {
      expanded: !runtime.collapsedFilterKeys.has(key),
      key,
      label: guide.label,
      optionCount: compatibleOptions.length,
      options,
      selectedLabel: guide.selectedLabel,
      selectedValue,
    };
  }
  return sections;
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
  const pane = getPaneData(page, kind);
  if (runtime.facets === undefined || pane.facetsLoading || pane.state === 'disabled') return;
  if (targetKey !== undefined) runtime.collapsedFilterKeys.delete(targetKey);
  const sections = buildActiveSheetSections(runtime, pane.guideStops);
  const scrollTarget = targetKey === undefined ? '' : `directory-filter-${kind}-${targetKey}`;
  const version = runtime.facets.publishedImportVersion;
  const savedScrollTop = runtime.sheetScrollVersion === version ? runtime.sheetScrollTop : 0;
  runtime.sheetScrollVersion = version;
  page.setData(
    {
      activeSheet: {
        activeFilterCount: Object.keys(runtime.filters).length,
        directoryKind: kind,
        emptyMessage: sections.length === 0 ? '当前无需筛选' : '',
        filterAdjustmentMessage: runtime.filterAdjustmentMessage,
        open: true,
        scrollTarget,
        scrollTop: 0,
        sections,
        title: pane.title,
      },
      filterSheetOpen: true,
    },
    () => restoreSheetScroll(page, kind, targetKey, savedScrollTop),
  );
}

function closeFilters(page: DirectoryPageInstance, kind: DirectoryKind): void {
  const runtime = getRuntime(page, kind);
  if (runtime.facets !== undefined) {
    runtime.sheetScrollVersion = runtime.facets.publishedImportVersion;
  }
  page.setData({ activeSheet: createSheetData(), filterSheetOpen: false });
}

function toggleFilterSection(
  page: DirectoryPageInstance,
  kind: DirectoryKind,
  key: DirectoryFilterKey,
): void {
  const runtime = getRuntime(page, kind);
  if (runtime.collapsedFilterKeys.has(key)) runtime.collapsedFilterKeys.delete(key);
  else runtime.collapsedFilterKeys.add(key);
  syncActiveSheet(page, kind);
}

function syncActiveSheet(page: DirectoryPageInstance, kind: DirectoryKind): void {
  if (!page.data.activeSheet.open || page.data.activeSheet.directoryKind !== kind) return;
  const runtime = getRuntime(page, kind);
  const sections = buildActiveSheetSections(runtime, getPaneData(page, kind).guideStops);
  page.setData({
    'activeSheet.activeFilterCount': Object.keys(runtime.filters).length,
    'activeSheet.emptyMessage': sections.length === 0 ? '当前无需筛选' : '',
    'activeSheet.filterAdjustmentMessage': runtime.filterAdjustmentMessage,
    'activeSheet.sections': sections,
  });
}

function restoreSheetScroll(
  page: DirectoryPageInstance,
  kind: DirectoryKind,
  targetKey: DirectoryFilterKey | undefined,
  savedScrollTop: number,
): void {
  if (targetKey === undefined && savedScrollTop <= 0) return;
  const apply = () => {
    if (
      page._detached ||
      !page.data.activeSheet.open ||
      page.data.activeSheet.directoryKind !== kind
    ) {
      return;
    }
    if (targetKey !== undefined) {
      page.setData({ 'activeSheet.scrollTarget': `directory-filter-${kind}-${targetKey}` });
      return;
    }
    clampAndSetSheetScroll(page, kind, savedScrollTop);
  };
  const nextTick = (wx as unknown as { readonly nextTick?: (callback: () => void) => void })
    .nextTick;
  if (nextTick === undefined) apply();
  else nextTick(apply);
}

function clampAndSetSheetScroll(
  page: DirectoryPageInstance,
  kind: DirectoryKind,
  savedScrollTop: number,
): void {
  const fallback = Math.max(0, savedScrollTop);
  const query = page.createSelectorQuery?.();
  if (query === undefined) {
    page.setData({ 'activeSheet.scrollTop': fallback });
    return;
  }
  query.in(page);
  query.select('.sheet-body').boundingClientRect();
  query.select('.sheet-scroll').boundingClientRect();
  query.exec((results) => {
    const bodyHeight = results[0]?.height ?? 0;
    const viewportHeight = results[1]?.height ?? 0;
    const maximum = Math.max(0, bodyHeight - viewportHeight);
    const value = bodyHeight > 0 && viewportHeight > 0 ? Math.min(fallback, maximum) : fallback;
    if (
      !page._detached &&
      page.data.activeSheet.open &&
      page.data.activeSheet.directoryKind === kind
    ) {
      page.setData({ 'activeSheet.scrollTop': value });
    }
  });
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
  const currentState = runtime.filterStates.find((state) => state[0] === key);
  if (value === undefined && currentState?.[1] === 'all') return;
  if (value !== undefined && currentState?.[1] === 'value' && currentState[2] === value) return;
  const result = updateDirectoryFilterSelection(snapshot, runtime.filters, key, value);
  runtime.filters = result.filters;
  runtime.filterStates = setDirectoryFilterState(
    runtime.filterStates,
    key,
    value === undefined ? 'all' : 'value',
    value,
  );
  runtime.filterStates = resetDirectoryFilterStates(runtime.filterStates, result.clearedKeys);
  runtime.filterAdjustmentMessage =
    result.clearedKeys.length === 0
      ? ''
      : `已自动清除不再适用的${result.clearedKeys.map((clearedKey) => filterLabel(kind, clearedKey)).join('、')}筛选。`;
  syncGuideStops(page, kind);
  syncActiveSheet(page, kind);
  await search(page, kind);
}

function clearAllFilters(page: DirectoryPageInstance, kind: DirectoryKind): void {
  const runtime = getRuntime(page, kind);
  if (Object.keys(runtime.filters).length === 0) return;
  runtime.filters = {};
  runtime.filterAdjustmentMessage = '';
  runtime.filterStates = DIRECTORY_FILTER_KEYS.reduce(
    (states, key) => setDirectoryFilterState(states, key, 'all'),
    runtime.filterStates,
  );
  syncGuideStops(page, kind);
  syncActiveSheet(page, kind);
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
  runtime.filterAdjustmentMessage = '';
  runtime.filterStates = createDirectoryFilterStates();
  setPaneData(page, kind, { searchQuery: '' });
  syncGuideStops(page, kind);
  syncActiveSheet(page, kind);
  resetSearchResults(page, kind);
}

function resetSearchResults(page: DirectoryPageInstance, kind: DirectoryKind): void {
  const runtime = getRuntime(page, kind);
  runtime.querySerial += 1;
  runtime.currentBaseQueryKey = undefined;
  runtime.completedBaseQueryKey = undefined;
  runtime.inFlightPages.clear();
  runtime.loadedPageKeys.clear();
  runtime.nextCursor = undefined;
  runtime.rawEntries = [];
  runtime.totalCount = 0;
  setPaneData(page, kind, {
    canRefreshFromStart: false,
    entries: [],
    errorMessage: '',
    hasCriteria: false,
    hasMore: false,
    interactionDisabled: false,
    loadingMore: false,
    mergedGroupCount: 0,
    resultSummary: '',
    retryKind: '',
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
  runtime.querySerial += 1;
  runtime.currentBaseQueryKey = undefined;
  runtime.completedBaseQueryKey = undefined;
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

function search(page: DirectoryPageInstance, kind: DirectoryKind, force = false): Promise<void> {
  const runtime = getRuntime(page, kind);
  clearSearchTimer(runtime);
  const pane = getPaneData(page, kind);
  if (!hasActiveDirectoryCriteria(pane.searchQuery, runtime.filters)) {
    resetSearchResults(page, kind);
    return Promise.resolve();
  }
  const identity = createQueryIdentity(page, kind, runtime, pane.searchQuery);
  const pageRequestKey = createPageRequestKey(identity.baseQueryKey);
  if (!force) {
    const inFlight = runtime.inFlightPages.get(pageRequestKey);
    if (runtime.currentBaseQueryKey === identity.baseQueryKey && inFlight !== undefined) {
      return inFlight;
    }
    if (
      identity.canReuseCompleted &&
      runtime.completedBaseQueryKey === identity.baseQueryKey &&
      runtime.currentBaseQueryKey === identity.baseQueryKey
    ) {
      return Promise.resolve();
    }
  } else {
    runtime.inFlightPages.delete(pageRequestKey);
  }
  runtime.querySerial += 1;
  runtime.currentBaseQueryKey = identity.baseQueryKey;
  runtime.completedBaseQueryKey = undefined;
  runtime.inFlightPages.delete(pageRequestKey);
  runtime.loadedPageKeys.clear();
  runtime.nextCursor = undefined;
  runtime.rawEntries = [];
  runtime.totalCount = 0;
  setPaneData(page, kind, {
    canRefreshFromStart: false,
    errorMessage: '',
    hasCriteria: true,
    hasMore: false,
    interactionDisabled: pane.entries.length > 0,
    loadingMore: false,
    resultSummary: pane.entries.length === 0 ? `正在查找${pane.title}号码` : pane.resultSummary,
    retryKind: '',
    searching: true,
    state: 'loading',
  });
  return executeDirectoryPageRequest(page, kind, runtime, identity, undefined, pageRequestKey);
}

function loadMore(page: DirectoryPageInstance, kind: DirectoryKind, force = false): Promise<void> {
  const runtime = getRuntime(page, kind);
  const pane = getPaneData(page, kind);
  const cursor = runtime.nextCursor;
  const baseQueryKey = runtime.currentBaseQueryKey;
  if (
    cursor === undefined ||
    baseQueryKey === undefined ||
    pane.interactionDisabled ||
    runtime.groupId.length === 0
  ) {
    return Promise.resolve();
  }
  const pageRequestKey = createPageRequestKey(baseQueryKey, cursor);
  if (!force) {
    const inFlight = runtime.inFlightPages.get(pageRequestKey);
    if (inFlight !== undefined) return inFlight;
    if (runtime.loadedPageKeys.has(pageRequestKey)) return Promise.resolve();
  } else runtime.inFlightPages.delete(pageRequestKey);
  const identity = createQueryIdentity(page, kind, runtime, pane.searchQuery);
  if (identity.baseQueryKey !== baseQueryKey) return Promise.resolve();
  setPaneData(page, kind, {
    canRefreshFromStart: false,
    errorMessage: '',
    loadingMore: true,
    retryKind: '',
  });
  return executeDirectoryPageRequest(page, kind, runtime, identity, cursor, pageRequestKey);
}

interface DirectoryQueryIdentity {
  readonly baseQueryKey: string;
  readonly canReuseCompleted: boolean;
  readonly filters: DirectoryFilters;
  readonly searchQuery: string;
}

function createQueryIdentity(
  page: DirectoryPageInstance,
  kind: DirectoryKind,
  runtime: DirectoryModeRuntime,
  searchQuery: string,
): DirectoryQueryIdentity {
  const accountId = getStoredWechatProfile()?.id ?? 'account-unknown';
  const permissionReady =
    page.properties.permissionContextReady === true &&
    typeof page.properties.groupRole === 'string' &&
    page.properties.groupRole.length > 0;
  const version = runtime.facets?.publishedImportVersion;
  const contextKey = createContextKey({
    accountId,
    directoryKind: kind,
    groupId: runtime.groupId,
    groupVersion: page.properties.groupVersion ?? 0,
    permission: permissionReady
      ? {
          isDeveloperAdmin: page.properties.groupIsDeveloperAdmin === true,
          role: page.properties.groupRole ?? '',
        }
      : { isDeveloperAdmin: false, role: 'permission-unknown' },
    publishedImportVersion: version ?? 'directory-version-unknown',
  });
  return {
    baseQueryKey: createBaseQueryKey({
      contextKey,
      filterStates: runtime.filterStates,
      pageSize: DIRECTORY_PAGE_SIZE,
      searchQuery,
    }),
    canReuseCompleted: accountId !== 'account-unknown' && permissionReady && version !== undefined,
    filters: { ...runtime.filters },
    searchQuery,
  };
}

function executeDirectoryPageRequest(
  page: DirectoryPageInstance,
  kind: DirectoryKind,
  runtime: DirectoryModeRuntime,
  identity: DirectoryQueryIdentity,
  cursor: string | undefined,
  pageRequestKey: string,
): Promise<void> {
  const groupId = runtime.groupId;
  const contextSerial = runtime.contextSerial;
  const querySerial = runtime.querySerial;
  const instanceId = page._instanceId;
  const expectedCursor = cursor;
  let tracked: Promise<void> = Promise.resolve();
  const operation = (async () => {
    try {
      await requireClientCapability('organization');
      const result = await page._directoryClient.list(
        groupId,
        kind,
        toDirectoryQuery(identity.searchQuery, identity.filters, cursor) as DirectoryQuery,
      );
      if (
        !isQueryCurrent(
          page,
          kind,
          runtime,
          contextSerial,
          querySerial,
          groupId,
          instanceId,
          identity.baseQueryKey,
        ) ||
        runtime.inFlightPages.get(pageRequestKey) !== tracked ||
        (cursor !== undefined && runtime.nextCursor !== expectedCursor) ||
        runtime.loadedPageKeys.has(pageRequestKey)
      ) {
        return;
      }
      runtime.loadedPageKeys.add(pageRequestKey);
      runtime.rawEntries =
        cursor === undefined ? result.entries : [...runtime.rawEntries, ...result.entries];
      runtime.nextCursor = result.nextCursor;
      runtime.totalCount = result.totalCount;
      if (identity.canReuseCompleted) runtime.completedBaseQueryKey = identity.baseQueryKey;
      const cards = createDirectoryCards(runtime, kind);
      const mergedGroupCount = cards.filter((card) => card.merged).length;
      const visible = page.data.directoryKind === kind;
      setPaneData(page, kind, {
        canRefreshFromStart: false,
        entries: visible ? cards : [],
        errorMessage: '',
        hasMore: result.nextCursor !== undefined,
        interactionDisabled: false,
        loadingMore: false,
        mergedGroupCount,
        resultSummary: resultSummary(result.totalCount, mergedGroupCount),
        retryKind: '',
        searching: false,
        state: cards.length === 0 ? 'empty' : 'ready',
      });
      syncPrioritySections(page, kind);
    } catch (error) {
      if (
        !isQueryCurrent(
          page,
          kind,
          runtime,
          contextSerial,
          querySerial,
          groupId,
          instanceId,
          identity.baseQueryKey,
        ) ||
        runtime.inFlightPages.get(pageRequestKey) !== tracked
      ) {
        return;
      }
      if (error instanceof ClientCapabilityDisabledError) {
        setDirectoryDisabled(page, error.message);
        return;
      }
      if (isAuthorizationError(error)) {
        clearDirectoryForAuthorizationError(page, toUserMessage(error, '当前账户无权读取通讯录。'));
        return;
      }
      if (cursor !== undefined) {
        setPaneData(page, kind, {
          canRefreshFromStart: isInvalidCursorError(error),
          errorMessage: toUserMessage(error, '更多通讯录记录暂时无法加载。'),
          loadingMore: false,
          retryKind: 'pagination',
        });
        return;
      }
      runtime.rawEntries = [];
      runtime.nextCursor = undefined;
      runtime.totalCount = 0;
      setPaneData(page, kind, {
        canRefreshFromStart: false,
        entries: [],
        errorMessage: toUserMessage(error, '搜索没有完成，请检查网络后重试。'),
        hasMore: false,
        interactionDisabled: false,
        loadingMore: false,
        mergedGroupCount: 0,
        resultSummary: '',
        retryKind: 'search',
        searching: false,
        state: 'error',
      });
    }
  })();
  tracked = operation.finally(() => {
    if (runtime.inFlightPages.get(pageRequestKey) === tracked) {
      runtime.inFlightPages.delete(pageRequestKey);
    }
  });
  runtime.inFlightPages.set(pageRequestKey, tracked);
  return tracked;
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
  instanceId: number,
): Promise<void> {
  const entryIds = getDirectoryPreferenceEntryIds(runtime.preferences);
  if (entryIds.length === 0) return;
  const chunks = Array.from({ length: Math.ceil(entryIds.length / 100) }, (_, index) =>
    entryIds.slice(index * 100, index * 100 + 100),
  );
  try {
    const responses = await Promise.all(
      chunks.map((chunk) => page._directoryClient.lookup(groupId, kind, chunk)),
    );
    if (!isContextCurrent(page, kind, runtime, serial, groupId, instanceId)) return;
    runtime.priorityEntries = responses.flatMap((response) => response.entries);
    syncPrioritySections(page, kind);
  } catch (error) {
    if (!isContextCurrent(page, kind, runtime, serial, groupId, instanceId)) return;
    if (error instanceof ClientCapabilityDisabledError) {
      setDirectoryDisabled(page, error.message);
      return;
    }
    if (isAuthorizationError(error)) {
      clearDirectoryForAuthorizationError(page, toUserMessage(error, '当前账户无权读取通讯录。'));
    }
    // Other preference lookup failures are an enhancement failure; search remains available.
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
  if (page.data.directoryKind !== kind) return;
  setPaneData(page, kind, { prioritySections: createPrioritySections(runtime, kind) });
}

function createPrioritySections(
  runtime: DirectoryModeRuntime,
  kind: DirectoryKind,
): readonly DirectoryPrioritySectionView[] {
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
  return sections;
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
