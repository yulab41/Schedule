export type BottomSheetPhase = 'closed' | 'closing' | 'dragging' | 'open' | 'opening' | 'settling';

export type BottomSheetPhaseEvent =
  | 'close-finished'
  | 'close-requested'
  | 'drag-bounced'
  | 'drag-started'
  | 'open-finished'
  | 'open-requested';

export const bottomSheetAnimationMilliseconds = 280;
export const bottomSheetBounceMilliseconds = 200;
export const bottomSheetDragCloseThresholdPx = 80;
export const bottomSheetDragCloseVelocityPxPerMillisecond = 0.8;
export const bottomSheetMaximumDragOffsetPx = 640;

export interface BottomSheetDragSample {
  readonly deltaX: number;
  readonly deltaY: number;
  readonly elapsedMilliseconds: number;
}

const phaseTransitions: Readonly<
  Partial<Record<BottomSheetPhase, Partial<Record<BottomSheetPhaseEvent, BottomSheetPhase>>>>
> = {
  closed: { 'open-requested': 'opening' },
  closing: { 'close-finished': 'closed', 'open-requested': 'opening' },
  dragging: { 'close-requested': 'closing', 'drag-bounced': 'settling' },
  open: { 'close-requested': 'closing', 'drag-started': 'dragging' },
  opening: { 'close-requested': 'closing', 'open-finished': 'open' },
  settling: { 'close-requested': 'closing', 'open-finished': 'open' },
};

export function nextBottomSheetPhase(
  phase: BottomSheetPhase,
  event: BottomSheetPhaseEvent,
): BottomSheetPhase {
  return phaseTransitions[phase]?.[event] ?? phase;
}

function hasDownwardVerticalIntent({ deltaX, deltaY }: BottomSheetDragSample): boolean {
  return deltaY > 0 && Math.abs(deltaY) > Math.abs(deltaX);
}

export function shouldBeginBottomSheetDrag(
  scrollTop: number,
  sample: BottomSheetDragSample,
): boolean {
  return scrollTop <= 1 && hasDownwardVerticalIntent(sample);
}

export function shouldCloseBottomSheet(sample: BottomSheetDragSample): boolean {
  return (
    hasDownwardVerticalIntent(sample) &&
    (sample.deltaY >= bottomSheetDragCloseThresholdPx ||
      (sample.elapsedMilliseconds > 0 &&
        sample.deltaY / sample.elapsedMilliseconds > bottomSheetDragCloseVelocityPxPerMillisecond))
  );
}

export function clampBottomSheetDragOffset(offsetPx: number): number {
  if (!Number.isFinite(offsetPx)) return 0;
  return Math.min(bottomSheetMaximumDragOffsetPx, Math.max(0, offsetPx));
}
