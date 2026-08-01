import type { CalendarReadModel, GroupSummary, UserProfile } from '@schedule/contracts';
import { describe, expect, it, vi } from 'vitest';

import type { CloudbaseAuthClient } from '../auth/cloudbase.js';
import { createApiClient } from './client.js';

vi.mock('@cloudbase/js-sdk', () => ({
  default: { init: vi.fn() },
}));

const profile: UserProfile = {
  id: 'profile-1',
  realName: '张医生',
  version: 1,
};

const group: GroupSummary = {
  groupCode: '1234',
  id: 'group-1',
  name: 'Emergency Department',
  role: 'owner',
  version: 1,
};

const calendar: CalendarReadModel = {
  assignments: [
    {
      businessDate: '2026-08-01',
      changeMarkers: [],
      endsAt: '2026-08-01T00:00:00.000Z',
      id: 'assignment-1',
      plannedMembershipId: 'membership-1',
      plannedMemberName: '张医生',
      schedulePeriodId: 'period-1',
      scheduleRoleId: 'role-1',
      scheduleRoleName: '一线',
      shiftTypeAbbreviation: '全',
      shiftTypeColor: '#1F5AA6',
      shiftTypeId: 'shift-1',
      shiftTypeName: '全天班',
      shiftTypeTextColor: '#FFFFFF',
      slotPosition: 1,
      startsAt: '2026-07-31T16:00:00.000Z',
    },
  ],
  businessMonth: '2026-08',
  groupId: 'group-1',
  members: [
    {
      isConfirmed: false,
      membershipId: 'membership-1',
      realName: '张医生',
    },
  ],
  roles: [{ id: 'role-1', name: '一线' }],
  shiftTypes: [
    {
      abbreviation: '全',
      color: '#1F5AA6',
      crossesMidnight: true,
      endTime: '08:00',
      id: 'shift-1',
      isAllDay: true,
      name: '全天班',
      startTime: '08:00',
      textColor: '#FFFFFF',
    },
  ],
};

describe('Web API client', () => {
  it('sends the current CloudBase access token to the profile endpoint', async () => {
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify(profile), { status: 201 }));
    const client = createApiClient({
      auth: createAuthClient(),
      fetch: fetchImplementation,
    });

    await expect(client.createCurrentProfile({ realName: profile.realName })).resolves.toEqual(
      profile,
    );

    expect(fetchImplementation).toHaveBeenCalledWith(
      '/api/users',
      expect.objectContaining({
        body: JSON.stringify({ realName: profile.realName }),
        headers: {
          Authorization: 'Bearer signed-in-token',
          'Content-Type': 'application/json',
        },
        method: 'POST',
      }),
    );
  });

  it('sends group creation, roster claiming, and group-code updates through authenticated API calls', async () => {
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify(group), { status: 201 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ status: 'request_created' }), { status: 202 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ...group, groupCode: '9876', version: 2 }), { status: 200 }),
      );
    const client = createApiClient({
      auth: createAuthClient(),
      fetch: fetchImplementation,
    });

    await expect(
      client.createGroup({ groupCode: '1234', name: 'Emergency Department' }),
    ).resolves.toEqual(group);
    await expect(client.claimGroup({ groupCode: '1234' })).resolves.toEqual({
      status: 'request_created',
    });
    await expect(client.regenerateGroupCode(group.id, {})).resolves.toEqual({
      ...group,
      groupCode: '9876',
      version: 2,
    });

    expect(fetchImplementation).toHaveBeenNthCalledWith(
      1,
      '/api/groups',
      expect.objectContaining({
        body: JSON.stringify({ groupCode: '1234', name: 'Emergency Department' }),
        method: 'POST',
      }),
    );
    expect(fetchImplementation).toHaveBeenNthCalledWith(
      2,
      '/api/groups/claim',
      expect.objectContaining({
        body: JSON.stringify({ groupCode: '1234' }),
        method: 'POST',
      }),
    );
    expect(fetchImplementation).toHaveBeenNthCalledWith(
      3,
      '/api/groups/group-1/group-code',
      expect.objectContaining({ body: '{}', method: 'PUT' }),
    );
  });

  it('loads the calendar read model for a group and month', async () => {
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify(calendar), { status: 200 }));
    const client = createApiClient({
      auth: createAuthClient(),
      fetch: fetchImplementation,
    });

    await expect(client.getCalendar(group.id, '2026-08')).resolves.toEqual(calendar);

    expect(fetchImplementation).toHaveBeenCalledWith(
      '/api/groups/group-1/calendar?businessMonth=2026-08',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('rejects a malformed calendar response', async () => {
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response(JSON.stringify({ businessMonth: '2026-08' }), { status: 200 }),
      );
    const client = createApiClient({
      auth: createAuthClient(),
      fetch: fetchImplementation,
    });

    await expect(client.getCalendar(group.id, '2026-08')).rejects.toMatchObject({
      code: 'SERVICE_UNAVAILABLE',
      status: 200,
    });
  });

  it('maps the API conflict contract to a typed client error', async () => {
    const fetchImplementation = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          error: {
            code: 'CONFLICT',
            message: '资料已发生变化。',
            requestId: 'request-1',
          },
        }),
        { status: 409 },
      ),
    );
    const client = createApiClient({
      auth: createAuthClient(),
      fetch: fetchImplementation,
    });

    await expect(client.getCurrentProfile()).rejects.toMatchObject({
      code: 'CONFLICT',
      requestId: 'request-1',
      status: 409,
    });
  });

  it('rejects a malformed successful profile response', async () => {
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify({ id: profile.id }), { status: 200 }));
    const client = createApiClient({
      auth: createAuthClient(),
      fetch: fetchImplementation,
    });

    await expect(client.getCurrentProfile()).rejects.toMatchObject({
      code: 'SERVICE_UNAVAILABLE',
      status: 200,
    });
  });

  it('maps forbidden and network failures to recoverable client errors', async () => {
    const forbiddenClient = createApiClient({
      auth: createAuthClient(),
      fetch: vi.fn<typeof fetch>().mockResolvedValue(
        new Response(
          JSON.stringify({
            error: {
              code: 'FORBIDDEN',
              message: '当前账户无权执行此操作。',
              requestId: 'request-2',
            },
          }),
          { status: 403 },
        ),
      ),
    });
    const networkClient = createApiClient({
      auth: createAuthClient(),
      fetch: vi.fn<typeof fetch>().mockRejectedValue(new TypeError('network unavailable')),
    });

    await expect(forbiddenClient.getCurrentProfile()).rejects.toMatchObject({
      code: 'FORBIDDEN',
      status: 403,
    });
    await expect(networkClient.getCurrentProfile()).rejects.toMatchObject({
      code: 'NETWORK_ERROR',
    });
  });
});

function createAuthClient(): CloudbaseAuthClient {
  return {
    getSession: vi.fn().mockResolvedValue({
      data: {
        session: {
          access_token: 'signed-in-token',
          user: { is_anonymous: false },
        },
      },
    }),
    signInWithPassword: vi.fn(),
    signOut: vi.fn(),
  };
}
