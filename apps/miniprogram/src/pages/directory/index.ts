import type {
  DirectoryContactMethod,
  DirectoryEntry,
  DirectoryFacetOption,
  DirectoryFacetSnapshot,
  DirectoryQuery,
  GroupSummary,
} from '@schedule/contracts';

import {
  createDirectoryController,
  type DirectoryMode,
} from '../../features/directory/directory-controller.js';
import {
  createRuntimeDirectoryReadClient,
  createRuntimeOrganizationReadClient,
} from '../../platform/client-core-calendar.js';
import {
  getStoredWechatToken,
  getWechatRequestAuthentication,
} from '../../platform/wechat-identity.js';

type PageState = 'error' | 'loading' | 'ready';
type DirectoryFilterKey =
  'building' | 'campusCode' | 'department' | 'entryKind' | 'floor' | 'section' | 'subunit';
type DirectoryFilters = Partial<Record<DirectoryFilterKey, string>>;

interface TapEvent {
  readonly currentTarget: { readonly dataset: Record<string, string | undefined> };
}

interface InputEvent {
  readonly detail?: { readonly value?: string };
}

interface DirectoryFilterOptionView extends DirectoryFacetOption {
  readonly selected: boolean;
}

interface DirectoryFilterSectionView {
  readonly key: DirectoryFilterKey;
  readonly label: string;
  readonly options: readonly DirectoryFilterOptionView[];
  readonly summary: string;
}

interface DirectoryContactView {
  readonly dialable: boolean;
  readonly id: string;
  readonly label: string;
  readonly number: string;
  readonly note: string;
}

interface DirectoryEntryView {
  readonly contacts: readonly DirectoryContactView[];
  readonly id: string;
  readonly kindLabel: string;
  readonly location: string;
  readonly notes: string;
  readonly path: string;
  readonly title: string;
  readonly jobTitle: string;
}

interface DirectoryPageData {
  readonly activeFilterCount: number;
  readonly announcement: string;
  readonly contentStyle: string;
  readonly errorMessage: string;
  readonly entries: readonly DirectoryEntryView[];
  readonly filterOpen: boolean;
  readonly filterSections: readonly DirectoryFilterSectionView[];
  readonly groupId: string;
  readonly groupName: string;
  readonly groupRole: string;
  readonly hasActiveQuery: boolean;
  readonly hasNextPage: boolean;
  readonly isLoadingMore: boolean;
  readonly mode: DirectoryMode;
  readonly modeLabel: string;
  readonly pageStyle: string;
  readonly searchDraft: string;
  readonly state: PageState;
  readonly summary: string;
  readonly shellHeaderStyle: string;
  readonly totalCount: number;
  readonly viewportClass: string;
}

interface DirectoryPageInstance {
  readonly data: DirectoryPageData;
  _controller: ReturnType<typeof createDirectoryController> | undefined;
  _filters: DirectoryFilters;
  _groupId: string;
  setData(patch: Partial<DirectoryPageData>, callback?: () => void): void;
}

const directoryReadClient = createRuntimeDirectoryReadClient(
  getStoredWechatToken,
  getWechatRequestAuthentication(),
);
const organizationReadClient = createRuntimeOrganizationReadClient(
  getStoredWechatToken,
  getWechatRequestAuthentication(),
);

const filterDefinitions: readonly { key: DirectoryFilterKey; label: string }[] = [
  { key: 'campusCode', label: '院区' },
  { key: 'section', label: '片区' },
  { key: 'building', label: '楼宇' },
  { key: 'floor', label: '楼层' },
  { key: 'department', label: '科室' },
  { key: 'subunit', label: '单元' },
  { key: 'entryKind', label: '类型' },
];

const entryKindLabels: Readonly<Record<string, string>> = {
  department: '科室',
  emergency: '急救',
  facility: '设施',
  other: '其他',
  person: '人员',
  service: '服务点',
  switchboard: '总机',
  vendor: '外部服务',
};

Page({
  data: {
    activeFilterCount: 0,
    announcement: '',
    contentStyle: 'height:calc(100% - 76px);',
    errorMessage: '',
    entries: [],
    filterOpen: false,
    filterSections: [],
    groupId: '',
    groupName: '正在读取群组',
    groupRole: '',
    hasActiveQuery: false,
    hasNextPage: false,
    isLoadingMore: false,
    mode: 'internal' as DirectoryMode,
    modeLabel: '科室',
    pageStyle: 'height:100vh;',
    searchDraft: '',
    shellHeaderStyle: 'height:76px;min-height:76px;padding-top:24px;',
    state: 'loading' as PageState,
    summary: '正在读取通讯录',
    totalCount: 0,
    viewportClass: '',
  } satisfies DirectoryPageData,

  _controller: undefined,
  _filters: {},
  _groupId: '',

  onLoad(this: DirectoryPageInstance, query: Readonly<Record<string, string | undefined>>): void {
    const groupId = query['groupId'] ?? '';
    this._groupId = groupId;
    const windowInfo = wx.getWindowInfo();
    const statusBarHeight = Math.max(0, windowInfo.statusBarHeight ?? 0);
    const headerHeight = statusBarHeight + 52;
    this.setData({
      contentStyle: `height:calc(100% - ${headerHeight}px);`,
      groupId,
      pageStyle: `height:${Math.max(1, windowInfo.windowHeight)}px;`,
      shellHeaderStyle: `height:${headerHeight}px;min-height:${headerHeight}px;padding-top:${statusBarHeight}px;`,
      viewportClass: windowInfo.windowWidth <= 340 ? 'is-compact' : '',
    });
    void loadDirectory(this);
  },

  handleBack(): void {
    wx.navigateBack({ delta: 1 });
  },

  handleModeSelect(this: DirectoryPageInstance, event: TapEvent): void {
    const mode = event.currentTarget.dataset.mode;
    if (mode !== 'internal' && mode !== 'employee') return;
    this._filters = {};
    this.setData({
      filterOpen: false,
      mode,
      modeLabel: mode === 'internal' ? '科室' : '人员',
      searchDraft: '',
    });
    const controller = this._controller;
    if (controller === undefined) return;
    void controller.setMode(mode).then(() => syncControllerState(this));
  },

  handleSearchInput(this: DirectoryPageInstance, event: InputEvent): void {
    this.setData({ searchDraft: event.detail?.value ?? '' });
  },

  handleSearchSubmit(this: DirectoryPageInstance): void {
    void submitSearch(this);
  },

  handleClearSearch(this: DirectoryPageInstance): void {
    if (this.data.searchDraft.length === 0) return;
    this.setData({ searchDraft: '' }, () => void submitSearch(this));
  },

  handleFilterToggle(this: DirectoryPageInstance): void {
    this.setData({ filterOpen: !this.data.filterOpen });
  },

  handleFilterOption(this: DirectoryPageInstance, event: TapEvent): void {
    const key = event.currentTarget.dataset.key;
    const value = event.currentTarget.dataset.value;
    if (!isDirectoryFilterKey(key) || value === undefined) return;
    if (this._filters[key] === value) delete this._filters[key];
    else this._filters[key] = value;
    this.setData({
      activeFilterCount: Object.keys(this._filters).length,
      filterSections: createFilterSections(this._controller?.getState().facets, this._filters),
    });
  },

  handleFilterClear(this: DirectoryPageInstance): void {
    this._filters = {};
    this.setData({
      activeFilterCount: 0,
      filterSections: createFilterSections(this._controller?.getState().facets, {}),
    });
  },

  handleFilterApply(this: DirectoryPageInstance): void {
    this.setData({ filterOpen: false }, () => void submitSearch(this));
  },

  handleFilterClose(this: DirectoryPageInstance): void {
    this.setData({ filterOpen: false });
  },

  handleLoadMore(this: DirectoryPageInstance): void {
    const controller = this._controller;
    if (controller === undefined) return;
    void controller.loadMore().then(() => syncControllerState(this));
  },

  handleRetry(this: DirectoryPageInstance): void {
    const controller = this._controller;
    if (controller === undefined) return;
    void controller.retry().then(() => syncControllerState(this));
  },

  handleCall(this: DirectoryPageInstance, event: TapEvent): void {
    const phoneNumber = event.currentTarget.dataset.phone;
    if (phoneNumber === undefined || phoneNumber.length === 0) return;
    wx.makePhoneCall({
      fail: () => this.setData({ announcement: '未能发起通话。' }),
      phoneNumber,
    });
  },

  stopSheetTap(): void {},
});

async function loadDirectory(page: DirectoryPageInstance): Promise<void> {
  page.setData({ errorMessage: '', state: 'loading', summary: '正在读取通讯录' });
  try {
    const groups = await organizationReadClient.listGroups();
    const group = selectGroup(groups, page._groupId);
    if (group === undefined) throw new Error('当前群组不可用。');
    if (group.role === 'guest') throw new Error('访客不能使用通讯录。');
    page._groupId = group.id;
    page._controller = createDirectoryController(directoryReadClient, group.id);
    page.setData({
      groupId: group.id,
      groupName: group.name,
      groupRole: formatRole(group),
    });
    await page._controller.load('internal');
    syncControllerState(page);
  } catch (error) {
    page.setData({
      errorMessage: error instanceof Error ? error.message : '通讯录暂时无法加载，请稍后重试。',
      state: 'error',
      summary: '通讯录暂时无法加载',
    });
  }
}

async function submitSearch(page: DirectoryPageInstance): Promise<void> {
  const controller = page._controller;
  if (controller === undefined) return;
  const query: DirectoryQuery = { pageSize: 30 };
  const search = page.data.searchDraft.trim();
  if (search.length > 0) query.q = search;
  Object.assign(query, page._filters);
  if (search.length === 0 && Object.keys(page._filters).length === 0) {
    page.setData({ hasActiveQuery: false, summary: '请输入科室、姓名、拼音或号码' });
    await controller.load(page.data.mode);
  } else {
    await controller.search(query);
  }
  syncControllerState(page);
}

function syncControllerState(page: DirectoryPageInstance): void {
  const controller = page._controller;
  if (controller === undefined) return;
  const state = controller.getState();
  const hasActiveQuery = state.activeQuery !== undefined;
  page.setData({
    activeFilterCount: Object.keys(page._filters).length,
    entries: state.entries.map(toEntryView),
    errorMessage: state.errorMessage,
    filterSections: createFilterSections(state.facets, page._filters),
    hasActiveQuery,
    hasNextPage: state.nextCursor !== undefined,
    isLoadingMore: state.isLoadingMore,
    mode: state.mode,
    modeLabel: state.mode === 'internal' ? '科室' : '人员',
    state: state.state,
    summary:
      state.state === 'loading'
        ? `正在查找${state.mode === 'internal' ? '科室' : '人员'}通讯录`
        : hasActiveQuery
          ? state.totalCount === 0
            ? '没有匹配的通讯录条目'
            : `找到 ${state.totalCount} 条通讯录记录`
          : '请输入科室、姓名、拼音或号码',
    totalCount: state.totalCount,
  });
}

function createFilterSections(
  facets: DirectoryFacetSnapshot | undefined,
  filters: DirectoryFilters,
): readonly DirectoryFilterSectionView[] {
  if (facets === undefined) return [];
  const optionsByKey: Readonly<Record<DirectoryFilterKey, readonly DirectoryFacetOption[]>> = {
    building: facets.buildings,
    campusCode: facets.campuses,
    department: facets.departments,
    entryKind: facets.entryKinds,
    floor: facets.floors,
    section: facets.sections,
    subunit: facets.subunits,
  };
  return filterDefinitions.map(({ key, label }) => {
    const selected = filters[key];
    const options = (optionsByKey[key] ?? []).map((option) => ({
      ...option,
      selected: option.value === selected,
    }));
    return {
      key,
      label,
      options,
      summary:
        selected === undefined
          ? '全部'
          : (options.find((option) => option.selected)?.label ?? selected),
    };
  });
}

function toEntryView(entry: DirectoryEntry): DirectoryEntryView {
  const title =
    entry.contactName ?? entry.subunit ?? entry.department ?? entry.section ?? entry.campus.name;
  const path = unique([
    entry.campus.code === 'employee-hospital' ? undefined : entry.campus.name,
    entry.section,
    entry.department,
    entry.subunit,
  ])
    .filter((value) => value !== undefined && value !== title)
    .join(' › ');
  const location = [entry.building, entry.floor, entry.room]
    .filter((value): value is string => value !== undefined)
    .join(' · ');
  return {
    contacts: entry.contacts.flatMap(toContactViews),
    id: entry.id,
    jobTitle: entry.jobTitle ?? '',
    kindLabel: entryKindLabels[entry.entryKind] ?? '通讯录',
    location,
    notes: entry.notes ?? '',
    path,
    title,
  };
}

function toContactViews(contact: DirectoryContactMethod): readonly DirectoryContactView[] {
  const views: DirectoryContactView[] = [];
  if (contact.fullNumber !== undefined) {
    views.push({
      dialable: new Set(['emergency', 'hotline', 'mobile', 'voice']).has(contact.type),
      id: `${contact.id}-full`,
      label: contact.label ?? (contact.type === 'mobile' ? '手机长号' : '固定电话'),
      note: '',
      number: contact.fullNumber,
    });
  }
  if (contact.internalExtension !== undefined && /^\d{3,6}$/u.test(contact.internalExtension)) {
    views.push({
      dialable: contact.type === 'mobile',
      id: `${contact.id}-extension`,
      label: contact.type === 'mobile' ? '手机短号' : '院内短号',
      note: contact.type === 'mobile' ? '' : '仅展示',
      number: contact.internalExtension,
    });
  }
  return views;
}

function selectGroup(groups: readonly GroupSummary[], groupId: string): GroupSummary | undefined {
  return groups.find((group) => group.id === groupId) ?? groups[0];
}

function formatRole(group: GroupSummary): string {
  if (group.isDeveloperAdmin === true) return '后台管理员';
  if (group.role === 'owner') return '群主';
  if (group.role === 'administrator') return '管理员';
  return '成员';
}

function isDirectoryFilterKey(value: string | undefined): value is DirectoryFilterKey {
  return value !== undefined && filterDefinitions.some((definition) => definition.key === value);
}

function unique(values: readonly (string | undefined)[]): readonly string[] {
  return [...new Set(values)].filter(
    (value): value is string => value !== undefined && value.length > 0,
  );
}
