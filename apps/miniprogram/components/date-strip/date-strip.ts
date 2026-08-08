interface DateStripData {
  readonly dates: readonly string[];
  readonly days: readonly string[];
  readonly isSnapping: boolean;
  readonly scrollIndex: number;
  readonly scrollLeft: number;
  readonly selected: string;
  readonly styles: readonly string[];
  readonly weekdays: readonly string[];
}

const ITEM_WIDTH_RPX = 96; // 每个日期项宽度，可按实际布局调整
const SCALE_RANGE_RPX = 720; // 缩放/透明度的作用半径，可按实际布局调整
const MIN_SCALE = 0.82;
const MIN_OPACITY = 0.35;
const STYLE_UPDATE_INTERVAL_MS = 50; // 滚动样式节流间隔，低端机可调大

interface StripMetrics {
  readonly itemWidth: number;
  readonly maxScroll: number;
  readonly range: number;
  readonly viewportWidth: number;
}

// 实例私有状态放在 WeakMap，避免污染 data 造成额外渲染
const metricsCache = new WeakMap<object, StripMetrics>();
const lastStyleUpdateCache = new WeakMap<object, number>();

function rpxToPx(rpx: number, windowWidthPx: number): number {
  return (windowWidthPx / 750) * rpx;
}

function weekdayLabel(businessDate: string): string {
  const date = new Date(`${businessDate}T00:00:00+08:00`);
  const weekday = (date.getUTCDay() + 6) % 7;
  return ['一', '二', '三', '四', '五', '六', '日'][weekday] ?? '';
}

Component({
  properties: {
    dates: {
      type: Array,
      value: [] as readonly string[],
    },
    selected: {
      type: String,
      value: '',
    },
    // 初始定位到指定索引；缺省时优先定位 selected，其次第一项
    scrollIndex: {
      type: Number,
      value: -1,
    },
  },

  data: {
    dates: [],
    days: [],
    isSnapping: false,
    scrollIndex: -1,
    scrollLeft: 0,
    selected: '',
    styles: [],
    weekdays: [],
  } as DateStripData,

  lifetimes: {
    attached() {
      this.rebuildLabels();
    },
  },

  observers: {
    'dates, selected, scrollIndex'() {
      this.rebuildLabels();
    },
  },

  methods: {
    rebuildLabels() {
      const dates = this.data.dates as readonly string[];
      this.setData({
        days: dates.map((date) => date.slice(8)),
        selected: this.data.selected,
        weekdays: dates.map(weekdayLabel),
      });
      this.prepareScroll();
    },

    getMetrics() {
      const cached = metricsCache.get(this);
      if (cached !== undefined) {
        return cached;
      }
      const dates = this.data.dates as readonly string[];
      const windowInfo =
        typeof wx.getWindowInfo === 'function' ? wx.getWindowInfo() : wx.getSystemInfoSync();
      const itemWidth = rpxToPx(ITEM_WIDTH_RPX, windowInfo.windowWidth);
      const metrics: StripMetrics = {
        itemWidth,
        maxScroll: Math.max(0, itemWidth * dates.length - windowInfo.windowWidth),
        range: rpxToPx(SCALE_RANGE_RPX, windowInfo.windowWidth),
        viewportWidth: windowInfo.windowWidth,
      };
      metricsCache.set(this, metrics);
      return metrics;
    },

    prepareScroll() {
      const dates = this.data.dates as readonly string[];
      if (dates.length === 0) {
        return;
      }
      const metrics = this.getMetrics();
      let index = Number(this.data.scrollIndex);
      if (!Number.isInteger(index) || index < 0) {
        const selectedIndex = dates.indexOf(this.data.selected);
        index = selectedIndex >= 0 ? selectedIndex : 0;
      }
      index = Math.min(index, dates.length - 1);
      const target = index * metrics.itemWidth - (metrics.viewportWidth - metrics.itemWidth) / 2;
      this.setData({
        isSnapping: false,
        scrollLeft: Math.max(0, Math.min(target, metrics.maxScroll)),
      });
      this.updateStyles(this.data.scrollLeft);
    },

    onScroll(event: WechatMiniprogram.ScrollViewScroll) {
      const now = Date.now();
      const lastUpdate = lastStyleUpdateCache.get(this);
      if (lastUpdate !== undefined && now - lastUpdate < STYLE_UPDATE_INTERVAL_MS) {
        return;
      }
      lastStyleUpdateCache.set(this, now);
      if (this.data.isSnapping) {
        // 手指拖动时关闭回弹过渡，让缩放/透明度实时跟随位移
        this.setData({ isSnapping: false });
      }
      this.updateStyles(event.detail.scrollLeft);
    },

    updateStyles(scrollLeft: number) {
      const dates = this.data.dates as readonly string[];
      const metrics = this.getMetrics();
      if (metrics.itemWidth <= 0) {
        return;
      }
      const center = scrollLeft + metrics.viewportWidth / 2;
      const next: string[] = [];
      for (let i = 0; i < dates.length; i += 1) {
        const itemCenter = i * metrics.itemWidth + metrics.itemWidth / 2;
        const distance = Math.abs(itemCenter - center);
        const ratio = Math.min(1, distance / metrics.range);
        const scale = Math.max(MIN_SCALE, 1 - ratio * 0.18);
        const opacity = Math.max(MIN_OPACITY, 1 - ratio * 0.65);
        next.push(`transform: scale(${scale.toFixed(3)}); opacity: ${opacity.toFixed(3)};`);
      }
      this.setData({ styles: next });
    },

    // 松手/滚动停止后吸附到最近日期：滚动条自带惯性，
    // 这里只做“最近项”取整 + scroll-with-animation 回弹（物理惯性由原生滚动提供）。
    snapToNearest() {
      const dates = this.data.dates as readonly string[];
      if (dates.length === 0) {
        return;
      }
      const metrics = this.getMetrics();
      const nearest = Math.round(this.data.scrollLeft / metrics.itemWidth);
      const index = Math.max(0, Math.min(nearest, dates.length - 1));
      const target = index * metrics.itemWidth - (metrics.viewportWidth - metrics.itemWidth) / 2;
      this.setData({
        isSnapping: true,
        scrollLeft: Math.max(0, Math.min(target, metrics.maxScroll)),
      });
      this.updateStyles(this.data.scrollLeft);
      this.triggerEvent('change', { date: dates[index], index });
    },

    onTouchEnd() {
      // touchend 早于惯性结束；稍等再吸附，避免打断惯性（时长可按实际布局调整）
      setTimeout(() => this.snapToNearest(), 120);
    },

    onScrollEnd() {
      this.snapToNearest();
    },

    onItemTap(event: WechatMiniprogram.TouchEvent) {
      const index = Number(event.currentTarget.dataset.index ?? -1);
      const dates = this.data.dates as readonly string[];
      if (!Number.isInteger(index) || index < 0 || index >= dates.length) {
        return;
      }
      const metrics = this.getMetrics();
      const target = index * metrics.itemWidth - (metrics.viewportWidth - metrics.itemWidth) / 2;
      this.setData({
        isSnapping: true,
        scrollLeft: Math.max(0, Math.min(target, metrics.maxScroll)),
      });
      this.triggerEvent('change', { date: dates[index], index });
    },
  },
});
