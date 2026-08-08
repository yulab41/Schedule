const DRAG_CLOSE_THRESHOLD_PX = 120; // 下滑关闭阈值，可按实际布局调整
const DRAG_CLOSE_VELOCITY_PX_MS = 0.6; // 快速下滑速度阈值（px/ms）
const EXIT_ANIMATION_MS = 220;

export {};

interface ConfirmDialogData {
  readonly contentScrollTop: number;
  readonly dragY: number;
  readonly leaving: boolean;
  readonly startTime: number;
  readonly startY: number;
}

Component({
  properties: {
    title: {
      type: String,
      value: '请确认',
    },
    content: {
      type: String,
      value: '',
    },
    visible: {
      type: Boolean,
      value: false,
    },
    confirmText: {
      type: String,
      value: '确认',
    },
    cancelText: {
      type: String,
      value: '取消',
    },
  },

  data: {
    contentScrollTop: 0,
    dragY: 0,
    leaving: false,
    startTime: 0,
    startY: 0,
  } as ConfirmDialogData,

  observers: {
    visible(visible: boolean) {
      if (!visible) {
        // 关闭后复位拖拽与退场状态，避免下次打开残留位移
        this.setData({ dragY: 0, leaving: false });
      }
    },
  },

  methods: {
    onContentScroll(event: WechatMiniprogram.ScrollViewScroll) {
      this.setData({ contentScrollTop: event.detail.scrollTop });
    },

    onTouchStart(event: WechatMiniprogram.TouchEvent) {
      this.setData({
        startTime: Date.now(),
        startY: event.touches[0]?.clientY ?? 0,
      });
    },

    // 仅在内容滚动到顶部时允许下拉关闭，避免与内容滚动冲突
    onTouchMove(event: WechatMiniprogram.TouchEvent) {
      if (this.data.contentScrollTop > 0) {
        return;
      }
      const currentY = event.touches[0]?.clientY ?? this.data.startY;
      const delta = Math.max(0, currentY - this.data.startY);
      this.setData({ dragY: delta });
    },

    onTouchEnd() {
      const elapsed = Date.now() - this.data.startTime;
      const velocity = elapsed > 0 ? this.data.dragY / elapsed : 0;
      if (
        this.data.dragY >= DRAG_CLOSE_THRESHOLD_PX ||
        (elapsed < 250 && velocity >= DRAG_CLOSE_VELOCITY_PX_MS)
      ) {
        this.close('cancel');
        return;
      }
      // 未达阈值：CSS transition 自动回弹到原位
      this.setData({ dragY: 0 });
    },

    close(eventName: 'cancel' | 'confirm') {
      if (this.data.leaving) {
        return;
      }
      this.setData({ leaving: true });
      setTimeout(() => {
        this.setData({ leaving: false });
        this.triggerEvent(eventName);
      }, EXIT_ANIMATION_MS);
    },

    onCancel() {
      this.close('cancel');
    },

    onConfirm() {
      this.close('confirm');
    },

    noop() {
      // 阻止遮罩点击冒泡关闭
    },
  },
});
