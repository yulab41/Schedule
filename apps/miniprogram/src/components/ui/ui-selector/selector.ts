export interface SelectorOption {
  readonly actionLabel?: string;
  readonly checked?: boolean;
  readonly disabled?: boolean;
  readonly value: string;
  readonly label: string;
  readonly isWeekend?: boolean;
}
export interface RenderedSelectorOption extends SelectorOption {
  readonly leadingLabel: string;
  readonly trailingLabel: string;
  readonly weekendLabel: string;
}
export interface SelectorPlacementBoundary {
  readonly bottom: number;
  readonly top: number;
}
export interface SelectorPlacementResult {
  readonly maxHeight: number;
  readonly placement: 'down' | 'up';
}
export interface SelectorInstance {
  readonly data: { readonly open: boolean };
  readonly properties: {
    readonly options: readonly SelectorOption[];
    readonly placementBoundary?: SelectorPlacementBoundary | null;
  };
  createSelectorQuery?(): MiniProgramSelectorQuery;
  setData(patch: Readonly<Record<string, unknown>>, callback?: () => void): void;
}

const selectorGap = 8;
const selectorMaximumHeight = 300;

export function resolveSelectorPlacement(
  trigger: Pick<MiniProgramRect, 'bottom' | 'top'>,
  popupHeight: number,
  windowHeight: number,
  boundary?: SelectorPlacementBoundary | null,
): SelectorPlacementResult {
  const viewportBottom = Math.max(0, windowHeight);
  const boundaryTop = Number.isFinite(boundary?.top)
    ? Math.min(viewportBottom, Math.max(0, boundary?.top ?? 0))
    : 0;
  const boundaryBottom = Number.isFinite(boundary?.bottom)
    ? Math.min(viewportBottom, Math.max(0, boundary?.bottom ?? viewportBottom))
    : viewportBottom;
  const hasValidBoundary = boundaryBottom > boundaryTop;
  const visibleTop = hasValidBoundary ? boundaryTop : 0;
  const visibleBottom = hasValidBoundary ? boundaryBottom : viewportBottom;
  const spaceBelow = Math.max(0, visibleBottom - trigger.bottom - selectorGap);
  const spaceAbove = Math.max(0, trigger.top - visibleTop - selectorGap);
  const placement =
    spaceBelow >= popupHeight
      ? ('down' as const)
      : spaceAbove >= popupHeight || spaceAbove > spaceBelow
        ? ('up' as const)
        : ('down' as const);
  const availableHeight = placement === 'up' ? spaceAbove : spaceBelow;
  return {
    maxHeight: Math.max(0, Math.min(selectorMaximumHeight, Math.floor(availableHeight))),
    placement,
  };
}

export function scheduleSelectorPlacement(instance: SelectorInstance): void {
  if (typeof wx === 'undefined' || instance.createSelectorQuery === undefined) {
    instance.setData({ popoverPlacementReady: true });
    return;
  }
  const query = instance.createSelectorQuery();
  query
    .select('.workflow-picker-trigger')
    .boundingClientRect()
    .exec((results) => {
      if (!instance.data.open) return;
      const trigger = results[0];
      if (trigger === undefined || trigger === null) {
        instance.setData({ popoverPlacementReady: true });
        return;
      }
      const optionCount = instance.properties.options.length;
      const popupHeight = Math.min(selectorMaximumHeight, Math.max(44, optionCount * 30 + 12));
      const windowHeight = wx.getWindowInfo().windowHeight;
      const result = resolveSelectorPlacement(
        trigger,
        popupHeight,
        windowHeight,
        instance.properties.placementBoundary,
      );
      instance.setData({
        popoverMaxHeight: result.maxHeight,
        popoverPlacement: result.placement,
        popoverPlacementReady: true,
      });
    });
}

export function validOptionIndex(
  options: readonly SelectorOption[],
  selectedIndex: number,
): number {
  return Number.isInteger(selectedIndex) && options[selectedIndex] !== undefined
    ? selectedIndex
    : -1;
}

export function createRenderedOptions(
  options: readonly SelectorOption[],
): readonly RenderedSelectorOption[] {
  return options.map((option) => {
    const match = option.isWeekend ? /^(.*?)(（周[六日]）)(.*)$/u.exec(option.label) : null;
    return {
      ...option,
      leadingLabel: match?.[1] ?? option.label,
      trailingLabel: match?.[3] ?? '',
      weekendLabel: match?.[2] ?? '',
    };
  });
}
