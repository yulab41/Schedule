/** Subpackages call the App-owned controller without bundling another native update adapter. */
export function requestClientUpdate(): void {
  if (typeof getApp !== 'function') return;
  try {
    getApp<{
      globalData?: { clientUpdateController?: { requestUpdate(): void } };
    }>().globalData?.clientUpdateController?.requestUpdate();
  } catch {
    // Policy remains fail-closed even if native update UI is unavailable.
  }
}
