import { readFileSync } from 'node:fs';

import { describe, expect, it, vi } from 'vitest';
import { enableTestClientCapabilities } from './test-client-capabilities.mjs';

const groupId = '11111111-1111-4111-8111-111111111111';
const operationId = '22222222-2222-4222-8222-222222222222';

describe('P7 Mini workflow client boundary', () => {
  it('creates the shared workflow client behind the workflows capability only', async () => {
    vi.resetModules();
    vi.stubGlobal('__MINIPROGRAM_API_BASE_URL__', 'https://example.test/api');
    vi.stubGlobal('__MINIPROGRAM_BUILD_COMMIT__', 'test');
    vi.stubGlobal('__MINIPROGRAM_BUILD_PROFILE__', 'production');
    vi.stubGlobal('__MINIPROGRAM_BUILD_VERSION__', 'test');
    const requests = [];
    vi.stubGlobal('wx', {
      request: vi.fn((options) => {
        requests.push(options);
        options.success({
          data: {
            createdAt: '2026-08-24T00:00:00.000Z',
            endsAt: '2026-08-26T16:00:00.000Z',
            groupId,
            id: '33333333-3333-4333-8333-333333333333',
            isAllDay: true,
            leaveType: 'sick',
            membershipId: '44444444-4444-4444-8444-444444444444',
            reflowStrategy: 'keep-original-order',
            startsAt: '2026-08-24T16:00:00.000Z',
            status: 'pending',
            version: 1,
          },
          statusCode: 201,
        });
      }),
    });
    const module = await import('../src/platform/client-core-calendar.ts');
    await enableTestClientCapabilities();
    const client = module.createRuntimeWorkflowClient(() => 'test-token');

    await client.createLeaveRequest(groupId, {
      endsAt: '2026-08-26T16:00:00.000Z',
      isAllDay: true,
      leaveType: 'sick',
      operationId,
      startsAt: '2026-08-24T16:00:00.000Z',
    });

    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({
      data: { operationId },
      header: {
        Authorization: 'Bearer test-token',
        'Idempotency-Key': operationId,
      },
      method: 'POST',
      url: `https://example.test/api/groups/${groupId}/leave-requests`,
    });
    vi.unstubAllGlobals();
  });

  it('keeps the Mini workflow adapter free of Web, DOM, Node, database, and Zod runtime imports', () => {
    const source = readFileSync(
      new URL('../src/platform/client-core-calendar.ts', import.meta.url),
      'utf8',
    );

    expect(source).toContain('createWorkflowClient');
    expect(source).toContain("capability = 'workflows'");
    expect(source).not.toMatch(/tdesign|@schedule\/database|\bzod\b|node:|document|window/iu);
  });
});
