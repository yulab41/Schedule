import { describe, expect, it, vi } from 'vitest';
import { CalendarLedgerProbeCache } from './calendar-ledger-probe-cache.js';

describe('calendar ledger safety probe', () => {
  it('shares same-revision scans and rechecks on revision change or expiry', async () => {
    let now = 100;
    const cache = new CalendarLedgerProbeCache(() => now, 30_000, 2);
    const load = vi.fn(async () => false);
    await Promise.all([cache.check('g', 1, load), cache.check('g', 1, load)]);
    await cache.check('g', 1, load);
    expect(load).toHaveBeenCalledTimes(1);
    await cache.check('g', 2, load);
    expect(load).toHaveBeenCalledTimes(2);
    now += 30_000;
    await cache.check('g', 2, load);
    expect(load).toHaveBeenCalledTimes(3);
  });
  it('never caches divergence, rejection, or results past the bounded capacity', async () => {
    const cache = new CalendarLedgerProbeCache(Date.now, 30_000, 2);
    const load = vi
      .fn()
      .mockResolvedValueOnce(true)
      .mockRejectedValueOnce(new Error('db'))
      .mockResolvedValue(false);
    expect(await cache.check('g', 1, load)).toBe(true);
    await expect(cache.check('g', 1, load)).rejects.toThrow('db');
    await cache.check('g', 1, load);
    await cache.check('b', 1, load);
    await cache.check('c', 1, load);
    await cache.check('g', 1, load);
    expect(load).toHaveBeenCalledTimes(6);
  });
});
