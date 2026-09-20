export class DirectoryFacetCache<Value> {
  private readonly entries = new Map<string, Promise<Value>>();

  public constructor(private readonly maxEntries = 64) {}

  public getOrLoad(key: string, loader: () => Promise<Value>): Promise<Value> {
    const existing = this.entries.get(key);
    if (existing !== undefined) {
      this.entries.delete(key);
      this.entries.set(key, existing);
      return existing;
    }

    const pending = Promise.resolve().then(loader);
    this.entries.set(key, pending);
    while (this.entries.size > this.maxEntries) {
      const oldest = this.entries.keys().next().value;
      if (oldest === undefined) break;
      this.entries.delete(oldest);
    }
    void pending.catch(() => {
      if (this.entries.get(key) === pending) this.entries.delete(key);
    });
    return pending;
  }
}
