interface ShiftTimeDraft {
  crossesMidnight: boolean;
  endTime: string;
  startTime: string;
}

type ShiftTimeField = 'endTime' | 'startTime';

export function updateShiftDraftTime(
  draft: ShiftTimeDraft,
  field: ShiftTimeField,
  value: string,
): void {
  draft[field] = value;

  if (draft.startTime !== '' && draft.endTime !== '') {
    draft.crossesMidnight = draft.endTime <= draft.startTime;
  }
}
