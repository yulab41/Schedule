export function overlappingBusinessDates(
  existing: readonly { readonly businessDate: string }[],
  incoming: readonly { readonly businessDate: string }[],
): string[] {
  const oldDates = new Set(existing.map((assignment) => assignment.businessDate));
  return [...new Set(incoming.map((assignment) => assignment.businessDate))]
    .filter((date) => oldDates.has(date))
    .sort();
}
