// Keep the persisted historical key format stable across algorithm retirement.
export function createAssignmentBusinessKey(
  scheduleRoleId: string,
  businessDate: string,
  slotPosition: number,
): string {
  return `rotation:${encodeURIComponent(scheduleRoleId)}:${businessDate}:${slotPosition}`;
}
