type Status = 'aligned' | 'pending' | 'processing' | 'blocked';
type Source = 'initial' | 'remote' | 'local' | 'both';

export interface PreviousDutyCheck {
  readonly remoteName: string;
  readonly localName: string | null;
  readonly fingerprint: string;
  readonly changeSource: Source;
  readonly status: Status;
}

export function classifyExternalDuty(input: {
  readonly previous?: PreviousDutyCheck | undefined;
  readonly remoteName: string;
  readonly localName: string | null;
  readonly fingerprint: string;
  readonly blockReason: string | null;
}): { readonly changeSource: Source; readonly status: Status; readonly newDifference: boolean } {
  const { previous, remoteName, localName, fingerprint, blockReason } = input;
  const changed = previous?.fingerprint !== fingerprint;
  const remoteChanged = previous && previous.remoteName !== remoteName;
  const localChanged = previous && previous.localName !== localName;
  const changeSource = !previous
    ? 'initial'
    : remoteChanged && localChanged
      ? 'both'
      : remoteChanged
        ? 'remote'
        : localChanged
          ? 'local'
          : previous.changeSource;
  const status = blockReason
    ? 'blocked'
    : remoteName === localName
      ? 'aligned'
      : previous?.status === 'processing' && !changed
        ? 'processing'
        : 'pending';
  return {
    changeSource,
    status,
    newDifference:
      remoteName !== localName && (!previous || Boolean(remoteChanged || localChanged)),
  };
}
