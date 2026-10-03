import type { CalendarReadModel, HolidayReadModel } from '@schedule/contracts';
import { calendarReadModelDecoder, holidayReadModelDecoder } from '@schedule/client-core';

const PREFIX = 'schedule.guest.public.v1:';
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_MONTHS = 12;
const MAX_HOLIDAY_YEARS = 4;
const MAX_STORED_BYTES = 2 * 1024 * 1024;
const MAX_MEMORY_BYTES = 8 * 1024 * 1024;
const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/u;
interface Snapshot {
  readonly updatedAt: number;
  readonly json: string;
  readonly bytes: number;
}
// Readonly models retain their own age and serialized snapshot across cache writes.
const snapshots = new WeakMap<object, Snapshot>();
const empty = () => ({
  months: new Map<string, CalendarReadModel>(),
  holidays: new Map<number, HolidayReadModel>(),
});
const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const fresh = (value: unknown, now: number): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value <= now && now - value <= MAX_AGE_MS;

function utf8Bytes(value: string): number {
  let bytes = 0;
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code <= 0x7f) bytes++;
    else if (code <= 0x7ff) bytes += 2;
    else if (
      code >= 0xd800 &&
      code <= 0xdbff &&
      value.charCodeAt(i + 1) >= 0xdc00 &&
      value.charCodeAt(i + 1) <= 0xdfff
    ) {
      bytes += 4;
      i++;
    } else bytes += 3;
  }
  return bytes;
}
function publicCalendar(calendar: CalendarReadModel): CalendarReadModel {
  return {
    ...calendar,
    members: calendar.members.map((member) => {
      const publicMember = { ...member };
      delete (publicMember as { mobilePhone?: string }).mobilePhone;
      return publicMember;
    }),
  };
}
function snapshot(model: CalendarReadModel | HolidayReadModel, now: number): Snapshot {
  const existing = snapshots.get(model);
  if (existing) return existing;
  const json = JSON.stringify('businessMonth' in model ? publicCalendar(model) : model);
  const value = { updatedAt: now, json, bytes: utf8Bytes(json) };
  snapshots.set(model, value);
  return value;
}

export function isGuestPublicResourceFresh(
  model: CalendarReadModel | HolidayReadModel,
  now = Date.now(),
): boolean {
  return fresh(snapshot(model, now).updatedAt, now);
}

export function readGuestPublicCache(groupId: string, now = Date.now()) {
  const result = empty();
  try {
    const raw = wx.getStorageSync(`${PREFIX}${groupId}`) as unknown;
    if (
      typeof raw !== 'string' ||
      raw.length > MAX_STORED_BYTES ||
      utf8Bytes(raw) > MAX_STORED_BYTES
    )
      return result;
    const parsed: unknown = JSON.parse(raw);
    // v1 had no per-month age: discard it rather than renew unknown stale data.
    if (
      !record(parsed) ||
      parsed.version !== 2 ||
      !fresh(parsed.updatedAt, now) ||
      !record(parsed.months) ||
      !record(parsed.holidays)
    )
      return result;
    for (const [month, entry] of Object.entries(parsed.months).reverse()) {
      if (!MONTH.test(month) || !record(entry) || !fresh(entry.updatedAt, now)) continue;
      const decoded = calendarReadModelDecoder.safeDecode(entry.calendar);
      if (
        !decoded.success ||
        decoded.data.groupId !== groupId ||
        decoded.data.businessMonth !== month
      )
        continue;
      const calendar = publicCalendar(decoded.data);
      snapshot(calendar, entry.updatedAt);
      result.months.set(month, calendar);
    }
    for (const [year, entry] of Object.entries(parsed.holidays).reverse()) {
      if (!/^\d{4}$/u.test(year) || !record(entry) || !fresh(entry.updatedAt, now)) continue;
      const decoded = holidayReadModelDecoder.safeDecode(entry.calendar);
      if (!decoded.success || decoded.data.year !== Number(year)) continue;
      snapshot(decoded.data, entry.updatedAt);
      result.holidays.set(Number(year), decoded.data);
    }
    pruneGuestPublicResources(result.months, result.holidays, [], now);
  } catch {
    return empty();
  }
  return result;
}

export function pruneGuestPublicResources(
  months: Map<string, CalendarReadModel>,
  holidays: Map<number, HolidayReadModel>,
  visibleMonths: readonly string[],
  now = Date.now(),
): void {
  const pinned = new Set(visibleMonths.filter((month) => MONTH.test(month)));
  // Visibility protects the working set from budget eviction, not from expiry.
  for (const [month, calendar] of months)
    if (!isGuestPublicResourceFresh(calendar, now)) months.delete(month);
  for (const [year, calendar] of holidays)
    if (!isGuestPublicResourceFresh(calendar, now)) holidays.delete(year);
  let retained = 0;
  let bytes = 0;
  for (const [month, calendar] of months)
    if (pinned.has(month)) {
      retained++;
      bytes += snapshot(calendar, now).bytes;
    }
  // The five-month visible pager must remain intact even if its working set exceeds the byte budget.
  // History cannot enlarge that exception; all months still share the 12-month count limit.
  for (const [month, calendar] of [...months].reverse())
    if (!pinned.has(month)) {
      const value = snapshot(calendar, now);
      if (
        !fresh(value.updatedAt, now) ||
        retained >= MAX_MONTHS ||
        bytes + value.bytes > MAX_MEMORY_BYTES
      )
        months.delete(month);
      else {
        retained++;
        bytes += value.bytes;
      }
    }
  const pinnedYears = new Set([...pinned].map((month) => Number(month.slice(0, 4))));
  let years = [...holidays.keys()].filter((year) => pinnedYears.has(year)).length;
  for (const [year, calendar] of [...holidays].reverse())
    if (!pinnedYears.has(year)) {
      if (!fresh(snapshot(calendar, now).updatedAt, now) || years >= MAX_HOLIDAY_YEARS)
        holidays.delete(year);
      else years++;
    }
}

export function writeGuestPublicCache(
  groupId: string,
  months: ReadonlyMap<string, CalendarReadModel>,
  holidays: ReadonlyMap<number, HolidayReadModel>,
  preferredMonths: readonly string[] = [],
): void {
  try {
    const now = Date.now();
    const storedHolidays: string[] = [];
    for (const [year, calendar] of [...holidays].reverse()) {
      if (storedHolidays.length >= MAX_HOLIDAY_YEARS) break;
      if (calendar.year !== year || !holidayReadModelDecoder.safeDecode(calendar).success) continue;
      const value = snapshot(calendar, now);
      if (fresh(value.updatedAt, now))
        storedHolidays.push(
          `${JSON.stringify(String(year))}:{"updatedAt":${value.updatedAt},"calendar":${value.json}}`,
        );
    }
    const head = `{"version":2,"updatedAt":${now},"months":{`;
    const tail = `},"holidays":{${storedHolidays.join(',')}}}`;
    let bytes = utf8Bytes(head) + utf8Bytes(tail);
    const storedMonths: string[] = [];
    const priority = new Set([...preferredMonths, ...[...months.keys()].reverse()]);
    for (const month of priority) {
      if (storedMonths.length >= MAX_MONTHS) break;
      const calendar = months.get(month);
      if (
        !calendar ||
        !MONTH.test(month) ||
        calendar.groupId !== groupId ||
        calendar.businessMonth !== month
      )
        continue;
      const value = snapshot(calendar, now);
      if (!fresh(value.updatedAt, now)) continue;
      const prefix = `${JSON.stringify(month)}:{"updatedAt":${value.updatedAt},"calendar":`;
      const size = prefix.length + value.bytes + 1 + (storedMonths.length ? 1 : 0);
      if (bytes + size > MAX_STORED_BYTES) continue;
      bytes += size;
      storedMonths.push(prefix + value.json + '}');
    }
    if (bytes <= MAX_STORED_BYTES)
      wx.setStorageSync(`${PREFIX}${groupId}`, head + storedMonths.join(',') + tail);
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
