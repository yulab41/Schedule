export interface SelectorOption {
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

const selectorPopoverEmptyHeight = 56;
const selectorPopoverOptionHeight = 30;
const selectorPopoverOptionPadding = 10;
const selectorPopoverMaxHeight = 300;

// The affected Skyline runtime does not derive a scroll container height from its
// content inside another scroll container, so the popover collapsed to its padding.
// Other runtimes keep their content-driven height and receive an empty style.
export function createSelectorPopoverStyle(optionCount: number, compatibility: boolean): string {
  if (!compatibility) return '';
  const count = Number.isInteger(optionCount) && optionCount > 0 ? optionCount : 0;
  if (count === 0) return `height:${selectorPopoverEmptyHeight}px;`;
  return `height:${Math.min(
    selectorPopoverMaxHeight,
    selectorPopoverOptionHeight * count + selectorPopoverOptionPadding,
  )}px;`;
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
