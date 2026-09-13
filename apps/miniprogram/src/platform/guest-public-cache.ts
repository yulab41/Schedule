import type { CalendarReadModel, HolidayReadModel } from '@schedule/contracts';

const PREFIX = 'schedule.guest.public.v1:';
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

interface StoredCache {
  readonly updatedAt: number;
  readonly months: Record<string, CalendarReadModel>;
  readonly holidays: Record<string, HolidayReadModel>;
}

export function readGuestPublicCache(groupId: string, now = Date.now()) {
  try {
    const raw = wx.getStorageSync(`${PREFIX}${groupId}`) as unknown;
    if (typeof raw !== 'string' || raw.length === 0)
      return {
        months: new Map<string, CalendarReadModel>(),
        holidays: new Map<number, HolidayReadModel>(),
      };
    const parsed = JSON.parse(raw) as Partial<StoredCache>;
    if (
      typeof parsed.updatedAt !== 'number' ||
      now - parsed.updatedAt > MAX_AGE_MS ||
      !parsed.months ||
      !parsed.holidays
    )
      return {
        months: new Map<string, CalendarReadModel>(),
        holidays: new Map<number, HolidayReadModel>(),
      };
    return {
      months: new Map(Object.entries(parsed.months)),
      holidays: new Map(
        Object.entries(parsed.holidays).map(([year, value]) => [Number(year), value]),
      ),
    };
  } catch {
    return {
      months: new Map<string, CalendarReadModel>(),
      holidays: new Map<number, HolidayReadModel>(),
    };
  }
}

export function writeGuestPublicCache(
  groupId: string,
  months: ReadonlyMap<string, CalendarReadModel>,
  holidays: ReadonlyMap<number, HolidayReadModel>,
): void {
  try {
    const publicMonths = Object.fromEntries(
      [...months].map(([month, calendar]) => [
        month,
        {
          ...calendar,
          members: calendar.members.map((member) => {
            const publicMember = { ...member };
            delete (publicMember as { mobilePhone?: string }).mobilePhone;
            return publicMember;
          }),
        },
      ]),
    );
    wx.setStorageSync(
      `${PREFIX}${groupId}`,
      JSON.stringify({
        updatedAt: Date.now(),
        months: publicMonths,
        holidays: Object.fromEntries([...holidays].map(([year, value]) => [String(year), value])),
      } satisfies StoredCache),
    );
  } catch {
    // Storage pressure must not block the live visitor calendar.
  }
}

export function clearGuestPublicCache(groupId: string): void {
  try {
    wx.removeStorageSync(`${PREFIX}${groupId}`);
  } catch {
    // Best-effort invalidation after an explicitly invalid visitor code.
  }
}
