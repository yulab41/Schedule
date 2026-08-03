export const scheduleCacheName = 'schedule-schedules-v2';
export const shellCacheName = 'schedule-shell-v2';
export const maxScheduleCacheEntries = 12;

export function isCalendarRequest(url: URL): boolean {
  return (
    /^\/api\/groups\/[^/]+\/calendar$/u.test(url.pathname) && url.searchParams.has('businessMonth')
  );
}

export function isStaticAsset(url: URL): boolean {
  return (
    url.pathname.startsWith('/assets/') ||
    /\.(?:css|ico|png|svg|webmanifest|woff2?)$/u.test(url.pathname)
  );
}

export function selectCacheKeysToRemove(
  keys: readonly string[],
  maxEntries: number,
): readonly string[] {
  if (!Number.isInteger(maxEntries) || maxEntries < 0) {
    throw new Error('The maximum cache entry count must be a non-negative integer.');
  }

  return keys.length <= maxEntries ? [] : keys.slice(0, keys.length - maxEntries);
}

export function shouldCacheResponse(response: Response): boolean {
  return response.ok && (response.type === 'basic' || response.type === 'default');
}
