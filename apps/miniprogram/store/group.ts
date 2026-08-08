import type { GroupSummary } from '@schedule/contracts';

const selectedGroupStorageKey = 'schedule.selectedGroupId';

export function getSelectedGroupId(): string | undefined {
  const raw = wx.getStorageSync<string>(selectedGroupStorageKey);
  return typeof raw === 'string' && raw.length > 0 ? raw : undefined;
}

export function setSelectedGroupId(groupId: string | undefined): void {
  if (groupId === undefined) {
    wx.removeStorageSync(selectedGroupStorageKey);
  } else {
    wx.setStorageSync(selectedGroupStorageKey, groupId);
  }
}

export function resolveSelectedGroup(
  groups: readonly GroupSummary[],
  preferredId?: string,
): GroupSummary | undefined {
  const preferred = preferredId ?? getSelectedGroupId();
  const found = groups.find((group) => group.id === preferred);
  if (found !== undefined) {
    return found;
  }
  const first = groups[0];
  if (first !== undefined) {
    setSelectedGroupId(first.id);
  }
  return first;
}
