import type { JsonObject } from './errors.js';

export interface VersionConflictLatestData {
  readonly id: string;
  readonly objectType: string;
  readonly version: number;
  readonly latestData?: JsonObject;
}

export function isVersionConflictLatestData(value: unknown): value is VersionConflictLatestData {
  if (value === null || typeof value !== 'object') {
    return false;
  }

  const latest = value as Partial<VersionConflictLatestData>;
  return (
    typeof latest.id === 'string' &&
    latest.id.length > 0 &&
    typeof latest.objectType === 'string' &&
    latest.objectType.length > 0 &&
    typeof latest.version === 'number' &&
    Number.isInteger(latest.version) &&
    (latest.latestData === undefined ||
      (latest.latestData !== null &&
        typeof latest.latestData === 'object' &&
        !Array.isArray(latest.latestData)))
  );
}
