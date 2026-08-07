import type { JsonObject, SchedulePeriodSummary } from '@schedule/contracts';
import { getChinaStandardTimeBusinessDate, isPastBusinessMonth } from '@schedule/scheduling-domain';

import { ApiError } from '../../plugins/error-handler.js';
import type { SchedulePeriodRecord } from './schedule-repository.js';

/**
 * 生成/发布共享的“仅未来日期”断言：整月早于当前业务月即拒绝（当月允许，
 * 已过日期由既有保留既往班次逻辑保护），错误引导到排班补录页。
 */
export function assertBusinessMonthNotFullyPast(businessMonth: string): void {
  if (isPastBusinessMonth(businessMonth)) {
    throw new ApiError({
      code: 'CONFLICT',
      statusCode: 409,
      userMessage: `该月份（${businessMonth}）已整体早于今天（${getChinaStandardTimeBusinessDate(new Date())}），已过日期不可修改，无法生成或发布排班。如需修改既往排班，请前往“排班补录”页面操作。`,
    });
  }
}

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
