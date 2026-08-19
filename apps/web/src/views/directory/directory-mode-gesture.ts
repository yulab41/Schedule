export type DirectoryMode = 'internal' | 'employee';

export interface DirectorySwipeCoordinates {
  readonly startX: number;
  readonly startY: number;
  readonly endX: number;
  readonly endY: number;
}

const DEFAULT_SWIPE_THRESHOLD = 48;
const HORIZONTAL_DOMINANCE_RATIO = 1.2;

export function getDirectorySwipeTarget(
  current: DirectoryMode,
  coordinates: DirectorySwipeCoordinates,
  threshold = DEFAULT_SWIPE_THRESHOLD,
): DirectoryMode | undefined {
  const deltaX = coordinates.endX - coordinates.startX;
  const deltaY = coordinates.endY - coordinates.startY;

  if (
    Math.abs(deltaX) < threshold ||
    Math.abs(deltaX) <= Math.abs(deltaY) * HORIZONTAL_DOMINANCE_RATIO
  ) {
    return undefined;
  }

  if (current === 'internal' && deltaX < 0) {
    return 'employee';
  }

  if (current === 'employee' && deltaX > 0) {
    return 'internal';
  }

  return undefined;
}
