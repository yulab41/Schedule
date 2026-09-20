import { describe, expect, it, vi } from 'vitest';

import { DirectoryFacetCache } from './directory-facet-cache.js';

describe('directory facet cache', () => {
  it('evicts least recently used snapshots at its capacity instead of retaining every import', async () => {
    const cache = new DirectoryFacetCache<string>(2);
    const load = vi.fn(async () => 'value');
    await cache.getOrLoad('first', load);
    await cache.getOrLoad('second', load);
    await cache.getOrLoad('first', load);
    await cache.getOrLoad('third', load);
    await cache.getOrLoad('first', load);
    expect(load).toHaveBeenCalledTimes(3);
    await cache.getOrLoad('second', load);
    expect(load).toHaveBeenCalledTimes(4);
  });
  it('shares an in-flight published snapshot request by its visibility-safe key', async () => {
    const cache = new DirectoryFacetCache<{ version: string }>();
    const load = vi.fn(async () => {
      await Promise.resolve();
      return { version: 'published-1' };
    });

    const [first, second] = await Promise.all([
      cache.getOrLoad('group:internal:published-1:member', load),
      cache.getOrLoad('group:internal:published-1:member', load),
    ]);

    expect(first).toEqual({ version: 'published-1' });
    expect(second).toBe(first);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('does not reuse a failed request', async () => {
    const cache = new DirectoryFacetCache<string>();
    const load = vi.fn().mockRejectedValueOnce(new Error('temporary')).mockResolvedValueOnce('ok');

    await expect(cache.getOrLoad('group:employee:published-1:member', load)).rejects.toThrow(
      'temporary',
    );
    await expect(cache.getOrLoad('group:employee:published-1:member', load)).resolves.toBe('ok');
    expect(load).toHaveBeenCalledTimes(2);
  });
});
