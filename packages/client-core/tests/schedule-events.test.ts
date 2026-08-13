import { describe, expect, expectTypeOf, it } from 'vitest';

import {
  scheduleEventPageSchema,
  type ScheduleEventPage as ContractScheduleEventPage,
} from '../../contracts/src/events.js';
import {
  INVALID_RESPONSE,
  buildScheduleEventListEndpoint,
  decodeScheduleEventPage,
  type ScheduleEventPage as CoreScheduleEventPage,
} from '../src/index.js';
import { scheduleEventPageCorpus, validScheduleEvent } from './schedule-event-page.corpus.js';

describe('schedule event endpoint descriptor', () => {
  it('maps every query field once without platform serialization', () => {
    const descriptor = buildScheduleEventListEndpoint('group/1', {
      cursor: 'cursor/+=',
      eventTypes: ['swap_completed', 'duty_adjustment_completed'],
      from: '2026-08-01T00:00:00+08:00',
      membershipId: 'membership-1',
      operatorUserId: 'user-1',
      pageSize: 100,
      scheduleRoleId: 'role-1',
      shiftId: 'assignment-1',
      to: '2026-09-01T00:00:00+08:00',
    });

    expect(descriptor).toEqual({
      auth: true,
      decodeResponse: decodeScheduleEventPage,
      method: 'GET',
      path: '/groups/group%2F1/events',
      query: {
        cursor: 'cursor/+=',
        eventTypes: 'swap_completed,duty_adjustment_completed',
        from: '2026-08-01T00:00:00+08:00',
        membershipId: 'membership-1',
        operatorUserId: 'user-1',
        pageSize: 100,
        scheduleRoleId: 'role-1',
        shiftId: 'assignment-1',
        to: '2026-09-01T00:00:00+08:00',
      },
    });
  });

  it('omits only undefined values and empty event type lists', () => {
    expect(
      buildScheduleEventListEndpoint('group-1', {
        cursor: '',
        eventTypes: [],
        pageSize: 0,
      }).query,
    ).toEqual({ cursor: '', pageSize: 0 });
  });
});

describe('schedule event page decoder', () => {
  it('keeps the runtime-free response shape type-compatible with contracts', () => {
    type CoreAssignableToContract = CoreScheduleEventPage extends ContractScheduleEventPage
      ? true
      : false;
    type ContractAssignableToCore = ContractScheduleEventPage extends CoreScheduleEventPage
      ? true
      : false;

    expectTypeOf<CoreAssignableToContract>().toEqualTypeOf<true>();
    expectTypeOf<ContractAssignableToCore>().toEqualTypeOf<true>();
  });

  it.each(scheduleEventPageCorpus)('$name matches the authoritative contract', (entry) => {
    const contractResult = scheduleEventPageSchema.safeParse(entry.value);
    const decoded = decodeScheduleEventPage(entry.value);

    expect(contractResult.success).toBe(entry.expected);
    expect(decoded.ok).toBe(contractResult.success);
    if (contractResult.success && decoded.ok) {
      expect(decoded.value).toEqual(contractResult.data);
    } else if (!decoded.ok) {
      expect(decoded.error).toEqual({ code: INVALID_RESPONSE });
    }
  });

  it('returns canonical plain page, event, and array snapshots', () => {
    const response = { events: [validScheduleEvent], nextCursor: 'next' };
    const decoded = decodeScheduleEventPage(response);

    expect(decoded).toEqual({ ok: true, value: response });
    if (decoded.ok) {
      expect(decoded.value).not.toBe(response);
      expect(decoded.value.events).not.toBe(response.events);
      expect(decoded.value.events[0]).not.toBe(validScheduleEvent);
      expect(decoded.value.events[0]?.afterData).toBe(validScheduleEvent.afterData);
      expect(decoded.value.events[0]?.affectedMembershipIds).not.toBe(
        validScheduleEvent.affectedMembershipIds,
      );
      expect(decoded.value.events[0]?.affectedShiftIds).not.toBe(
        validScheduleEvent.affectedShiftIds,
      );
      expect(Object.getPrototypeOf(decoded.value)).toBe(Object.prototype);
      expect(Object.getPrototypeOf(decoded.value.events)).toBe(Array.prototype);
      expect(Object.getPrototypeOf(decoded.value.events[0])).toBe(Object.prototype);
      expect(Object.isFrozen(decoded.value)).toBe(false);
      expect(Object.isFrozen(decoded.value.events)).toBe(true);
      expect(Object.isFrozen(decoded.value.events[0])).toBe(false);
      expect(Object.isFrozen(decoded.value.events[0]?.affectedMembershipIds)).toBe(true);
      expect(Object.isFrozen(decoded.value.events[0]?.affectedShiftIds)).toBe(true);
    }
  });

  it('reads every page and event property at most once before snapshotting', () => {
    const reads = new Map<string, number>();
    const count = <Value>(key: string, value: Value): Value => {
      reads.set(key, (reads.get(key) ?? 0) + 1);
      return value;
    };
    const event = Object.fromEntries(
      Object.entries(validScheduleEvent).map(([key, fieldValue]) => [
        key,
        {
          enumerable: true,
          get: () => count(`event.${key}`, fieldValue),
        },
      ]),
    );
    const eventWithGetters = Object.defineProperties({}, event);
    const response = Object.defineProperties(
      {},
      {
        events: {
          enumerable: true,
          get: () => count('page.events', [eventWithGetters]),
        },
        nextCursor: {
          enumerable: true,
          get: () => count('page.nextCursor', 'next'),
        },
      },
    );

    const decoded = decodeScheduleEventPage(response);

    expect(decoded.ok).toBe(true);
    expect([...reads.values()].every((readCount) => readCount === 1)).toBe(true);
    expect(Object.fromEntries(reads)).toMatchObject({
      'event.eventType': 1,
      'event.groupId': 1,
      'event.id': 1,
      'page.events': 1,
      'page.nextCursor': 1,
    });
  });

  it('reads each array index once while creating independent arrays', () => {
    const reads = { event: 0, membership: 0, shift: 0 };
    const membershipIds = Object.defineProperty(new Array<string>(1), 0, {
      configurable: true,
      enumerable: true,
      get() {
        reads.membership += 1;
        return 'membership-1';
      },
    });
    const shiftIds = Object.defineProperty(new Array<string>(1), 0, {
      configurable: true,
      enumerable: true,
      get() {
        reads.shift += 1;
        return 'shift-1';
      },
    });
    const event = {
      ...validScheduleEvent,
      affectedMembershipIds: membershipIds,
      affectedShiftIds: shiftIds,
    };
    const events = Object.defineProperty(new Array<typeof event>(1), 0, {
      configurable: true,
      enumerable: true,
      get() {
        reads.event += 1;
        return event;
      },
    });

    const decoded = decodeScheduleEventPage({ events });

    expect(decoded.ok).toBe(true);
    expect(reads).toEqual({ event: 1, membership: 1, shift: 1 });
  });

  it('drops a hostile inherited then getter from the canonical page', async () => {
    let thenReads = 0;
    const prototype = Object.create(null, {
      then: {
        get() {
          thenReads += 1;
          return undefined;
        },
      },
    });
    const response = Object.assign(Object.create(prototype), { events: [] });

    const decoded = decodeScheduleEventPage(response);

    expect(decoded.ok).toBe(true);
    if (decoded.ok) {
      await expect(Promise.resolve(decoded.value)).resolves.toEqual({ events: [] });
    }
    expect(thenReads).toBe(0);
  });

  it('preserves explicitly present undefined optional properties in the snapshot', () => {
    const response = {
      events: [{ ...validScheduleEvent, reason: undefined }],
      nextCursor: undefined,
    };

    const decoded = decodeScheduleEventPage(response);

    expect(decoded.ok).toBe(true);
    if (decoded.ok) {
      expect(Object.hasOwn(decoded.value, 'nextCursor')).toBe(true);
      expect(Object.hasOwn(decoded.value.events[0] ?? {}, 'reason')).toBe(true);
    }
  });

  it('normalizes hostile property access to INVALID_RESPONSE instead of throwing', () => {
    const hostileResponse = new Proxy(
      {},
      {
        ownKeys() {
          throw new Error('hostile response');
        },
      },
    );

    expect(decodeScheduleEventPage(hostileResponse)).toEqual({
      error: { code: INVALID_RESPONSE },
      ok: false,
    });
  });
});
