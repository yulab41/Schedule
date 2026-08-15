import type { PopupProps } from 'tdesign-vue-next';

export function getResponsiveSheetPopupContainer(triggerNode?: HTMLElement): Element {
  return triggerNode?.closest('dialog.responsive-sheet') ?? document.body;
}

export const responsiveSheetPopupProps = {
  attach: getResponsiveSheetPopupContainer,
} satisfies PopupProps;
