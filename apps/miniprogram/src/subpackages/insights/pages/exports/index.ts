type ExportPageData = {
  readonly groupId: string;
  readonly largeText: boolean;
  readonly panelAttached: boolean;
  readonly panelReady: boolean;
  readonly startupError: string;
  readonly viewportClass: string;
  readonly shellHeaderStyle: string;
  readonly pageScrollStyle: string;
};

interface ExportPageRuntime {
  readonly data: ExportPageData;
  _pageActive?: boolean;
  _panelAttached?: boolean;
  _panelRevealTimer?: ReturnType<typeof setTimeout> | undefined;
  _panelTimeoutTimer?: ReturnType<typeof setTimeout> | undefined;
  setData(patch: Partial<ExportPageData>, callback?: () => void): void;
}

const EXPORT_STARTUP_STAGES = new Set([
  'module-registered',
  'page-load',
  'page-show',
  'page-ready',
  'panel-mount-requested',
  'panel-component-attached',
  'panel-mount-timeout',
  'page-unload',
]);

Page({
  data: {
    groupId: '',
    largeText: false,
    panelAttached: false,
    panelReady: false,
    startupError: '',
    viewportClass: '',
    shellHeaderStyle: 'height:84px;min-height:84px;padding-top:32px;',
    pageScrollStyle: 'height:calc(100% - 84px);',
  },

  handleBack(): void {
    wx.navigateBack({ delta: 1 });
  },

  handlePanelStartupReady(this: ExportPageRuntime): void {
    if (this._pageActive !== true) return;
    this._panelAttached = true;
    clearTimeout(this._panelTimeoutTimer);
    this._panelTimeoutTimer = undefined;
    this.setData({ panelAttached: true });
    recordPageStartupStage('panel-component-attached');
  },

  handleRetry(this: ExportPageRuntime): void {
    if (this._pageActive !== true) return;
    this._panelAttached = false;
    if (this.data.groupId.length === 0) {
      this.setData({
        panelAttached: false,
        panelReady: false,
        startupError: '当前群组信息缺失，请返回工作台后重试。',
      });
      return;
    }
    this.setData({ panelAttached: false, panelReady: false, startupError: '' });
    schedulePanelMount(this);
  },

  onLoad(this: ExportPageRuntime, query: Readonly<Record<string, string | undefined>> = {}): void {
    this._pageActive = true;
    this._panelAttached = false;
    recordPageStartupStage('page-load');
    const groupId = decodeGroupId(query['groupId']);
    if (groupId.length === 0) {
      this.setData({
        groupId: '',
        panelAttached: false,
        panelReady: false,
        startupError: '当前群组信息缺失，请返回工作台后重试。',
      });
      return;
    }
    this.setData({
      groupId,
      panelAttached: false,
      panelReady: false,
      startupError: '',
    });
    schedulePanelMount(this);
  },

  onReady(): void {
    recordPageStartupStage('page-ready');
  },

  onShow(this: ExportPageRuntime): void {
    if (this._pageActive === true) recordPageStartupStage('page-show');
  },

  onUnload(this: ExportPageRuntime): void {
    this._pageActive = false;
    this._panelAttached = false;
    clearTimeout(this._panelRevealTimer);
    clearTimeout(this._panelTimeoutTimer);
    this._panelRevealTimer = undefined;
    this._panelTimeoutTimer = undefined;
    recordPageStartupStage('page-unload');
  },
});

recordPageStartupStage('module-registered');

function schedulePanelMount(page: ExportPageRuntime): void {
  clearTimeout(page._panelRevealTimer);
  clearTimeout(page._panelTimeoutTimer);
  page._panelRevealTimer = setTimeout(() => {
    page._panelRevealTimer = undefined;
    if (page._pageActive !== true) return;
    recordPageStartupStage('panel-mount-requested');
    page.setData({ panelAttached: false, panelReady: true, startupError: '' });
    page._panelTimeoutTimer = setTimeout(() => {
      page._panelTimeoutTimer = undefined;
      if (page._pageActive !== true || page._panelAttached === true) return;
      recordPageStartupStage('panel-mount-timeout');
      page.setData({
        panelAttached: false,
        panelReady: false,
        startupError: '导出内容组件未完成装载，请点击重新加载；若重复出现请复制诊断报告。',
      });
    }, 5000);
  }, 0);
}

function recordPageStartupStage(stage: string): void {
  if (!EXPORT_STARTUP_STAGES.has(stage)) return;
  try {
    const app = getApp<{
      globalData?: {
        runtimeDiagnostics?: RuntimeDiagnosticsSlot;
      };
    }>();
    const globalData = app.globalData;
    if (globalData === undefined) return;
    const runtimeDiagnostics = (globalData.runtimeDiagnostics ??= {
      appLaunchAt: 0,
      directorySearchRecording: false,
      directorySearches: [],
      errors: [],
      initialShowPending: false,
      launchMarkerConsumed: false,
      launchObserved: false,
      performance: [],
      requests: [],
      warmResumeObserved: false,
    });
    const performance = runtimeDiagnostics.performance;
    if (!Array.isArray(performance)) return;
    performance.push({
      durationMs: 0,
      metric: stage,
      page: 'exports',
      recordedAt: Date.now(),
    });
    if (performance.length > 12) performance.shift();
  } catch {
    // The startup marker must never affect Page registration or rendering.
  }
}

interface RuntimeDiagnosticsSlot {
  appLaunchAt: number;
  directorySearchRecording: boolean;
  readonly directorySearches: unknown[];
  readonly errors: unknown[];
  initialShowPending: boolean;
  launchMarkerConsumed: boolean;
  launchObserved: boolean;
  readonly performance: Array<{
    durationMs: number;
    metric: string;
    page: string;
    recordedAt: number;
  }>;
  readonly requests: unknown[];
  warmResumeObserved: boolean;
}

function decodeGroupId(value: string | undefined): string {
  if (value === undefined) return '';
  try {
    return decodeURIComponent(value);
  } catch {
    return '';
  }
}
