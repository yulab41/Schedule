/** Coalesces only the expensive missed-write safety scan, never authorization or deltas. */
export class CalendarLedgerProbeCache {
  private readonly entries = new Map<
    string,
    { readonly at: number; readonly result: Promise<boolean> }
  >();

  public constructor(
    private readonly now = Date.now,
    private readonly ttlMs = 30_000,
    private readonly maxEntries = 128,
  ) {}

  public check(groupId: string, revision: number, probe: () => Promise<boolean>): Promise<boolean> {
    const key = `${groupId}:${revision}`;
    const at = this.now();
    const existing = this.entries.get(key);
    if (existing !== undefined && at >= existing.at && at - existing.at < this.ttlMs)
      return existing.result;
    const result = Promise.resolve().then(probe);
    const entry = { at, result };
    this.entries.delete(key);
    this.entries.set(key, entry);
    while (this.entries.size > this.maxEntries) {
      const oldest = this.entries.keys().next().value;
      if (oldest === undefined) break;
      this.entries.delete(oldest);
    }
    const discard = () => {
      if (this.entries.get(key) === entry) this.entries.delete(key);
    };
    void result.then((diverged) => {
      if (diverged) discard();
    }, discard);
    return result;
  }
}
