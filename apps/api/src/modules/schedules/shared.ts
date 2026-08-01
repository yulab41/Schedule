import type { JsonObject, SchedulePeriodSummary } from '@schedule/contracts';

import type { SchedulePeriodRecord } from './schedule-repository.js';

export function toLatestData(value: unknown): JsonObject {
  return JSON.parse(JSON.stringify(value)) as JsonObject;
}

export function toPeriodSummary(period: SchedulePeriodRecord): SchedulePeriodSummary {
  return {
    businessMonth: period.businessMonth,
    id: period.id,
    revision: period.revision,
    rulesVersion: period.rulesVersion,
    scheduleRoleId: period.scheduleRoleId,
    status: period.status,
    version: period.version,
  };
}
