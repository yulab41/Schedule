interface FitLineInstance {
  _fitAlive?: boolean;
  _fitQueued?: boolean;
  _fitRevision?: number;
  readonly data: { readonly fitScale: number };
  readonly properties: { readonly active: boolean };
  createSelectorQuery(): MiniProgramSelectorQuery;
  setData(patch: Record<string, unknown>): void;
}

function scheduleFit(instance: FitLineInstance): void {
  instance._fitRevision = (instance._fitRevision ?? 0) + 1;
  if (!instance._fitAlive || !instance.properties.active || instance._fitQueued) return;
  instance._fitQueued = true;
  wx.nextTick(() => {
    instance._fitQueued = false;
    if (!instance._fitAlive || !instance.properties.active) return;
    const revision = instance._fitRevision;
    instance
      .createSelectorQuery()
      .select('.fit-viewport')
      .boundingClientRect()
      .select('.fit-measure')
      .boundingClientRect()
      .exec(([viewport, content]) => {
        if (
          !instance._fitAlive ||
          !instance.properties.active ||
          revision !== instance._fitRevision
        )
          return;
        const available = viewport?.width ?? 0;
        const natural = content?.width ?? 0;
        // A hidden pane is measured again on activation/show, never by polling.
        if (available <= 0 || natural <= 0 || !Number.isFinite(available + natural)) return;
        const fitScale = Math.min(1, Math.floor((available / natural) * 10000) / 10000);
        if (fitScale !== instance.data.fitScale) instance.setData({ fitScale });
      });
  });
}

Component({
  properties: {
    contentKey: { type: String, value: '' },
    active: { type: Boolean, value: true },
  },
  data: { fitScale: 1 },
  observers: {
    'contentKey, active'(this: FitLineInstance): void {
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
      scheduleFit(this);
    },
  },
});
