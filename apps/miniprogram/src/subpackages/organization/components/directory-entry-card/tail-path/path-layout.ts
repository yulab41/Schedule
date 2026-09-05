// Candidates preserve the exact source substring and separator order. Widths come
// from the native text renderer; character counts are never a layout heuristic.
export function createDirectoryPathCandidates(value: string): readonly string[] {
  const candidates = [value];
  let leaf = value;
  for (const separator of value.matchAll(/ [›>·] /gu)) {
    leaf = value.slice((separator.index ?? 0) + separator[0].length);
    if (leaf.length > 0) candidates.push(`…${separator[0]}${leaf}`);
  }
  if (leaf !== value && leaf.length > 0) candidates.push(leaf);
  return candidates;
}

export function selectDirectoryTailPath(
  candidates: readonly string[],
  widths: readonly number[],
  availableWidth: number,
): string {
  if (
    !Number.isFinite(availableWidth) ||
    availableWidth <= 0 ||
    widths.length !== candidates.length
  ) {
    return candidates[0] ?? '';
  }
  const index = widths.findIndex(
    (width) => Number.isFinite(width) && width >= 0 && width <= availableWidth,
  );
  return candidates[index < 0 ? candidates.length - 1 : index] ?? '';
}
