const lastGroupStorageKeyPrefix = 'schedule.lastGroup.v1:';

export interface SessionStoragePort {
  getStorageSync(key: string): unknown;
  removeStorageSync(key: string): void;
  setStorageSync(key: string, value: unknown): void;
}

export interface SessionStorage {
  readLastGroupId(userId: string): string | undefined;
  removeLastGroupId(userId: string): void;
  writeLastGroupId(userId: string, groupId: string): void;
}

function assertStorageId(value: string, label: string): void {
  if (typeof value !== 'string' || value.trim().length === 0)
    throw new Error(`${label} must be a non-empty string.`);
}

export function buildLastGroupStorageKey(userId: string): string {
  assertStorageId(userId, 'userId');
  return `${lastGroupStorageKeyPrefix}${encodeURIComponent(userId)}`;
}

export function createSessionStorage(port: SessionStoragePort): SessionStorage {
  return {
    readLastGroupId(userId) {
      const key = buildLastGroupStorageKey(userId);
      try {
        const value = port.getStorageSync(key);
        return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
      } catch {
        return undefined;
      }
    },
    removeLastGroupId(userId) {
      const key = buildLastGroupStorageKey(userId);
      try {
        port.removeStorageSync(key);
      } catch {
        return;
      }
    },
    writeLastGroupId(userId, groupId) {
      assertStorageId(groupId, 'groupId');
      const key = buildLastGroupStorageKey(userId);
      try {
        port.setStorageSync(key, groupId);
      } catch {
        return;
      }
    },
  };
}

export const sessionStorage = createSessionStorage({
  getStorageSync: (key) => wx.getStorageSync(key),
  removeStorageSync: (key) => wx.removeStorageSync(key),
  setStorageSync: (key, value) => wx.setStorageSync(key, value),
});
