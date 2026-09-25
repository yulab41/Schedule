import type {
  CalendarChangesReadModel,
  CalendarReadModel,
  GroupRole,
  GroupSummary,
  HolidayReadModel,
} from '@schedule/contracts';
import {
  calendarReadModelDecoder,
  groupSummaryListDecoder,
  holidayReadModelDecoder,
} from '@schedule/client-core';

import {
  createRuntimeCalendarReadClient,
  createRuntimeOrganizationReadClient,
} from './client-core-calendar.js';
import {
  getStoredWechatProfile,
  getStoredWechatToken,
  getWechatRequestAuthentication,
} from './wechat-identity.js';
import {
  clearLegacyWorkbenchStorage,
  clearPrivateBusinessStorageForGroup,
  readStorageKeys,
  WORKBENCH_CALENDAR_CURSOR_PREFIX,
  WORKBENCH_CONTACTS_PREFIX,
  WORKBENCH_CACHE_V2_PREFIX,
  WORKBENCH_GROUP_SNAPSHOT_V2_PREFIX,
  WORKBENCH_GROUP_STORAGE_KEY,
} from './private-storage.js';

export const WORKBENCH_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
export { WORKBENCH_GROUP_STORAGE_KEY };
import { readStoredWorkbenchGroupId } from './workbench-selection.js';
export { readStoredWorkbenchGroupId };

export interface WorkbenchCacheEntry {
  readonly calendar: CalendarReadModel;
  readonly contactsIncomplete?: boolean;
  readonly holidays: HolidayReadModel;
  /**
   * Set when the shared per-year holiday cache could not supply this month.
   * The caller must re-read (or fetch) that year before trusting the badges.
   */
  readonly holidaysMissing?: boolean;
  readonly savedAt: number;
}

export interface WorkbenchMember {
  readonly id: string;
  readonly isCurrentUser: boolean;
  readonly realName: string;
  readonly role: GroupRole;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function sanitizeCalendarForCache(calendar: CalendarReadModel): CalendarReadModel {
  return {
    ...calendar,
    members: calendar.members.map((member) => {
      const sanitized = { ...member };
      delete sanitized.mobilePhone;
      return sanitized;
    }),
  };
}

export function createWorkbenchReadClient(): {
  readonly getCalendarChanges: (
    groupId: string,
    since: number,
  ) => Promise<CalendarChangesReadModel>;
  readonly getCalendar: (groupId: string, businessMonth: string) => Promise<CalendarReadModel>;
  readonly getGroupGuestCalendar: (
    groupId: string,
    businessMonth: string,
  ) => Promise<CalendarReadModel>;
  readonly getMembers: (groupId: string) => Promise<readonly WorkbenchMember[]>;
  readonly getHolidays: (year: number) => Promise<HolidayReadModel>;
  readonly listGroups: () => Promise<readonly GroupSummary[]>;
} {
  const authentication = getWechatRequestAuthentication();
  const calendarClient = createRuntimeCalendarReadClient(getStoredWechatToken, authentication);
  const organizationReadClient = createRuntimeOrganizationReadClient(
    getStoredWechatToken,
    authentication,
  );
  return {
    getCalendarChanges: (groupId, since) => calendarClient.getCalendarChanges(groupId, since),
    getCalendar: (groupId, businessMonth) => calendarClient.getCalendar(groupId, businessMonth),
    getGroupGuestCalendar: async (groupId, businessMonth) => {
      const result = await calendarClient.getGroupGuestCalendar(groupId, businessMonth);
      if (result.calendar.groupId !== groupId || result.calendar.businessMonth !== businessMonth)
        throw new Error('Invalid guest calendar context');
      return result.calendar;
    },
    getMembers: async (groupId) =>
      (await organizationReadClient.listGroupMembers(groupId)).map(
        ({ id, isCurrentUser, realName, role }) => ({ id, isCurrentUser, realName, role }),
      ),
    getHolidays: (year) => calendarClient.getHolidays(year),
    listGroups: async () => {
      const groups = await organizationReadClient.listGroups();
      const ownerId = getStoredWechatProfile()?.id;
      if (ownerId !== undefined) {
        writeWorkbenchGroupSnapshot(ownerId, groups);
        pruneWorkbenchCaches(ownerId, new Set(groups.map((group) => group.id)));
      }
      return groups;
    },
  };
}

export function clearWorkbenchCalendarCache(ownerId: string, groupId: string): void {
  const prefix = `${WORKBENCH_CACHE_V2_PREFIX}${ownerId}:${groupId}:`;
  for (const key of readStorageKeys()) if (key.startsWith(prefix)) removeStorage(key);
  removeStorage(`${WORKBENCH_CONTACTS_PREFIX}${ownerId}:${groupId}`);
}

/** Only remove months whose server revision changed, including off-screen ones. */
export function invalidateWorkbenchMonths(
  ownerId: string,
  groupId: string,
  months: ReadonlySet<string>,
): void {
  for (const month of months) removeStorage(getWorkbenchCacheKey(ownerId, groupId, month));
}

type CachedContact = {
  readonly membershipId: string;
  readonly mobilePhone?: string;
  readonly shortPhone?: string;
};

function readWorkbenchContacts(
  ownerId: string,
  groupId: string,
): readonly CachedContact[] | undefined {
  const stored = readStorage(`${WORKBENCH_CONTACTS_PREFIX}${ownerId}:${groupId}`);
  if (!isRecord(stored) || !Array.isArray(stored.contacts)) return undefined;
  if (
    !stored.contacts.every(
      (entry: unknown) =>
        isRecord(entry) &&
        typeof entry.membershipId === 'string' &&
        (entry.mobilePhone === undefined || typeof entry.mobilePhone === 'string') &&
        (entry.shortPhone === undefined || typeof entry.shortPhone === 'string'),
    )
  )
    return undefined;
  return stored.contacts as readonly CachedContact[];
}

function writeWorkbenchContacts(
  ownerId: string,
  groupId: string,
  calendar: CalendarReadModel,
): void {
  // Each month contains only members with assignments in that month. Replace
  // each returned member's contact fields, never the entire group's snapshot.
  const previous = readWorkbenchContacts(ownerId, groupId);
  const merged = new Map(previous?.map((contact) => [contact.membershipId, contact]));
  for (const { membershipId, mobilePhone, shortPhone } of calendar.members) {
    merged.set(membershipId, {
      membershipId,
      ...(mobilePhone === undefined ? {} : { mobilePhone }),
      ...(shortPhone === undefined ? {} : { shortPhone }),
    });
  }
  // Bound long-lived historical membership data independently of month eviction.
  const contacts = [...merged.values()].slice(-2048);
  if (JSON.stringify(previous) === JSON.stringify(contacts)) return;
  writeStorage(`${WORKBENCH_CONTACTS_PREFIX}${ownerId}:${groupId}`, { contacts });
}

export function getWorkbenchCacheKey(
  ownerId: string,
  groupId: string,
  businessMonth: string,
): string {
  return `${WORKBENCH_CACHE_V2_PREFIX}${ownerId}:${groupId}:${businessMonth}`;
}

/**
 * Holidays and make-up workdays are cached per year and checked against the
 * published version; the one-day TTL bounds version-less reuse. Only the
 * holiday payload is stored here; schedules keep their own per-owner cache.
 */
export const WORKBENCH_HOLIDAY_CACHE_KEY = 'schedule.workbench.holidays.v1';
export const WORKBENCH_HOLIDAY_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

interface StoredHolidayEntry {
  readonly savedAt: number;
  readonly holidays: HolidayReadModel;
  readonly version?: number;
}

export function readPersistentHolidays(
  year: number,
  now = Date.now(),
  options: { readonly expectedVersion?: number } = {},
): HolidayReadModel | undefined {
  const value = readStorage(WORKBENCH_HOLIDAY_CACHE_KEY);
  if (!isRecord(value)) return undefined;
  const entry = (value as Record<string, unknown>)[String(year)];
  if (!isRecord(entry)) return undefined;
  const savedAt = entry.savedAt;
  const holidays = entry.holidays;
  const version = entry.version;
  if (
    typeof savedAt !== 'number' ||
    !Number.isFinite(savedAt) ||
    savedAt > now ||
    now - savedAt >= WORKBENCH_HOLIDAY_CACHE_TTL_MS ||
    !isRecord(holidays)
  )
    return undefined;
  // A published revision invalidates the cached copy immediately; the 24h TTL
  // below only bounds how long a version-less copy may be trusted.
  if (
    options.expectedVersion !== undefined &&
    (typeof version !== 'number' || version !== options.expectedVersion)
  )
    return undefined;
  return holidays as unknown as HolidayReadModel;
}

export function writePersistentHolidays(
  year: number,
  holidays: HolidayReadModel,
  now = Date.now(),
  version?: number,
): void {
  const value = readStorage(WORKBENCH_HOLIDAY_CACHE_KEY);
  const stored = isRecord(value) ? { ...(value as Record<string, unknown>) } : {};
  stored[String(year)] = {
    holidays,
    savedAt: now,
    ...(version === undefined ? {} : { version }),
  } satisfies StoredHolidayEntry;
  writeStorage(WORKBENCH_HOLIDAY_CACHE_KEY, stored);
}

/**
 * The version this device already holds for a year, or undefined when it holds
 * nothing. Lets a caller compare the server's published version cheaply.
 */
export function readPersistentHolidayVersion(year: number, now = Date.now()): number | undefined {
  const value = readStorage(WORKBENCH_HOLIDAY_CACHE_KEY);
  if (!isRecord(value)) return undefined;
  const entry = (value as Record<string, unknown>)[String(year)];
  if (!isRecord(entry)) return undefined;
  const savedAt = entry.savedAt;
  const version = entry.version;
  if (typeof savedAt !== 'number' || !Number.isFinite(savedAt) || savedAt > now) return undefined;
  return typeof version === 'number' ? version : undefined;
}

function emptyHolidayForYear(year: number): HolidayReadModel {
  return { confirmed: false, dates: [], year };
}

export function readWorkbenchCache(
  ownerId: string,
  groupId: string,
  businessMonth: string,
  now = Date.now(),
  options: { readonly ignoreAge?: boolean } = {},
): WorkbenchCacheEntry | undefined {
  clearLegacyWorkbenchStorage();
  const key = getWorkbenchCacheKey(ownerId, groupId, businessMonth);
  const value = readStorage(key);
  if (!isRecord(value)) {
    if (value !== undefined) removeStorage(key);
    return undefined;
  }
  const savedAt = value.savedAt;
  const calendar = value.calendar;
  const holidays = value.holidays;
  const hasEmbeddedHolidays = isRecord(holidays);
  const hasHolidayYear =
    typeof value.holidayYear === 'number' && Number.isInteger(value.holidayYear);
  if (
    typeof savedAt !== 'number' ||
    !Number.isFinite(savedAt) ||
    savedAt > now ||
    (options.ignoreAge !== true && now - savedAt >= WORKBENCH_CACHE_TTL_MS) ||
    !isRecord(calendar) ||
    (!hasEmbeddedHolidays && !hasHolidayYear)
  ) {
    removeStorage(key);
    return undefined;
  }
  const decodedCalendar = calendarReadModelDecoder.safeDecode(calendar);
  if (
    !decodedCalendar.success ||
    decodedCalendar.data.groupId !== groupId ||
    decodedCalendar.data.businessMonth !== businessMonth
  ) {
    removeStorage(key);
    return undefined;
  }

  // Holidays live once per year in their own cache; a month only records which
  // year it needs. Entries written before that split still carry their own copy
  // and stay readable so an upgrade does not throw away a warm window.
  const storedYear = value.holidayYear;
  const holidayYear =
    typeof storedYear === 'number' && Number.isInteger(storedYear)
      ? storedYear
      : Number(businessMonth.slice(0, 4));
  const embedded = holidayReadModelDecoder.safeDecode(holidays);
  const shared = embedded.success ? undefined : readPersistentHolidays(holidayYear, now);
  const resolvedHolidays = embedded.success ? embedded.data : shared;
  const contacts = readWorkbenchContacts(ownerId, groupId);
  const byMembership = new Map(contacts?.map((contact) => [contact.membershipId, contact]));
  const hydratedCalendar = {
    ...decodedCalendar.data,
    members: decodedCalendar.data.members.map((member) => {
      const withoutContact = { ...member };
      delete withoutContact.mobilePhone;
      delete withoutContact.shortPhone;
      const contact = byMembership.get(member.membershipId);
      return contact === undefined
        ? {
            ...withoutContact,
            ...(contacts === undefined && member.shortPhone !== undefined
              ? { shortPhone: member.shortPhone }
              : {}),
          }
        : { ...withoutContact, ...contact };
    }),
  };
  return {
    calendar: hydratedCalendar,
    ...(contacts === undefined ||
    decodedCalendar.data.members.some((member) => !byMembership.has(member.membershipId))
      ? { contactsIncomplete: true }
      : {}),
    holidays: resolvedHolidays ?? emptyHolidayForYear(holidayYear),
    ...(resolvedHolidays === undefined ? { holidaysMissing: true } : {}),
    savedAt,
  };
}

/**
 * Validated calendar incremental cursor for one owner+group pair.
 *
 * `lastSeq` is the last server revision this device has already merged, so the
 * next validation only has to ask for what happened after it.
 */
export interface WorkbenchCalendarCursor {
  readonly lastSeq: number;
  readonly revision: number;
  readonly savedAt: number;
}

export function getWorkbenchCalendarCursorKey(ownerId: string, groupId: string): string {
  return `${WORKBENCH_CALENDAR_CURSOR_PREFIX}${ownerId}:${groupId}`;
}

export function readWorkbenchCalendarCursor(
  ownerId: string,
  groupId: string,
  now = Date.now(),
): WorkbenchCalendarCursor | undefined {
  const key = getWorkbenchCalendarCursorKey(ownerId, groupId);
  const value = readStorage(key);
  if (!isRecord(value)) {
    if (value !== undefined) removeStorage(key);
    return undefined;
  }
  const lastSeq = value.lastSeq;
  const revision = value.revision;
  const savedAt = value.savedAt;
  if (
    typeof lastSeq !== 'number' ||
    !Number.isSafeInteger(lastSeq) ||
    lastSeq < 0 ||
    typeof revision !== 'number' ||
    !Number.isSafeInteger(revision) ||
    revision < 0 ||
    typeof savedAt !== 'number' ||
    !Number.isFinite(savedAt) ||
    savedAt > now
  ) {
    removeStorage(key);
    return undefined;
  }
  return { lastSeq, revision, savedAt };
}

export function writeWorkbenchCalendarCursor(
  ownerId: string,
  groupId: string,
  cursor: { readonly lastSeq: number; readonly revision: number },
  now = Date.now(),
): void {
  if (
    !Number.isSafeInteger(cursor.lastSeq) ||
    cursor.lastSeq < 0 ||
    !Number.isSafeInteger(cursor.revision) ||
    cursor.revision < 0
  )
    return;
  writeStorage(getWorkbenchCalendarCursorKey(ownerId, groupId), {
    lastSeq: cursor.lastSeq,
    revision: cursor.revision,
    savedAt: now,
  } satisfies WorkbenchCalendarCursor);
}

export function writeWorkbenchCache(
  ownerId: string,
  groupId: string,
  businessMonth: string,
  calendar: CalendarReadModel,
  now = Date.now(),
): void {
  if (calendar.groupId !== groupId || calendar.businessMonth !== businessMonth) return;
  clearLegacyWorkbenchStorage();
  writeWorkbenchContacts(ownerId, groupId, calendar);
  writeStorage(getWorkbenchCacheKey(ownerId, groupId, businessMonth), {
    calendar: sanitizeCalendarForCache(calendar),
    // Holidays are cached once per year in WORKBENCH_HOLIDAY_CACHE_KEY; the
    // month entry only records which year it needs. Storing a copy per month
    // duplicated the same year up to 24 times.
    holidayYear: Number(businessMonth.slice(0, 4)),
    savedAt: now,
  });
  pruneWorkbenchMonthCache(ownerId, groupId);
}

/**
 * How many months of one owner+group stay on the device.
 *
 * A cached month only stays trustworthy while the incremental cursor keeps
 * confirming it, so the cache would otherwise grow forever. Keeping two years
 * covers every realistic "scroll back to check last year" trip while bounding
 * both storage use and the work of validating a group.
 */
export const WORKBENCH_MONTH_CACHE_LIMIT = 24;

/**
 * Drops the oldest cached months for one owner+group beyond the limit.
 *
 * Recency is the last successful write, which for this read pattern is the same
 * as the last time the month was fetched. Served-from-cache reads deliberately
 * do not refresh the timestamp: touching seven keys on every foreground return
 * would cost more than the eviction it would prevent.
 */
export function pruneWorkbenchMonthCache(ownerId: string, groupId: string): void {
  const prefix = `${WORKBENCH_CACHE_V2_PREFIX}${ownerId}:${groupId}:`;
  const keys = readStorageKeys().filter((key) => key.startsWith(prefix));
  if (keys.length <= WORKBENCH_MONTH_CACHE_LIMIT) return;
  const entries: { key: string; savedAt: number }[] = [];
  for (const key of keys) {
    const value = readStorage(key);
    const savedAt =
      isRecord(value) && typeof value.savedAt === 'number' && Number.isFinite(value.savedAt)
        ? value.savedAt
        : 0;
    entries.push({ key, savedAt });
  }
  if (entries.length <= WORKBENCH_MONTH_CACHE_LIMIT) return;
  entries.sort(
    (first, second) => second.savedAt - first.savedAt || first.key.localeCompare(second.key),
  );
  for (const entry of entries.slice(WORKBENCH_MONTH_CACHE_LIMIT)) removeStorage(entry.key);
}

export function writeWorkbenchGroupSnapshot(
  ownerId: string,
  groups: readonly GroupSummary[],
  now = Date.now(),
): void {
  clearLegacyWorkbenchStorage();
  const currentGroups = groups.map((group): GroupSummary => ({
    id: group.id,
    ...(group.isDeveloperAdmin === undefined ? {} : { isDeveloperAdmin: group.isDeveloperAdmin }),
    name: group.name,
    role: group.role,
    version: group.version,
  }));
  writeStorage(getWorkbenchGroupSnapshotKey(ownerId), { groups: currentGroups, savedAt: now });
}

export function readWorkbenchGroupSnapshot(
  ownerId: string,
  now = Date.now(),
): readonly GroupSummary[] | undefined {
  clearLegacyWorkbenchStorage();
  const key = getWorkbenchGroupSnapshotKey(ownerId);
  const value = readStorage(key);
  if (!isRecord(value)) {
    if (value !== undefined) removeStorage(key);
    return undefined;
  }
  const savedAt = value.savedAt;
  if (
    typeof savedAt !== 'number' ||
    !Number.isFinite(savedAt) ||
    savedAt > now ||
    now - savedAt >= WORKBENCH_CACHE_TTL_MS
  ) {
    removeStorage(key);
    return undefined;
  }
  const decodedGroups = groupSummaryListDecoder.safeDecode(value.groups);
  if (!decodedGroups.success) {
    removeStorage(key);
    return undefined;
  }
  return decodedGroups.data;
}

export function pruneWorkbenchCaches(ownerId: string, activeGroupIds: ReadonlySet<string>): void {
  clearLegacyWorkbenchStorage();
  const ownerPrefix = `${WORKBENCH_CACHE_V2_PREFIX}${ownerId}:`;
  const contactsPrefix = `${WORKBENCH_CONTACTS_PREFIX}${ownerId}:`;
  const departedGroups = new Set<string>();
  for (const key of readStorageKeys()) {
    const prefix = key.startsWith(ownerPrefix)
      ? ownerPrefix
      : key.startsWith(contactsPrefix)
        ? contactsPrefix
        : undefined;
    if (prefix === undefined) continue;
    const groupId = key.slice(prefix.length).split(':', 1)[0];
    if (groupId !== undefined && !activeGroupIds.has(groupId)) {
      departedGroups.add(groupId);
    }
  }
  for (const groupId of departedGroups) clearPrivateBusinessStorageForGroup(ownerId, groupId);
  const selectedGroupId = readStoredWorkbenchGroupId(ownerId);
  if (selectedGroupId !== undefined && !activeGroupIds.has(selectedGroupId)) {
    clearPrivateBusinessStorageForGroup(ownerId, selectedGroupId);
  }
}

export function clearWorkbenchGroupCaches(ownerId: string, groupId: string): void {
  clearPrivateBusinessStorageForGroup(ownerId, groupId);
  const groups = readWorkbenchGroupSnapshot(ownerId);
  if (groups === undefined) return;
  const remaining = groups.filter((group) => group.id !== groupId);
  if (remaining.length === 0) removeStorage(getWorkbenchGroupSnapshotKey(ownerId));
  else writeWorkbenchGroupSnapshot(ownerId, remaining);
}

export function writeStoredWorkbenchGroupId(ownerId: string, groupId: string): void {
  writeStorage(WORKBENCH_GROUP_STORAGE_KEY, { groupId, ownerId });
}

export function canUseWorkbenchOfflineFallback(error: unknown): boolean {
  if (!isRecord(error)) return false;
  if (error.code === 'NETWORK_ERROR') return true;
  return error.status === 502 || error.status === 503 || error.status === 504;
}

export function loadActiveThenAdjacent<T>(
  keys: readonly string[],
  activeKey: string,
  load: (key: string) => Promise<T>,
): { readonly active: Promise<T>; readonly adjacent: Promise<readonly T[]> } {
  const active = load(activeKey);
  const adjacentKeys = [...new Set(keys)].filter((key) => key !== activeKey);
  const adjacent = active.then(
    async () => {
      await Promise.resolve();
      const results: PromiseSettledResult<T>[] = new Array(adjacentKeys.length);
      let nextIndex = 0;
      const worker = async () => {
        while (nextIndex < adjacentKeys.length) {
          const index = nextIndex++;
          const key = adjacentKeys[index];
          if (key === undefined) continue;
          try {
            results[index] = { status: 'fulfilled', value: await load(key) };
          } catch (reason) {
            results[index] = { status: 'rejected', reason };
          }
        }
      };
      await Promise.all([worker(), worker()]);
      const fatal = results.find(
        (result): result is PromiseRejectedResult =>
          result.status === 'rejected' && !canUseWorkbenchOfflineFallback(result.reason),
      );
      if (fatal !== undefined) throw fatal.reason;
      return results.flatMap((result) => (result.status === 'fulfilled' ? [result.value] : []));
    },
    () => [],
  );
  // A context switch can abandon this window before the caller subscribes to adjacent.
  // Observe rejection immediately; the returned promise still rejects for active consumers.
  void adjacent.catch(() => undefined);
  return { active, adjacent };
}

function getWorkbenchGroupSnapshotKey(ownerId: string): string {
  return `${WORKBENCH_GROUP_SNAPSHOT_V2_PREFIX}${ownerId}`;
}

function readStorage(key: string): unknown {
  try {
    return wx.getStorageSync(key);
  } catch {
    return undefined;
  }
}

function writeStorage(key: string, value: unknown): void {
  try {
    wx.setStorageSync(key, value);
  } catch {
    // A storage quota failure must never turn a successful online read into an error.
  }
}

function removeStorage(key: string): void {
  try {
    wx.removeStorageSync(key);
  } catch {
    // Invalid private cache entries remain unusable even if physical cleanup fails.
  }
}
