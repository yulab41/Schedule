import { buildInfo } from '../../../../platform/build-info.js';
import { recordRuntimeDiagnosticPerformance } from '../../../../platform/runtime-diagnostics-bridge.js';
import {
  getRuntimeDiagnosticsSnapshot,
  type RuntimeDiagnosticError,
  type RuntimeDiagnosticPerformance,
  type RuntimeDiagnosticRequest,
} from '../../../../platform/runtime-diagnostics.js';
import {
  formatMiniProgramEnvironment,
  isTestToolsRuntimeEnabled,
  readMiniProgramRuntimeIdentity,
} from '../../../../platform/runtime-environment.js';

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
}

interface TestToolsPageData {
  readonly buildRows: readonly DiagnosticRow[];
  readonly checkSummary: string;
  readonly deviceRows: readonly DiagnosticRow[];
  readonly displayChecks: readonly DisplayCheck[];
  readonly environmentLabel: string;
  readonly errorRows: readonly ErrorView[];
  readonly generatedAt: string;
  readonly networkType: string;
  readonly pageReadyMs: number;
  readonly performanceRows: readonly PerformanceView[];
  readonly requestRows: readonly RequestView[];
  readonly scenarios: readonly DiagnosticScenario[];
  readonly storageRows: readonly DiagnosticRow[];
}

interface TestToolsPageInstance {
  _active: boolean;
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

interface RuntimeSystemApi {
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
  data: {
    buildRows: [],
    checkSummary: '尚未检查',
    deviceRows: [],
    displayChecks: displayCheckDefaults,
    environmentLabel: '正在确认环境',
    errorRows: [],
    generatedAt: formatTimestamp(Date.now()),
    networkType: '读取中',
    pageReadyMs: 0,
    performanceRows: [],
    requestRows: [],
    scenarios: scenarioDefaults,
    storageRows: [],
  },

  onLoad(this: TestToolsPageInstance): void {
    this._active = true;
    this._loadStartedAt = Date.now();
    if (!isTestToolsRuntimeEnabled()) {
      this._active = false;
      wx.showToast?.({ icon: 'none', title: '测试工具仅在开发版和体验版开放' });
      wx.redirectTo({ url: '/pages/workbench/index' });
      return;
    }
    const identity = readMiniProgramRuntimeIdentity();
    this.setData({
      buildRows: createBuildRows(identity.version),
      environmentLabel: formatMiniProgramEnvironment(identity.envVersion),
      storageRows: createStorageRows(wx as unknown as RuntimeSystemApi),
    });
    void collectDeviceRows(wx as unknown as RuntimeSystemApi).then(({ networkType, rows }) => {
      if (!this._active) return;
      this.setData({ deviceRows: rows, networkType });
    });
    refreshRuntimeDiagnostics(this);
  },

  onReady(this: TestToolsPageInstance): void {
    if (!this._active) return;
    const pageReadyMs = Date.now() - this._loadStartedAt;
    recordRuntimeDiagnosticPerformance({
      durationMs: pageReadyMs,
      metric: 'page-ready',
      page: 'test-tools',
      recordedAt: Date.now(),
    });
    this.setData({ pageReadyMs });
    refreshRuntimeDiagnostics(this);
  },

  onShow(this: TestToolsPageInstance): void {
    if (!this._active) return;
    refreshRuntimeDiagnostics(this);
  },

  onUnload(this: TestToolsPageInstance): void {
    this._active = false;
  },

  handleBack(): void {
    wx.navigateBack();
  },

  handleRefresh(this: TestToolsPageInstance): void {
    if (!this._active) return;
    this.setData({
      generatedAt: formatTimestamp(Date.now()),
      storageRows: createStorageRows(wx as unknown as RuntimeSystemApi),
    });
    refreshRuntimeDiagnostics(this);
    void collectDeviceRows(wx as unknown as RuntimeSystemApi).then(({ networkType, rows }) => {
      if (!this._active) return;
      this.setData({ deviceRows: rows, networkType });
    });
  },

  handleCheckChange(this: TestToolsPageInstance, event: CheckboxChangeEvent): void {
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
    this.setData({
      checkSummary: '全部正常',
      displayChecks: this.data.displayChecks.map((item) => ({ ...item, checked: false })),
    });
  },

  handleIssueMode(this: TestToolsPageInstance): void {
    this.setData({ checkSummary: '发现异常，请勾选具体项目' });
  },

  handleScenarioResult(this: TestToolsPageInstance, event: ScenarioResultEvent): void {
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

  handleOpenWorkspace(): void {
    wx.reLaunch({ url: '/pages/workbench/index' });
  },

  handleOpenGestureProbe(): void {
    if (!isTestToolsRuntimeEnabled()) return;
    wx.navigateTo({ url: '/pages/gesture-probe/index' });
  },

  handleCopyChecks(this: TestToolsPageInstance): void {
    copyText(createCheckReport(this.data), '检查结果已复制');
  },

  handleCopyFullReport(this: TestToolsPageInstance): void {
    copyText(createDiagnosticReport(this.data, false), '完整诊断报告已复制');
  },

  handleCopyCodexReport(this: TestToolsPageInstance): void {
    copyText(createDiagnosticReport(this.data, true), 'Codex 简化报告已复制');
  },
} as never);

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
    errorRows: [...snapshot.errors].reverse().map(toErrorView),
    generatedAt: formatTimestamp(Date.now()),
    performanceRows: [...snapshot.performance].reverse().map(toPerformanceView),
    requestRows: [...snapshot.requests].reverse().map(toRequestView),
  });
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
  };
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

function createDiagnosticReport(data: TestToolsPageData, simplified: boolean): string {
  const generatedAt = formatTimestamp(Date.now());
  const lines = [
    simplified ? '[Codex 简化诊断报告 v1]' : '[测试工具完整诊断报告 v1]',
    '安全说明：本报告不含请求体、响应体、Header、凭证、身份、联系方式、成员信息或原始堆栈。',
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
    '[关键性能]',
    ...(data.performanceRows.length === 0
      ? ['暂无有界内存记录']
      : data.performanceRows
          .slice(0, simplified ? 6 : 12)
          .map((item) => `${item.metricLabel}=${item.durationMs}ms`)),
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

function reportRows(rows: readonly DiagnosticRow[], limit: number): string[] {
  return rows.slice(0, limit).map((item) => `${item.label}=${item.value}（${item.statusLabel}）`);
}

function copyText(value: string, successTitle: string): void {
  if (wx.setClipboardData === undefined) {
    wx.showToast?.({ icon: 'none', title: '当前微信版本不支持复制' });
    return;
  }
  wx.setClipboardData({
    data: value,
    fail: () => wx.showToast?.({ icon: 'none', title: '复制失败，请稍后重试' }),
    success: () => wx.showToast?.({ icon: 'success', title: successTitle }),
  });
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
