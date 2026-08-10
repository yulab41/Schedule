import { describe, expect, it } from 'vitest';

import {
  bottomSheetDragCloseThresholdPx,
  bottomSheetDragCloseVelocityPxPerMillisecond,
  bottomSheetMaximumDragOffsetPx,
  clampBottomSheetDragOffset,
  nextBottomSheetPhase,
  shouldBeginBottomSheetDrag,
  shouldCloseBottomSheet,
  type BottomSheetPhase,
  type BottomSheetPhaseEvent,
} from './bottom-sheet-logic.js';

const phases: readonly BottomSheetPhase[] = [
  'closed',
  'closing',
  'dragging',
  'open',
  'opening',
  'settling',
];

const events: readonly BottomSheetPhaseEvent[] = [
  'close-finished',
  'close-requested',
  'drag-bounced',
  'drag-started',
  'open-finished',
  'open-requested',
];

const transitions: Readonly<Record<string, BottomSheetPhase>> = {
  'closed:open-requested': 'opening',
  'closing:close-finished': 'closed',
  'closing:open-requested': 'opening',
  'dragging:close-requested': 'closing',
  'dragging:drag-bounced': 'settling',
  'open:close-requested': 'closing',
  'open:drag-started': 'dragging',
  'opening:close-requested': 'closing',
  'opening:open-finished': 'open',
  'settling:close-requested': 'closing',
  'settling:open-finished': 'open',
};

describe('bottom sheet logic', () => {
  it('defines every phase transition and retains state for all other events', () => {
    for (const phase of phases) {
      for (const event of events) {
        expect(nextBottomSheetPhase(phase, event)).toBe(transitions[`${phase}:${event}`] ?? phase);
      }
    }
  });

  it('accepts only a downward vertical drag when content is at the top', () => {
    expect(shouldBeginBottomSheetDrag(1, { deltaX: 0, deltaY: 1, elapsedMilliseconds: 1 })).toBe(
      true,
    );
    expect(shouldBeginBottomSheetDrag(1.01, { deltaX: 0, deltaY: 8, elapsedMilliseconds: 1 })).toBe(
      false,
    );
    expect(shouldBeginBottomSheetDrag(0, { deltaX: 8, deltaY: 8, elapsedMilliseconds: 1 })).toBe(
      false,
    );
    expect(shouldBeginBottomSheetDrag(0, { deltaX: 0, deltaY: -1, elapsedMilliseconds: 1 })).toBe(
      false,
    );
    expect(shouldBeginBottomSheetDrag(0, { deltaX: 0, deltaY: 0, elapsedMilliseconds: 1 })).toBe(
      false,
    );
  });

  it('closes only at the configured distance or strictly faster than the velocity threshold', () => {
    expect(bottomSheetDragCloseThresholdPx).toBe(80);
    expect(bottomSheetDragCloseVelocityPxPerMillisecond).toBe(0.8);
    expect(shouldCloseBottomSheet({ deltaX: 0, deltaY: 79.9, elapsedMilliseconds: 200 })).toBe(
      false,
    );
    expect(shouldCloseBottomSheet({ deltaX: 0, deltaY: 80, elapsedMilliseconds: 200 })).toBe(true);
    expect(shouldCloseBottomSheet({ deltaX: 0, deltaY: 8, elapsedMilliseconds: 10 })).toBe(false);
    expect(shouldCloseBottomSheet({ deltaX: 0, deltaY: 8.1, elapsedMilliseconds: 10 })).toBe(true);
    expect(shouldCloseBottomSheet({ deltaX: 20, deltaY: 10, elapsedMilliseconds: 1 })).toBe(false);
    expect(shouldCloseBottomSheet({ deltaX: 0, deltaY: 9, elapsedMilliseconds: 0 })).toBe(false);
  });

  it('clamps finite drag offsets to the supported range', () => {
    expect(bottomSheetMaximumDragOffsetPx).toBe(640);
    expect(clampBottomSheetDragOffset(-1)).toBe(0);
    expect(clampBottomSheetDragOffset(0)).toBe(0);
    expect(clampBottomSheetDragOffset(320)).toBe(320);
    expect(clampBottomSheetDragOffset(641)).toBe(640);
    expect(clampBottomSheetDragOffset(Number.NaN)).toBe(0);
    expect(clampBottomSheetDragOffset(Number.POSITIVE_INFINITY)).toBe(0);
  });
});
