export interface AsyncResourceCacheOptions {
  readonly forceRefresh?: boolean;
}

export interface AsyncResourceCache<T> {
  clear(): void;
  get(key: string, loader: () => Promise<T>, options?: AsyncResourceCacheOptions): Promise<T>;
}

export function createAsyncResourceCache<T>(): AsyncResourceCache<T> {
  const entries = new Map<string, Promise<T>>();

  return {
    clear(): void {
      entries.clear();
    },
    get(
      key: string,
      loader: () => Promise<T>,
      options: AsyncResourceCacheOptions = {},
    ): Promise<T> {
      if (options.forceRefresh !== true) {
        const existing = entries.get(key);
        if (existing !== undefined) return existing;
      }

      const request = loader().catch((error: unknown) => {
        if (entries.get(key) === request) entries.delete(key);
        throw error;
      });
      entries.set(key, request);
      return request;
    },
  };
}
