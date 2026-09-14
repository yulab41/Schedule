import {
  canUseDiagnostics,
  refreshDiagnosticsAccess,
  subscribeDiagnosticsPermission,
} from '../../../../platform/diagnostics-access.js';
import { buildInfo } from '../../../../platform/build-info.js';
import { recordRuntimeDiagnosticPerformance } from '../../../../platform/runtime-diagnostics-bridge.js';
import { RUNTIME_DIAGNOSTIC_COPY_MAX_BYTES } from '../../../../platform/runtime-diagnostics-limits.js';
import {
  armRuntimeDirectoryLaunchMarker,
  clearRuntimeDirectoryLaunchMarker,
  hasRuntimeDirectoryLaunchMarker,
} from '../../../../platform/runtime-diagnostics-launch.js';
import {
  clearRuntimeDirectorySearches,
  getRuntimeDiagnosticsSnapshot,
  startRuntimeDirectorySearchRecording,
  stopRuntimeDirectorySearchRecording,
  type RuntimeDiagnosticError,
  type RuntimeDiagnosticPerformance,
  type RuntimeDiagnosticRequest,
  type RuntimeDirectorySearchDiagnostic,
} from '../../../../platform/runtime-diagnostics.js';
import {
  formatMiniProgramEnvironment,
  isTestToolsRuntimeEnabled,
  readMiniProgramRuntimeIdentity,
} from '../../../../platform/runtime-environment.js';
import {
  wechatDiagnosticData,
  wechatDiagnosticMethods,
  clearWechatDiagnosticPage,
  prepareWechatDiagnosticPage,
  wechatDiagnosticReport,
} from './wechat-diagnostics.js';

type RowStatus = 'good' | 'notice' | 'unavailable';
type ScenarioResult = 'issue' | 'passed' | 'pending';

interface DiagnosticRow {
  readonly explanation: string;
  readonly label: string;
  readonly screenshot: string;
  readonly status: RowStatus;
  readonly statusLabel: string;
  readonly value: string;
}

interface DisplayCheck {
  readonly checked: boolean;
  readonly id: string;
  readonly impact: string;
  readonly label: string;
  readonly screenshot: string;
}

interface DiagnosticScenario {
  readonly action: 'gesture' | 'workspace';
  readonly actionLabel: string;
  readonly id: string;
  readonly normal: string;
  readonly observe: string;
  readonly path: string;
  readonly result: ScenarioResult;
  readonly resultLabel: string;
  readonly screenshot: string;
  readonly title: string;
}

interface RequestView extends RuntimeDiagnosticRequest {
  readonly key: string;
  readonly normalText: string;
  readonly outcomeLabel: string;
  readonly screenshot: string;
  readonly timeLabel: string;
}

interface ErrorView extends RuntimeDiagnosticError {
  readonly fingerprintLabel: string;
  readonly key: string;
  readonly normalText: string;
  readonly screenshot: string;
  readonly timeLabel: string;
}

interface PerformanceView extends RuntimeDiagnosticPerformance {
  readonly key: string;
  readonly metricLabel: string;
  readonly normalText: string;
  readonly screenshot: string;
  readonly timeLabel: string;
}

interface DirectorySearchView extends RuntimeDirectorySearchDiagnostic {
  readonly key: string;
  readonly modeLabel: string;
  readonly outcomeLabel: string;
  readonly searchTypeLabel: string;
}

interface TestToolsPageData extends Readonly<typeof wechatDiagnosticData> {
  readonly authorized: boolean;
  readonly buildRows: readonly DiagnosticRow[];
  readonly checkSummary: string;
  readonly deviceRows: readonly DiagnosticRow[];
  readonly directoryRecording: boolean;
  readonly directorySearchRows: readonly DirectorySearchView[];
  readonly displayChecks: readonly DisplayCheck[];
  readonly environmentLabel: string;
  readonly errorRows: readonly ErrorView[];
  readonly generatedAt: string;
  readonly networkType: string;
  readonly nextLaunchDirectoryDiagnosticArmed: boolean;
  readonly pageReadyMs: number;
  readonly exportBoundaryRows: readonly PerformanceView[];
  readonly performanceRows: readonly PerformanceView[];
  readonly requestRows: readonly RequestView[];
  readonly runtimeProbeRows: readonly DiagnosticRow[];
  readonly runtimeProbeSummary: string;
  readonly runtimeProbeTone: RowStatus;
  readonly scenarios: readonly DiagnosticScenario[];
  readonly storageRows: readonly DiagnosticRow[];
}

interface TestToolsPageInstance {
  _active: boolean;
  _live: boolean;
  _ready: boolean;
  _accessSerial: number;
  _probeSerial: number;
  _runtimeTokenWidth: number | undefined;
  _unsubscribe?: () => void;
  _loadStartedAt: number;
  readonly data: TestToolsPageData;
  setData(patch: Partial<TestToolsPageData>, callback?: () => void): void;
}

interface CheckboxChangeEvent {
  readonly currentTarget: { readonly dataset: { readonly checkId?: string } };
  readonly detail: { readonly checked?: boolean };
}

interface ScenarioResultEvent {
  readonly currentTarget: {
    readonly dataset: { readonly result?: ScenarioResult; readonly scenarioId?: string };
  };
}

interface RuntimeTokenMeasureEvent {
  readonly detail?: { readonly width?: unknown };
}

interface RuntimeProbeRect {
  readonly bottom?: number;
  readonly height?: number;
  readonly left?: number;
  readonly right?: number;
  readonly top?: number;
  readonly width?: number;
}

interface RuntimeSelectorQuery {
  exec(callback?: () => void): void;
  select(selector: string): {
    boundingClientRect(
      callback: (rect: RuntimeProbeRect | undefined) => void,
    ): RuntimeSelectorQuery;
  };
  selectAll(selector: string): {
    boundingClientRect(
      callback: (rects: readonly RuntimeProbeRect[] | undefined) => void,
    ): RuntimeSelectorQuery;
  };
}

interface RuntimeProbeSnapshot {
  readonly contentRect: RuntimeProbeRect | undefined;
  readonly gridRects: readonly RuntimeProbeRect[] | undefined;
  readonly scrollRect: RuntimeProbeRect | undefined;
  readonly tokenWidth: number | undefined;
}

interface RuntimeSystemApi {
  readonly createSelectorQuery?: () => RuntimeSelectorQuery;
  readonly getAppBaseInfo?: () => {
    readonly SDKVersion?: unknown;
    readonly fontSizeSetting?: unknown;
    readonly language?: unknown;
    readonly theme?: unknown;
    readonly version?: unknown;
  };
  readonly getDeviceInfo?: () => {
    readonly benchmarkLevel?: unknown;
    readonly brand?: unknown;
    readonly model?: unknown;
    readonly platform?: unknown;
    readonly system?: unknown;
  };
  readonly getMenuButtonBoundingClientRect?: () => {
    readonly bottom?: unknown;
    readonly height?: unknown;
    readonly left?: unknown;
    readonly right?: unknown;
    readonly top?: unknown;
    readonly width?: unknown;
  };
  readonly getNetworkType?: (options: {
    readonly fail: () => void;
    readonly success: (result: { readonly networkType?: unknown }) => void;
  }) => unknown;
  readonly getStorageInfoSync?: () => {
    readonly currentSize?: unknown;
    readonly keys?: unknown;
    readonly limitSize?: unknown;
  };
  readonly getSystemSetting?: () => { readonly deviceOrientation?: unknown };
  readonly getWindowInfo?: () => {
    readonly pixelRatio?: unknown;
    readonly safeArea?: {
      readonly bottom?: unknown;
      readonly left?: unknown;
      readonly right?: unknown;
      readonly top?: unknown;
    };
    readonly screenHeight?: unknown;
    readonly screenWidth?: unknown;
    readonly statusBarHeight?: unknown;
    readonly windowHeight?: unknown;
    readonly windowWidth?: unknown;
  };
}

const currentPagePath = 'subpackages/diagnostics/pages/test-tools/index';
const displayCheckDefaults: readonly DisplayCheck[] = [
  check(
    'top-navigation',
    '顶部导航或胶囊遮挡',
    '可能挡住返回按钮或页面标题。',
    '截顶部标题、状态栏和胶囊。',
  ),
  check(
    'bottom-safe-area',
    '底部安全区异常',
    '底部按钮可能贴边或被系统手势区遮住。',
    '截页面最底部和系统手势区。',
  ),
  check(
    'wrap-overflow',
    '意外换行、截断或横向溢出',
    '文字可能看不全，页面也可能左右晃动。',
    '截出现截断的整行和屏幕左右边缘。',
  ),
  check(
    'button-layout',
    '按钮错位或点击反馈缺失',
    '用户可能无法确认是否点到了操作。',
    '截按钮按下前后，必要时录屏。',
  ),
  check(
    'scroll-sheet',
    '滚动、弹窗或 fixed 元素漂移',
    '长页面、弹窗或固定区域可能无法正常使用。',
    '截异常区域并录制一次滚动。',
  ),
  check(
    'image-keyboard',
    '图片拉伸或键盘遮挡',
    '图片比例或输入区域可能影响阅读和保存。',
    '截完整图片，或键盘弹出后的输入区域。',
  ),
  check(
    'return-state',
    '返回状态丢失或切换卡顿',
    '返回后可能回到错误页面、白屏或闪烁。',
    '录制进入、返回和底部导航切换。',
  ),
  check(
    'gesture-wheel',
    '手势、滚轮或原生组件异常',
    '排班矩阵、年月滚轮等交互可能不跟手。',
    '打开交互探针并截图运行信息，异常时录屏。',
  ),
];

const scenarioDefaults: readonly DiagnosticScenario[] = [
  scenario(
    'calendar',
    '首页与日历',
    '工作台 → 日历',
    '首次显示、月/周/列表切换、日期详情、loading/空态/错误态。',
    '首屏不白屏，切换后内容与选中日期一致。',
    '截完整日历和异常状态。',
  ),
  scenario(
    'directory',
    '通讯录长列表与筛选',
    '工作台 → 通讯录',
    '搜索、筛选、加载更多、空结果、失败重试和返回后的滚动位置。',
    '筛选项可读，列表不重复、不闪回旧数据。',
    '截搜索栏、筛选弹层和异常列表。',
  ),
  scenario(
    'workflow',
    '请假、换班与加扣班',
    '工作台 → 换班；更多 → 请假/加扣班',
    '列表、详情、新建、编辑、确认弹层、重复点击和失败提示。',
    '按钮一次生效，loading 能结束，错误后可以继续操作。',
    '截表单、确认弹层和结果提示。',
  ),
  scenario(
    'organization',
    '群组与排班配置',
    '更多 → 群组管理/排班配置/手动排班',
    '长列表、底部面板、输入框与键盘、安全区和保存返回。',
    '权限正确，键盘不遮挡，保存后状态一致。',
    '截标题、表单底部和键盘弹出状态。',
  ),
  scenario(
    'profile-notification',
    '我的、通知与导出',
    '工作台 → 我的；更多 → 通知中心/导出排班',
    '头像、个人资料、通知 loading/empty/error、文件操作和返回状态。',
    '内容完整且不显示不属于当前账号的数据。',
    '截完整卡片和异常提示，不截真实隐私内容。',
  ),
  scenario(
    'gesture',
    '交互检查：旧手势探针',
    '测试工具 → 打开交互探针',
    '五入口压力切换、WXS 年月滚轮、蓝/黄点和普通触摸计数。',
    '滚轮吸附一次且可反向接管，拖动跟手，切换不白屏。',
    '先截探针顶部运行信息；异常时录制对应区域。',
    'gesture',
    '打开交互探针',
  ),
];

Page({
  ...wechatDiagnosticMethods,
  data: {
    ...wechatDiagnosticData,
    authorized: false,
    buildRows: [],
    checkSummary: '尚未检查',
    deviceRows: [],
    directoryRecording: false,
    directorySearchRows: [],
    displayChecks: displayCheckDefaults,
    environmentLabel: '正在确认环境',
    errorRows: [],
    generatedAt: formatTimestamp(Date.now()),
    networkType: '读取中',
    nextLaunchDirectoryDiagnosticArmed: false,
    pageReadyMs: 0,
    exportBoundaryRows: [],
    performanceRows: [],
    requestRows: [],
    runtimeProbeRows: createPendingRuntimeProbeRows(),
    runtimeProbeSummary: '等待自动测量',
    runtimeProbeTone: 'unavailable',
    scenarios: scenarioDefaults,
    storageRows: [],
  },

  onLoad(this: TestToolsPageInstance): void {
    this._loadStartedAt = Date.now();
    this._accessSerial = 0;
    this._probeSerial = 0;
    this._ready = false;
    this._runtimeTokenWidth = undefined;
    this._live = true;
    this._active = false;
    this._unsubscribe = subscribeDiagnosticsPermission((allowed) => {
      if (!allowed) {
        this._accessSerial += 1;
        clearTestToolsPage(this);
      }
    });
    void authorizeTestToolsPage(this);
  },

  onReady(this: TestToolsPageInstance): void {
    this._ready = true;
    if (!this._active || !canUseDiagnostics()) return;
    const pageReadyMs = Date.now() - this._loadStartedAt;
    recordRuntimeDiagnosticPerformance({
      durationMs: pageReadyMs,
      metric: 'page-ready',
      page: 'test-tools',
      recordedAt: Date.now(),
    });
    this.setData({ pageReadyMs }, () => runRuntimeCompatibilityProbe(this));
    refreshRuntimeDiagnostics(this);
  },

  onShow(this: TestToolsPageInstance): void {
    this._live = true;
    void authorizeTestToolsPage(this);
  },

  onHide(this: TestToolsPageInstance): void {
    this._live = false;
    this._accessSerial += 1;
    this._probeSerial += 1;
    clearTestToolsPage(this);
  },

  onUnload(this: TestToolsPageInstance): void {
    this._live = false;
    this._accessSerial += 1;
    this._probeSerial += 1;
    this._unsubscribe?.();
    clearTestToolsPage(this);
  },

  handleBack(): void {
    wx.navigateBack();
  },

  handleRefresh(this: TestToolsPageInstance): void {
    if (!this._active || !canUseDiagnostics()) return;
    this.setData({
      generatedAt: formatTimestamp(Date.now()),
      nextLaunchDirectoryDiagnosticArmed: hasRuntimeDirectoryLaunchMarker(),
      storageRows: createStorageRows(wx as unknown as RuntimeSystemApi),
    });
    refreshRuntimeDiagnostics(this);
    runRuntimeCompatibilityProbe(this);
    const serial = this._accessSerial;
    void collectDeviceRows(wx as unknown as RuntimeSystemApi).then(({ networkType, rows }) => {
      if (!this._active || serial !== this._accessSerial || !canUseDiagnostics()) return;
      this.setData({ deviceRows: rows, networkType });
    });
  },

  handleCheckChange(this: TestToolsPageInstance, event: CheckboxChangeEvent): void {
    if (!this._active || !canUseDiagnostics()) return;
    const checkId = event.currentTarget.dataset.checkId;
    if (typeof checkId !== 'string') return;
    const checked = event.detail.checked === true;
    const displayChecks = this.data.displayChecks.map((item) =>
      item.id === checkId ? { ...item, checked } : item,
    );
    this.setData({
      checkSummary: checked || displayChecks.some((item) => item.checked) ? '发现异常' : '尚未检查',
      displayChecks,
    });
  },

  handleAllNormal(this: TestToolsPageInstance): void {
    if (!this._active || !canUseDiagnostics()) return;
    this.setData({
      checkSummary: '全部正常',
      displayChecks: this.data.displayChecks.map((item) => ({ ...item, checked: false })),
    });
  },

  handleIssueMode(this: TestToolsPageInstance): void {
    if (!this._active || !canUseDiagnostics()) return;
    this.setData({ checkSummary: '发现异常，请勾选具体项目' });
  },

  handleScenarioResult(this: TestToolsPageInstance, event: ScenarioResultEvent): void {
    if (!this._active || !canUseDiagnostics()) return;
    const scenarioId = event.currentTarget.dataset.scenarioId;
    const result = event.currentTarget.dataset.result;
    if (typeof scenarioId !== 'string' || (result !== 'passed' && result !== 'issue')) return;
    this.setData({
      scenarios: this.data.scenarios.map((item) =>
        item.id === scenarioId
          ? { ...item, result, resultLabel: result === 'passed' ? '正常' : '发现异常' }
          : item,
      ),
    });
  },

  handleRuntimeTokenMeasure(this: TestToolsPageInstance, event: RuntimeTokenMeasureEvent): void {
    const width = event.detail?.width;
    this._runtimeTokenWidth =
      typeof width === 'number' && Number.isFinite(width)
        ? Math.round(width * 100) / 100
        : undefined;
    if (this._ready && this._active && canUseDiagnostics()) {
      runRuntimeCompatibilityProbe(this);
    }
  },

  handleOpenWorkspace(): void {
    wx.reLaunch({ url: '/pages/workbench/index' });
  },

  handleOpenExportColdEntry(this: TestToolsPageInstance): void {
    if (!this._active || !canUseDiagnostics()) return;
    wx.navigateTo({ url: '/subpackages/insights/pages/exports/index' });
  },

  handleOpenGestureProbe(this: TestToolsPageInstance): void {
    if (!this._active || !canUseDiagnostics()) return;
    wx.navigateTo({ url: '/pages/gesture-probe/index' });
  },

  handleStartDirectoryRecording(this: TestToolsPageInstance): void {
    if (!this._active || !canUseDiagnostics()) return;
    if (!startRuntimeDirectorySearchRecording()) {
      wx.showToast?.({ icon: 'none', title: '当前环境无法开始记录' });
      return;
    }
    refreshRuntimeDiagnostics(this);
    wx.showToast?.({ icon: 'success', title: '已开始记录通讯录搜索' });
  },

  handleArmNextLaunchDirectoryRecording(this: TestToolsPageInstance): void {
    if (!this._active || !canUseDiagnostics()) return;
    const armed = armRuntimeDirectoryLaunchMarker();
    this.setData({ nextLaunchDirectoryDiagnosticArmed: armed });
    wx.showToast?.({
      icon: armed ? 'success' : 'none',
      title: armed ? '下次 App 启动诊断已开启' : '无法保存一次性标记',
    });
  },

  handleCancelNextLaunchDirectoryRecording(this: TestToolsPageInstance): void {
    if (!this._active || !canUseDiagnostics()) return;
    clearRuntimeDirectoryLaunchMarker();
    this.setData({ nextLaunchDirectoryDiagnosticArmed: false });
    wx.showToast?.({ icon: 'success', title: '下次启动诊断已取消' });
  },

  handleStopDirectoryRecording(this: TestToolsPageInstance): void {
    if (!this._active || !canUseDiagnostics()) return;
    stopRuntimeDirectorySearchRecording();
    refreshRuntimeDiagnostics(this);
    wx.showToast?.({ icon: 'success', title: '已停止记录' });
  },

  handleClearDirectoryRecords(this: TestToolsPageInstance): void {
    if (!this._active || !canUseDiagnostics()) return;
    clearRuntimeDirectorySearches();
    refreshRuntimeDiagnostics(this);
    wx.showToast?.({ icon: 'success', title: '通讯录记录已清空' });
  },

  handleCopyLatestDirectorySearch(this: TestToolsPageInstance): void {
    if (!this._active || !canUseDiagnostics()) return;
    const latest = this.data.directorySearchRows.slice(0, 1);
    if (latest.length === 0) {
      wx.showToast?.({ icon: 'none', title: '暂时没有搜索记录' });
      return;
    }
    copyText(createDirectorySearchReport(latest), '最近一次已复制');
  },

  handleCopyRecentDirectorySearches(this: TestToolsPageInstance): void {
    if (!this._active || !canUseDiagnostics()) return;
    const recent = this.data.directorySearchRows.slice(0, 10);
    if (recent.length === 0) {
      wx.showToast?.({ icon: 'none', title: '暂时没有搜索记录' });
      return;
    }
    copyText(createDirectorySearchReport(recent), '最近 10 次已复制');
  },

  handleCopyChecks(this: TestToolsPageInstance): void {
    if (!this._active || !canUseDiagnostics()) return;
    copyText(createCheckReport(this.data), '检查结果已复制');
  },

  handleCopyRuntimeReport(this: TestToolsPageInstance): void {
    if (!this._active || !canUseDiagnostics()) return;
    copyText(createRuntimeCompatibilityReport(this.data), '首屏诊断已复制');
  },

  handleCopyFullReport(this: TestToolsPageInstance): void {
    if (!this._active || !canUseDiagnostics()) return;
    copyText(
      createDiagnosticReport(this.data, false) + '\n' + wechatDiagnosticReport(this),
      '完整诊断报告已复制',
    );
  },

  handleCopyCodexReport(this: TestToolsPageInstance): void {
    if (!this._active || !canUseDiagnostics()) return;
    copyText(
      createDiagnosticReport(this.data, true) + '\n' + wechatDiagnosticReport(this),
      'Codex 简化报告已复制',
    );
  },
} as never);

async function authorizeTestToolsPage(page: TestToolsPageInstance): Promise<void> {
  const serial = ++page._accessSerial;
  clearTestToolsPage(page);
  const allowed = isTestToolsRuntimeEnabled() && (await refreshDiagnosticsAccess());
  if (!page._live || serial !== page._accessSerial) return;
  if (!allowed || !canUseDiagnostics()) {
    wx.showToast?.({ icon: 'none', title: '当前账号不能使用测试工具' });
    wx.redirectTo({ url: '/pages/workbench/index' });
    return;
  }
  page._active = true;
  page.setData({ authorized: true }, () => {
    if (page._ready) runRuntimeCompatibilityProbe(page);
  });
  void prepareWechatDiagnosticPage(page);
  loadAuthorizedTestTools(page);
}

function clearTestToolsPage(page: TestToolsPageInstance): void {
  clearWechatDiagnosticPage(page);
  page._active = false;
  page._probeSerial += 1;
  page._runtimeTokenWidth = undefined;
  stopRuntimeDirectorySearchRecording();
  page.setData({
    authorized: false,
    buildRows: [],
    deviceRows: [],
    storageRows: [],
    requestRows: [],
    runtimeProbeRows: createPendingRuntimeProbeRows(),
    runtimeProbeSummary: '等待自动测量',
    runtimeProbeTone: 'unavailable',
    errorRows: [],
    performanceRows: [],
    directorySearchRows: [],
    directoryRecording: false,
    nextLaunchDirectoryDiagnosticArmed: false,
    displayChecks: displayCheckDefaults,
    scenarios: scenarioDefaults,
    checkSummary: '尚未检查',
    environmentLabel: '正在确认身份',
    networkType: '未读取',
    pageReadyMs: 0,
  });
}

function loadAuthorizedTestTools(page: TestToolsPageInstance): void {
  const serial = page._accessSerial;
  const identity = readMiniProgramRuntimeIdentity();
  page.setData({
    buildRows: createBuildRows(identity.version),
    environmentLabel: formatMiniProgramEnvironment(identity.envVersion),
    nextLaunchDirectoryDiagnosticArmed: hasRuntimeDirectoryLaunchMarker(),
    storageRows: createStorageRows(wx as unknown as RuntimeSystemApi),
  });
  void collectDeviceRows(wx as unknown as RuntimeSystemApi).then(({ networkType, rows }) => {
    if (!page._active || serial !== page._accessSerial || !canUseDiagnostics()) return;
    page.setData({ deviceRows: rows, networkType });
  });
  refreshRuntimeDiagnostics(page);
}

function createPendingRuntimeProbeRows(): readonly DiagnosticRow[] {
  return [
    row(
      'Grid 双列',
      '等待页面测量',
      '判断两列布局是否退化为纵排。',
      '截首屏兼容性卡。',
      'unavailable',
    ),
    row(
      'CSS 变量继承',
      '等待组件测量',
      '判断页面令牌能否进入隔离自定义组件。',
      '截首屏兼容性卡。',
      'unavailable',
    ),
    row(
      '纵向滚动容器',
      '等待页面测量',
      '判断显式 scroll-view 是否获得有效尺寸。',
      '截首屏兼容性卡。',
      'unavailable',
    ),
  ];
}

function runRuntimeCompatibilityProbe(page: TestToolsPageInstance): void {
  if (!page._active || !page._ready || !canUseDiagnostics()) return;
  const serial = ++page._probeSerial;
  page.setData({
    runtimeProbeRows: createPendingRuntimeProbeRows(),
    runtimeProbeSummary: '正在自动测量',
    runtimeProbeTone: 'unavailable',
  });
  void collectRuntimeProbe(wx as unknown as RuntimeSystemApi, page._runtimeTokenWidth).then(
    (snapshot) => {
      if (!page._active || !page._live || serial !== page._probeSerial || !canUseDiagnostics()) {
        return;
      }
      const runtimeProbeRows = createRuntimeProbeRows(snapshot);
      const runtimeProbeTone: RowStatus = runtimeProbeRows.some((item) => item.status === 'notice')
        ? 'notice'
        : runtimeProbeRows.some((item) => item.status === 'unavailable')
          ? 'unavailable'
          : 'good';
      page.setData({
        runtimeProbeRows,
        runtimeProbeSummary:
          runtimeProbeTone === 'good'
            ? '自动测量正常'
            : runtimeProbeTone === 'notice'
              ? '发现兼容性差异'
              : '部分暂未验证',
        runtimeProbeTone,
      });
    },
  );
}

function collectRuntimeProbe(
  runtime: RuntimeSystemApi,
  tokenWidth: number | undefined,
): Promise<RuntimeProbeSnapshot> {
  return new Promise((resolve) => {
    let settled = false;
    let gridRects: readonly RuntimeProbeRect[] | undefined;
    let scrollRect: RuntimeProbeRect | undefined;
    let contentRect: RuntimeProbeRect | undefined;
    const finish = (): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ contentRect, gridRects, scrollRect, tokenWidth });
    };
    const timer = setTimeout(finish, 500);
    try {
      const query = runtime.createSelectorQuery?.();
      if (query === undefined) {
        finish();
        return;
      }
      query.selectAll('.runtime-grid-probe__cell').boundingClientRect((rects) => {
        gridRects = rects;
      });
      query.select('.test-tools-scroll').boundingClientRect((rect) => {
        scrollRect = rect;
      });
      query.select('.test-tools-scroll-content').boundingClientRect((rect) => {
        contentRect = rect;
      });
      query.exec(finish);
    } catch {
      finish();
    }
  });
}

function createRuntimeProbeRows(snapshot: RuntimeProbeSnapshot): readonly DiagnosticRow[] {
  return [
    createGridProbeRow(snapshot.gridRects),
    createTokenProbeRow(snapshot.tokenWidth),
    createScrollProbeRow(snapshot),
  ];
}

function createGridProbeRow(rects: readonly RuntimeProbeRect[] | undefined): DiagnosticRow {
  const first = rects?.[0];
  const second = rects?.[1];
  if (!hasFiniteRect(first) || !hasFiniteRect(second)) {
    return row(
      'Grid 双列',
      '未取得两个探针矩形',
      '当前工具无法测量，不能据此判断 Grid。',
      '截首屏兼容性卡。',
      'unavailable',
    );
  }
  const topDelta = Math.abs(first.top - second.top);
  const horizontal = topDelta <= 1 && second.left >= first.right - 1;
  return row(
    'Grid 双列',
    horizontal
      ? `同行双列（顶部差 ${roundProbe(topDelta)}px）`
      : `已退化（顶部差 ${roundProbe(topDelta)}px）`,
    horizontal ? '受控 Grid 当前按两列呈现。' : '受控 Grid 未按两列呈现，符合业务按钮纵排现象。',
    '异常时截本行和业务页面。',
    horizontal ? 'good' : 'notice',
  );
}

function createTokenProbeRow(width: number | undefined): DiagnosticRow {
  if (typeof width !== 'number' || !Number.isFinite(width)) {
    return row(
      'CSS 变量继承',
      '隔离组件未返回宽度',
      '当前工具无法测量，不能据此判断 CSS 变量。',
      '截首屏兼容性卡。',
      'unavailable',
    );
  }
  const inherited = Math.abs(width - 44) <= 1;
  return row(
    'CSS 变量继承',
    `${roundProbe(width)}px（预期 44px）`,
    inherited ? '页面设计令牌已进入隔离组件。' : '隔离组件使用了回退宽度或错误宽度。',
    '异常时截本行和加载圈。',
    inherited ? 'good' : 'notice',
  );
}

function createScrollProbeRow(snapshot: RuntimeProbeSnapshot): DiagnosticRow {
  const viewport = snapshot.scrollRect;
  const content = snapshot.contentRect;
  if (!hasPositiveSize(viewport) || !hasPositiveSize(content)) {
    return row(
      '纵向滚动容器',
      '未取得有效尺寸',
      '显式 scroll-view 或内容尺寸不可测量。',
      '截首屏和无法滚动的位置。',
      viewport === undefined && content === undefined ? 'unavailable' : 'notice',
    );
  }
  const scrollable = content.height > viewport.height + 1;
  return row(
    '纵向滚动容器',
    `${roundProbe(viewport.height)}px / 内容 ${roundProbe(content.height)}px`,
    scrollable ? '显式 scroll-view 已形成可滚动区域。' : '内容没有超过 viewport，暂时不需要滚动。',
    '若仍不能下滑，截本行。',
    'good',
  );
}

function hasFiniteRect(
  rect: RuntimeProbeRect | undefined,
): rect is Required<Pick<RuntimeProbeRect, 'left' | 'right' | 'top'>> & RuntimeProbeRect {
  return (
    typeof rect?.left === 'number' &&
    Number.isFinite(rect.left) &&
    typeof rect.right === 'number' &&
    Number.isFinite(rect.right) &&
    typeof rect.top === 'number' &&
    Number.isFinite(rect.top)
  );
}

function hasPositiveSize(
  rect: RuntimeProbeRect | undefined,
): rect is Required<Pick<RuntimeProbeRect, 'height' | 'width'>> & RuntimeProbeRect {
  return (
    typeof rect?.width === 'number' &&
    Number.isFinite(rect.width) &&
    rect.width > 0 &&
    typeof rect.height === 'number' &&
    Number.isFinite(rect.height) &&
    rect.height > 0
  );
}

function roundProbe(value: number): number {
  return Math.round(value * 100) / 100;
}

function createBuildRows(miniProgramVersion: string): readonly DiagnosticRow[] {
  return [
    row(
      '构建版本',
      buildInfo.buildLabel,
      '用于确认截图和代码是否来自同一版本。',
      '截顶部构建校准条。',
    ),
    row(
      '小程序版本号',
      miniProgramVersion,
      '由微信运行环境提供；未提供时不影响页面使用。',
      '与环境标签一起截图。',
      miniProgramVersion === '未提供' ? 'unavailable' : 'good',
    ),
    row(
      'Git 短 SHA',
      buildInfo.buildCommit,
      '代码身份证；不同 SHA 的截图不能用于本轮判断。',
      '截本卡片。',
    ),
    row(
      '构建时间',
      buildInfo.buildTime,
      '帮助排除旧缓存或旧体验版。',
      '截本卡片。',
      buildInfo.buildTime === '未提供' ? 'unavailable' : 'good',
    ),
    row(
      '版本描述',
      buildInfo.buildDescription,
      '只保留安全构建描述；不安全文字会在构建时整体脱敏。',
      '截本卡片。',
    ),
    row(
      '脏工作树构建',
      buildInfo.buildDirty ? '是' : '否',
      '“是”表示构建时含未提交文件，需要额外核对来源。',
      '截本卡片。',
      buildInfo.buildDirty ? 'notice' : 'good',
    ),
    row(
      'API 环境',
      buildInfo.apiEnvironment,
      '决定连接测试还是正式 API；页面不显示完整地址。',
      '截本卡片。',
    ),
    row(
      '云环境',
      buildInfo.cloudEnvironment,
      '本项目使用自建 API，不读取 CloudBase 标识。',
      '无需单独截图。',
    ),
    row(
      'npm 构建产物',
      buildInfo.npmBuildArtifact,
      '本项目没有独立 miniprogram_npm 产物时间。',
      '无需单独截图。',
      'unavailable',
    ),
  ];
}

async function collectDeviceRows(
  runtime: RuntimeSystemApi,
): Promise<{ readonly networkType: string; readonly rows: readonly DiagnosticRow[] }> {
  const app = safeCall(runtime.getAppBaseInfo);
  const device = safeCall(runtime.getDeviceInfo);
  const windowInfo = safeCall(runtime.getWindowInfo);
  const menu = safeCall(runtime.getMenuButtonBoundingClientRect);
  const setting = safeCall(runtime.getSystemSetting);
  const networkType = await readNetworkType(runtime);
  const safeArea = isRecord(windowInfo?.safeArea) ? windowInfo.safeArea : undefined;
  const deviceName = joinKnown([textValue(device?.brand), textValue(device?.model)]);
  return {
    networkType,
    rows: [
      row(
        '设备品牌与型号',
        deviceName,
        '用于判断问题是否只出现在某类手机。',
        '截“手机与微信环境”整张卡片。',
        availability(deviceName),
      ),
      row(
        '系统',
        textValue(device?.system),
        'Android 版本差异可能影响字体、键盘和安全区。',
        '截本卡片。',
        availability(textValue(device?.system)),
      ),
      row(
        '微信版本',
        textValue(app?.version),
        '微信版本不同可能带来渲染差异。',
        '截本卡片。',
        availability(textValue(app?.version)),
      ),
      row(
        '基础库版本',
        textValue(app?.SDKVersion),
        '基础库决定可用 API 和 Skyline 行为。',
        '截本卡片。',
        availability(textValue(app?.SDKVersion)),
      ),
      row(
        'renderer',
        buildInfo.renderer,
        '当前项目固定使用 Skyline；模拟器结果不能代替手机。',
        '截本卡片。',
      ),
      row(
        'Skyline 支持',
        '当前页面已按 Skyline 构建',
        '能打开本页说明当前渲染链路已工作，但不代表所有交互已验收。',
        '截本卡片。',
      ),
      row(
        'Skyline 版本',
        '当前微信版本不支持单独读取',
        '没有可靠 API 时不猜测 Skyline 版本。',
        '无需单独截图。',
        'unavailable',
      ),
      row(
        '屏幕',
        sizeValue(windowInfo?.screenWidth, windowInfo?.screenHeight),
        '用于判断屏幕比例和 rpx 换算。',
        '截本卡片。',
        availability(sizeValue(windowInfo?.screenWidth, windowInfo?.screenHeight)),
      ),
      row(
        '窗口',
        sizeValue(windowInfo?.windowWidth, windowInfo?.windowHeight),
        '窗口高度会影响长页、弹窗和键盘遮挡。',
        '截本卡片。',
        availability(sizeValue(windowInfo?.windowWidth, windowInfo?.windowHeight)),
      ),
      row(
        'pixelRatio',
        numberValue(windowInfo?.pixelRatio),
        '像素比例可能影响细线和小图标清晰度。',
        '截本卡片。',
        availability(numberValue(windowInfo?.pixelRatio)),
      ),
      row(
        '状态栏 / 胶囊',
        `${numberValue(windowInfo?.statusBarHeight)} / ${rectValue(menu)}`,
        '用于排查顶部标题或返回按钮被遮挡。',
        '必须截顶部状态栏、胶囊和页面标题。',
        availability(numberValue(windowInfo?.statusBarHeight)),
      ),
      row(
        '安全区域',
        safeAreaValue(safeArea),
        '安全区域异常可能遮挡顶部或底部按钮。',
        '截页面顶部和最底部。',
        availability(safeAreaValue(safeArea)),
      ),
      row(
        '字体设置',
        numberValue(app?.fontSizeSetting),
        '大字号可能造成换行或按钮高度变化。',
        '如使用非默认字号，截发生换行的位置。',
        availability(numberValue(app?.fontSizeSetting)),
      ),
      row(
        '浅色 / 深色',
        textValue(app?.theme),
        '主题差异可能影响文字和背景对比度。',
        '截文字看不清的完整卡片。',
        availability(textValue(app?.theme)),
      ),
      row(
        '方向',
        textValue(setting?.deviceOrientation),
        '横竖屏变化可能影响固定布局。',
        '异常时截完整屏幕。',
        availability(textValue(setting?.deviceOrientation)),
      ),
      row(
        '网络',
        networkType,
        '无网或弱网会影响加载、重试和错误提示。',
        '异常时截网络卡片与页面错误提示。',
        networkType === '未知' ? 'unavailable' : networkType === 'none' ? 'notice' : 'good',
      ),
    ],
  };
}

function createStorageRows(runtime: RuntimeSystemApi): readonly DiagnosticRow[] {
  const info = safeCall(runtime.getStorageInfoSync);
  const keys = Array.isArray(info?.keys)
    ? info.keys.filter((key): key is string => typeof key === 'string')
    : [];
  const oldCount = keys.filter((key) => key.includes('.v1:')).length;
  const currentCount = keys.filter((key) => key.includes('.v2:')).length;
  return [
    row(
      '缓存项数量',
      String(keys.length),
      '只统计数量，不显示可能含用户标识的键名。',
      '截“缓存和存储摘要”卡片。',
    ),
    row(
      '当前占用 / 上限',
      `${numberValue(info?.currentSize)} KB / ${numberValue(info?.limitSize)} KB`,
      '接近上限时可能无法继续写入缓存。',
      '截本卡片。',
      typeof info?.currentSize === 'number' ? 'good' : 'unavailable',
    ),
    row(
      '结构版本摘要',
      `v2 ${currentCount} 项；旧 v1 ${oldCount} 项`,
      '旧结构只计数，不读取内容，也不会自动删除。',
      '旧 v1 大于 0 时截本行。',
      oldCount > 0 ? 'notice' : 'good',
    ),
    row(
      '缓存命中',
      '当前未接入统一统计',
      '没有可靠数据时不猜测命中率。',
      '无需截图。',
      'unavailable',
    ),
    row(
      '解析失败',
      '当前未接入统一统计',
      '页面不会为诊断目的重新读取或解析业务缓存。',
      '业务页出现错误时截错误提示。',
      'unavailable',
    ),
    row('清理能力', '未提供“一键清空”', '避免误删登录态或正式业务缓存。', '无需截图。'),
  ];
}

function refreshRuntimeDiagnostics(page: TestToolsPageInstance): void {
  const snapshot = getRuntimeDiagnosticsSnapshot();
  page.setData({
    directoryRecording: snapshot.directorySearchRecording,
    directorySearchRows: [...snapshot.directorySearches].reverse().map(toDirectorySearchView),
    errorRows: [...snapshot.errors].reverse().map(toErrorView),
    exportBoundaryRows: [...snapshot.performance]
      .filter((entry) => entry.page === 'exports' && isExportStartupStage(entry.metric))
      .map(toPerformanceView),
    generatedAt: formatTimestamp(Date.now()),
    performanceRows: [...snapshot.performance].reverse().map(toPerformanceView),
    requestRows: [...snapshot.requests].reverse().map(toRequestView),
  });
}

function toDirectorySearchView(
  entry: RuntimeDirectorySearchDiagnostic,
  index: number,
): DirectorySearchView {
  return {
    ...entry,
    key: `${entry.diagnosticId}-${index}`,
    modeLabel: entry.directoryKind === 'employee' ? '人员' : '科室',
    outcomeLabel:
      entry.outcome === 'success'
        ? '完成'
        : entry.outcome === 'superseded'
          ? '已被新搜索替代'
          : '失败',
    searchTypeLabel: searchTypeLabel(entry.searchType),
  };
}

function toRequestView(entry: RuntimeDiagnosticRequest, index: number): RequestView {
  const outcomeLabel =
    entry.outcome === 'success'
      ? '成功'
      : entry.outcome === 'http-error'
        ? 'HTTP 异常'
        : '网络失败';
  return {
    ...entry,
    key: `${entry.startedAt}-${index}`,
    normalText:
      entry.outcome === 'success' ? '正常；请求已完成。' : '异常；对应页面可能显示失败或需要重试。',
    outcomeLabel,
    screenshot: '截本条记录和发生问题的业务页面；不要截隐私正文。',
    timeLabel: formatTimestamp(entry.startedAt),
  };
}

function toErrorView(entry: RuntimeDiagnosticError, index: number): ErrorView {
  return {
    ...entry,
    fingerprintLabel: entry.fingerprint.slice(0, 12),
    key: `${entry.recordedAt}-${index}`,
    normalText: '发现异常；指纹只能帮助归类，无法代替原生 Console 取证。',
    screenshot: '截错误指纹、本页顶部版本条和出错业务页面。',
    timeLabel: formatTimestamp(entry.recordedAt),
  };
}

function toPerformanceView(entry: RuntimeDiagnosticPerformance, index: number): PerformanceView {
  return {
    ...entry,
    key: `${entry.recordedAt}-${index}`,
    metricLabel: `${entry.page} · ${entry.metric}`,
    normalText: '这是单次辅助计时，没有经过手机多轮统计，不能单独判断卡顿。',
    screenshot: '卡顿时截本条并录制对应操作。',
    timeLabel: formatTimestamp(entry.recordedAt),
  };
}

const exportStartupStages = new Set([
  'module-registered',
  'page-load',
  'page-show',
  'page-ready',
  'options-start',
  'options-ready',
  'options-error',
  'options-timeout',
  'page-unload',
]);

function isExportStartupStage(metric: string): boolean {
  return exportStartupStages.has(metric);
}

function createCheckReport(data: TestToolsPageData): string {
  const issues = data.displayChecks.filter((item) => item.checked);
  return [
    '[页面显示检查]',
    `状态：${data.checkSummary}`,
    `异常项：${issues.length === 0 ? '无勾选项' : issues.map((item) => item.label).join('、')}`,
    `版本：${buildInfo.buildLabel}`,
    `环境：${data.environmentLabel}`,
    `生成时间：${formatTimestamp(Date.now())}`,
  ].join('\n');
}

function createRuntimeCompatibilityReport(data: TestToolsPageData): string {
  return [
    '[首屏运行时兼容性诊断 v1]',
    '安全说明：只含固定环境字段和受控布局测量，不含身份、联系方式、群组、排班、请求正文、响应正文、Header、凭证或原始堆栈。',
    `构建=${buildInfo.buildLabel}`,
    `环境=${data.environmentLabel}`,
    `生成时间=${formatTimestamp(Date.now())}`,
    '',
    '[设备与屏幕]',
    ...reportRows(data.deviceRows, data.deviceRows.length),
    '',
    '[运行时兼容性]',
    `汇总=${data.runtimeProbeSummary}`,
    ...reportRows(data.runtimeProbeRows, data.runtimeProbeRows.length),
    '可视检查=左侧 CSS 缺口圆与右侧 SVG 完整圆；自动测量不能判断圆弧像素形状，请附首屏截图。',
  ].join('\n');
}

function createDiagnosticReport(data: TestToolsPageData, simplified: boolean): string {
  const generatedAt = formatTimestamp(Date.now());
  const lines = [
    simplified ? '[Codex 简化诊断报告 v2]' : '[测试工具完整诊断报告 v2]',
    '安全说明：本报告不含请求体、响应体、Header、凭证、身份、联系方式、成员信息或原始堆栈。',
    '口径说明：记录总耗时包含诊断附加开销；setData 提交和下一渲染周期不代表用户已实际看到结果。',
    '',
    '[版本]',
    `构建=${buildInfo.buildLabel}`,
    `环境=${data.environmentLabel}`,
    `构建时间=${buildInfo.buildTime}`,
    `构建描述=${buildInfo.buildDescription}`,
    `脏工作树=${buildInfo.buildDirty ? '是' : '否'}`,
    `API环境=${buildInfo.apiEnvironment}`,
    '',
    '[设备与屏幕]',
    ...reportRows(data.deviceRows, data.deviceRows.length),
    '',
    '[当前页面]',
    `路径=${currentPagePath}`,
    `测试工具首屏=${data.pageReadyMs}ms（单次辅助值）`,
    '',
    '[运行时兼容性]',
    `汇总=${data.runtimeProbeSummary}`,
    ...reportRows(data.runtimeProbeRows, data.runtimeProbeRows.length),
    '可视检查=左侧 CSS 缺口圆与右侧 SVG 完整圆；自动测量不能判断圆弧像素形状，请附首屏截图。',
    '',
    '[关键性能]',
    ...(data.performanceRows.length === 0
      ? ['暂无有界内存记录']
      : data.performanceRows
          .slice(0, simplified ? 6 : 12)
          .map((item) => `${item.metricLabel}=${item.durationMs}ms`)),
    '',
    '[导出页启动边界]',
    ...createExportBoundaryReportLines(data.exportBoundaryRows),
    '',
    '[通讯录性能诊断]',
    `记录状态=${data.directoryRecording ? '记录中' : '已停止'}`,
    ...(data.directorySearchRows.length === 0
      ? ['暂无记录']
      : createDirectorySearchReportLines(data.directorySearchRows.slice(0, simplified ? 3 : 10))),
    '',
    '[脱敏网络结果]',
    ...(data.requestRows.length === 0
      ? ['暂无有界内存记录']
      : data.requestRows
          .slice(0, simplified ? 8 : 20)
          .map(
            (item) =>
              `${item.method} ${item.endpoint} | ${item.outcomeLabel} | HTTP ${item.statusCode ?? '-'} | ${item.durationMs}ms | 重试${item.retryCount} | 重复=${item.duplicate ? '是' : '否'}`,
          )),
    '',
    '[错误指纹]',
    ...(data.errorRows.length === 0
      ? ['未记录到错误指纹']
      : data.errorRows
          .slice(0, simplified ? 6 : 10)
          .map((item) => `${item.timeLabel} | ${item.page}/${item.code} | ${item.fingerprint}`)),
    '',
    '[显示检查]',
    `状态=${data.checkSummary}`,
    `异常项=${
      data.displayChecks
        .filter((item) => item.checked)
        .map((item) => item.label)
        .join('、') || '无勾选项'
    }`,
    '',
    '[测试场景结果]',
    ...data.scenarios.map((item) => `${item.title}=${item.resultLabel}`),
    '',
    `[生成时间] ${generatedAt}`,
  ];
  if (!simplified) {
    lines.splice(
      lines.indexOf('[显示检查]'),
      0,
      '[缓存摘要]',
      ...reportRows(data.storageRows, data.storageRows.length),
      '',
    );
  }
  return lines.join('\n');
}

function createExportBoundaryReportLines(rows: readonly PerformanceView[]): string[] {
  if (rows.length === 0) {
    return [
      '暂无导出页边界记录；请从工作台进入“更多 → 导出排班”，返回本页后点刷新。',
      '判读：没有 module-registered 重点检查页面资源/静态依赖；有 module-registered 但没有 page-load 重点检查原生页面装载。',
    ];
  }
  const stages = rows.map((item) => item.metric);
  const conclusion = stages.includes('options-ready')
    ? '导出选项已加载完成；该记录不代表原生绘制或文件导出已完成。'
    : stages.includes('options-start')
      ? 'Page 已开始加载导出选项，请结合 options-error/options-timeout 与网络结果判断。'
      : stages.includes('page-load')
        ? 'Page 已进入 onLoad，尚未加载导出选项；无群组参数冷入口会显示缺少群组提示。'
        : stages.includes('module-registered')
          ? '页面模块已注册但没有 onLoad，重点检查原生页面装载和 WXML 边界。'
          : '没有完成 Page 模块注册，重点检查页面 JS 静态依赖或页面资源装载。';
  return [
    `记录=${rows.length} 条（按时间正序）`,
    `阶段=${rows.map((item) => `${item.metric}@${item.timeLabel}`).join(' → ')}`,
    `判读=${conclusion}`,
  ];
}

function createDirectorySearchReport(rows: readonly DirectorySearchView[]): string {
  return [
    '[通讯录性能诊断 v1]',
    '安全说明：只含长度、类型、阶段耗时、计数和设备环境；不含原始搜索词、姓名、号码、工号、账号、群组、权限、筛选值或游标。',
    '口径说明：记录总耗时包含诊断附加开销；响应和 setData 字节数均为 JSON.stringify 估算。',
    `构建=${buildInfo.buildLabel}`,
    `记录数=${rows.length}`,
    '',
    ...createDirectorySearchReportLines(rows),
  ].join('\n');
}

function createDirectorySearchReportLines(rows: readonly DirectorySearchView[]): string[] {
  return rows.flatMap((item, index) => [
    `#${index + 1} ${item.diagnosticId} | ${formatTimestamp(item.confirmedAt)} | ${item.modeLabel} | ${item.outcomeLabel}`,
    `搜索=长度${item.searchTermLength}，类型${item.searchTypeLabel}，筛选=${yesNo(item.hasFilters)}，页面会话第${item.pageSessionSearchIndex}次，页面会话首次=${yesNo(item.firstSearchInPageSession)}`,
    `启动=下次启动标记自动开启${yesNo(item.autoStartedByLaunchMarker)}，新 App.onLaunch=${yesNo(item.newAppLaunchObserved)}，warm resume=${yesNo(item.warmResume)}，App启动到确认${item.appLaunchToConfirmMs}ms，通讯录页面加载到确认${item.directoryPageLoadToConfirmMs}ms`,
    `复用=完成结果${yesNo(item.completedResultReuse)}，进行中请求${yesNo(item.inFlightRequestReuse)}，重复拦截${yesNo(item.duplicateRequestIntercepted)}`,
    `阶段ms=事件开始${item.eventHandlerStartMs}，账号/群组/权限等待${item.contextWaitMs}，facets/发布复核等待${item.facetsOrReleaseWaitMs}，发请求${item.networkRequestStartMs}，收响应${item.networkResponseMs}，响应到转换${item.responseToConversionMs}，卡片${item.cardBuildMs}，数据提交完成${item.setDataCommitMs}，下一渲染周期完成${item.nextRenderCycleMs}，诊断序列化${item.diagnosticSerializationMs}，总计${item.totalMs}`,
    `setData=次数${item.setDataCallCount}，累计${item.setDataTotalBytes}B，最大单次${item.setDataMaxBytes}B，字节为估算=${yesNo(item.setDataBytesEstimated)}`,
    `结果=返回${item.resultCount}条，下一页${yesNo(item.hasNextPage)}，响应${item.responseBytes}B，字节为估算=${yesNo(item.responseBytesEstimated)}，facets就绪${yesNo(item.facetsReady)}，发布批次确认${yesNo(item.publishedBatchConfirmed)}`,
    `网络=requestId=${item.requestId}，profileEnabled=${yesNo(item.profileEnabled)}，profile=${formatNetworkProfile(item.networkProfile)}`,
    `服务端=${formatServerTiming(item.serverTiming)}`,
    `边界=截断${yesNo(item.truncated)}，记录总耗时包含诊断附加开销`,
    '',
  ]);
}

function formatNetworkProfile(profile: RuntimeDirectorySearchDiagnostic['networkProfile']): string {
  if (!profile.supported) return '不支持';
  return `DNS ${profile.dnsMs ?? '不支持'}ms / 建连 ${profile.connectMs ?? '不支持'}ms / TLS ${profile.tlsMs ?? '不支持'}ms / 首字节 ${profile.ttfbMs ?? '不支持'}ms / 下载 ${profile.downloadMs ?? '不支持'}ms`;
}

function formatServerTiming(timing: RuntimeDirectorySearchDiagnostic['serverTiming']): string {
  if (!timing.supported) return '不支持';
  const duration = (value: number | undefined): string =>
    value === undefined ? '不支持' : `${value}ms`;
  return [
    `总${duration(timing.totalMs)}`,
    `鉴权${duration(timing.authMs)}`,
    `索引检查等待${duration(timing.readinessMs)}`,
    `数据库连接等待${duration(timing.databaseWaitMs)}`,
    `权限${duration(timing.permissionMs)}`,
    `发布批次${duration(timing.batchMs)}`,
    `工号别名${duration(timing.aliasMs)}`,
    `主查询${duration(timing.rowsMs)}`,
    `联系方式${duration(timing.contactsMs)}`,
    `计数${duration(timing.countMs)}`,
    `查询合计${duration(timing.queryMs)}`,
    `结果转换${duration(timing.transformMs)}`,
    `序列化${duration(timing.serializationMs)}`,
    `冷启动${timing.coldStart === undefined ? '不支持' : timing.coldStart ? '是' : '否'}`,
    `实例存活${timing.instanceAgeMs === 2_592_000_000 ? '≥' : ''}${duration(timing.instanceAgeMs)}`,
    `查询计划${timing.directoryPlan ?? '未提供'}`,
    `排队${timing.queueSupported === false ? '不支持' : '支持'}`,
    `缓存${timing.cache ?? '不支持'}`,
  ].join(' / ');
}

function searchTypeLabel(value: RuntimeDirectorySearchDiagnostic['searchType']): string {
  if (value === 'employee-code') return '工号';
  if (value === 'name') return '姓名/拼音';
  if (value === 'phone') return '电话';
  return '其他';
}

function yesNo(value: boolean): string {
  return value ? '是' : '否';
}

function reportRows(rows: readonly DiagnosticRow[], limit: number): string[] {
  return rows.slice(0, limit).map((item) => `${item.label}=${item.value}（${item.statusLabel}）`);
}

function copyText(value: string, successTitle: string): void {
  if (wx.setClipboardData === undefined) {
    wx.showToast?.({ icon: 'none', title: '当前微信版本不支持复制' });
    return;
  }
  wx.setClipboardData({
    data: truncateCopyText(value),
    fail: () => wx.showToast?.({ icon: 'none', title: '复制失败，请稍后重试' }),
    success: () => wx.showToast?.({ icon: 'success', title: successTitle }),
  });
}

function truncateCopyText(value: string): string {
  if (utf8Bytes(value) <= RUNTIME_DIAGNOSTIC_COPY_MAX_BYTES) return value;
  const notice = `\n[已安全截断：复制文本超过 ${RUNTIME_DIAGNOSTIC_COPY_MAX_BYTES} B 上限]`;
  const budget = RUNTIME_DIAGNOSTIC_COPY_MAX_BYTES - utf8Bytes(notice);
  let output = '';
  let bytes = 0;
  for (const character of value) {
    const next = utf8Bytes(character);
    if (bytes + next > budget) break;
    output += character;
    bytes += next;
  }
  return output + notice;
}

function utf8Bytes(value: string): number {
  let bytes = 0;
  for (const character of value) {
    const codePoint = character.codePointAt(0) ?? 0;
    bytes += codePoint <= 0x7f ? 1 : codePoint <= 0x7ff ? 2 : codePoint <= 0xffff ? 3 : 4;
  }
  return bytes;
}

function check(id: string, label: string, impact: string, screenshot: string): DisplayCheck {
  return { checked: false, id, impact, label, screenshot };
}

function scenario(
  id: string,
  title: string,
  path: string,
  observe: string,
  normal: string,
  screenshot: string,
  action: 'gesture' | 'workspace' = 'workspace',
  actionLabel = '回到工作台测试',
): DiagnosticScenario {
  return {
    action,
    actionLabel,
    id,
    normal,
    observe,
    path,
    result: 'pending',
    resultLabel: '未测试',
    screenshot,
    title,
  };
}

function row(
  label: string,
  value: string,
  explanation: string,
  screenshot: string,
  status: RowStatus = 'good',
): DiagnosticRow {
  return {
    explanation,
    label,
    screenshot,
    status,
    statusLabel: status === 'good' ? '正常' : status === 'notice' ? '需留意' : '暂未验证',
    value,
  };
}

function safeCall<T>(reader: (() => T) | undefined): T | undefined {
  try {
    return reader?.();
  } catch {
    return undefined;
  }
}

function readNetworkType(runtime: RuntimeSystemApi): Promise<string> {
  return new Promise((resolve) => {
    if (runtime.getNetworkType === undefined) {
      resolve('未知');
      return;
    }
    let settled = false;
    const finish = (value: string): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(value);
    };
    const timer = setTimeout(() => finish('未知'), 500);
    try {
      runtime.getNetworkType({
        fail: () => finish('未知'),
        success: (result) => finish(textValue(result.networkType)),
      });
    } catch {
      finish('未知');
    }
  });
}

function textValue(value: unknown): string {
  if (typeof value === 'string' && value.trim().length > 0) return value.trim().slice(0, 80);
  return '当前微信版本不支持读取';
}

function numberValue(value: unknown): string {
  return typeof value === 'number' && Number.isFinite(value)
    ? String(Math.round(value * 100) / 100)
    : '当前微信版本不支持读取';
}

function sizeValue(width: unknown, height: unknown): string {
  if (typeof width !== 'number' || typeof height !== 'number') return '当前微信版本不支持读取';
  return `${Math.round(width)} × ${Math.round(height)}`;
}

function safeAreaValue(value: Record<string, unknown> | undefined): string {
  if (value === undefined) return '当前微信版本不支持读取';
  return `上 ${numberValue(value['top'])} / 右 ${numberValue(value['right'])} / 下 ${numberValue(value['bottom'])} / 左 ${numberValue(value['left'])}`;
}

function rectValue(value: Record<string, unknown> | undefined): string {
  if (value === undefined) return '当前微信版本不支持读取';
  return `top ${numberValue(value['top'])}, bottom ${numberValue(value['bottom'])}, ${numberValue(value['width'])}×${numberValue(value['height'])}`;
}

function joinKnown(values: readonly string[]): string {
  const known = values.filter((value) => value !== '当前微信版本不支持读取');
  return known.length === 0 ? '当前微信版本不支持读取' : known.join(' / ');
}

function availability(value: string): RowStatus {
  return value === '当前微信版本不支持读取' ? 'unavailable' : 'good';
}

function formatTimestamp(value: number): string {
  try {
    return new Date(value).toISOString();
  } catch {
    return '时间不可用';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
