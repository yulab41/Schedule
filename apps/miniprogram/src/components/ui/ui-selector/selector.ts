export interface SelectorOption {
  readonly value: string;
  readonly label: string;
  readonly isWeekend?: boolean;
}
export interface RenderedSelectorOption extends SelectorOption {
  readonly leadingLabel: string;
  readonly trailingLabel: string;
  readonly weekendLabel: string;
}
export interface SelectorInstance {
  readonly data: { readonly open: boolean };
  readonly properties: { readonly options: readonly SelectorOption[] };
  createSelectorQuery?(): MiniProgramSelectorQuery;
  setData(patch: Readonly<Record<string, unknown>>, callback?: () => void): void;
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
      const popupHeight = Math.min(300, Math.max(44, optionCount * 30 + 12));
      const windowHeight = wx.getWindowInfo().windowHeight;
      const spaceBelow = windowHeight - trigger.bottom - 8;
      const spaceAbove = trigger.top - 8;
      instance.setData({
        popoverPlacement:
          spaceBelow < popupHeight && spaceAbove > spaceBelow ? ('up' as const) : ('down' as const),
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
