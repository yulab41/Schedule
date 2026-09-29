import { describe, expect, it } from 'vitest';

import { ExternalDutySource } from './external-duty-source.js';

const page = 'var N=["甲","乙"]; var y=2026,mm=8,dd=1,idx=0; if(y===2027&&mm===7)break;';

function source(overrides: unknown, pageText = page): ExternalDutySource {
  const request = async (url: string | URL | Request) =>
    new Response(String(url).endsWith('edit.html') ? pageText : JSON.stringify(overrides), {
      status: 200,
    });
  return new ExternalDutySource(request as typeof fetch);
}

describe('external duty source', () => {
  it('reconstructs the fixed daily rotation and applies server overrides', async () => {
    const snapshot = await source({ '2026-08-02': '甲' }).read();
    expect(snapshot.duties.get('2026-08-01')).toBe('甲');
    expect(snapshot.duties.get('2026-08-02')).toBe('甲');
    expect(snapshot.duties.get('2026-08-03')).toBe('甲');
    expect(snapshot.duties.has('2027-07-01')).toBe(false);
  });

  it('fails closed on an unknown person or changed page coverage', async () => {
    await expect(source({ '2026-08-02': '丙' }).read()).rejects.toThrow('override');
    await expect(source({}, page.replace('mm===7', 'mm===8')).read()).rejects.toThrow('coverage');
  });

  it('fails closed when the public API times out or changes shape', async () => {
    await expect(source([]).read()).rejects.toThrow('overrides');
    const failingRequest = async (): Promise<Response> => {
      throw new Error('timeout');
    };
    await expect(new ExternalDutySource(failingRequest as typeof fetch).read()).rejects.toThrow(
      'timeout',
    );
  });

  it('sends the page save payload through the public write endpoint', async () => {
    const calls: Array<{ url: string; body: unknown }> = [];
    const request = async (url: string | URL | Request, options?: RequestInit) => {
      calls.push({ url: String(url), body: JSON.parse(String(options?.body)) });
      return new Response('{}', { status: 200 });
    };
    await new ExternalDutySource(request as typeof fetch).write('2026-09-28', '甲');
    expect(calls).toEqual([
      { url: 'http://43.133.68.128:8888/api/override', body: { date: '2026-09-28', person: '甲' } },
    ]);
  });
});
