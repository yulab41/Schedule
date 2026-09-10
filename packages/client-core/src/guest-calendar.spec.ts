import { describe, expect, it } from 'vitest';
import { build } from 'esbuild';
import {
  calendarReadEndpoints,
  createCalendarReadClient,
  guestCalendarReadModelDecoder,
  visitorResolveResponseDecoder,
} from './calendar-client.js';
import { calendarApiGoldenResponse } from './testing/calendar-api-golden.js';

describe('guest calendar client', () => {
  it('strictly decodes the existing server wrapper instead of accepting member responses', () => {
    const response = { calendar: calendarApiGoldenResponse, groupName: '访客群' };
    expect(guestCalendarReadModelDecoder.safeDecode(response).success).toBe(true);
    expect(guestCalendarReadModelDecoder.safeDecode(calendarApiGoldenResponse).success).toBe(false);
    expect(guestCalendarReadModelDecoder.safeDecode({ ...response, secret: 'no' }).success).toBe(
      false,
    );
    expect(
      guestCalendarReadModelDecoder.safeDecode({
        ...response,
        calendar: { ...calendarApiGoldenResponse, assignments: [{}] },
      }).success,
    ).toBe(false);
    expect(visitorResolveResponseDecoder.safeDecode({ groupId: 123, groupName: 'x' }).success).toBe(
      false,
    );
  });
  it('keeps authenticated and anonymous endpoint methods and paths distinct', async () => {
    const calls: unknown[] = [];
    const client = createCalendarReadClient({
      request: async (endpoint, input) => {
        calls.push({
          auth: endpoint.auth,
          method: endpoint.method,
          path: endpoint.path(input),
          body: endpoint.body?.(input),
        });
        return undefined as never;
      },
    });
    await client.getGroupGuestCalendar('group/1', '2026-12');
    await client.resolveVisitor('a'.repeat(32));
    await client.getGuestCalendar('group/1', '2027-01', 'a'.repeat(32));
    expect(calls).toEqual([
      {
        auth: 'bearer',
        method: 'GET',
        path: '/groups/group%2F1/guest-calendar?businessMonth=2026-12',
        body: undefined,
      },
      {
        auth: 'public',
        method: 'POST',
        path: '/guest/groups/resolve',
        body: { visitorKey: 'a'.repeat(32) },
      },
      {
        auth: 'public',
        method: 'GET',
        path: `/guest/groups/group%2F1/calendar?businessMonth=2027-01&visitorKey=${'a'.repeat(32)}`,
        body: undefined,
      },
    ]);
    expect(calendarReadEndpoints.guestHolidays.auth).toBe('public');
  });
  it('keeps guest reader declarations within the 100 KB Mini entry budget', async () => {
    const result = await build({
      stdin: {
        contents: "export { createCalendarReadClient } from './packages/client-core/src/index.ts'",
        resolveDir: process.cwd(),
      },
      write: false,
      bundle: true,
      format: 'esm',
      platform: 'browser',
      minify: true,
    });
    const output = result.outputFiles[0]?.text ?? '';
    expect(output).not.toContain('visitorAccessAggregate');
    expect(output).not.toContain('passwordIdentityAssignment');
    expect(output.length).toBeLessThan(100000);
  });
});
