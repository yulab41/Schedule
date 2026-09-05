type UiSheetCloseSource = 'backdrop' | 'button' | 'swipe';

interface UiSheetInstance {
  _attached: boolean;
  _windowResizeHandler: (() => void) | undefined;
  readonly data: { readonly gestureSession: number };
  readonly properties: {
    readonly size: 'default' | 'half' | 'three-quarter';
    readonly swipeDismiss: boolean;
    readonly visible: boolean;
  };
  setData(patch: Readonly<Record<string, unknown>>): void;
  triggerEvent(name: 'close', detail: { readonly source: UiSheetCloseSource }): void;
}

interface SheetWindowRuntime {
  getWindowInfo(): MiniProgramWindowInfo;
  onWindowResize?(handler: () => void): void;
  offWindowResize?(handler: () => void): void;
}

Component({
  properties: {
    closeLabel: { type: String, value: '完成' },
    size: { type: String, value: 'default' },
    swipeArea: { type: String, value: 'header' },
    swipeDismiss: { type: Boolean, value: false },
    title: { type: String, value: '' },
    visible: { type: Boolean, value: false },
  },
  data: {
    gestureSession: 0,
    panelStyle: '',
  },
  observers: {
    'size, visible'(this: UiSheetInstance): void {
      if (!this._attached) return;
      updatePanelSize(this);
      this.setData({ gestureSession: this.data.gestureSession + 1 });
    },
  },
  lifetimes: {
    attached(this: UiSheetInstance): void {
      this._attached = true;
      updatePanelSize(this);
      const runtime: SheetWindowRuntime = wx;
      // Register only when the same runtime can remove the exact callback.
      if (!runtime.onWindowResize || !runtime.offWindowResize) return;
      const handler = (): void => {
        if (this._attached) updatePanelSize(this);
      };
      this._windowResizeHandler = handler;
      runtime.onWindowResize(handler);
    },
    detached(this: UiSheetInstance): void {
      this._attached = false;
      const handler = this._windowResizeHandler;
      this._windowResizeHandler = undefined;
      if (handler) (wx as SheetWindowRuntime).offWindowResize?.(handler);
    },
  },
  methods: {
    handleBackdropClose(this: UiSheetInstance): void {
      emitClose(this, 'backdrop');
    },
    handleButtonClose(this: UiSheetInstance): void {
      emitClose(this, 'button');
    },
    handleSwipeDismiss(this: UiSheetInstance): void {
      if (!this._attached || !this.properties.visible || !this.properties.swipeDismiss) return;
      emitClose(this, 'swipe');
    },
    preventTouchMove(): void {},
  },
});

function updatePanelSize(sheet: UiSheetInstance): void {
  const ratio =
    sheet.properties.size === 'half'
      ? 0.5
      : sheet.properties.size === 'three-quarter'
        ? 0.75
        : undefined;
  if (ratio === undefined) {
    sheet.setData({ panelStyle: '' });
    return;
  }
  // windowHeight is the usable native window, not screenHeight. Do not subtract
  // status/navigation/capsule/TabBar again. Safe-bottom stays inside the border box.
  const height = wx.getWindowInfo().windowHeight;
  const panelStyle =
    Number.isFinite(height) && height > 0
      ? `height:${Math.round(height * ratio)}px;max-height:none;`
      : `height:${ratio * 100}vh;max-height:none;`;
  sheet.setData({ panelStyle });
}

function emitClose(sheet: UiSheetInstance, source: UiSheetCloseSource): void {
  sheet.triggerEvent('close', { source });
}
