import { ClientCoreError, type VisitorAccessReadClient } from '@schedule/client-core';
import type { VisitorAccessAggregate, VisitorAccessLog } from '@schedule/contracts';
import {
  ClientCapabilityDisabledError,
  requireClientCapability,
} from '../../../../app/client-capability-store.js';
import { createRuntimeVisitorAccessReadClient } from '../../../../platform/client-core-calendar.js';
import {
  getStoredWechatToken,
  getWechatRequestAuthentication,
} from '../../../../platform/wechat-identity.js';

type VisitorAccessState = 'disabled' | 'empty' | 'error' | 'loading' | 'ready';

interface AggregateCard {
  readonly accessCountLabel: string;
  readonly accessMonth: string;
  readonly accessMonthLabel: string;
  readonly barHeight: number;
}

interface LogCard {
  readonly businessMonthLabel: string;
  readonly createdAtLabel: string;
  readonly id: string;
  readonly ipLabel: string;
  readonly requestIdLabel: string;
}

interface VisitorAccessPageData {
  readonly aggregateCountLabel: string;
  readonly aggregates: readonly AggregateCard[];
  readonly errorMessage: string;
  readonly groupId: string;
  readonly loadMoreError: string;
  readonly loadingMore: boolean;
  readonly logCountLabel: string;
  readonly logs: readonly LogCard[];
  readonly nextCursor: string;
  readonly pageScrollStyle: string;
  readonly shellHeaderStyle: string;
  readonly state: VisitorAccessState;
  readonly viewportClass: string;
}

interface VisitorAccessPageInstance {
  readonly data: VisitorAccessPageData;
  readonly properties: { readonly groupId: string };
  _visitorAccessReadClient: VisitorAccessReadClient;
  _loadedGroupId: string;
  _nextCursor: string | undefined;
  _requestSerial: number;
  setData(patch: Partial<VisitorAccessPageData>, callback?: () => void): void;
}

const visitorAccessReadClient = createRuntimeVisitorAccessReadClient(
  getStoredWechatToken,
  getWechatRequestAuthentication(),
);

export function createVisitorAccessPanelControllerDefinition() {
  return {
    data: {
      aggregateCountLabel: '0 个月',
      aggregates: [],
      errorMessage: '',
      groupId: '',
      loadMoreError: '',
      loadingMore: false,
      logCountLabel: '0 条',
      logs: [],
      nextCursor: '',
      pageScrollStyle: 'height:calc(100% - 76px);',
      shellHeaderStyle: 'height:76px;min-height:76px;padding-top:24px;',
      state: 'loading' as VisitorAccessState,
      viewportClass: '',
    } satisfies VisitorAccessPageData,

    properties: {
      groupId: { type: String, value: '' },
    },

    _visitorAccessReadClient: visitorAccessReadClient,
    _loadedGroupId: '',
    _nextCursor: undefined,
    _requestSerial: 0,

    observers: {
      groupId(this: VisitorAccessPageInstance): void {
        startLoad(this);
      },
    },

    lifetimes: {
      attached(this: VisitorAccessPageInstance): void {
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

      handleRetry(this: VisitorAccessPageInstance): void {
        void loadVisitorAccess(this);
      },

      handleLoadMore(this: VisitorAccessPageInstance): void {
        void loadMoreLogs(this);
      },
    },
  };
}

async function loadVisitorAccess(page: VisitorAccessPageInstance): Promise<void> {
  initializeRuntimeState(page);
  const groupId = page.data.groupId;
  if (groupId.length === 0) {
    page.setData({ errorMessage: '当前群组信息缺失，请返回工作台后重试。', state: 'error' });
    return;
  }
  const requestSerial = page._requestSerial + 1;
  page._requestSerial = requestSerial;
  page._nextCursor = undefined;
  page.setData({
    aggregateCountLabel: '0 个月',
    aggregates: [],
    errorMessage: '',
    loadMoreError: '',
    loadingMore: false,
    logCountLabel: '0 条',
    logs: [],
    nextCursor: '',
    state: 'loading',
  });
  try {
    await requireClientCapability('insights');
    const [aggregatePage, logPage] = await Promise.all([
      page._visitorAccessReadClient.listAggregates(groupId, { pageSize: 12 }),
      page._visitorAccessReadClient.listLogs(groupId, { pageSize: 20 }),
    ]);
    if (requestSerial !== page._requestSerial) return;
    page._nextCursor = logPage.nextCursor;
    const aggregates = toAggregateCards(aggregatePage.aggregates);
    const logs = logPage.logs.map(toLogCard);
    page.setData({
      aggregateCountLabel: `${aggregates.length} 个月`,
      aggregates,
      logCountLabel: `${logs.length} 条`,
      logs,
      nextCursor: logPage.nextCursor ?? '',
      state: aggregates.length === 0 && logs.length === 0 ? 'empty' : 'ready',
    });
  } catch (error) {
    if (requestSerial !== page._requestSerial) return;
    if (error instanceof ClientCapabilityDisabledError) {
      page.setData({ state: 'disabled', errorMessage: error.message });
      return;
    }
    page.setData({
      errorMessage: toUserMessage(error, '访客访问暂时无法加载，请稍后重试。'),
      state: 'error',
    });
  }
}

function startLoad(page: VisitorAccessPageInstance): void {
  initializeRuntimeState(page);
  const groupId = page.properties.groupId;
  if (groupId.length === 0) {
    page.setData({ errorMessage: '当前群组信息缺失，请返回工作台后重试。', state: 'error' });
    return;
  }
  if (groupId === page._loadedGroupId) return;
  page._loadedGroupId = groupId;
  page.setData({ groupId });
  void loadVisitorAccess(page);
}

function initializeRuntimeState(page: VisitorAccessPageInstance): void {
  // Private fields in a Component definition are ignored by WeChat. Attach
  // the runtime client and initialize the request guards on the live object.
  page._visitorAccessReadClient = visitorAccessReadClient;
  if (typeof page._loadedGroupId !== 'string') page._loadedGroupId = '';
  if (!Number.isFinite(page._requestSerial)) page._requestSerial = 0;
}

async function loadMoreLogs(page: VisitorAccessPageInstance): Promise<void> {
  const cursor = page._nextCursor;
  if (cursor === undefined || page.data.loadingMore || page.data.groupId.length === 0) return;
  page.setData({ loadMoreError: '', loadingMore: true });
  try {
    await requireClientCapability('insights');
    const nextPage = await page._visitorAccessReadClient.listLogs(page.data.groupId, {
      cursor,
      pageSize: 20,
    });
    page._nextCursor = nextPage.nextCursor;
    const logs = [...page.data.logs, ...nextPage.logs.map(toLogCard)];
    page.setData({
      logCountLabel: `${logs.length} 条`,
      logs,
      nextCursor: nextPage.nextCursor ?? '',
      loadingMore: false,
    });
  } catch (error) {
    page.setData({
      loadMoreError: toUserMessage(error, '更多访问记录暂时无法加载，请重试。'),
      loadingMore: false,
    });
  }
}

function toAggregateCards(rows: readonly VisitorAccessAggregate[]): readonly AggregateCard[] {
  const maxCount = Math.max(...rows.map((row) => Number(row.accessCount)), 1);
  return rows
    .slice()
    .reverse()
    .map((row) => ({
      accessCountLabel: row.accessCount,
      accessMonth: row.accessMonth,
      accessMonthLabel: formatMonth(row.accessMonth),
      barHeight: Math.max(12, Math.round((Number(row.accessCount) / maxCount) * 100)),
    }));
}

function toLogCard(row: VisitorAccessLog): LogCard {
  return {
    businessMonthLabel: formatMonth(row.businessMonth),
    createdAtLabel: formatDateTime(row.createdAt),
    id: row.id,
    ipLabel: maskClientIp(row.clientIp),
    requestIdLabel: maskRequestId(row.requestId),
  };
}

function formatMonth(value: string): string {
  const match = /^(\d{4})-(\d{2})$/u.exec(value);
  return match === null ? value : `${match[1]} 年 ${Number(match[2])} 月`;
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return '访问时间未知';
  const pad = (part: number): string => String(part).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function maskClientIp(value: string | undefined): string {
  if (value === undefined || value.length === 0) return '来源已脱敏';
  const parts = value.split('.');
  if (parts.length === 4 && parts.every((part) => /^\d{1,3}$/u.test(part))) {
    return `${parts.slice(0, 3).join('.')}.*`;
  }
  return '来源已脱敏';
}

function maskRequestId(value: string | undefined): string {
  if (value === undefined || value.length === 0) return '请求标识已隐藏';
  if (value.length <= 10) return `请求 ${value.slice(0, 4)}…`;
  return `请求 ${value.slice(0, 6)}…${value.slice(-4)}`;
}

function toUserMessage(error: unknown, fallback: string): string {
  if (error instanceof ClientCoreError && error.message.length > 0) return error.message;
  return error instanceof Error && error.message.length > 0 ? error.message : fallback;
}
