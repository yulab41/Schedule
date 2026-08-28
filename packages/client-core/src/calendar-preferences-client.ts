import type {
  CalendarPreferences,
  UpdateGroupCalendarDefaults,
  UpdateMemberCalendarPreferences,
} from '@schedule/contracts';

import { defineClientEndpoint, type ClientTransport } from './endpoint.js';
import type { CompactDecodeResult, CompactDecoder } from './json-decoder.js';

interface GroupInput {
  readonly groupId: string;
}

interface UpdateGroupDefaultsInput extends GroupInput {
  readonly input: UpdateGroupCalendarDefaults;
}

interface UpdateMineInput extends GroupInput {
  readonly input: UpdateMemberCalendarPreferences;
}

const expectedKeys = [
  'canManageGroupDefaults',
  'effectiveMonthShiftTypeId',
  'effectiveView',
  'groupDefaultMonthShiftTypeId',
  'groupDefaultView',
  'groupId',
  'memberDefaultMonthShiftTypeId',
  'memberDefaultView',
  'membershipId',
] as const;

const uuidPattern =
  /^(?:00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff|[\da-f]{8}-[\da-f]{4}-[1-8][\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12})$/iu;

export const calendarPreferencesDecoder: CompactDecoder<CalendarPreferences> = {
  safeDecode(value): CompactDecodeResult<CalendarPreferences> {
    if (!isRecord(value)) return { success: false };
    const keys = Object.keys(value).sort();
    if (
      keys.length !== expectedKeys.length ||
      keys.some((key, index) => key !== [...expectedKeys].sort()[index])
    ) {
      return { success: false };
    }
    if (typeof value.canManageGroupDefaults !== 'boolean') return { success: false };
    if (!isCalendarView(value.effectiveView) || !isCalendarView(value.groupDefaultView)) {
      return { success: false };
    }
    if (value.memberDefaultView !== null && !isCalendarView(value.memberDefaultView)) {
      return { success: false };
    }
    if (!isUuid(value.groupId) || !isUuid(value.membershipId)) return { success: false };
    for (const shiftTypeId of [
      value.effectiveMonthShiftTypeId,
      value.groupDefaultMonthShiftTypeId,
      value.memberDefaultMonthShiftTypeId,
    ]) {
      if (shiftTypeId !== null && !isUuid(shiftTypeId)) return { success: false };
    }
    return { data: value as unknown as CalendarPreferences, success: true };
  },
};

export const calendarPreferencesEndpoints = {
  get: defineClientEndpoint<GroupInput, CalendarPreferences>({
    auth: 'bearer',
    decoder: calendarPreferencesDecoder,
    id: 'core.calendar-preferences',
    method: 'GET',
    path: ({ groupId }) => `${groupPath(groupId)}/calendar-preferences`,
  }),
  updateGroupDefaults: defineClientEndpoint<UpdateGroupDefaultsInput, CalendarPreferences>({
    auth: 'bearer',
    body: ({ input }) => input,
    decoder: calendarPreferencesDecoder,
    id: 'core.calendar-settings-update',
    method: 'PUT',
    path: ({ groupId }) => `${groupPath(groupId)}/calendar-settings`,
  }),
  updateMine: defineClientEndpoint<UpdateMineInput, CalendarPreferences>({
    auth: 'bearer',
    body: ({ input }) => input,
    decoder: calendarPreferencesDecoder,
    id: 'core.calendar-preferences-mine-update',
    method: 'PUT',
    path: ({ groupId }) => `${groupPath(groupId)}/calendar-preferences/mine`,
  }),
} as const;

export interface CalendarPreferencesClient {
  get(groupId: string): Promise<CalendarPreferences>;
  updateGroupDefaults(
    groupId: string,
    input: UpdateGroupCalendarDefaults,
  ): Promise<CalendarPreferences>;
  updateMine(groupId: string, input: UpdateMemberCalendarPreferences): Promise<CalendarPreferences>;
}

export function createCalendarPreferencesClient(
  transport: ClientTransport,
): CalendarPreferencesClient {
  return {
    get(groupId) {
      return transport.request(calendarPreferencesEndpoints.get, { groupId });
    },
    updateGroupDefaults(groupId, input) {
      return transport.request(calendarPreferencesEndpoints.updateGroupDefaults, {
        groupId,
        input,
      });
    },
    updateMine(groupId, input) {
      return transport.request(calendarPreferencesEndpoints.updateMine, { groupId, input });
    },
  };
}

function groupPath(groupId: string): string {
  return `/groups/${encodeURIComponent(groupId)}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isCalendarView(value: unknown): value is 'list' | 'month' | 'week' {
  return value === 'list' || value === 'month' || value === 'week';
}

function isUuid(value: unknown): value is string {
  return typeof value === 'string' && uuidPattern.test(value);
}
