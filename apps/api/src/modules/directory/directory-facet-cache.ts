export class DirectoryFacetCache<Value> {
  private readonly entries = new Map<string, Promise<Value>>();

  public getOrLoad(key: string, loader: () => Promise<Value>): Promise<Value> {
    const existing = this.entries.get(key);
    if (existing !== undefined) return existing;

    const pending = Promise.resolve().then(loader);
    this.entries.set(key, pending);
    void pending.catch(() => {
      if (this.entries.get(key) === pending) this.entries.delete(key);
    });
    return pending;
  }
}
