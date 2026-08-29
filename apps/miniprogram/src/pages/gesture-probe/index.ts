import { buildInfo } from '../../platform/build-info.js';

declare const getCurrentPages: undefined | (() => unknown[]);

interface GestureProbeEvent {
  readonly deltaX: number;
  readonly deltaY: number;
  readonly state: number;
}

interface GestureProbePageInstance {
  _probeX: MiniProgramSharedValue<number>;
  _probeY: MiniProgramSharedValue<number>;
  _touchMoveCount: number;
  _workspaceStressTimer: ReturnType<typeof setTimeout> | undefined;
  applyAnimatedStyle(
    selector: string,
    updater: () => Record<string, string>,
    userConfig?: { readonly flush?: 'async' | 'sync' },
  ): void;
  setData(patch: Record<string, unknown>, callback?: () => void): void;
  readonly data: {
    readonly wheelCommandRevision: number;
    readonly wheelGeneration: number;
    readonly wheelItems: readonly GestureProbeWheelItem[];
    readonly workspaceProbeIndex: number;
    readonly workspaceStressRunning: boolean;
  };
}

type WorkspaceProbeKey = 'calendar' | 'directory' | 'more' | 'profile' | 'swap';
type WorkspaceProbeBooleanState = Readonly<Record<WorkspaceProbeKey, boolean>>;
type WorkspaceProbeCountState = Readonly<Record<WorkspaceProbeKey, number>>;

interface WorkspaceProbeHost {
  readonly route?: string;
  readonly data: {
    readonly activeWorkspaceIndex: number;
    readonly workspaceAttachedCounts: WorkspaceProbeCountState;
    readonly workspaceGestureLocked: boolean;
    readonly workspaceMounted: WorkspaceProbeBooleanState;
    readonly workspacePreloadQueue: readonly WorkspaceProbeKey[];
    readonly workspaceReady: WorkspaceProbeBooleanState;
    readonly workspaceReadyEventCounts: WorkspaceProbeCountState;
    readonly workspaceRequestCounts: WorkspaceProbeCountState;
  };
  handleCalendarNav?(): void;
  handleDirectoryNav?(): void;
  handleMoreNav?(): void;
  handleProfileNav?(): void;
  handleSwapNav?(): void;
}

interface GestureProbeWheelItem {
  readonly ariaLabel: string;
  readonly label: string;
}

interface GestureProbeWheelEvent {
  readonly detail: { readonly generation: number; readonly index: number };
}

const { shared } = wx.worklet;
const probeYears = Array.from({ length: 11 }, (_, index) => 2021 + index);
const initialProbeYearIndex = probeYears.indexOf(2026);
const workspaceProbeItems = [
  { key: 'calendar', label: '日历' },
  { key: 'directory', label: '通讯录' },
  { key: 'swap', label: '换班' },
  { key: 'profile', label: '我的' },
  { key: 'more', label: '更多' },
] as const;

Page({
  data: {
    appVersion: '未知',
    buildLabel: buildInfo.buildLabel,
    model: '未知',
    platform: '未知',
    sdkVersion: '未知',
    system: '未知',
    touchMoveCount: 0,
    touchStatus: '尚未触发普通触摸',
    workspaceProbe: 'index 0 · 日历',
    workspaceProbeAttached: '日历 1 / 通讯录 0 / 换班 0 / 我的 0 / 更多 1',
    workspaceProbeDuplicateReady: '0',
    workspaceProbeIndex: 0,
    workspaceProbeItems,
    workspaceProbeQueue: '通讯录 → 我的 → 换班',
    workspaceProbeReady: '日历、更多',
    workspaceProbeMounted: '日历、更多',
    workspaceProbeGestureLock: '关闭',
    workspaceProbeRequests: '日历 0 / 通讯录 0 / 换班 0 / 我的 0 / 更多 0',
    workspaceStressCount: 0,
    workspaceStressRunning: false,
    wheelCommandRevision: 1,
    wheelGeneration: 1,
    wheelItems: probeYears.map((year) => ({ ariaLabel: `${year}年`, label: String(year) })),
    wheelPreviewLabel: '2026年',
    wheelSelectedIndex: initialProbeYearIndex,
    wheelSettledLabel: '2026年',
  },
  onLoad(this: GestureProbePageInstance): void {
    this._probeX = shared(0);
    this._probeY = shared(0);
    this._touchMoveCount = 0;
    this._workspaceStressTimer = undefined;
    const probeX = this._probeX;
    const probeY = this._probeY;
    this.applyAnimatedStyle(
      '#gesture-probe-dot',
      () => {
        'worklet';
        return { transform: `translate(${probeX.value}px, ${probeY.value}px)` };
      },
      { flush: 'sync' },
    );

    const appBaseInfo = wx.getAppBaseInfo();
    const deviceInfo = wx.getDeviceInfo();
    this.setData({
      appVersion: appBaseInfo.version,
      model: deviceInfo.model,
      platform: deviceInfo.platform,
      sdkVersion: appBaseInfo.SDKVersion,
      system: deviceInfo.system,
    });
    syncWorkspaceDiagnostics(this);
  },
  onShow(this: GestureProbePageInstance): void {
    syncWorkspaceDiagnostics(this);
  },
  onUnload(this: GestureProbePageInstance): void {
    if (this._workspaceStressTimer !== undefined) clearTimeout(this._workspaceStressTimer);
    this._workspaceStressTimer = undefined;
  },
  handleProbePan(this: GestureProbePageInstance, event: GestureProbeEvent): void {
    'worklet';
    if (event.state !== 2) return;
    this._probeX.value = Math.max(-96, Math.min(96, this._probeX.value + event.deltaX));
    this._probeY.value = Math.max(-70, Math.min(70, this._probeY.value + event.deltaY));
  },
  handleTouchStart(this: GestureProbePageInstance): void {
    this._touchMoveCount = 0;
    this.setData({ touchMoveCount: 0, touchStatus: '普通触摸已开始' });
  },
  handleTouchMove(this: GestureProbePageInstance): void {
    this._touchMoveCount += 1;
    this.setData({
      touchMoveCount: this._touchMoveCount,
      touchStatus: '普通触摸移动中',
    });
  },
  handleTouchEnd(this: GestureProbePageInstance): void {
    this.setData({ touchMoveCount: this._touchMoveCount, touchStatus: '普通触摸已结束' });
  },
  handleWorkspaceStress(this: GestureProbePageInstance): void {
    if (this.data.workspaceStressRunning) return;
    this.setData({ workspaceStressCount: 0, workspaceStressRunning: true }, () =>
      runWorkspaceStress(this, 50),
    );
  },
  handleWorkspaceProbeTap(
    this: GestureProbePageInstance,
    event: { readonly currentTarget: { readonly dataset: { readonly index?: number } } },
  ): void {
    const index = Number(event.currentTarget.dataset.index);
    if (!Number.isInteger(index) || index < 0 || index >= workspaceProbeItems.length) return;
    activateWorkspaceProbe(index);
    this.setData({ workspaceProbeIndex: index }, () => syncWorkspaceDiagnostics(this));
  },
  handleWheelPreview(this: GestureProbePageInstance, event: GestureProbeWheelEvent): void {
    if (event.detail.generation !== this.data.wheelGeneration) return;
    const index = boundedProbeYearIndex(event.detail.index);
    this.setData({
      wheelPreviewLabel: `${probeYears[index]}年`,
      wheelSelectedIndex: index,
    });
  },
  handleWheelReset(this: GestureProbePageInstance): void {
    this.setData({
      wheelCommandRevision: this.data.wheelCommandRevision + 1,
      wheelGeneration: this.data.wheelGeneration + 1,
      wheelPreviewLabel: '2026年',
      wheelSelectedIndex: initialProbeYearIndex,
      wheelSettledLabel: '2026年',
    });
  },
  handleWheelSettled(this: GestureProbePageInstance, event: GestureProbeWheelEvent): void {
    if (event.detail.generation !== this.data.wheelGeneration) return;
    const index = boundedProbeYearIndex(event.detail.index);
    this.setData({
      wheelSelectedIndex: index,
      wheelSettledLabel: `${probeYears[index]}年`,
    });
  },
});

function boundedProbeYearIndex(value: number): number {
  if (!Number.isFinite(value)) return initialProbeYearIndex;
  return Math.min(probeYears.length - 1, Math.max(0, Math.round(value)));
}

function runWorkspaceStress(page: GestureProbePageInstance, remaining: number): void {
  if (remaining <= 0) {
    page._workspaceStressTimer = undefined;
    page.setData({ workspaceStressRunning: false }, () => syncWorkspaceDiagnostics(page));
    return;
  }
  const index = (page.data.workspaceProbeIndex + 1) % 5;
  activateWorkspaceProbe(index);
  page.setData(
    {
      workspaceProbeIndex: index,
      workspaceStressCount: 51 - remaining,
    },
    () => {
      syncWorkspaceDiagnostics(page);
      page._workspaceStressTimer = setTimeout(() => runWorkspaceStress(page, remaining - 1), 16);
    },
  );
}

function activateWorkspaceProbe(index: number): void {
  const host = findWorkbenchProbeHost();
  const handlers = [
    host?.handleCalendarNav,
    host?.handleDirectoryNav,
    host?.handleSwapNav,
    host?.handleProfileNav,
    host?.handleMoreNav,
  ];
  handlers[index]?.call(host);
}

function syncWorkspaceDiagnostics(page: GestureProbePageInstance): void {
  const host = findWorkbenchProbeHost();
  if (host === undefined) {
    const index = page.data?.workspaceProbeIndex ?? 0;
    page.setData({
      workspaceProbe: `index ${index} · 未连接工作台`,
      workspaceProbeAttached: '请从“更多 → 测试中心”进入',
      workspaceProbeDuplicateReady: '—',
      workspaceProbeGestureLock: '未知',
      workspaceProbeMounted: '未连接',
      workspaceProbeQueue: '未连接',
      workspaceProbeReady: '未连接',
      workspaceProbeRequests: '未连接',
    });
    return;
  }
  const index = Math.max(
    0,
    Math.min(workspaceProbeItems.length - 1, host.data.activeWorkspaceIndex),
  );
  const duplicateReady = workspaceProbeItems.reduce(
    (count, item) => count + Math.max(0, host.data.workspaceReadyEventCounts[item.key] - 1),
    0,
  );
  page.setData({
    workspaceProbe: `index ${index} · ${workspaceProbeItems[index]?.label ?? '未知'}`,
    workspaceProbeAttached: formatWorkspaceCounts(host.data.workspaceAttachedCounts),
    workspaceProbeDuplicateReady: String(duplicateReady),
    workspaceProbeGestureLock: host.data.workspaceGestureLocked ? '开启' : '关闭',
    workspaceProbeIndex: index,
    workspaceProbeMounted: formatWorkspaceFlags(host.data.workspaceMounted),
    workspaceProbeQueue:
      host.data.workspacePreloadQueue.length === 0
        ? '空'
        : host.data.workspacePreloadQueue.map(workspaceLabel).join(' → '),
    workspaceProbeReady: formatWorkspaceFlags(host.data.workspaceReady),
    workspaceProbeRequests: formatWorkspaceCounts(host.data.workspaceRequestCounts),
  });
}

function findWorkbenchProbeHost(): WorkspaceProbeHost | undefined {
  if (typeof getCurrentPages !== 'function') return undefined;
  const pages = getCurrentPages() as unknown as WorkspaceProbeHost[];
  return [...pages].reverse().find((page) => page.route === 'pages/workbench/index');
}

function formatWorkspaceFlags(state: WorkspaceProbeBooleanState): string {
  const labels = workspaceProbeItems.filter((item) => state[item.key]).map((item) => item.label);
  return labels.length === 0 ? '无' : labels.join('、');
}

function formatWorkspaceCounts(state: WorkspaceProbeCountState): string {
  return workspaceProbeItems.map((item) => `${item.label} ${state[item.key]}`).join(' / ');
}

function workspaceLabel(workspace: WorkspaceProbeKey): string {
  return workspaceProbeItems.find((item) => item.key === workspace)?.label ?? workspace;
}
