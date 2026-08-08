const DRAG_CLOSE_THRESHOLD_PX = 120;
const DRAG_CLOSE_VELOCITY_PX_MS = 0.6;
const EXIT_ANIMATION_MS = 220;

export {};

interface DutyDetailData {
  readonly contentScrollTop: number;
  readonly dragY: number;
  readonly leaving: boolean;
  readonly startTime: number;
  readonly startY: number;
}

Component({
  properties: {
    show: {
      type: Boolean,
      value: false,
    },
    detail: {
      type: Object,
      value: null,
    },
  },

  data: {
    contentScrollTop: 0,
    dragY: 0,
    leaving: false,
    startTime: 0,
    startY: 0,
  } as DutyDetailData,

  observers: {
    show(show: boolean) {
      if (!show) {
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

    onTouchMove(event: WechatMiniprogram.TouchEvent) {
      if (this.data.contentScrollTop > 0) {
        return;
      }
      const currentY = event.touches[0]?.clientY ?? this.data.startY;
      this.setData({ dragY: Math.max(0, currentY - this.data.startY) });
    },

    onTouchEnd() {
      const elapsed = Date.now() - this.data.startTime;
      const velocity = elapsed > 0 ? this.data.dragY / elapsed : 0;
      if (
        this.data.dragY >= DRAG_CLOSE_THRESHOLD_PX ||
        (elapsed < 250 && velocity >= DRAG_CLOSE_VELOCITY_PX_MS)
      ) {
        this.close();
        return;
      }
      this.setData({ dragY: 0 });
    },

    close() {
      if (this.data.leaving) {
        return;
      }
      this.setData({ leaving: true });
      setTimeout(() => {
        this.setData({ leaving: false });
        this.triggerEvent('close');
      }, EXIT_ANIMATION_MS);
    },

    onClose() {
      this.close();
    },

    onCall(event: WechatMiniprogram.TouchEvent) {
      const number = event.currentTarget.dataset.number;
      if (typeof number === 'string' && number.length > 0) {
        this.triggerEvent('call', { number });
      }
    },
  },
});
