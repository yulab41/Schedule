import { createDirectoryPathCandidates, selectDirectoryTailPath } from './path-layout.js';

interface PathRect {
  readonly width: number;
}
interface PathQuery {
  select(selector: string): { boundingClientRect(): PathQuery };
  selectAll(selector: string): { boundingClientRect(): PathQuery };
  exec(callback: (results: readonly [PathRect | null, readonly PathRect[] | null]) => void): void;
}
interface TailPathInstance {
  _attached: boolean;
  _revision: number;
  _resizeHandler: (() => void) | undefined;
  readonly properties: { readonly value: string; readonly layoutActive: boolean };
  readonly data: { readonly candidates: readonly string[]; readonly displayText: string };
  createSelectorQuery(): PathQuery;
  setData(patch: Readonly<Record<string, unknown>>, callback?: () => void): void;
}
interface PathRuntime {
  nextTick?(callback: () => void): void;
  onWindowResize?(handler: () => void): void;
  offWindowResize?(handler: () => void): void;
}

Component({
  properties: {
    value: { type: String, value: '' },
    largeText: { type: Boolean, value: false },
    layoutActive: { type: Boolean, value: true },
  },
  data: { candidates: [] as readonly string[], displayText: '' },
  observers: {
    'value, largeText, layoutActive'(this: TailPathInstance): void {
      if (this._attached) refreshPath(this);
    },
  },
  lifetimes: {
    attached(this: TailPathInstance): void {
      this._attached = true;
      this._revision = 0;
      refreshPath(this);
      const runtime = wx as PathRuntime;
      if (!runtime.onWindowResize || !runtime.offWindowResize) return;
      const handler = (): void => {
        if (this._attached) refreshPath(this);
      };
      this._resizeHandler = handler;
      runtime.onWindowResize(handler);
    },
    ready(this: TailPathInstance): void {
      if (this._attached) refreshPath(this);
    },
    detached(this: TailPathInstance): void {
      this._attached = false;
      this._revision += 1;
      if (this._resizeHandler) (wx as PathRuntime).offWindowResize?.(this._resizeHandler);
      this._resizeHandler = undefined;
    },
  },
  pageLifetimes: {
    show(this: TailPathInstance): void {
      if (this._attached) refreshPath(this);
    },
  },
});

function refreshPath(path: TailPathInstance): void {
  const revision = ++path._revision;
  if (path.properties.layoutActive === false) return;
  const candidates = createDirectoryPathCandidates(path.properties.value);
  path.setData({ candidates, displayText: path.properties.value }, () => {
    const measure = (): void => {
      if (!path._attached || revision !== path._revision) return;
      const query = path.createSelectorQuery();
      query.select('.directory-tail-path').boundingClientRect();
      query.selectAll('.directory-tail-path__measure').boundingClientRect();
      query.exec(([bounds, measurements]) => {
        if (!path._attached || revision !== path._revision || !bounds || bounds.width <= 0) return;
        const displayText = selectDirectoryTailPath(
          candidates,
          (measurements ?? []).map((rect) => rect.width),
          bounds.width,
        );
        if (displayText !== path.data.displayText) path.setData({ displayText });
      });
    };
    const runtime = wx as PathRuntime;
    if (runtime.nextTick) runtime.nextTick(measure);
    else measure();
  });
}
