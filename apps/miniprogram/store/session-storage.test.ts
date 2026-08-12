import { describe, expect, it } from 'vitest';

import { buildLastGroupStorageKey, createSessionStorage } from './session-storage.js';

describe('user-scoped session storage', () => {
  it("encodes a stable user-specific key and never restores another user's last group", () => {
    const values = new Map<string, unknown>();
    const storage = createSessionStorage({
      getStorageSync: (key) => values.get(key),
      removeStorageSync: (key) => values.delete(key),
      setStorageSync: (key, value) => values.set(key, value),
    });

    storage.writeLastGroupId('user:A', 'group:A');
    storage.writeLastGroupId('user:B', 'group:B');

    expect(buildLastGroupStorageKey('user:A')).toContain('user%3AA');
    expect(storage.readLastGroupId('user:A')).toBe('group:A');
    expect(storage.readLastGroupId('user:B')).toBe('group:B');
    expect(storage.readLastGroupId('user:C')).toBeUndefined();
  });

  it('rejects invalid values and deletes only the named user record', () => {
    const values = new Map<string, unknown>();
    const storage = createSessionStorage({
      getStorageSync: (key) => values.get(key),
      removeStorageSync: (key) => values.delete(key),
      setStorageSync: (key, value) => values.set(key, value),
    });
    storage.writeLastGroupId('user:A', 'group:A');
    storage.writeLastGroupId('user:B', 'group:B');
    values.set(buildLastGroupStorageKey('user:C'), { id: 'group:C' });

    expect(storage.readLastGroupId('user:C')).toBeUndefined();
    storage.removeLastGroupId('user:A');

    expect(storage.readLastGroupId('user:A')).toBeUndefined();
    expect(storage.readLastGroupId('user:B')).toBe('group:B');
    expect(() => storage.writeLastGroupId('', 'group')).toThrow();
    expect(() => storage.writeLastGroupId('user', '')).toThrow();
  });
});
