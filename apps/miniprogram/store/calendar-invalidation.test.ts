import { describe, expect, it, vi } from 'vitest';

import {
  createCalendarInvalidationObserver,
  createCalendarInvalidationRegistry,
} from './calendar-invalidation.js';
import { createCalendarCacheRuntime } from './calendar-cache-runtime.js';

const identity = {
  businessMonth: '2026-08',
  groupId: 'group-1',
  groupRole: 'member' as const,
  groupVersion: 2,
  userId: 'user-1',
};

describe('calendar cache invalidation', () => {
  it('removes one exact cache identity and advances a user/group/month epoch', () => {
    const remove = vi.fn();
    const registry = createCalendarInvalidationRegistry();
    const runtime = createCalendarCacheRuntime({
      cache: {
        read: () => undefined,
        remove,
        removeForUser: () => undefined,
        removeForUserGroup: () => undefined,
        write: () => undefined,
      },
      registry,
    });
    const observer = createCalendarInvalidationObserver(registry);

    expect(observer.consume(identity, ['2026-08', '2026-09'])).toEqual([]);
    runtime.invalidate(identity);

    expect(remove).toHaveBeenCalledWith(identity);
    expect(observer.consume(identity, ['2026-08', '2026-09'])).toEqual(['2026-08']);
    expect(observer.consume({ ...identity, groupId: 'group-2' }, ['2026-08', '2026-09'])).toEqual(
      [],
    );
    expect(observer.consume(identity, ['2026-08', '2026-09'])).toEqual([]);
  });
});
