import { describe, expect, expectTypeOf, it } from 'vitest';

import {
  holidayReadModelSchema,
  type HolidayReadModel as ContractHolidayReadModel,
} from '../../contracts/src/holidays.js';
import {
  INVALID_RESPONSE,
  buildGuestHolidayReadEndpoint,
  buildHolidayReadEndpoint,
  decodeHolidayReadModel,
  type HolidayReadModel as CoreHolidayReadModel,
} from '../src/index.js';
import { holidayReadModelCorpus, validHolidayReadModel } from './holiday-read-model.corpus.js';

describe('holiday endpoint descriptors', () => {
  it('builds an authenticated protected holiday request', () => {
    expect(buildHolidayReadEndpoint(2026)).toMatchObject({
      auth: true,
      decodeResponse: expect.any(Function),
      method: 'GET',
      path: '/holidays',
      query: { year: 2026 },
    });
  });

  it('builds a public holiday request with explicit anonymous auth', () => {
    expect(buildGuestHolidayReadEndpoint(2026)).toMatchObject({
      auth: false,
      decodeResponse: expect.any(Function),
      method: 'GET',
      path: '/guest/holidays',
      query: { year: 2026 },
    });
  });

  it('rejects contract-valid protected and public responses for another year', () => {
    for (const descriptor of [
      buildHolidayReadEndpoint(2026),
      buildGuestHolidayReadEndpoint(2026),
    ]) {
      expect(descriptor.decodeResponse(validHolidayReadModel).ok).toBe(true);
      expect(descriptor.decodeResponse({ ...validHolidayReadModel, year: 2027 })).toEqual({
        error: { code: INVALID_RESPONSE },
        ok: false,
      });
    }
  });
});

describe('holiday read model decoder', () => {
  it('keeps the runtime-free shape type-compatible with contracts', () => {
    type CoreAssignable = CoreHolidayReadModel extends ContractHolidayReadModel ? true : false;
    type ContractAssignable = ContractHolidayReadModel extends CoreHolidayReadModel ? true : false;
    expectTypeOf<CoreAssignable>().toEqualTypeOf<true>();
    expectTypeOf<ContractAssignable>().toEqualTypeOf<true>();
  });

  it.each(holidayReadModelCorpus)('$name matches the authoritative contract', (entry) => {
    const contractResult = holidayReadModelSchema.safeParse(entry.value);
    const decoded = decodeHolidayReadModel(entry.value);

    expect(contractResult.success).toBe(entry.expected);
    expect(decoded.ok).toBe(contractResult.success);
    if (contractResult.success && decoded.ok) {
      expect(decoded.value).toEqual(contractResult.data);
    } else if (!decoded.ok) {
      expect(decoded.error).toEqual({ code: INVALID_RESPONSE });
    }
  });

  it('returns canonical plain snapshots with a contract-readonly dates array', () => {
    const decoded = decodeHolidayReadModel(validHolidayReadModel);

    expect(decoded).toEqual({ ok: true, value: validHolidayReadModel });
    if (decoded.ok) {
      expect(decoded.value).not.toBe(validHolidayReadModel);
      expect(decoded.value.dates).not.toBe(validHolidayReadModel.dates);
      expect(decoded.value.dates[0]).not.toBe(validHolidayReadModel.dates[0]);
      expect(Object.getPrototypeOf(decoded.value)).toBe(Object.prototype);
      expect(Object.getPrototypeOf(decoded.value.dates[0])).toBe(Object.prototype);
      expect(Object.isFrozen(decoded.value)).toBe(false);
      expect(Object.isFrozen(decoded.value.dates)).toBe(true);
      expect(Object.isFrozen(decoded.value.dates[0])).toBe(false);
    }
  });

  it('reads each property and array index once', () => {
    const reads = new Map<string, number>();
    const count = <Value>(key: string, value: Value): Value => {
      reads.set(key, (reads.get(key) ?? 0) + 1);
      return value;
    };
    const date = Object.defineProperties(
      {},
      Object.fromEntries(
        Object.entries(validHolidayReadModel.dates[0] ?? {}).map(([key, value]) => [
          key,
          { enumerable: true, get: () => count(`date.${key}`, value) },
        ]),
      ),
    );
    const dates = Object.defineProperty(new Array(1), 0, {
      enumerable: true,
      get: () => count('dates.0', date),
    });
    const response = Object.defineProperties(
      {},
      {
        confirmed: { enumerable: true, get: () => count('root.confirmed', true) },
        dates: { enumerable: true, get: () => count('root.dates', dates) },
        year: { enumerable: true, get: () => count('root.year', 2026) },
      },
    );

    expect(decodeHolidayReadModel(response).ok).toBe(true);
    expect([...reads.values()].every((countValue) => countValue === 1)).toBe(true);
  });

  it('normalizes hostile access to INVALID_RESPONSE', () => {
    const hostile = new Proxy(
      {},
      {
        get() {
          throw new Error('hostile holiday');
        },
      },
    );
    expect(decodeHolidayReadModel(hostile)).toEqual({
      error: { code: INVALID_RESPONSE },
      ok: false,
    });
  });
});
