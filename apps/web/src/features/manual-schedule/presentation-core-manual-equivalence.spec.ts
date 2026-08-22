import {
  applyManualCellMutation,
  clearManualCell,
  clearManualColumn,
  clearManualRow,
  createManualCellKey,
  createManualSnapshotUndoStack,
  getManualCellValue,
  resolveManualCellMutation,
  resolveManualSelection,
  revertManualCellMutation,
  type ManualCellMap,
} from '@schedule/presentation-core';
import {
  manualGoldenCellEntries,
  manualGoldenSelections,
  manualGoldenWebActions,
} from '@schedule/presentation-core/testing';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';

import {
  applyShiftToCell,
  clearCell,
  clearColumn,
  clearRow,
  createCellKey,
  createTemplateUndoStack,
  getTemplateCellShiftTypeId,
  type ManualGridSelection,
  type TemplateCellMap,
} from './manual-schedule-logic.js';

interface WebTrackState {
  readonly cells: readonly (readonly [string, string])[];
  readonly selectedCell: ManualGridSelection | undefined;
  readonly undoSnapshots: readonly (readonly (readonly [string, string])[])[];
}

interface MiniAssignment {
  readonly abbreviation: string;
  readonly shiftTypeId: string;
}

function sortedEntries<Value>(
  cells: ReadonlyMap<string, Value>,
): readonly (readonly [string, Value])[] {
  return [...cells.entries()].sort(([left], [right]) => left.localeCompare(right));
}

function sameWebSelection(left: ManualGridSelection, right: ManualGridSelection): boolean {
  return left.cycleDay === right.cycleDay && left.membershipId === right.membershipId;
}

function drainLegacyUndoStack(
  stack: ReturnType<typeof createTemplateUndoStack>,
): readonly (readonly (readonly [string, string])[])[] {
  const snapshots: (readonly (readonly [string, string])[])[] = [];
  while (stack.canUndo()) {
    const snapshot = stack.pop();
    if (snapshot !== undefined) snapshots.push(sortedEntries(snapshot));
  }
  return snapshots;
}

function runLegacyWebTrack(): WebTrackState {
  let cells: TemplateCellMap = new Map(manualGoldenCellEntries);
  let selectedCell: ManualGridSelection | undefined;
  const undo = createTemplateUndoStack();

  for (const action of manualGoldenWebActions) {
    selectedCell =
      selectedCell !== undefined && sameWebSelection(selectedCell, action.selection)
        ? undefined
        : action.selection;
    if (action.activeShiftTypeId !== undefined) {
      undo.push(cells);
      const current = cells.get(
        createCellKey(action.selection.cycleDay, action.selection.membershipId),
      );
      cells =
        current === action.activeShiftTypeId
          ? clearCell(cells, action.selection.cycleDay, action.selection.membershipId)
          : applyShiftToCell(
              cells,
              action.selection.cycleDay,
              action.selection.membershipId,
              action.activeShiftTypeId,
            );
    }
  }

  return {
    cells: sortedEntries(cells),
    selectedCell,
    undoSnapshots: drainLegacyUndoStack(undo),
  };
}

function runSharedWebTrack(): WebTrackState {
  let cells: ManualCellMap<string> = new Map(manualGoldenCellEntries);
  let selectedCell: ManualGridSelection | undefined;
  const undo = createManualSnapshotUndoStack<string>();

  for (const action of manualGoldenWebActions) {
    selectedCell = resolveManualSelection(selectedCell, action.selection, {
      isSame: sameWebSelection,
      mode: 'toggle',
    });
    if (action.activeShiftTypeId !== undefined) {
      undo.push(cells);
      const key = createManualCellKey(action.selection.cycleDay, action.selection.membershipId);
      cells = applyManualCellMutation(
        cells,
        resolveManualCellMutation({
          active: action.activeShiftTypeId,
          before: cells.get(key),
          key,
          mode: 'toggle',
        }),
      );
    }
  }

  const undoSnapshots: (readonly (readonly [string, string])[])[] = [];
  while (undo.canUndo()) {
    const snapshot = undo.pop();
    if (snapshot !== undefined) undoSnapshots.push(sortedEntries(snapshot));
  }
  return { cells: sortedEntries(cells), selectedCell, undoSnapshots };
}

describe('presentation-core manual schedule equivalence', () => {
  it('wires the Web editor through shared selection and mutation transitions', () => {
    const source = readFileSync(
      fileURLToPath(new URL('../../views/schedules/ManualScheduleView.vue', import.meta.url)),
      'utf8',
    );
    expect(source).toContain('resolveManualSelection');
    expect(source).toContain('resolveManualCellMutation');
    expect(source).toContain('applyManualCellMutation');
    expect(source).not.toContain('currentShiftTypeId === activeShiftTypeId.value');
  });

  it('matches the existing Web cell keys, immutable fills, clears, rows, and columns', () => {
    const cells = new Map<string, string>(manualGoldenCellEntries);
    expect(createManualCellKey(1, 'member-1')).toBe(createCellKey(1, 'member-1'));
    expect(
      sortedEntries(
        applyManualCellMutation(
          cells,
          resolveManualCellMutation({
            active: 'shift-new',
            before: cells.get('1:member-2'),
            key: '1:member-2',
            mode: 'replace',
          }),
        ),
      ),
    ).toEqual(sortedEntries(applyShiftToCell(cells, 1, 'member-2', 'shift-new')));
    expect(sortedEntries(clearManualCell(cells, '1:member-1'))).toEqual(
      sortedEntries(clearCell(cells, 1, 'member-1')),
    );
    expect(sortedEntries(clearManualRow(cells, 'member-1'))).toEqual(
      sortedEntries(clearRow(cells, 'member-1')),
    );
    expect(sortedEntries(clearManualColumn(cells, 2))).toEqual(
      sortedEntries(clearColumn(cells, 2)),
    );
    expect(getManualCellValue(cells, '2:member-1')).toBe(
      getTemplateCellShiftTypeId(cells, 2, 'member-1'),
    );
    expect(cells).toEqual(new Map(manualGoldenCellEntries));
  });

  it('replays Web toggle selection and full-snapshot undo exactly', () => {
    expect(runSharedWebTrack()).toEqual(runLegacyWebTrack());
  });

  it('keeps snapshot undo isolated from later mutations and clears on editor reset', () => {
    const undo = createManualSnapshotUndoStack<string>();
    const cells = new Map<string, string>(manualGoldenCellEntries);
    undo.push(cells);
    cells.set('3:member-3', 'shift-late');
    expect(undo.pop()).toEqual(new Map(manualGoldenCellEntries));
    undo.push(cells);
    undo.clear();
    expect(undo.canUndo()).toBe(false);
    expect(undo.pop()).toBeUndefined();
  });

  it('models Mini replace selection and incremental key/before/after undo without snapshots', () => {
    const before: MiniAssignment = { abbreviation: 'P', shiftTypeId: 'shift-p' };
    const active: MiniAssignment = { abbreviation: 'A', shiftTypeId: 'shift-a' };
    const compareAssignments = vi.fn(
      (left: MiniAssignment, right: MiniAssignment) => left.shiftTypeId === right.shiftTypeId,
    );
    const mutation = resolveManualCellMutation({
      active,
      before,
      isSameValue: compareAssignments,
      key: '3:member-2',
      mode: 'replace',
    });
    expect(Object.keys(mutation).sort()).toEqual(['after', 'before', 'key']);
    expect(mutation).toEqual({ after: active, before, key: '3:member-2' });
    expect(compareAssignments).not.toHaveBeenCalled();

    const cells = new Map<string, MiniAssignment>([['3:member-2', before]]);
    const applied = applyManualCellMutation(cells, mutation);
    expect(applied.get('3:member-2')).toBe(active);
    expect(revertManualCellMutation(applied, mutation)).toEqual(cells);
    const compareSelections = vi.fn(sameWebSelection);
    expect(
      resolveManualSelection(manualGoldenSelections.first, manualGoldenSelections.first, {
        isSame: compareSelections,
        mode: 'replace',
      }),
    ).toBe(manualGoldenSelections.first);
    expect(compareSelections).not.toHaveBeenCalled();
  });

  it('keeps Web same-shift toggle distinct from Mini same-shift replace', () => {
    const webMutation = resolveManualCellMutation({
      active: 'shift-a',
      before: 'shift-a',
      key: '1:member-1',
      mode: 'toggle',
    });
    const miniMutation = resolveManualCellMutation({
      active: 'shift-a',
      before: 'shift-a',
      key: '1:member-1',
      mode: 'replace',
    });
    expect(webMutation.after).toBeUndefined();
    expect(miniMutation.after).toBe('shift-a');
  });
});
