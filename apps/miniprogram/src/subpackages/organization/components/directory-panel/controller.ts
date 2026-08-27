import type { DirectoryReadClient } from '@schedule/client-core';
import type {
  DirectoryEntry,
  DirectoryFacetOption,
  DirectoryFacetSnapshot,
  DirectoryKind,
  DirectoryQuery,
} from '@schedule/contracts';
import { ClientCoreError } from '@schedule/client-core';
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
import {
  getStoredWechatProfile,
  getStoredWechatToken,
  getWechatRequestAuthentication,
} from '../../../../platform/wechat-identity.js';
import { recordMiniTelemetryBoundary } from '../../../../platform/telemetry.js';

type DirectoryState = 'disabled' | 'empty' | 'error' | 'loading' | 'ready';

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

interface DirectoryOption extends DirectoryFacetOption {
  readonly value: string;
}

interface DirectoryFilterOptionView extends DirectoryOption {
  readonly selected: boolean;
}

interface DirectoryFilterSectionView {
  readonly key: DirectoryFilterKey;
  readonly label: string;
  readonly options: readonly DirectoryFilterOptionView[];
  readonly selectedLabel: string;
}

interface DirectoryPageData {
  readonly activeFilterCount: number;
  readonly buildingIndex: number;
  readonly buildingLabel: string;
  readonly buildingOptions: readonly DirectoryOption[];
  readonly campusIndex: number;
  readonly campusFilterLabel: string;
  readonly campusLabel: string;
  readonly campusOptions: readonly DirectoryOption[];
  readonly departmentIndex: number;
  readonly departmentFilterLabel: string;
  readonly departmentLabel: string;
  readonly departmentOptions: readonly DirectoryOption[];
  readonly directoryKind: DirectoryKind;
  readonly embedded: boolean;
  readonly entries: readonly DirectoryCard[];
  readonly entryKindIndex: number;
  readonly entryKindFilterLabel: string;
  readonly entryKindLabel: string;
  readonly entryKindOptions: readonly DirectoryOption[];
  readonly errorMessage: string;
  readonly filterAdjustmentMessage: string;
  readonly filterSections: readonly DirectoryFilterSectionView[];
  readonly filterSheetOpen: boolean;
  readonly floorIndex: number;
  readonly floorFilterLabel: string;
  readonly floorLabel: string;
  readonly floorOptions: readonly DirectoryOption[];
  readonly groupId: string;
  readonly largeText: boolean;
  readonly loadingMore: boolean;
  readonly mergedGroupCount: number;
  readonly modeMotionClass: string;
  readonly nextCursor: string;
  readonly pageScrollStyle: string;
  readonly prioritySections: readonly DirectoryPrioritySectionView[];
  readonly searching: boolean;
  readonly searchQuery: string;
  readonly sectionIndex: number;
  readonly sectionFilterLabel: string;
  readonly sectionLabel: string;
  readonly sectionOptions: readonly DirectoryOption[];
  readonly shellHeaderStyle: string;
  readonly state: DirectoryState;
  readonly subunitIndex: number;
  readonly subunitFilterLabel: string;
  readonly buildingFilterLabel: string;
  readonly subunitLabel: string;
  readonly subunitOptions: readonly DirectoryOption[];
  readonly resultSummary: string;
  readonly viewportClass: string;
}

interface DirectoryPageInstance {
  readonly data: DirectoryPageData;
  readonly properties: {
    readonly directoryKind: DirectoryKind;
    readonly embedded: boolean;
    readonly groupId: string;
  };
  _directoryClient: DirectoryReadClient;
  _facets: DirectoryFacetSnapshot | undefined;
  _filters: DirectoryFilters;
  _loadedKey: string;
  _nextCursor: string | undefined;
  _preferences: DirectoryPreferences;
  _priorityEntries: readonly DirectoryEntry[];
  _rawEntries: readonly DirectoryEntry[];
  _requestSerial: number;
  _searchTimer: unknown;
  setData(patch: Partial<DirectoryPageData>): void;
}

const directoryClient = createRuntimeDirectoryReadClient(
  getStoredWechatToken,
  getWechatRequestAuthentication(),
);
const filterKeys: readonly DirectoryFilterKey[] = [
  'campusCode',
  'section',
  'building',
  'floor',
  'department',
  'subunit',
  'entryKind',
];
const filterFieldNames: Readonly<Record<DirectoryFilterKey, string>> = {
  building: 'building',
  campusCode: 'campus',
  department: 'department',
  entryKind: 'entryKind',
  floor: 'floor',
  section: 'section',
  subunit: 'subunit',
};
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
    activeFilterCount: 0,
    buildingIndex: 0,
    buildingLabel: '全部',
    buildingOptions: [{ count: 0, label: '全部', value: '' }],
    campusIndex: 0,
    campusFilterLabel: '院区',
    campusLabel: '全部',
    campusOptions: [{ count: 0, label: '全部', value: '' }],
    departmentIndex: 0,
    departmentFilterLabel: '科室',
    departmentLabel: '全部',
    departmentOptions: [{ count: 0, label: '全部', value: '' }],
    directoryKind: 'internal',
    embedded: false,
    entries: [],
    entryKindIndex: 0,
    entryKindFilterLabel: '类型',
    entryKindLabel: '全部',
    entryKindOptions: [{ count: 0, label: '全部', value: '' }],
    errorMessage: '',
    filterAdjustmentMessage: '',
    filterSections: [],
    filterSheetOpen: false,
    floorIndex: 0,
    floorFilterLabel: '楼层',
    floorLabel: '全部',
    floorOptions: [{ count: 0, label: '全部', value: '' }],
    groupId: '',
    largeText: false,
    loadingMore: false,
    mergedGroupCount: 0,
    modeMotionClass: '',
    nextCursor: '',
    pageScrollStyle: 'height:calc(100% - 76px);',
    prioritySections: [],
    searching: false,
    searchQuery: '',
    sectionIndex: 0,
    sectionFilterLabel: '片区',
    sectionLabel: '全部',
    sectionOptions: [{ count: 0, label: '全部', value: '' }],
    shellHeaderStyle: 'height:76px;min-height:76px;padding-top:24px;',
    state: 'loading',
    subunitIndex: 0,
    subunitFilterLabel: '单元',
    buildingFilterLabel: '楼宇',
    subunitLabel: '全部',
    subunitOptions: [{ count: 0, label: '全部', value: '' }],
    resultSummary: '输入关键词或选择筛选条件后开始查找。',
    viewportClass: '',
  };
  return {
    data,
    properties: {
      directoryKind: { type: String, value: 'internal' },
      embedded: { type: Boolean, value: false },
      groupId: { type: String, value: '' },
    },
    _directoryClient: directoryClient,
    _facets: undefined,
    _filters: {},
    _loadedKey: '',
    _nextCursor: undefined,
    _preferences: parseDirectoryPreferences(undefined),
    _priorityEntries: [],
    _rawEntries: [],
    _requestSerial: 0,
    _searchTimer: undefined,
    observers: {
      groupId(this: DirectoryPageInstance): void {
        startLoad(this);
      },
      directoryKind(this: DirectoryPageInstance): void {
        startLoad(this);
      },
    },
    lifetimes: {
      attached(this: DirectoryPageInstance): void {
        recordMiniTelemetryBoundary('directory:controller-attached');
        const windowInfo = wx.getWindowInfo();
        const statusBarHeight = Math.max(0, windowInfo.statusBarHeight ?? 0);
        const headerHeight = statusBarHeight + 52;
        const embedded = this.properties.embedded;
        this.setData({
          embedded,
          pageScrollStyle: embedded ? 'height:100%;' : `height:calc(100% - ${headerHeight}px);`,
          shellHeaderStyle: `height:${headerHeight}px;min-height:${headerHeight}px;padding-top:${statusBarHeight}px;`,
          largeText:
            ((windowInfo as unknown as { readonly fontSizeSetting?: number }).fontSizeSetting ??
              16) >= 20,
          viewportClass: windowInfo.windowWidth <= 340 ? 'is-compact' : '',
        });
        startLoad(this);
      },
      detached(this: DirectoryPageInstance): void {
        clearSearchTimer(this);
        this._requestSerial += 1;
        this._loadedKey = '';
        this._facets = undefined;
        this._filters = {};
        this._nextCursor = undefined;
        this._priorityEntries = [];
        this._rawEntries = [];
      },
    },
    methods: {
      preventTouchMove(): void {},
      handleBack(): void {
        wx.navigateBack({ delta: 1 });
      },
      handleRetry(this: DirectoryPageInstance): void {
        void loadFacets(this);
      },
      handleInternalMode(this: DirectoryPageInstance): void {
        switchMode(this, 'internal');
      },
      handleEmployeeMode(this: DirectoryPageInstance): void {
        switchMode(this, 'employee');
      },
      handleSearchInput(this: DirectoryPageInstance, event: InputEvent): void {
        this.setData({ searchQuery: event.detail.value });
        scheduleSearch(this);
      },
      handleSearch(this: DirectoryPageInstance): void {
        void search(this);
      },
      handleOpenFilters(this: DirectoryPageInstance): void {
        this.setData({ filterSheetOpen: true });
      },
      handleCloseFilters(this: DirectoryPageInstance): void {
        this.setData({ filterSheetOpen: false });
      },
      handleFilterOption(this: DirectoryPageInstance, event: FilterOptionEvent): void {
        void selectFilter(this, event);
      },
      handleFilterChange(this: DirectoryPageInstance, event: LegacyPickerEvent): void {
        const key = event.currentTarget.dataset.filter;
        const fieldName = filterFieldNames[key];
        const options = this.data[
          `${fieldName}Options` as keyof DirectoryPageData
        ] as readonly DirectoryOption[];
        const selected = options[event.detail.value];
        if (selected !== undefined) {
          void selectFilter(this, {
            currentTarget: { dataset: { filter: key, value: selected.value } },
          });
        }
      },
      handleClearFilters(this: DirectoryPageInstance): void {
        clearAllFilters(this);
      },
      handleResetSearch(this: DirectoryPageInstance): void {
        resetDirectorySearch(this);
      },
      handleLoadMore(this: DirectoryPageInstance): void {
        void loadMore(this);
      },
      handleToggleFavorite(this: DirectoryPageInstance, event: FavoriteEvent): void {
        toggleFavorite(this, event.currentTarget.dataset.groupId);
      },
      handleDirectoryCardFavorite(this: DirectoryPageInstance, event: DirectoryCardEvent): void {
        toggleFavorite(this, event.detail.groupId);
      },
      handleDirectoryCardCall(this: DirectoryPageInstance, event: DirectoryCardEvent): void {
        const number = event.detail.number;
        if (number !== undefined && /^\+?\d{3,20}$/u.test(number)) {
          recordUse(this, event.detail.groupId);
          wx.makePhoneCall({ phoneNumber: number });
        }
      },
      handleCall(this: DirectoryPageInstance, event: CallEvent): void {
        const number = event.currentTarget.dataset.number;
        if (number !== undefined && /^\+?\d{3,20}$/u.test(number)) {
          recordUse(this, event.currentTarget.dataset.groupId);
          wx.makePhoneCall({ phoneNumber: number });
        }
      },
    },
  };
}

interface InputEvent {
  readonly detail: { readonly value: string };
}
interface FilterOptionEvent {
  readonly currentTarget: {
    readonly dataset: { readonly filter?: DirectoryFilterKey; readonly value?: string };
  };
}
interface LegacyPickerEvent {
  readonly currentTarget: { readonly dataset: { readonly filter: DirectoryFilterKey } };
  readonly detail: { readonly value: number };
}
interface CallEvent {
  readonly currentTarget: {
    readonly dataset: { readonly groupId?: string; readonly number?: string };
  };
}
interface FavoriteEvent {
  readonly currentTarget: { readonly dataset: { readonly groupId?: string } };
}
interface DirectoryCardEvent {
  readonly detail: { readonly groupId?: string; readonly number?: string };
}

function startLoad(page: DirectoryPageInstance): void {
  initializeRuntimeState(page);
  const groupId = page.properties.groupId;
  const kind = page.properties.directoryKind;
  const key = `${groupId}:${kind}`;
  if (groupId.length === 0) {
    setMissingGroupError(page);
    return;
  }
  if (key === page._loadedKey) return;
  page._loadedKey = key;
  page._requestSerial += 1;
  page._nextCursor = undefined;
  page._facets = undefined;
  page._filters = {};
  page._priorityEntries = [];
  page._rawEntries = [];
  page.setData({ directoryKind: kind, groupId, ...filterLabelsForKind(kind) });
  void loadFacets(page);
}

function initializeRuntimeState(page: DirectoryPageInstance): void {
  // WeChat only keeps documented Component config keys; private controller
  // fields from the factory object are not copied onto the live instance.
  page._directoryClient = directoryClient;
  if (page._facets !== undefined && typeof page._facets !== 'object') page._facets = undefined;
  if (page._filters === undefined || typeof page._filters !== 'object') page._filters = {};
  if (typeof page._loadedKey !== 'string') page._loadedKey = '';
  if (page._preferences === undefined || typeof page._preferences !== 'object') {
    page._preferences = parseDirectoryPreferences(undefined);
  }
  if (!Array.isArray(page._priorityEntries)) page._priorityEntries = [];
  if (!Array.isArray(page._rawEntries)) page._rawEntries = [];
  if (!Number.isFinite(page._requestSerial)) page._requestSerial = 0;
  if (typeof page._nextCursor !== 'string') page._nextCursor = undefined;
}

function isDirectoryRequestCurrent(
  page: DirectoryPageInstance,
  serial: number,
  groupId: string,
  directoryKind: DirectoryKind,
): boolean {
  return (
    serial === page._requestSerial &&
    groupId === page.data.groupId &&
    directoryKind === page.data.directoryKind
  );
}

function setMissingGroupError(page: DirectoryPageInstance): void {
  page._requestSerial += 1;
  page._loadedKey = '';
  page._facets = undefined;
  page._filters = {};
  page._nextCursor = undefined;
  page._priorityEntries = [];
  page._rawEntries = [];
  page.setData({
    activeFilterCount: 0,
    entries: [],
    errorMessage: '当前群组信息缺失，请返回工作台后重试。',
    filterAdjustmentMessage: '',
    filterSections: [],
    filterSheetOpen: false,
    loadingMore: false,
    mergedGroupCount: 0,
    nextCursor: '',
    prioritySections: [],
    resultSummary: '当前群组信息缺失，请返回工作台后重试。',
    searching: false,
    state: 'error',
  });
}

function setDirectoryDisabled(page: DirectoryPageInstance, message: string): void {
  page._requestSerial += 1;
  page._facets = undefined;
  page._filters = {};
  page._nextCursor = undefined;
  page._priorityEntries = [];
  page._rawEntries = [];
  page.setData({
    activeFilterCount: 0,
    entries: [],
    errorMessage: message,
    filterAdjustmentMessage: '',
    filterSections: [],
    filterSheetOpen: false,
    loadingMore: false,
    mergedGroupCount: 0,
    nextCursor: '',
    prioritySections: [],
    resultSummary: '通讯录暂未开放。',
    searching: false,
    state: 'disabled',
  });
}

function clearSearchTimer(page: DirectoryPageInstance): void {
  if (page._searchTimer === undefined) return;
  clearTimeout(page._searchTimer);
  page._searchTimer = undefined;
}

async function loadFacets(page: DirectoryPageInstance): Promise<void> {
  initializeRuntimeState(page);
  const groupId = page.data.groupId;
  const directoryKind = page.data.directoryKind;
  if (groupId.length === 0) {
    setMissingGroupError(page);
    return;
  }
  const serial = ++page._requestSerial;
  clearSearchTimer(page);
  page._facets = undefined;
  page._filters = {};
  page._nextCursor = undefined;
  page._preferences = readDirectoryPreferences(page);
  page._priorityEntries = [];
  page._rawEntries = [];
  page.setData({
    activeFilterCount: 0,
    errorMessage: '',
    filterAdjustmentMessage: '',
    filterSections: [],
    filterSheetOpen: false,
    loadingMore: false,
    searching: false,
    state: 'loading',
    entries: [],
    mergedGroupCount: 0,
    nextCursor: '',
    prioritySections: [],
    resultSummary: '正在读取通讯录筛选项。',
  });
  try {
    await requireClientCapability('organization');
    const facets = await page._directoryClient.getFacets(groupId, directoryKind);
    if (!isDirectoryRequestCurrent(page, serial, groupId, directoryKind)) return;
    applyFacets(page, facets);
    page.setData({ state: 'empty', resultSummary: '输入关键词或选择筛选条件后开始查找。' });
    void loadPriorityEntries(page, page._loadedKey, serial, groupId, directoryKind);
  } catch (error) {
    if (!isDirectoryRequestCurrent(page, serial, groupId, directoryKind)) return;
    if (error instanceof ClientCapabilityDisabledError) {
      setDirectoryDisabled(page, error.message);
      return;
    }
    page.setData({
      errorMessage: toUserMessage(error, '通讯录暂时无法加载，请稍后重试。'),
      state: 'error',
    });
  }
}

function applyFacets(page: DirectoryPageInstance, facets: DirectoryFacetSnapshot): void {
  page._facets = facets;
  page._filters = {};
  const makeOptions = (options: readonly DirectoryFacetOption[]) => [
    { count: 0, label: '全部', value: '' },
    ...options,
  ];
  page.setData({
    buildingOptions: makeOptions(facets.buildings),
    campusOptions: makeOptions(facets.campuses),
    departmentOptions: makeOptions(facets.departments),
    entryKindOptions: makeOptions(facets.entryKinds),
    floorOptions: makeOptions(facets.floors),
    sectionOptions: makeOptions(facets.sections),
    subunitOptions: makeOptions(facets.subunits),
  });
  syncFilterSections(page);
}

function switchMode(page: DirectoryPageInstance, kind: DirectoryKind): void {
  if (page.data.directoryKind === kind) return;
  clearSearchTimer(page);
  page._loadedKey = '';
  page._requestSerial += 1;
  page._facets = undefined;
  page._filters = {};
  page._nextCursor = undefined;
  page._priorityEntries = [];
  page._rawEntries = [];
  page.setData({
    activeFilterCount: 0,
    directoryKind: kind,
    searchQuery: '',
    entries: [],
    errorMessage: '',
    filterAdjustmentMessage: '',
    filterSections: [],
    filterSheetOpen: false,
    loadingMore: false,
    mergedGroupCount: 0,
    modeMotionClass: kind === 'employee' ? 'is-forward' : 'is-backward',
    prioritySections: [],
    searching: false,
    ...filterLabelsForKind(kind),
  });
  page._loadedKey = `${page.data.groupId}:${kind}`;
  void loadFacets(page);
}

function filterLabelsForKind(kind: DirectoryKind): Partial<DirectoryPageData> {
  return kind === 'employee'
    ? {
        buildingFilterLabel: '二级组织',
        campusFilterLabel: '组织根',
        departmentFilterLabel: '四级组织',
        entryKindFilterLabel: '类型',
        floorFilterLabel: '三级组织',
        sectionFilterLabel: '一级组织',
        subunitFilterLabel: '五级组织',
      }
    : {
        buildingFilterLabel: '楼宇',
        campusFilterLabel: '院区',
        departmentFilterLabel: '科室',
        entryKindFilterLabel: '类型',
        floorFilterLabel: '楼层',
        sectionFilterLabel: '片区',
        subunitFilterLabel: '单元',
      };
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

function syncFilterSections(page: DirectoryPageInstance): void {
  const snapshot = page._facets;
  if (snapshot === undefined) {
    page.setData({ activeFilterCount: 0, filterSections: [] });
    return;
  }
  const compatible = getCompatibleDirectoryFacetOptionsByKey(snapshot, page._filters);
  const meaningful = getMeaningfulDirectoryFilterKeys(snapshot, page._filters, compatible);
  const sections = meaningful.map((key): DirectoryFilterSectionView => {
    const selectedValue = page._filters[key] ?? '';
    const options: readonly DirectoryFilterOptionView[] = [
      { count: snapshot.totalCount, label: '全部', selected: selectedValue === '', value: '' },
      ...(compatible.get(key) ?? []).map((option) => ({
        ...option,
        selected: option.value === selectedValue,
      })),
    ];
    return {
      key,
      label: filterLabel(page.data.directoryKind, key),
      options,
      selectedLabel: options.find((option) => option.selected)?.label ?? '全部',
    };
  });
  const legacyPatch: Record<string, unknown> = {};
  for (const key of filterKeys) {
    const fieldName = filterFieldNames[key];
    const selectedValue = page._filters[key] ?? '';
    const options: readonly DirectoryOption[] = [
      { count: snapshot.totalCount, label: '全部', value: '' },
      ...(compatible.get(key) ?? []),
    ];
    const index = Math.max(
      0,
      options.findIndex((option) => option.value === selectedValue),
    );
    legacyPatch[`${fieldName}Options`] = options;
    legacyPatch[`${fieldName}Index`] = index;
    legacyPatch[`${fieldName}Label`] = options[index]?.label ?? '全部';
  }
  page.setData({
    ...(legacyPatch as Partial<DirectoryPageData>),
    activeFilterCount: Object.keys(page._filters).length,
    filterSections: sections,
  });
}

async function selectFilter(page: DirectoryPageInstance, event: FilterOptionEvent): Promise<void> {
  const key = event.currentTarget.dataset.filter;
  const snapshot = page._facets;
  if (key === undefined || snapshot === undefined) return;
  const value = event.currentTarget.dataset.value;
  if (page._filters[key] === value || (value === '' && page._filters[key] === undefined)) return;
  const result = updateDirectoryFilterSelection(
    snapshot,
    page._filters,
    key,
    value === undefined || value === '' ? undefined : value,
  );
  page._filters = result.filters;
  page.setData({
    filterAdjustmentMessage:
      result.clearedKeys.length === 0
        ? ''
        : `已自动清除不再适用的${result.clearedKeys.map((clearedKey) => filterLabel(page.data.directoryKind, clearedKey)).join('、')}筛选。`,
  });
  syncFilterSections(page);
  await search(page);
}

function clearAllFilters(page: DirectoryPageInstance): void {
  if (Object.keys(page._filters).length === 0) return;
  page._filters = {};
  page.setData({ filterAdjustmentMessage: '' });
  syncFilterSections(page);
  void search(page);
}

function resetDirectorySearch(page: DirectoryPageInstance): void {
  clearSearchTimer(page);
  page._filters = {};
  page.setData({ filterAdjustmentMessage: '', searchQuery: '' });
  syncFilterSections(page);
  void search(page);
}

function scheduleSearch(page: DirectoryPageInstance): void {
  clearSearchTimer(page);
  if (page.data.searchQuery.trim().length === 0 && Object.keys(page._filters).length === 0) {
    void search(page);
    return;
  }
  page.setData({ searching: true });
  page._searchTimer = setTimeout(() => {
    page._searchTimer = undefined;
    void search(page);
  }, 240);
}

async function search(page: DirectoryPageInstance): Promise<void> {
  initializeRuntimeState(page);
  clearSearchTimer(page);
  const groupId = page.data.groupId;
  const directoryKind = page.data.directoryKind;
  if (!hasActiveDirectoryCriteria(page.data.searchQuery, page._filters)) {
    page._requestSerial += 1;
    page._nextCursor = undefined;
    page._rawEntries = [];
    page.setData({
      entries: [],
      mergedGroupCount: 0,
      nextCursor: '',
      resultSummary: '输入关键词或选择筛选条件后开始查找。',
      searching: false,
      state: 'empty',
    });
    return;
  }
  const query = buildQuery(page);
  const serial = ++page._requestSerial;
  page._nextCursor = undefined;
  page.setData({
    errorMessage: '',
    searching: true,
    state: 'loading',
    resultSummary: '正在查找通讯录号码。',
  });
  try {
    await requireClientCapability('organization');
    const result = await page._directoryClient.list(groupId, directoryKind, query);
    if (!isDirectoryRequestCurrent(page, serial, groupId, directoryKind)) return;
    page._nextCursor = result.nextCursor;
    page._rawEntries = result.entries;
    const cards = createDirectoryCards(page, page._rawEntries);
    const mergedGroupCount = cards.filter((card) => card.merged).length;
    page.setData({
      entries: cards,
      mergedGroupCount,
      nextCursor: result.nextCursor ?? '',
      resultSummary: resultSummary(result.totalCount, mergedGroupCount),
      searching: false,
      state: cards.length === 0 ? 'empty' : 'ready',
    });
    syncPrioritySections(page);
  } catch (error) {
    if (!isDirectoryRequestCurrent(page, serial, groupId, directoryKind)) return;
    if (error instanceof ClientCapabilityDisabledError) {
      setDirectoryDisabled(page, error.message);
      return;
    }
    page.setData({
      errorMessage: toUserMessage(error, '通讯录搜索未完成，请稍后重试。'),
      searching: false,
      state: 'error',
    });
  }
}

async function loadMore(page: DirectoryPageInstance): Promise<void> {
  initializeRuntimeState(page);
  const cursor = page._nextCursor;
  const groupId = page.data.groupId;
  const directoryKind = page.data.directoryKind;
  if (cursor === undefined || page.data.loadingMore || groupId.length === 0) return;
  const serial = page._requestSerial;
  const query = buildQuery(page, cursor);
  page.setData({ errorMessage: '', loadingMore: true });
  try {
    await requireClientCapability('organization');
    if (!isDirectoryRequestCurrent(page, serial, groupId, directoryKind)) return;
    const result = await page._directoryClient.list(groupId, directoryKind, query);
    if (!isDirectoryRequestCurrent(page, serial, groupId, directoryKind)) return;
    page._nextCursor = result.nextCursor;
    page._rawEntries = [...page._rawEntries, ...result.entries];
    const cards = createDirectoryCards(page, page._rawEntries);
    const mergedGroupCount = cards.filter((card) => card.merged).length;
    page.setData({
      entries: cards,
      loadingMore: false,
      mergedGroupCount,
      nextCursor: result.nextCursor ?? '',
      resultSummary: resultSummary(result.totalCount, mergedGroupCount),
    });
    syncPrioritySections(page);
  } catch (error) {
    if (!isDirectoryRequestCurrent(page, serial, groupId, directoryKind)) return;
    if (error instanceof ClientCapabilityDisabledError) {
      setDirectoryDisabled(page, error.message);
      return;
    }
    page.setData({
      errorMessage: toUserMessage(error, '更多通讯录记录暂时无法加载。'),
      loadingMore: false,
    });
  }
}

function buildQuery(page: DirectoryPageInstance, cursor?: string): DirectoryQuery {
  return toDirectoryQuery(page.data.searchQuery, page._filters, cursor) as DirectoryQuery;
}

function createDirectoryCards(
  page: DirectoryPageInstance,
  entries: readonly DirectoryEntry[],
): readonly DirectoryCard[] {
  return groupDirectoryEntriesByContact(entries).map((group) =>
    toCard(group, page.data.directoryKind, page._preferences),
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
  loadedKey: string,
  serial: number,
  groupId: string,
  directoryKind: DirectoryKind,
): Promise<void> {
  const entryIds = getDirectoryPreferenceEntryIds(page._preferences);
  if (entryIds.length === 0) {
    syncPrioritySections(page);
    return;
  }
  const chunks = Array.from({ length: Math.ceil(entryIds.length / 100) }, (_, index) =>
    entryIds.slice(index * 100, index * 100 + 100),
  );
  try {
    const responses = await Promise.all(
      chunks.map((chunk) =>
        page._directoryClient.lookup(page.data.groupId, page.data.directoryKind, chunk),
      ),
    );
    if (
      page._loadedKey !== loadedKey ||
      !isDirectoryRequestCurrent(page, serial, groupId, directoryKind)
    )
      return;
    page._priorityEntries = responses.flatMap((response) => response.entries);
    syncPrioritySections(page);
  } catch {
    // Preferred entries are an enhancement; search and filtering remain available.
  }
}

function knownEntryGroups(page: DirectoryPageInstance): readonly DirectoryEntryDisplayGroup[] {
  const entriesById = new Map<string, DirectoryEntry>();
  for (const entry of [...page._priorityEntries, ...page._rawEntries]) {
    entriesById.set(entry.id, entry);
  }
  return groupDirectoryEntriesByContact([...entriesById.values()]);
}

function syncPrioritySections(page: DirectoryPageInstance): void {
  const priority = getDirectoryPriorityGroups(page._preferences, knownEntryGroups(page));
  const sections: DirectoryPrioritySectionView[] = [];
  if (priority.favorites.length > 0) {
    sections.push({
      entries: priority.favorites.map((group) =>
        toCard(group, page.data.directoryKind, page._preferences),
      ),
      key: 'favorites',
      title: '收藏通讯录',
    });
  }
  if (priority.frequent.length > 0) {
    sections.push({
      entries: priority.frequent.map((group) =>
        toCard(group, page.data.directoryKind, page._preferences),
      ),
      key: 'frequent',
      title: '常用通讯录',
    });
  }
  page.setData({ prioritySections: sections });
}

function findDirectoryGroup(
  page: DirectoryPageInstance,
  groupId: string | undefined,
): DirectoryEntryDisplayGroup | undefined {
  return groupId === undefined
    ? undefined
    : knownEntryGroups(page).find((group) => group.id === groupId);
}

function rememberPriorityEntries(
  page: DirectoryPageInstance,
  group: DirectoryEntryDisplayGroup,
): void {
  const entriesById = new Map(page._priorityEntries.map((entry) => [entry.id, entry]));
  for (const entry of group.entries as readonly DirectoryEntry[]) entriesById.set(entry.id, entry);
  page._priorityEntries = [...entriesById.values()];
}

function toggleFavorite(page: DirectoryPageInstance, groupId: string | undefined): void {
  const group = findDirectoryGroup(page, groupId);
  if (group === undefined) return;
  rememberPriorityEntries(page, group);
  page._preferences = toggleDirectoryFavorite(page._preferences, group);
  persistDirectoryPreferences(page);
  page.setData({ entries: createDirectoryCards(page, page._rawEntries) });
  syncPrioritySections(page);
}

function recordUse(page: DirectoryPageInstance, groupId: string | undefined): void {
  const group = findDirectoryGroup(page, groupId);
  if (group === undefined) return;
  rememberPriorityEntries(page, group);
  page._preferences = recordDirectoryUse(page._preferences, group);
  persistDirectoryPreferences(page);
  syncPrioritySections(page);
}

function directoryPreferenceStorageKey(page: DirectoryPageInstance): string | undefined {
  const ownerId = getStoredWechatProfile()?.id;
  return ownerId === undefined
    ? undefined
    : `${DIRECTORY_PREFERENCES_PREFIX}${ownerId}:${page.data.groupId}:${page.data.directoryKind}`;
}

function readDirectoryPreferences(page: DirectoryPageInstance): DirectoryPreferences {
  const key = directoryPreferenceStorageKey(page);
  if (key === undefined) return parseDirectoryPreferences(undefined);
  try {
    const value = wx.getStorageSync(key);
    return parseDirectoryPreferences(typeof value === 'string' ? value : undefined);
  } catch {
    return parseDirectoryPreferences(undefined);
  }
}

function persistDirectoryPreferences(page: DirectoryPageInstance): void {
  const key = directoryPreferenceStorageKey(page);
  if (key === undefined) return;
  try {
    wx.setStorageSync(key, JSON.stringify(page._preferences));
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
