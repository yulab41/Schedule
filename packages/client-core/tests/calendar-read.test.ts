import { describe, expect, expectTypeOf, it } from 'vitest';

import {
  calendarReadModelSchema,
  guestCalendarReadModelSchema,
  visitorResolveResponseSchema,
  type CalendarReadModel as ContractCalendarReadModel,
  type GuestCalendarReadModel as ContractGuestCalendarReadModel,
  type VisitorResolveResponse as ContractVisitorResolveResponse,
} from '../../contracts/src/index.js';
import {
  INVALID_RESPONSE,
  buildCalendarReadEndpoint,
  buildGuestCalendarReadEndpoint,
  buildGuestGroupResolveEndpoint,
  buildLoggedInGuestCalendarReadEndpoint,
  buildSchedulePeriodCalendarReadEndpoint,
  decodeCalendarReadModel,
  decodeGuestCalendarReadModel,
  decodeVisitorResolveResponse,
  type CalendarReadModel as CoreCalendarReadModel,
  type GuestCalendarReadModel as CoreGuestCalendarReadModel,
  type VisitorResolveResponse as CoreVisitorResolveResponse,
} from '../src/index.js';
import {
  calendarReadModelCorpus,
  guestCalendarReadModelCorpus,
  validCalendarDutyAssignment,
  validCalendarDutyMember,
  validCalendarReadModel,
  validCalendarRole,
  validCalendarShiftType,
  validGuestCalendarReadModel,
} from './calendar-read-model.corpus.js';

describe('calendar endpoint descriptors', () => {
  it('builds an authenticated protected calendar request without serializing query values', () => {
    expect(buildCalendarReadEndpoint('group/1', '2026-08')).toMatchObject({
      auth: true,
      decodeResponse: expect.any(Function),
      method: 'GET',
      path: '/groups/group%2F1/calendar',
      query: { businessMonth: '2026-08' },
    });
  });

  it('builds the authenticated logged-in guest calendar variant', () => {
    expect(buildLoggedInGuestCalendarReadEndpoint('group/1', '2026-08')).toMatchObject({
      auth: true,
      decodeResponse: expect.any(Function),
      method: 'GET',
      path: '/groups/group%2F1/guest-calendar',
      query: { businessMonth: '2026-08' },
    });
  });

  it('builds an authenticated schedule-period calendar request with encoded path segments', () => {
    expect(buildSchedulePeriodCalendarReadEndpoint('group/1', 'period/1')).toMatchObject({
      auth: true,
      decodeResponse: expect.any(Function),
      method: 'GET',
      path: '/groups/group%2F1/calendar/periods/period%2F1',
    });
  });

  it('builds a public visitor calendar request with explicit anonymous auth', () => {
    expect(buildGuestCalendarReadEndpoint('group/1', 'visitor-key', '2026-08')).toMatchObject({
      auth: false,
      decodeResponse: expect.any(Function),
      method: 'GET',
      path: '/guest/groups/group%2F1/calendar',
      query: { businessMonth: '2026-08', visitorKey: 'visitor-key' },
    });
  });

  it('builds a public visitor resolver request with a body and no query', () => {
    expect(buildGuestGroupResolveEndpoint('visitor-key')).toEqual({
      auth: false,
      body: { visitorKey: 'visitor-key' },
      decodeResponse: decodeVisitorResolveResponse,
      method: 'POST',
      path: '/guest/groups/resolve',
    });
  });

  it('rejects contract-valid protected calendar responses bound to another group or month', () => {
    const descriptor = buildCalendarReadEndpoint('group-1', '2026-08');
    expect(descriptor.decodeResponse(validCalendarReadModel).ok).toBe(true);
    expect(descriptor.decodeResponse({ ...validCalendarReadModel, groupId: 'group-2' })).toEqual({
      error: { code: INVALID_RESPONSE },
      ok: false,
    });
    expect(
      descriptor.decodeResponse({ ...validCalendarReadModel, businessMonth: '2026-09' }),
    ).toEqual({ error: { code: INVALID_RESPONSE }, ok: false });
  });

  it('rejects contract-valid logged-in and public guest responses for another group or month', () => {
    const loggedInDescriptor = buildLoggedInGuestCalendarReadEndpoint('group-1', '2026-08');
    const publicDescriptor = buildGuestCalendarReadEndpoint('group-1', 'visitor-key', '2026-08');
    for (const descriptor of [loggedInDescriptor, publicDescriptor]) {
      expect(descriptor.decodeResponse(validGuestCalendarReadModel).ok).toBe(true);
      expect(
        descriptor.decodeResponse({
          ...validGuestCalendarReadModel,
          calendar: { ...validCalendarReadModel, groupId: 'group-2' },
        }),
      ).toEqual({ error: { code: INVALID_RESPONSE }, ok: false });
      expect(
        descriptor.decodeResponse({
          ...validGuestCalendarReadModel,
          calendar: { ...validCalendarReadModel, businessMonth: '2026-09' },
        }),
      ).toEqual({ error: { code: INVALID_RESPONSE }, ok: false });
    }
  });

  it('rejects contract-valid schedule-period calendar responses from another group', () => {
    const descriptor = buildSchedulePeriodCalendarReadEndpoint('group-1', 'period-1');
    expect(descriptor.decodeResponse(validCalendarReadModel).ok).toBe(true);
    expect(descriptor.decodeResponse({ ...validCalendarReadModel, groupId: 'group-2' })).toEqual({
      error: { code: INVALID_RESPONSE },
      ok: false,
    });
  });

  it('rejects schedule-period calendar assignments bound to another period', () => {
    const descriptor = buildSchedulePeriodCalendarReadEndpoint('group-1', 'period-1');
    expect(
      descriptor.decodeResponse({
        ...validCalendarReadModel,
        assignments: [{ ...validCalendarDutyAssignment, schedulePeriodId: 'period-2' }],
      }),
    ).toEqual({ error: { code: INVALID_RESPONSE }, ok: false });
  });

  it('does not invoke an overridden array iterator while checking period identity', () => {
    const assignments = [validCalendarDutyAssignment];
    Object.defineProperty(assignments, Symbol.iterator, {
      value: () => {
        throw new Error('must not call instance iterator');
      },
    });

    const descriptor = buildSchedulePeriodCalendarReadEndpoint('group-1', 'period-1');
    expect(descriptor.decodeResponse({ ...validCalendarReadModel, assignments }).ok).toBe(true);
  });
});

describe('calendar read model decoder', () => {
  it('keeps the runtime-free shape type-compatible with contracts', () => {
    type CoreAssignable = CoreCalendarReadModel extends ContractCalendarReadModel ? true : false;
    type ContractAssignable = ContractCalendarReadModel extends CoreCalendarReadModel
      ? true
      : false;
    expectTypeOf<CoreAssignable>().toEqualTypeOf<true>();
    expectTypeOf<ContractAssignable>().toEqualTypeOf<true>();
  });

  it.each(calendarReadModelCorpus)('$name matches the authoritative contract', (entry) => {
    const contractResult = calendarReadModelSchema.safeParse(entry.value);
    const decoded = decodeCalendarReadModel(entry.value);

    expect(contractResult.success).toBe(entry.expected);
    expect(decoded.ok).toBe(contractResult.success);
    if (contractResult.success && decoded.ok) {
      expect(decoded.value).toEqual(contractResult.data);
    } else if (!decoded.ok) {
      expect(decoded.error).toEqual({ code: INVALID_RESPONSE });
    }
  });

  it('returns canonical plain snapshots with contract-readonly arrays', () => {
    const decoded = decodeCalendarReadModel(validCalendarReadModel);

    expect(decoded).toEqual({ ok: true, value: validCalendarReadModel });
    if (decoded.ok) {
      expect(decoded.value).not.toBe(validCalendarReadModel);
      expect(decoded.value.assignments).not.toBe(validCalendarReadModel.assignments);
      expect(decoded.value.assignments[0]).not.toBe(validCalendarDutyAssignment);
      expect(decoded.value.assignments[0]?.changeMarkers).not.toBe(
        validCalendarDutyAssignment.changeMarkers,
      );
      expect(decoded.value.members[0]).not.toBe(validCalendarDutyMember);
      expect(decoded.value.roles[0]).not.toBe(validCalendarRole);
      expect(decoded.value.shiftTypes[0]).not.toBe(validCalendarShiftType);
      expect(Object.getPrototypeOf(decoded.value)).toBe(Object.prototype);
      expect(Object.getPrototypeOf(decoded.value.assignments[0])).toBe(Object.prototype);
      expect(Object.isFrozen(decoded.value)).toBe(false);
      expect(Object.isFrozen(decoded.value.assignments)).toBe(true);
      expect(Object.isFrozen(decoded.value.assignments[0])).toBe(false);
      expect(Object.isFrozen(decoded.value.assignments[0]?.changeMarkers)).toBe(true);
      expect(Object.isFrozen(decoded.value.members)).toBe(true);
      expect(Object.isFrozen(decoded.value.roles)).toBe(true);
      expect(Object.isFrozen(decoded.value.shiftTypes)).toBe(true);
    }
  });

  it('reads each root, nested object property, and array index once', () => {
    const reads = new Map<string, number>();
    const count = <Value>(key: string, value: Value): Value => {
      reads.set(key, (reads.get(key) ?? 0) + 1);
      return value;
    };
    const withGetters = (prefix: string, value: Record<string, unknown>) =>
      Object.defineProperties(
        {},
        Object.fromEntries(
          Object.entries(value).map(([key, fieldValue]) => [
            key,
            { enumerable: true, get: () => count(`${prefix}.${key}`, fieldValue) },
          ]),
        ),
      );
    const assignment = withGetters('assignment', validCalendarDutyAssignment);
    const member = withGetters('member', validCalendarDutyMember);
    const role = withGetters('role', validCalendarRole);
    const shiftType = withGetters('shiftType', validCalendarShiftType);
    const response = withGetters('calendar', {
      ...validCalendarReadModel,
      assignments: [assignment],
      members: [member],
      roles: [role],
      shiftTypes: [shiftType],
    });

    expect(decodeCalendarReadModel(response).ok).toBe(true);
    expect([...reads.values()].every((countValue) => countValue === 1)).toBe(true);
    expect(Object.fromEntries(reads)).toMatchObject({
      'assignment.id': 1,
      'calendar.assignments': 1,
      'member.membershipId': 1,
      'role.id': 1,
      'shiftType.id': 1,
    });
  });

  it('does not call overridden array helpers and rejects sparse invalid entries', () => {
    const assignments = [validCalendarDutyAssignment];
    Object.defineProperty(assignments, 'every', {
      value: () => {
        throw new Error('must not call instance every');
      },
    });
    expect(decodeCalendarReadModel({ ...validCalendarReadModel, assignments }).ok).toBe(true);

    const sparseAssignments = new Array(1);
    expect(
      decodeCalendarReadModel({ ...validCalendarReadModel, assignments: sparseAssignments }),
    ).toEqual({ error: { code: INVALID_RESPONSE }, ok: false });
  });

  it('preserves explicitly present undefined optional properties', () => {
    const decoded = decodeCalendarReadModel({
      ...validCalendarReadModel,
      assignments: [{ ...validCalendarDutyAssignment, actualMemberName: undefined }],
      members: [{ ...validCalendarDutyMember, mobilePhone: undefined }],
      shiftTypes: [{ ...validCalendarShiftType, endTime: undefined }],
    });

    expect(decoded.ok).toBe(true);
    if (decoded.ok) {
      expect(Object.hasOwn(decoded.value.assignments[0] ?? {}, 'actualMemberName')).toBe(true);
      expect(Object.hasOwn(decoded.value.members[0] ?? {}, 'mobilePhone')).toBe(true);
      expect(Object.hasOwn(decoded.value.shiftTypes[0] ?? {}, 'endTime')).toBe(true);
    }
  });

  it('normalizes hostile access to INVALID_RESPONSE without leaking the throw', () => {
    const hostile = new Proxy(
      {},
      {
        ownKeys() {
          throw new Error('hostile calendar');
        },
      },
    );
    expect(decodeCalendarReadModel(hostile)).toEqual({
      error: { code: INVALID_RESPONSE },
      ok: false,
    });
  });

  it('drops a hostile inherited then getter from the canonical calendar snapshot', async () => {
    let thenReads = 0;
    const prototype = Object.create(null, {
      then: {
        get() {
          thenReads += 1;
          return undefined;
        },
      },
    });
    const response = Object.assign(Object.create(prototype), validCalendarReadModel);
    const decoded = decodeCalendarReadModel(response);

    expect(decoded.ok).toBe(true);
    if (decoded.ok)
      await expect(Promise.resolve(decoded.value)).resolves.toEqual(validCalendarReadModel);
    expect(thenReads).toBe(0);
  });
});

describe('guest calendar read model decoder', () => {
  it('keeps the runtime-free shape type-compatible with contracts', () => {
    type CoreAssignable = CoreGuestCalendarReadModel extends ContractGuestCalendarReadModel
      ? true
      : false;
    type ContractAssignable = ContractGuestCalendarReadModel extends CoreGuestCalendarReadModel
      ? true
      : false;
    expectTypeOf<CoreAssignable>().toEqualTypeOf<true>();
    expectTypeOf<ContractAssignable>().toEqualTypeOf<true>();
  });

  it.each(guestCalendarReadModelCorpus)('$name matches the authoritative contract', (entry) => {
    const contractResult = guestCalendarReadModelSchema.safeParse(entry.value);
    const decoded = decodeGuestCalendarReadModel(entry.value);
    expect(contractResult.success).toBe(entry.expected);
    expect(decoded.ok).toBe(contractResult.success);
    if (contractResult.success && decoded.ok) expect(decoded.value).toEqual(contractResult.data);
  });

  it('snapshots both guest wrapper and nested calendar', () => {
    const decoded = decodeGuestCalendarReadModel(validGuestCalendarReadModel);
    expect(decoded.ok).toBe(true);
    if (decoded.ok) {
      expect(decoded.value).not.toBe(validGuestCalendarReadModel);
      expect(decoded.value.calendar).not.toBe(validCalendarReadModel);
      expect(Object.getPrototypeOf(decoded.value)).toBe(Object.prototype);
    }
  });
});

describe('visitor resolve response decoder', () => {
  const corpus = [
    { expected: true, name: 'valid response', value: { groupId: 'group-1', groupName: '测试群' } },
    { expected: false, name: 'empty id', value: { groupId: '', groupName: '测试群' } },
    { expected: false, name: 'empty name', value: { groupId: 'group-1', groupName: '' } },
    {
      expected: false,
      name: 'extra field',
      value: { extra: true, groupId: 'group-1', groupName: '测试群' },
    },
    { expected: false, name: 'wrong type', value: { groupId: 1, groupName: '测试群' } },
  ] as const;

  it('keeps the runtime-free shape type-compatible with contracts', () => {
    type CoreAssignable = CoreVisitorResolveResponse extends ContractVisitorResolveResponse
      ? true
      : false;
    type ContractAssignable = ContractVisitorResolveResponse extends CoreVisitorResolveResponse
      ? true
      : false;
    expectTypeOf<CoreAssignable>().toEqualTypeOf<true>();
    expectTypeOf<ContractAssignable>().toEqualTypeOf<true>();
  });

  it.each(corpus)('$name matches the authoritative contract', (entry) => {
    const contractResult = visitorResolveResponseSchema.safeParse(entry.value);
    const decoded = decodeVisitorResolveResponse(entry.value);
    expect(contractResult.success).toBe(entry.expected);
    expect(decoded.ok).toBe(contractResult.success);
    if (contractResult.success && decoded.ok) expect(decoded.value).toEqual(contractResult.data);
  });
});
