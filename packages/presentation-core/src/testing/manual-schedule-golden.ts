export interface ManualGoldenSelection {
  readonly cycleDay: number;
  readonly membershipId: string;
}

export interface ManualGoldenWebAction {
  readonly activeShiftTypeId?: string | undefined;
  readonly selection: ManualGoldenSelection;
}

export const manualGoldenCellEntries = [
  ['1:member-1', 'shift-a'],
  ['2:member-1', 'shift-b'],
  ['1:member-2', 'shift-c'],
] as const;

export const manualGoldenSelections = {
  first: { cycleDay: 1, membershipId: 'member-1' },
  second: { cycleDay: 2, membershipId: 'member-1' },
} as const satisfies Readonly<Record<'first' | 'second', ManualGoldenSelection>>;

export const manualGoldenWebActions: readonly ManualGoldenWebAction[] = [
  { activeShiftTypeId: 'shift-a', selection: manualGoldenSelections.first },
  { selection: manualGoldenSelections.first },
  { activeShiftTypeId: 'shift-p', selection: manualGoldenSelections.second },
  { activeShiftTypeId: 'shift-n', selection: manualGoldenSelections.first },
];
