import { describe, expect, it, vi } from 'vitest';

import { createAsyncResourceCache } from './calendar-resource-cache.js';

describe('calendar async resource cache', () => {
  it('deduplicates adjacent-panel reads and refreshes only when explicitly requested', async () => {
    const cache = createAsyncResourceCache<number>();
    const loader = vi.fn(async () => 8);

    const [first, second] = await Promise.all([
      cache.get('2026-08', loader),
      cache.get('2026-08', loader),
    ]);

    expect([first, second]).toEqual([8, 8]);
    expect(loader).toHaveBeenCalledTimes(1);
    await expect(cache.get('2026-08', loader, { forceRefresh: true })).resolves.toBe(8);
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it('does not retain a rejected request', async () => {
    const cache = createAsyncResourceCache<number>();
    const loader = vi
      .fn<() => Promise<number>>()
      .mockRejectedValueOnce(new Error('temporary'))
      .mockResolvedValueOnce(9);

    await expect(cache.get('2026-09', loader)).rejects.toThrow('temporary');
    await expect(cache.get('2026-09', loader)).resolves.toBe(9);
    expect(loader).toHaveBeenCalledTimes(2);
  });
});
