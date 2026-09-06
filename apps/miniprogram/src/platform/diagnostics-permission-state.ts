import { clearRuntimeDirectoryLaunchMarker } from './runtime-diagnostics-launch.js';

const listeners = new Set<(allowed: boolean) => void>();
let grant: { readonly ownerId: string; readonly generation: number } | undefined;

export function hasDiagnosticsPermission(ownerId: string | undefined, generation: number): boolean {
  return ownerId !== undefined && grant?.ownerId === ownerId && grant.generation === generation;
}

export function setDiagnosticsPermission(ownerId: string, generation: number): void {
  grant = { ownerId, generation };
  notifyPermission(true);
}

export function subscribeDiagnosticsPermission(listener: (allowed: boolean) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function invalidateDiagnosticsPermission(): void {
  grant = undefined;
  clearRuntimeDirectoryLaunchMarker();
  try {
    const globalData = getApp<{ globalData?: { runtimeDiagnostics?: unknown } }>().globalData;
    if (globalData !== undefined) delete globalData.runtimeDiagnostics;
  } catch {
    /* Diagnostics never prevent session invalidation. */
  }
  notifyPermission(false);
}

function notifyPermission(allowed: boolean): void {
  for (const listener of listeners) {
    try {
      listener(allowed);
    } catch {
      /* A broken page cannot block logout or other revocations. */
    }
  }
}
