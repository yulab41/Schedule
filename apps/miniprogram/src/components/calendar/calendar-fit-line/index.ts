interface FitLineInstance {
  _fitAlive?: boolean;
  _fitRevision?: number;
  readonly data: { readonly fitScale: number; readonly fitHeight: number };
  readonly properties: {
    readonly active: boolean;
    readonly maxScale: number;
    readonly layout: string;
    readonly contentKey: string;
    readonly referenceName: string;
  };
  getPageId(): string;
  groupSetData(callback: () => void): void;
  createSelectorQuery(): MiniProgramSelectorQuery;
  setData(patch: Record<string, unknown>): void;
}

const pending = new Map<string, Set<FitLineInstance>>();
interface Measurement {
  available: number;
  natural: number;
  reference: number;
  height: number;
}
const measurements = new Map<string, Measurement>();
let windowWidth: number | undefined;
let widthRevision = 0;

function refreshWidth(): void {
  const width = wx.getWindowInfo().windowWidth;
  if (width === windowWidth) return;
  windowWidth = width;
  widthRevision++;
  measurements.clear();
}

function usesReference(row: FitLineInstance): boolean {
  return /^[\u3400-\u9fff]{1,3}$/u.test(row.properties.referenceName);
}

function measurementKey(row: FitLineInstance): string {
  return JSON.stringify([
    row.getPageId(),
    row.properties.layout,
    usesReference(row) ? 'three-character-reference' : row.properties.contentKey,
  ]);
}

function applyFit(row: FitLineInstance, result: Measurement): void {
  const cap = Number.isFinite(row.properties.maxScale)
    ? Math.max(1, Math.min(1.18, row.properties.maxScale))
    : 1;
  const fitScale = Math.min(
    cap,
    Math.floor((result.available / Math.max(result.natural, result.reference)) * 10000) / 10000,
  );
  const fitHeight = fitScale > 1 ? result.height * fitScale : 0;
  if (fitScale !== row.data.fitScale || fitHeight !== row.data.fitHeight)
    row.setData({ fitScale, fitHeight });
}

function scheduleFit(instance: FitLineInstance): void {
  instance._fitRevision = (instance._fitRevision ?? 0) + 1;
  if (!instance._fitAlive || !instance.properties.active) return;
  if (windowWidth === undefined) refreshWidth();
  const pageId = instance.getPageId();
  const queued = pending.get(pageId);
  if (queued) {
    queued.add(instance);
    return;
  }
  const queue = new Set([instance]);
  pending.set(pageId, queue);
  wx.nextTick(() => {
    pending.delete(pageId);
    const rows = [...queue]
      .filter((row) => row._fitAlive && row.properties.active)
      .map((row) => ({ row, revision: row._fitRevision, key: measurementKey(row) }));
    const first = rows[0]?.row;
    if (!first) return;
    // Ordinary Chinese names share one fixed three-character reference per layout.
    // Longer names / compound badges are measured only once per distinct content.
    const missing = new Map<string, (typeof rows)[number]>();
    first.groupSetData(() => {
      for (const entry of rows) {
        const { row, key } = entry;
        const cached = measurements.get(key);
        if (cached) applyFit(row, cached);
        else if (!missing.has(key)) missing.set(key, entry);
      }
    });
    if (missing.size === 0) return;
    const entries = [...missing];
    const measuredWidthRevision = widthRevision;
    const query = first.createSelectorQuery();
    for (const [, { row }] of entries) {
      query.in(row).select('.fit-viewport').boundingClientRect();
      query.in(row).select('.fit-measure').boundingClientRect();
      query.in(row).select('.fit-reference').boundingClientRect();
    }
    query.exec((results) => {
      if (measuredWidthRevision !== widthRevision) return;
      const measured = new Map<string, Measurement>();
      entries.forEach(([key, { row, revision }], index) => {
        if (!row._fitAlive || !row.properties.active || revision !== row._fitRevision) return;
        const available = results[index * 3]?.width ?? 0;
        const content = results[index * 3 + 1];
        const reference = results[index * 3 + 2]?.width ?? 0;
        const natural = usesReference(row) && reference > 0 ? reference : (content?.width ?? 0);
        if (available <= 0 || natural <= 0 || !Number.isFinite(available + natural)) return;
        const result = { available, natural, reference, height: content?.height ?? 0 };
        measured.set(key, result);
        measurements.set(key, result);
        if (measurements.size > 512) measurements.delete(measurements.keys().next().value!);
      });
      const apply = () =>
        rows.forEach(({ row, revision, key }) => {
          const cached = measured.get(key) ?? measurements.get(key);
          if (cached && row._fitAlive && row.properties.active && revision === row._fitRevision)
            applyFit(row, cached);
        });
      // Keep all component updates in the same draw, without one paint per row.
      const live = rows.find(({ row }) => row._fitAlive)?.row;
      live?.groupSetData(apply);
    });
  });
}

Component({
  properties: {
    contentKey: { type: String, value: '' },
    active: { type: Boolean, value: true },
    maxScale: { type: Number, value: 1 },
    centered: { type: Boolean, value: false },
    layout: { type: String, value: '' },
    referenceName: { type: String, value: '' },
  },
  data: { fitScale: 1, fitHeight: 0 },
  observers: {
    'contentKey, active, maxScale, layout, referenceName'(this: FitLineInstance): void {
      scheduleFit(this);
    },
  },
  lifetimes: {
    ready(this: FitLineInstance): void {
      this._fitAlive = true;
      scheduleFit(this);
    },
    detached(this: FitLineInstance): void {
      this._fitAlive = false;
      this._fitRevision = (this._fitRevision ?? 0) + 1;
    },
  },
  pageLifetimes: {
    show(this: FitLineInstance): void {
      scheduleFit(this);
    },
    resize(this: FitLineInstance): void {
      refreshWidth();
      scheduleFit(this);
    },
  },
});
