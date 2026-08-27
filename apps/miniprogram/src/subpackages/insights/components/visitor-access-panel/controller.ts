import { ClientCoreError, type VisitorAccessReadClient } from '@schedule/client-core';
import type { VisitorAccessLog } from '@schedule/contracts';
import {
  buildVisitorAccessAggregateCards,
  formatVisitorAccessDateTime,
  formatVisitorAccessMonth,
  maskVisitorAccessIp,
  maskVisitorAccessRequestId,
  sumVisitorAccessCounts,
  type VisitorAccessAggregateCardLike,
} from '@schedule/presentation-core/visitor-access';
import {
  ClientCapabilityDisabledError,
  requireClientCapability,
} from '../../../../app/client-capability-store.js';
import { createRuntimeVisitorAccessReadClient } from '../../../../platform/client-core-calendar.js';
import {
  getStoredWechatToken,
  getWechatRequestAuthentication,
} from '../../../../platform/wechat-identity.js';
import { recordMiniTelemetryBoundary } from '../../../../platform/telemetry.js';

type VisitorAccessState = 'disabled' | 'empty' | 'error' | 'loading' | 'ready';

type AggregateCard = VisitorAccessAggregateCardLike;

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
  readonly largeText: boolean;
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
      aggregateCountLabel: '0 次',
      aggregates: [],
      errorMessage: '',
      groupId: '',
      largeText: false,
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
        recordMiniTelemetryBoundary('visitor-access:component-attached');
        const windowInfo = wx.getWindowInfo();
        const statusBarHeight = Math.max(0, windowInfo.statusBarHeight ?? 0);
        const headerHeight = statusBarHeight + 52;
        const fontSizeSetting = (windowInfo as unknown as { readonly fontSizeSetting?: number })
          .fontSizeSetting;
        this.setData({
          pageScrollStyle: `height:calc(100% - ${headerHeight}px);`,
          shellHeaderStyle: `height:${headerHeight}px;min-height:${headerHeight}px;padding-top:${statusBarHeight}px;`,
          largeText: (fontSizeSetting ?? 16) >= 20,
          viewportClass: windowInfo.windowWidth <= 340 ? 'is-compact' : '',
        });
        startLoad(this);
      },
      detached(this: VisitorAccessPageInstance): void {
        initializeRuntimeState(this);
        this._requestSerial += 1;
        this._nextCursor = undefined;
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
  const requestSerial = page._requestSerial + 1;
  page._requestSerial = requestSerial;
  const groupId = page.data.groupId;
  if (groupId.length === 0) {
    page.setData({ errorMessage: '当前群组信息缺失，请返回工作台后重试。', state: 'error' });
    return;
  }
  page._nextCursor = undefined;
  page.setData({
    aggregateCountLabel: '0 次',
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
      page._visitorAccessReadClient.listAggregates(groupId),
      page._visitorAccessReadClient.listLogs(groupId),
    ]);
    if (requestSerial !== page._requestSerial) return;
    page._nextCursor = logPage.nextCursor;
    const aggregates = buildVisitorAccessAggregateCards(aggregatePage.aggregates);
    const logs = logPage.logs.map(toLogCard);
    page.setData({
      aggregateCountLabel: sumVisitorAccessCounts(aggregatePage.aggregates),
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
    page._loadedGroupId = '';
    page._nextCursor = undefined;
    page._requestSerial += 1;
    page.setData({
      errorMessage: '当前群组信息缺失，请返回工作台后重试。',
      groupId: '',
      state: 'error',
    });
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
  const requestSerial = page._requestSerial;
  const groupId = page.data.groupId;
  page.setData({ loadMoreError: '', loadingMore: true });
  try {
    await requireClientCapability('insights');
    const nextPage = await page._visitorAccessReadClient.listLogs(groupId, { cursor });
    if (!isRequestCurrent(page, requestSerial, groupId)) return;
    page._nextCursor = nextPage.nextCursor;
    const logs = [...page.data.logs, ...nextPage.logs.map(toLogCard)];
    page.setData({
      logCountLabel: `${logs.length} 条`,
      logs,
      nextCursor: nextPage.nextCursor ?? '',
      loadingMore: false,
    });
  } catch (error) {
    if (!isRequestCurrent(page, requestSerial, groupId)) return;
    if (error instanceof ClientCapabilityDisabledError) {
      page._nextCursor = undefined;
      page.setData({
        aggregateCountLabel: '0 次',
        aggregates: [],
        errorMessage: error.message,
        loadMoreError: '',
        loadingMore: false,
        logCountLabel: '0 条',
        logs: [],
        nextCursor: '',
        state: 'disabled',
      });
      return;
    }
    page.setData({
      loadMoreError: toUserMessage(error, '更多访问记录暂时无法加载，请重试。'),
      loadingMore: false,
    });
  }
}

function toLogCard(row: VisitorAccessLog): LogCard {
  return {
    businessMonthLabel: formatVisitorAccessMonth(row.businessMonth),
    createdAtLabel: formatVisitorAccessDateTime(row.createdAt),
    id: row.id,
    ipLabel: maskVisitorAccessIp(row.clientIp),
    requestIdLabel: maskVisitorAccessRequestId(row.requestId),
  };
}

function isRequestCurrent(
  page: VisitorAccessPageInstance,
  requestSerial: number,
  groupId: string,
): boolean {
  return requestSerial === page._requestSerial && groupId === page.data.groupId;
}

function toUserMessage(error: unknown, fallback: string): string {
  if (error instanceof ClientCoreError && error.message.length > 0) return error.message;
  return error instanceof Error && error.message.length > 0 ? error.message : fallback;
}
