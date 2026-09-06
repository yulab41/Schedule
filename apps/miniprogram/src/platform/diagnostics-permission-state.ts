import { clearRuntimeDirectoryLaunchMarker } from './runtime-diagnostics-launch.js';

const listeners = new Set<(allowed: boolean) => void>();
let grant: { readonly ownerId: string; readonly generation: number } | undefined;

export function hasDiagnosticsPermission(ownerId: string | undefined, generation: number): boolean {
  return ownerId !== undefined && grant?.ownerId === ownerId && grant.generation === generation;
}

export function setDiagnosticsPermission(ownerId: string, generation: number): void {
  grant = { ownerId, generation };
  for (const listener of listeners) listener(true);
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
  for (const listener of listeners) listener(false);
}
