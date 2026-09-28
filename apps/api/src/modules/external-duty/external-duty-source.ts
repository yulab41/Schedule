const PAGE_URL = 'http://43.133.68.128:8888/edit.html';
const OVERRIDES_URL = 'http://43.133.68.128:8888/api/overrides';
const WRITE_URL = 'http://43.133.68.128:8888/api/override';

export interface ExternalDutySnapshot {
  readonly duties: ReadonlyMap<string, string>;
  readonly people: readonly string[];
}

export class ExternalDutySource {
  public constructor(private readonly request: typeof fetch = fetch) {}

  public async read(): Promise<ExternalDutySnapshot> {
    const [page, overrides] = await Promise.all([
      this.readText(PAGE_URL),
      this.readJson(OVERRIDES_URL),
    ]);
    const namesMatch = page.match(/var N=(\[[^;\n]+\]);/u);
    const startMatch = page.match(/var y=(\d{4}),mm=(\d{1,2}),dd=(\d{1,2}),idx=0;/u);
    const endMatch = page.match(/if\(y===(\d{4})&&mm===(\d{1,2})\)break;/u);
    if (!namesMatch || !startMatch || !endMatch)
      throw new Error('External duty page format changed');
    const names: unknown = JSON.parse(namesMatch[1]!);
    if (
      !Array.isArray(names) ||
      names.length === 0 ||
      names.some((name) => typeof name !== 'string' || !name.trim()) ||
      new Set(names).size !== names.length
    )
      throw new Error('External duty roster is invalid');
    const people = names as string[];
    const start = Date.UTC(Number(startMatch[1]), Number(startMatch[2]) - 1, Number(startMatch[3]));
    const exclusiveEnd = Date.UTC(Number(endMatch[1]), Number(endMatch[2]) - 1, 1);
    if (
      !Number.isFinite(start) ||
      !Number.isFinite(exclusiveEnd) ||
      start !== Date.UTC(2026, 7, 1) ||
      exclusiveEnd !== Date.UTC(2027, 6, 1)
    ) {
      throw new Error('External duty coverage changed');
    }
    if (!overrides || typeof overrides !== 'object' || Array.isArray(overrides)) {
      throw new Error('External duty overrides are invalid');
    }
    const duties = new Map<string, string>();
    let index = 0;
    for (let day = start; day < exclusiveEnd; day += 86_400_000) {
      duties.set(new Date(day).toISOString().slice(0, 10), people[index++ % people.length]!);
    }
    for (const [date, person] of Object.entries(overrides)) {
      if (!duties.has(date) || typeof person !== 'string' || !people.includes(person)) {
        throw new Error('External duty override is invalid');
      }
      duties.set(date, person);
    }
    return { duties, people };
  }

  public async write(date: string, person: string): Promise<void> {
    const response = await this.request(WRITE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date, person }),
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new Error(`External duty write failed: ${response.status}`);
  }

  private async readText(url: string): Promise<string> {
    const response = await this.request(url, { signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new Error(`External duty read failed: ${response.status}`);
    return response.text();
  }

  private async readJson(url: string): Promise<unknown> {
    const response = await this.request(url, { signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new Error(`External duty read failed: ${response.status}`);
    return response.json();
  }
}
