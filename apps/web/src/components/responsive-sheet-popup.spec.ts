import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it, vi } from 'vitest';

import {
  getResponsiveSheetPopupContainer,
  responsiveSheetPopupProps,
} from './responsive-sheet-popup.js';

function readSource(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8');
}

describe('responsive sheet popup mounting', () => {
  it('keeps a popup inside the modal dialog top layer', () => {
    const sheet = {} as Element;
    const closest = vi.fn(() => sheet);
    const trigger = { closest } as unknown as HTMLElement;

    expect(getResponsiveSheetPopupContainer(trigger)).toBe(sheet);
    expect(closest).toHaveBeenCalledWith('dialog.responsive-sheet');
    expect(responsiveSheetPopupProps.attach).toBe(getResponsiveSheetPopupContainer);
  });

  it.each([
    ['../views/calendar/CalendarView.vue', 3],
    ['../features/swaps/SwapPanel.vue', 7],
    ['../features/duty-adjustments/DutyAdjustmentPanel.vue', 4],
  ])('mounts every reported sheet select through the shared popup props in %s', (path, count) => {
    const source = readSource(path);
    const sheetSource = source.slice(source.indexOf('<ResponsiveSheet'));

    expect(sheetSource.match(/:popup-props="responsiveSheetPopupProps"/g)).toHaveLength(count);
  });
});
