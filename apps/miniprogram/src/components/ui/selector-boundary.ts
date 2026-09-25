export interface SelectorPlacementBoundary {
  readonly bottom: number;
  readonly top: number;
}

interface SelectorBoundaryHost {
  createSelectorQuery?(): MiniProgramSelectorQuery;
  setData(patch: Readonly<Record<string, unknown>>): void;
}

export function measureSelectorPlacementBoundary(
  host: object,
  selector: string,
  dataKey = 'pickerBoundary',
  isCurrent: () => boolean = () => true,
): void {
  const target = host as SelectorBoundaryHost;
  if (target.createSelectorQuery === undefined) return;
  target
    .createSelectorQuery()
    .select(selector)
    .boundingClientRect()
    .exec((results) => {
      if (!isCurrent()) return;
      const rect = results[0];
      if (
        rect === undefined ||
        rect === null ||
        !Number.isFinite(rect.top) ||
        !Number.isFinite(rect.bottom) ||
        rect.bottom <= rect.top
      ) {
        target.setData({ [dataKey]: null });
        return;
      }
      target.setData({
        [dataKey]: {
          bottom: rect.bottom,
          top: rect.top,
        } satisfies SelectorPlacementBoundary,
      });
    });
}
