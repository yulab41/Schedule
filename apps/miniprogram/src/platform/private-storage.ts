export const WECHAT_SESSION_STORAGE_KEY = 'schedule.wechat.session';
export const WORKBENCH_GROUP_STORAGE_KEY = 'schedule.wechat.workbench.current-group';
export const WORKBENCH_CACHE_V1_PREFIX = 'schedule.wechat.workbench.cache.v1:';
export const WORKBENCH_CACHE_V2_PREFIX = 'schedule.wechat.workbench.cache.v2:';
export const WORKBENCH_GROUP_SNAPSHOT_V2_PREFIX = 'schedule.wechat.workbench.groups.v2:';
export const DIRECTORY_PREFERENCES_PREFIX = 'schedule.directory.preferences.v1:';

const privateBusinessPrefixes = [
  WORKBENCH_CACHE_V1_PREFIX,
  WORKBENCH_CACHE_V2_PREFIX,
  WORKBENCH_GROUP_SNAPSHOT_V2_PREFIX,
  DIRECTORY_PREFERENCES_PREFIX,
] as const;

export function clearWechatSessionStorage(): void {
  removeStorage(WECHAT_SESSION_STORAGE_KEY);
}

export function clearPrivateBusinessStorage(): void {
  removeStorage(WORKBENCH_GROUP_STORAGE_KEY);
  for (const key of readStorageKeys()) {
    if (privateBusinessPrefixes.some((prefix) => key.startsWith(prefix))) removeStorage(key);
  }
}

export function clearPrivateBusinessStorageForGroup(ownerId: string, groupId: string): void {
  const prefix = `${WORKBENCH_CACHE_V2_PREFIX}${ownerId}:${groupId}:`;
  const directoryPrefix = `${DIRECTORY_PREFERENCES_PREFIX}${ownerId}:${groupId}:`;
  for (const key of readStorageKeys()) {
    if (key.startsWith(prefix) || key.startsWith(directoryPrefix)) removeStorage(key);
  }
  const selected = readStorage(WORKBENCH_GROUP_STORAGE_KEY);
  if (isRecord(selected) && selected['ownerId'] === ownerId && selected['groupId'] === groupId) {
    removeStorage(WORKBENCH_GROUP_STORAGE_KEY);
  }
}

export function clearLegacyWorkbenchStorage(): void {
  for (const key of readStorageKeys()) {
    if (key.startsWith(WORKBENCH_CACHE_V1_PREFIX)) removeStorage(key);
  }
}

export function readStorageKeys(): readonly string[] {
  try {
    const keys = wx.getStorageInfoSync().keys;
    return Array.isArray(keys) ? keys.filter((key): key is string => typeof key === 'string') : [];
  } catch {
    return [];
  }
}

function readStorage(key: string): unknown {
  try {
    return wx.getStorageSync(key);
  } catch {
    return undefined;
  }
}

function removeStorage(key: string): void {
  try {
    wx.removeStorageSync(key);
  } catch {
    // Storage cleanup is best effort, and callers still fail closed in memory.
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
