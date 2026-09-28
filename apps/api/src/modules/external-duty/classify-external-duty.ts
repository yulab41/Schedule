type Status = 'aligned' | 'pending' | 'processing' | 'blocked';
type Source = 'initial' | 'remote' | 'local' | 'both';

export interface PreviousDutyCheck {
  readonly baselineName: string | null;
  readonly remoteName: string;
  readonly localName: string | null;
  readonly fingerprint: string;
  readonly changeSource: Source;
  readonly status: Status;
  readonly isInScope: number;
}

export function classifyExternalDuty(input: {
  readonly previous?: PreviousDutyCheck | undefined;
  readonly baselineName: string | null;
  readonly remoteName: string;
  readonly localName: string | null;
  readonly fingerprint: string;
  readonly blockReason: string | null;
}): { readonly changeSource: Source; readonly status: Status; readonly newDifference: boolean } {
  const { previous, baselineName, remoteName, localName, fingerprint, blockReason } = input;
  const changeSource: Source =
    baselineName === null
      ? 'both'
      : remoteName === baselineName && localName !== baselineName
        ? 'local'
        : localName === baselineName && remoteName !== baselineName
          ? 'remote'
          : remoteName !== localName
            ? 'both'
            : 'initial';
  const status: Status = blockReason
    ? 'blocked'
    : remoteName === localName
      ? 'aligned'
      : previous?.status === 'processing' && previous.fingerprint === fingerprint
        ? 'processing'
        : 'pending';
  return {
    changeSource,
    status,
    newDifference:
      status !== 'aligned' &&
      (!previous ||
        previous.isInScope !== 1 ||
        previous.status === 'aligned' ||
        previous.baselineName !== baselineName ||
        previous.remoteName !== remoteName ||
        previous.localName !== localName),
  };
}

export function scopedExternalDutyDates(
  remoteDuties: ReadonlyMap<string, string>,
  publishedCounts: ReadonlyMap<string, number>,
  today: string,
): readonly (readonly [string, string])[] {
  return [...remoteDuties].filter(
    ([date]) => date >= today && (publishedCounts.get(date) ?? 0) > 0,
  );
}
