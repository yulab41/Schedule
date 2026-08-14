export interface SwipeDelta {
  readonly deltaX: number;
  readonly deltaY: number;
}

export type SwipeMonthIntent = -1 | 0 | 1;

const minimumHorizontalDistance = 56;
const horizontalDominanceRatio = 1.2;

export function getSwipeMonthIntent({ deltaX, deltaY }: SwipeDelta): SwipeMonthIntent {
  const horizontalDistance = Math.abs(deltaX);
  const verticalDistance = Math.abs(deltaY);

  if (
    horizontalDistance < minimumHorizontalDistance ||
    horizontalDistance < verticalDistance * horizontalDominanceRatio
  ) {
    return 0;
  }

  return deltaX < 0 ? 1 : -1;
}
