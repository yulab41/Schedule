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
  ClientCapabilityDisabledError,
  requireClientCapability,
} from '../../../../app/client-capability-store.js';
import { createRuntimeDirectoryReadClient } from '../../../../platform/client-core-calendar.js';
import {
  getStoredWechatToken,
  getWechatRequestAuthentication,
} from '../../../../platform/wechat-identity.js';

type DirectoryState = 'disabled' | 'empty' | 'error' | 'loading' | 'ready';
type FilterKey =
  'building' | 'campusCode' | 'department' | 'entryKind' | 'floor' | 'section' | 'subunit';

interface DirectoryContactCard {
  readonly id: string;
  readonly label: string;
  readonly number: string;
}
interface DirectoryCard {
  readonly contacts: readonly DirectoryContactCard[];
  readonly context: string;
  readonly id: string;
  readonly kindLabel: string;
  readonly title: string;
}
interface DirectoryOption extends DirectoryFacetOption {
  readonly value: string;
}

interface DirectoryPageData {
  readonly buildingIndex: number;
  readonly buildingLabel: string;
  readonly buildingOptions: readonly DirectoryOption[];
  readonly campusIndex: number;
  readonly campusLabel: string;
  readonly campusOptions: readonly DirectoryOption[];
  readonly departmentIndex: number;
  readonly departmentLabel: string;
  readonly departmentOptions: readonly DirectoryOption[];
  readonly directoryKind: DirectoryKind;
  readonly entries: readonly DirectoryCard[];
  readonly entryKindIndex: number;
  readonly entryKindLabel: string;
  readonly entryKindOptions: readonly DirectoryOption[];
  readonly errorMessage: string;
  readonly floorIndex: number;
  readonly floorLabel: string;
  readonly floorOptions: readonly DirectoryOption[];
  readonly groupId: string;
  readonly loadingMore: boolean;
  readonly nextCursor: string;
  readonly pageScrollStyle: string;
  readonly searching: boolean;
  readonly searchQuery: string;
  readonly sectionIndex: number;
  readonly sectionLabel: string;
  readonly sectionOptions: readonly DirectoryOption[];
  readonly shellHeaderStyle: string;
  readonly state: DirectoryState;
  readonly subunitIndex: number;
  readonly subunitLabel: string;
  readonly subunitOptions: readonly DirectoryOption[];
  readonly resultSummary: string;
  readonly viewportClass: string;
}

interface DirectoryPageInstance {
  readonly data: DirectoryPageData;
  readonly properties: { readonly directoryKind: DirectoryKind; readonly groupId: string };
  readonly _directoryClient: DirectoryReadClient;
  _loadedKey: string;
  _nextCursor: string | undefined;
  _requestSerial: number;
  setData(patch: Partial<DirectoryPageData>): void;
}

const directoryClient = createRuntimeDirectoryReadClient(
  getStoredWechatToken,
  getWechatRequestAuthentication(),
);
const filterKeys: readonly FilterKey[] = [
  'campusCode',
  'section',
  'building',
  'floor',
  'department',
  'subunit',
  'entryKind',
];
const filterFieldNames: Readonly<Record<FilterKey, string>> = {
  building: 'building',
  campusCode: 'campus',
  department: 'department',
  entryKind: 'entryKind',
  floor: 'floor',
  section: 'section',
  subunit: 'subunit',
};
const filterLabels: Readonly<Record<FilterKey, string>> = {
  building: '楼宇',
  campusCode: '院区',
  department: '科室',
  entryKind: '类型',
  floor: '楼层',
  section: '片区',
  subunit: '单元',
};
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

export function createDirectoryPanelControllerDefinition() {
  const data: DirectoryPageData = {
    buildingIndex: 0,
    buildingLabel: '全部',
    buildingOptions: [{ count: 0, label: '全部', value: '' }],
    campusIndex: 0,
    campusLabel: '全部',
    campusOptions: [{ count: 0, label: '全部', value: '' }],
    departmentIndex: 0,
    departmentLabel: '全部',
    departmentOptions: [{ count: 0, label: '全部', value: '' }],
    directoryKind: 'internal',
    entries: [],
    entryKindIndex: 0,
    entryKindLabel: '全部',
    entryKindOptions: [{ count: 0, label: '全部', value: '' }],
    errorMessage: '',
    floorIndex: 0,
    floorLabel: '全部',
    floorOptions: [{ count: 0, label: '全部', value: '' }],
    groupId: '',
    loadingMore: false,
    nextCursor: '',
    pageScrollStyle: 'height:calc(100% - 76px);',
    searching: false,
    searchQuery: '',
    sectionIndex: 0,
    sectionLabel: '全部',
    sectionOptions: [{ count: 0, label: '全部', value: '' }],
    shellHeaderStyle: 'height:76px;min-height:76px;padding-top:24px;',
    state: 'loading',
    subunitIndex: 0,
    subunitLabel: '全部',
    subunitOptions: [{ count: 0, label: '全部', value: '' }],
    resultSummary: '输入关键词或选择筛选条件后开始查找。',
    viewportClass: '',
  };
  return {
    data,
    properties: {
      directoryKind: { type: String, value: 'internal' },
      groupId: { type: String, value: '' },
    },
    _directoryClient: directoryClient,
    _loadedKey: '',
    _nextCursor: undefined,
    _requestSerial: 0,
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
        const windowInfo = wx.getWindowInfo();
        const statusBarHeight = Math.max(0, windowInfo.statusBarHeight ?? 0);
        const headerHeight = statusBarHeight + 52;
        this.setData({
          pageScrollStyle: `height:calc(100% - ${headerHeight}px);`,
          shellHeaderStyle: `height:${headerHeight}px;min-height:${headerHeight}px;padding-top:${statusBarHeight}px;`,
          viewportClass: windowInfo.windowWidth <= 340 ? 'is-compact' : '',
        });
        startLoad(this);
      },
    },
    methods: {
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
      },
      handleSearch(this: DirectoryPageInstance): void {
        void search(this);
      },
      handleFilterChange(this: DirectoryPageInstance, event: PickerEvent): void {
        void selectFilter(this, event);
      },
      handleLoadMore(this: DirectoryPageInstance): void {
        void loadMore(this);
      },
    },
  };
}

interface InputEvent {
  readonly detail: { readonly value: string };
}
interface PickerEvent {
  readonly currentTarget: { readonly dataset: { readonly filter: FilterKey } };
  readonly detail: { readonly value: number };
}

function startLoad(page: DirectoryPageInstance): void {
  const groupId = page.properties.groupId;
  const kind = page.properties.directoryKind;
  const key = `${groupId}:${kind}`;
  if (groupId.length === 0 || key === page._loadedKey) return;
  page._loadedKey = key;
  page.setData({ directoryKind: kind, groupId });
  void loadFacets(page);
}

async function loadFacets(page: DirectoryPageInstance): Promise<void> {
  if (page.data.groupId.length === 0) {
    page.setData({ errorMessage: '当前群组信息缺失，请返回工作台后重试。', state: 'error' });
    return;
  }
  const serial = ++page._requestSerial;
  page._nextCursor = undefined;
  page.setData({
    errorMessage: '',
    state: 'loading',
    entries: [],
    nextCursor: '',
    resultSummary: '正在读取通讯录筛选项。',
  });
  try {
    await requireClientCapability('organization');
    const facets = await page._directoryClient.getFacets(
      page.data.groupId,
      page.data.directoryKind,
    );
    if (serial !== page._requestSerial) return;
    applyFacets(page, facets);
    page.setData({ state: 'empty', resultSummary: '输入关键词或选择筛选条件后开始查找。' });
  } catch (error) {
    if (serial !== page._requestSerial) return;
    page.setData({
      errorMessage:
        error instanceof ClientCapabilityDisabledError
          ? error.message
          : toUserMessage(error, '通讯录暂时无法加载，请稍后重试。'),
      state: error instanceof ClientCapabilityDisabledError ? 'disabled' : 'error',
    });
  }
}

function applyFacets(page: DirectoryPageInstance, facets: DirectoryFacetSnapshot): void {
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
}

function switchMode(page: DirectoryPageInstance, kind: DirectoryKind): void {
  if (page.data.directoryKind === kind) return;
  page._loadedKey = '';
  page.setData({ directoryKind: kind, searchQuery: '', entries: [], errorMessage: '' });
  startLoad(page);
}

async function selectFilter(page: DirectoryPageInstance, event: PickerEvent): Promise<void> {
  const key = event.currentTarget.dataset.filter;
  const fieldName = filterFieldNames[key];
  const options = page.data[
    `${fieldName}Options` as keyof DirectoryPageData
  ] as readonly DirectoryOption[];
  const selected = options[event.detail.value];
  if (selected === undefined) return;
  const indexKey = `${fieldName}Index` as keyof DirectoryPageData;
  const labelKey = `${fieldName}Label` as keyof DirectoryPageData;
  page.setData({
    [indexKey]: event.detail.value,
    [labelKey]: selected.label,
  } as Partial<DirectoryPageData>);
  await search(page);
}

async function search(page: DirectoryPageInstance): Promise<void> {
  const query = buildQuery(page);
  if (Object.keys(query).length === 0) {
    page._nextCursor = undefined;
    page.setData({
      entries: [],
      nextCursor: '',
      resultSummary: '输入关键词或选择筛选条件后开始查找。',
      state: 'empty',
    });
    return;
  }
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
    const result = await page._directoryClient.list(
      page.data.groupId,
      page.data.directoryKind,
      query,
    );
    if (serial !== page._requestSerial) return;
    page._nextCursor = result.nextCursor;
    page.setData({
      entries: result.entries.map(toCard),
      nextCursor: result.nextCursor ?? '',
      resultSummary: `找到 ${result.totalCount} 条通讯录记录。`,
      searching: false,
      state: result.entries.length === 0 ? 'empty' : 'ready',
    });
  } catch (error) {
    if (serial !== page._requestSerial) return;
    page.setData({
      errorMessage: toUserMessage(error, '通讯录搜索未完成，请稍后重试。'),
      searching: false,
      state: 'error',
    });
  }
}

async function loadMore(page: DirectoryPageInstance): Promise<void> {
  const cursor = page._nextCursor;
  if (cursor === undefined || page.data.loadingMore) return;
  page.setData({ loadingMore: true });
  try {
    await requireClientCapability('organization');
    const result = await page._directoryClient.list(page.data.groupId, page.data.directoryKind, {
      ...buildQuery(page),
      cursor,
    });
    page._nextCursor = result.nextCursor;
    page.setData({
      entries: [...page.data.entries, ...result.entries.map(toCard)],
      loadingMore: false,
      nextCursor: result.nextCursor ?? '',
      resultSummary: `找到 ${result.totalCount} 条通讯录记录。`,
    });
  } catch (error) {
    page.setData({
      errorMessage: toUserMessage(error, '更多通讯录记录暂时无法加载。'),
      loadingMore: false,
    });
  }
}

function buildQuery(page: DirectoryPageInstance): DirectoryQuery {
  const query: Record<string, string> = {};
  if (page.data.searchQuery.trim()) query.q = page.data.searchQuery.trim();
  for (const key of filterKeys) {
    const fieldName = filterFieldNames[key];
    const value = (
      page.data[`${fieldName}Options` as keyof DirectoryPageData] as readonly DirectoryOption[]
    )[page.data[`${fieldName}Index` as keyof DirectoryPageData] as number]?.value;
    if (value) query[key] = value;
  }
  return query as DirectoryQuery;
}

function toCard(entry: DirectoryEntry): DirectoryCard {
  return {
    contacts: entry.contacts.map((contact) => ({
      id: contact.id,
      label: contact.label ?? (contact.type === 'mobile' ? '手机' : '电话'),
      number: contact.fullNumber ?? `分机 ${contact.internalExtension ?? '未提供'}`,
    })),
    context: [entry.campus.name, entry.section, entry.department, entry.subunit, entry.room]
      .filter((value): value is string => value !== undefined)
      .join(' · '),
    id: entry.id,
    kindLabel: entryKindLabels[entry.entryKind] ?? '其他',
    title: entry.contactName ?? entry.department ?? entry.subunit ?? '未命名条目',
  };
}

function toUserMessage(error: unknown, fallback: string): string {
  return error instanceof ClientCoreError && error.message.length > 0
    ? error.message
    : error instanceof Error && error.message.length > 0
      ? error.message
      : fallback;
}
