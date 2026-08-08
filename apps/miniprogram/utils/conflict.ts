import type { JsonObject, VersionConflictLatestData } from '@schedule/contracts';

import { ApiClientError } from '../api/client.js';

export function isDataConflictError(error: unknown): error is ApiClientError {
  return error instanceof ApiClientError && error.code === 'CONFLICT';
}

export function getConflictLatestData(
  error: unknown,
): VersionConflictLatestData | JsonObject | undefined {
  if (!isDataConflictError(error)) {
    return undefined;
  }

  return error.latestData;
}

export function getConflictMessage(
  error: unknown,
  fallback = '排班已被其他操作更新，请刷新后重新确认。',
): string {
  if (!isDataConflictError(error)) {
    return fallback;
  }

  return error.message.length > 0 ? error.message : fallback;
}

export function getVersionConflictSummary(latestData: unknown): string | undefined {
  if (!isVersionConflictLatestData(latestData)) {
    return undefined;
  }

  return `${latestData.objectType} 已更新到版本 ${latestData.version}`;
}

function isVersionConflictLatestData(value: unknown): value is VersionConflictLatestData {
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
