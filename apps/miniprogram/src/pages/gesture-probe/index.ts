import { buildInfo } from '../../platform/build-info.js';

interface GestureProbeEvent {
  readonly deltaX: number;
  readonly deltaY: number;
  readonly state: number;
}

interface GestureProbePageInstance {
  _probeX: MiniProgramSharedValue<number>;
  _probeY: MiniProgramSharedValue<number>;
  _touchMoveCount: number;
  applyAnimatedStyle(
    selector: string,
    updater: () => Record<string, string>,
    userConfig?: { readonly flush?: 'async' | 'sync' },
  ): void;
  setData(patch: Record<string, unknown>): void;
}

const { shared } = wx.worklet;

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
  },
  onLoad(this: GestureProbePageInstance): void {
    this._probeX = shared(0);
    this._probeY = shared(0);
    this._touchMoveCount = 0;
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
});
