/** Host-owned state survives independently bundled entry points. */
export interface InfoMessageHost {
  __infoMessageTimer?: unknown;
  __infoMessageToken?: object;
  readonly data: { readonly infoMessage?: unknown };
  setData(patch: { readonly infoMessage: string }): void;
}

export function clearInfoMessageTimer(host: InfoMessageHost): void {
  delete host.__infoMessageToken;
  if (host.__infoMessageTimer === undefined) return;
  clearTimeout(host.__infoMessageTimer);
  host.__infoMessageTimer = undefined;
}

export function scheduleInfoMessageExpiry(
  host: InfoMessageHost,
  expected: string,
  isCurrent: () => boolean,
): void {
  clearInfoMessageTimer(host);
  const token = {};
  host.__infoMessageToken = token;
  host.__infoMessageTimer = setTimeout(() => {
    if (host.__infoMessageToken !== token) return;
    delete host.__infoMessageToken;
    host.__infoMessageTimer = undefined;
    if (isCurrent() && host.data.infoMessage === expected) {
      host.setData({ infoMessage: '' });
    }
  }, 2_000);
}
