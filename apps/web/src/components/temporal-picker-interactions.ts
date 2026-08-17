interface PointerCoordinates {
  readonly clientX: number;
  readonly clientY: number;
}

interface RectangleBounds {
  readonly bottom: number;
  readonly left: number;
  readonly right: number;
  readonly top: number;
}

export function isPointOutsideRectangle(
  point: PointerCoordinates,
  rectangle: RectangleBounds,
): boolean {
  return (
    point.clientX < rectangle.left ||
    point.clientX > rectangle.right ||
    point.clientY < rectangle.top ||
    point.clientY > rectangle.bottom
  );
}
