import { chinaStandardTimeOffsetMilliseconds } from '@schedule/scheduling-domain';

const businessHandoverHour = 8;
const dayMilliseconds = 24 * 60 * 60 * 1000;
const refreshSafetyMarginMilliseconds = 5000;

export function getBusinessHandoverRefreshDelay(now: Date): number {
  const nowTimestamp = now.valueOf();
  if (Number.isNaN(nowTimestamp)) {
    throw new Error('The current time must be valid.');
  }

  const chinaWallClock = new Date(nowTimestamp + chinaStandardTimeOffsetMilliseconds);
  let nextHandoverTimestamp =
    Date.UTC(
      chinaWallClock.getUTCFullYear(),
      chinaWallClock.getUTCMonth(),
      chinaWallClock.getUTCDate(),
      businessHandoverHour,
    ) - chinaStandardTimeOffsetMilliseconds;

  if (nextHandoverTimestamp <= nowTimestamp) {
    nextHandoverTimestamp += dayMilliseconds;
  }

  return nextHandoverTimestamp - nowTimestamp + refreshSafetyMarginMilliseconds;
}
