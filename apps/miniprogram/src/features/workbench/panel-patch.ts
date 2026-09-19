type PanelRecord = Record<string, unknown>;

/**
 * Builds a path-scoped patch for the circular panel rings (month / week / list).
 *
 * A ring rotates one slot at a time and a background refresh usually changes a
 * handful of cells. Re-sending every slot with every cell is what made a month
 * swipe push ~100KB, so this helper emits a whole slot only when its month (or
 * its cell list) actually changes and otherwise emits just the cells that differ.
 *
 * The caller keeps the panels it did not send: the returned paths update the
 * existing `page.data` arrays in place, so an omitted cell stays exactly as the
 * user sees it.
 */
export function createPanelRingPatch(
  prefix: string,
  previousPanels: readonly PanelRecord[] | undefined,
  nextPanels: readonly PanelRecord[],
  childArrayKey: 'cells' | 'days',
): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  nextPanels.forEach((panel, slot) => {
    const previous = previousPanels?.[slot];
    const nextChildren = readChildren(panel, childArrayKey);
    const previousChildren = previous === undefined ? [] : readChildren(previous, childArrayKey);
    if (requiresWholeSlot(previous, panel, previousChildren, nextChildren, childArrayKey)) {
      patch[`${prefix}[${slot}]`] = panel;
      return;
    }
    for (const [field, value] of Object.entries(panel)) {
      if (field === childArrayKey) continue;
      if (JSON.stringify(previous?.[field]) === JSON.stringify(value)) continue;
      patch[`${prefix}[${slot}].${field}`] = value;
    }
    nextChildren.forEach((child, index) => {
      if (JSON.stringify(previousChildren[index]) === JSON.stringify(child)) return;
      patch[`${prefix}[${slot}].${childArrayKey}[${index}]`] = child;
    });
  });
  return patch;
}

function readChildren(panel: PanelRecord, childArrayKey: 'cells' | 'days'): readonly PanelRecord[] {
  const children = panel[childArrayKey];
  return Array.isArray(children) ? (children as readonly PanelRecord[]) : [];
}

function requiresWholeSlot(
  previous: PanelRecord | undefined,
  next: PanelRecord,
  previousChildren: readonly PanelRecord[],
  nextChildren: readonly PanelRecord[],
  childArrayKey: 'cells' | 'days',
): boolean {
  if (previous === undefined) return true;
  if (previous.key !== next.key) return true;
  if (previousChildren.length !== nextChildren.length) return true;
  // A different date in the same position means the ring rotated this slot, so
  // the whole slot (including the child list) has to be replaced.
  return nextChildren.some(
    (child, index) => previousChildren[index]?.businessDate !== child.businessDate,
  );
}
