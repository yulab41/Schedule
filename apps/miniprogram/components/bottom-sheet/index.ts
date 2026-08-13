import {
  bottomSheetAnimationMilliseconds,
  bottomSheetBounceMilliseconds,
  clampBottomSheetDragOffset,
  nextBottomSheetPhase,
  shouldBeginBottomSheetDrag,
  shouldCloseBottomSheet,
  type BottomSheetPhase,
} from '../../features/sheets/bottom-sheet-logic.js';

type BottomSheetTouchEvent = WechatMiniprogram.TouchEvent;
type BottomSheetScrollEvent = WechatMiniprogram.CustomEvent<{ readonly scrollTop?: unknown }>;

interface BottomSheetInstanceRuntime {
  ownsDrag: boolean;
  touchStart?: { readonly x: number; readonly y: number };
  touchStartedAt: number;
  transitionTimer?: ReturnType<typeof setTimeout>;
}

const bottomSheetRuntimeByInstance = new WeakMap<object, BottomSheetInstanceRuntime>();

function getInstanceRuntime(instance: object): BottomSheetInstanceRuntime {
  const existing = bottomSheetRuntimeByInstance.get(instance);
  if (existing !== undefined) return existing;
  const runtime: BottomSheetInstanceRuntime = { ownsDrag: false, touchStartedAt: 0 };
  bottomSheetRuntimeByInstance.set(instance, runtime);
  return runtime;
}

function getFirstTouch(event: BottomSheetTouchEvent) {
  return event.touches[0] ?? event.changedTouches[0];
}

Component({
  properties: {
    sheetKey: {
      type: Number,
      value: 0,
      observer(): void {
        this.syncVisibility();
      },
    },
    title: {
      type: String,
      value: '',
    },
    visible: {
      type: Boolean,
      value: false,
      observer(): void {
        this.syncVisibility();
      },
    },
  },
  data: {
    dragOffsetPx: 0,
    panelTransform: 'translateY(100%)',
    phase: 'closed' as BottomSheetPhase,
    scrollTop: 0,
  },
  detached(): void {
    this.clearTransitionTimer();
    bottomSheetRuntimeByInstance.delete(this);
  },
  methods: {
    clearTransitionTimer(): void {
      const runtime = getInstanceRuntime(this);
      if (runtime.transitionTimer !== undefined) clearTimeout(runtime.transitionTimer);
      runtime.transitionTimer = undefined;
    },
    handleContentScroll(event: BottomSheetScrollEvent): void {
      const scrollTop = event.detail.scrollTop;
      if (typeof scrollTop === 'number' && Number.isFinite(scrollTop)) this.setData({ scrollTop });
    },
    handleMaskTap(): void {
      this.requestClose();
    },
    handlePanelTouchEnd(event: BottomSheetTouchEvent): void {
      const touch = getFirstTouch(event);
      const runtime = getInstanceRuntime(this);
      if (touch === undefined || runtime.touchStart === undefined || !runtime.ownsDrag) return;
      const sample = {
        deltaX: touch.clientX - runtime.touchStart.x,
        deltaY: touch.clientY - runtime.touchStart.y,
        elapsedMilliseconds: Math.max(0, Date.now() - runtime.touchStartedAt),
      };
      runtime.touchStart = undefined;
      runtime.ownsDrag = false;
      if (shouldCloseBottomSheet(sample)) {
        this.requestClose();
        return;
      }
      this.setData({
        dragOffsetPx: 0,
        panelTransform: 'translateY(0)',
        phase: nextBottomSheetPhase(this.data.phase, 'drag-bounced'),
      });
      this.schedulePhaseEvent(
        this.properties.sheetKey,
        'open-finished',
        bottomSheetBounceMilliseconds,
      );
    },
    handlePanelTouchMove(event: BottomSheetTouchEvent): void {
      const touch = getFirstTouch(event);
      const runtime = getInstanceRuntime(this);
      if (touch === undefined || runtime.touchStart === undefined) return;
      const sample = {
        deltaX: touch.clientX - runtime.touchStart.x,
        deltaY: touch.clientY - runtime.touchStart.y,
        elapsedMilliseconds: Math.max(0, Date.now() - runtime.touchStartedAt),
      };
      if (!runtime.ownsDrag) {
        if (!shouldBeginBottomSheetDrag(this.data.scrollTop, sample)) return;
        runtime.ownsDrag = true;
        this.setData({ phase: nextBottomSheetPhase(this.data.phase, 'drag-started') });
      }
      const dragOffsetPx = clampBottomSheetDragOffset(sample.deltaY);
      this.setData({ dragOffsetPx, panelTransform: `translateY(${dragOffsetPx}px)` });
    },
    handlePanelTouchStart(event: BottomSheetTouchEvent): void {
      const touch = getFirstTouch(event);
      if (touch === undefined) return;
      const runtime = getInstanceRuntime(this);
      runtime.touchStart = { x: touch.clientX, y: touch.clientY };
      runtime.touchStartedAt = Date.now();
      runtime.ownsDrag = false;
    },
    requestClose(): void {
      if (this.data.phase === 'closed' || this.data.phase === 'closing') return;
      this.clearTransitionTimer();
      const sheetKey = this.properties.sheetKey;
      this.setData({
        dragOffsetPx: 0,
        panelTransform: 'translateY(0)',
        phase: nextBottomSheetPhase(this.data.phase, 'close-requested'),
      });
      this.triggerEvent('request-close', { sheetKey });
      this.schedulePhaseEvent(sheetKey, 'close-finished', bottomSheetAnimationMilliseconds);
    },
    noop(): void {},
    schedulePhaseEvent(
      sheetKey: number,
      event: 'close-finished' | 'open-finished',
      milliseconds: number,
    ): void {
      this.clearTransitionTimer();
      const phase = this.data.phase;
      const runtime = getInstanceRuntime(this);
      runtime.transitionTimer = setTimeout(() => {
        runtime.transitionTimer = undefined;
        if (this.properties.sheetKey !== sheetKey || this.data.phase !== phase) return;
        const next = nextBottomSheetPhase(this.data.phase, event);
        this.setData({ phase: next });
        if (event === 'close-finished' && next === 'closed')
          this.triggerEvent('closed', { sheetKey });
      }, milliseconds);
    },
    syncVisibility(): void {
      if (!this.properties.visible) {
        if (this.data.phase === 'closing') {
          this.setData({ panelTransform: 'translateY(100%)' });
          return;
        }
        this.clearTransitionTimer();
        const runtime = getInstanceRuntime(this);
        runtime.touchStart = undefined;
        runtime.touchStartedAt = 0;
        runtime.ownsDrag = false;
        this.setData({
          dragOffsetPx: 0,
          panelTransform: 'translateY(100%)',
          phase: 'closed',
          scrollTop: 0,
        });
        return;
      }
      this.clearTransitionTimer();
      const next = nextBottomSheetPhase(this.data.phase, 'open-requested');
      this.setData({
        dragOffsetPx: 0,
        panelTransform: 'translateY(0)',
        phase: next,
        scrollTop: 0,
      });
      if (next === 'opening') {
        this.schedulePhaseEvent(
          this.properties.sheetKey,
          'open-finished',
          bottomSheetAnimationMilliseconds,
        );
      }
    },
  },
});
