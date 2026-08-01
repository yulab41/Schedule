export function parseRosterNames(value: string): string[] {
  return value
    .split(/\r?\n/u)
    .map((name) => name.trim())
    .filter((name) => name.length > 0);
}

export function hasDuplicateRosterName(realNames: readonly string[]): boolean {
  return new Set(realNames).size !== realNames.length;
}
