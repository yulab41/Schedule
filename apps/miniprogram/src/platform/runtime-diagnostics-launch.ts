const DIRECTORY_NEXT_LAUNCH_MARKER_KEY = 'schedule.diagnostics.directory-next-launch.v1';
const DIRECTORY_NEXT_LAUNCH_MARKER_SCHEMA = 1;
const DIRECTORY_NEXT_LAUNCH_MARKER_TTL_MS = 24 * 60 * 60 * 1_000;

interface MarkerStorageRuntime {
  readonly getStorageSync?: (key: string) => unknown;
  readonly removeStorageSync?: (key: string) => void;
  readonly setStorageSync?: (key: string, value: unknown) => void;
}

export function armRuntimeDirectoryLaunchMarker(
  runtime: MarkerStorageRuntime = wx as unknown as MarkerStorageRuntime,
  now = Date.now(),
): boolean {
  try {
    runtime.setStorageSync?.(DIRECTORY_NEXT_LAUNCH_MARKER_KEY, {
      armedAt: now,
      expiresAt: now + DIRECTORY_NEXT_LAUNCH_MARKER_TTL_MS,
      schemaVersion: DIRECTORY_NEXT_LAUNCH_MARKER_SCHEMA,
    });
    return runtime.setStorageSync !== undefined;
  } catch {
    return false;
  }
}

export function clearRuntimeDirectoryLaunchMarker(
  runtime: MarkerStorageRuntime = wx as unknown as MarkerStorageRuntime,
): void {
  try {
    runtime.removeStorageSync?.(DIRECTORY_NEXT_LAUNCH_MARKER_KEY);
  } catch {
    // A diagnostic marker must never affect App startup.
  }
}

export function hasRuntimeDirectoryLaunchMarker(
  runtime: MarkerStorageRuntime = wx as unknown as MarkerStorageRuntime,
  now = Date.now(),
): boolean {
  return readMarker(runtime, now);
}

export function consumeRuntimeDirectoryLaunchMarker(
  enabled: boolean,
  runtime: MarkerStorageRuntime = wx as unknown as MarkerStorageRuntime,
  now = Date.now(),
): boolean {
  const armed = enabled && readMarker(runtime, now);
  clearRuntimeDirectoryLaunchMarker(runtime);
  return armed;
}

function readMarker(runtime: MarkerStorageRuntime, now: number): boolean {
  try {
    const value = runtime.getStorageSync?.(DIRECTORY_NEXT_LAUNCH_MARKER_KEY);
    if (!isRecord(value)) return false;
    return (
      value['schemaVersion'] === DIRECTORY_NEXT_LAUNCH_MARKER_SCHEMA &&
      typeof value['armedAt'] === 'number' &&
      Number.isFinite(value['armedAt']) &&
      typeof value['expiresAt'] === 'number' &&
      Number.isFinite(value['expiresAt']) &&
      value['expiresAt'] >= now
    );
  } catch {
    return false;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
