import { WORKBENCH_GROUP_STORAGE_KEY } from './private-storage.js';

/** Lightweight reader shared with the workbench; keep its owner and empty-string semantics. */
export function readStoredWorkbenchGroupId(ownerId: string): string | undefined {
  let value: unknown;
  try {
    value = wx.getStorageSync(WORKBENCH_GROUP_STORAGE_KEY);
  } catch {
    return undefined;
  }
  if (typeof value !== 'object' || value === null) return undefined;
  const record = value as Record<string, unknown>;
  if (record['ownerId'] !== ownerId) return undefined;
  const groupId = record['groupId'];
  return typeof groupId === 'string' && groupId.length > 0 ? groupId : undefined;
}
