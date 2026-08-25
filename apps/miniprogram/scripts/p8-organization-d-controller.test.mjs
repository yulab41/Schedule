import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { enableTestClientCapabilities } from './test-client-capabilities.mjs';

const groupId = '11111111-1111-4111-8111-111111111111';

describe('P8-D native invite and visitor controller', () => {
  let definition;
  let requests;

  beforeEach(async () => {
    vi.resetModules();
    requests = [];
    vi.stubGlobal('__MINIPROGRAM_API_BASE_URL__', 'https://example.test/api');
    vi.stubGlobal('__MINIPROGRAM_BUILD_COMMIT__', 'test');
    vi.stubGlobal('__MINIPROGRAM_BUILD_PROFILE__', 'production');
    vi.stubGlobal('__MINIPROGRAM_BUILD_VERSION__', 'test');
    vi.stubGlobal('wx', {
      getStorageSync: vi.fn((key) => (key === 'schedule.wechat.session' ? session() : undefined)),
      getWindowInfo: () => ({ statusBarHeight: 24, windowHeight: 844, windowWidth: 390 }),
      navigateBack: vi.fn(),
      request: vi.fn((options) => {
        requests.push(options);
        const url = options.url;
        if (url.endsWith('/groups') && options.method === 'GET') {
          options.success({ data: [group()], statusCode: 200 });
          return;
        }
        if (url.endsWith(`/groups/${groupId}/members`) && options.method === 'GET') {
          options.success({ data: members(), statusCode: 200 });
          return;
        }
        if (url.endsWith(`/groups/${groupId}/scheduling-config`) && options.method === 'GET') {
          options.success({ data: config(), statusCode: 200 });
          return;
        }
        if (url.endsWith(`/groups/${groupId}/invite-links`) && options.method === 'POST') {
          options.success({ data: invite(), statusCode: 201 });
          return;
        }
        if (url.endsWith(`/groups/${groupId}/group-qr`) && options.method === 'GET') {
          options.success({ data: { imageBase64: 'iVBORw0KGgo=' }, statusCode: 200 });
          return;
        }
        if (url.endsWith(`/groups/${groupId}/visitor-key`) && options.method === 'PUT') {
          options.success({ data: { visitorKeyChanged: true }, statusCode: 200 });
          return;
        }
        throw new Error(`unexpected request ${options.method} ${url}`);
      }),
      showModal: vi.fn(({ success }) => success({ confirm: true, cancel: false })),
    });
    const module =
      await import('../src/subpackages/organization/components/invite-visitor-panel/controller.ts');
    definition = module.createInviteVisitorPanelControllerDefinition();
    await enableTestClientCapabilities();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('loads member and role targets without persisting invite material', async () => {
    const page = createPageInstance(definition);
    definition.onLoad.call(page, { groupId });
    await vi.waitFor(() => expect(page.data.state).toBe('ready'));

    expect(page.data).toMatchObject({
      canManage: true,
      guestEnabled: true,
      organizationEnabled: true,
      targets: [
        expect.objectContaining({ kind: 'membership', name: '林医生' }),
        expect.objectContaining({ kind: 'roster', name: '陈医生' }),
      ],
    });
  });

  it('keeps invite creation idempotent and holds the raw token outside page data', async () => {
    const page = await loadReadyPage(definition);
    definition.handleCreateInvite.call(page);
    await vi.waitFor(() => expect(page.data.managementInfo).toContain('邀请已生成'));

    const request = requests.find((candidate) =>
      candidate.url.endsWith(`/groups/${groupId}/invite-links`),
    );
    expect(request?.header['Idempotency-Key']).toBe(request?.data.operationId);
    expect(request?.data.expectedTargetVersion).toBe(3);
    expect(page.data.inviteSharePath).toContain('pages/invite/invite');
    expect(page.data).not.toHaveProperty('inviteToken');
    expect(page._inviteToken).toBe('invite-token-secret');
  });

  it('requires guest capability for QR and visitor-key operations', async () => {
    const page = await loadReadyPage(definition);
    definition.handleLoadQr.call(page);
    await vi.waitFor(() => expect(page.data.qrVisible).toBe(true));
    expect(page.data.qrImageSrc).toBe('data:image/png;base64,iVBORw0KGgo=');

    definition.handleRegenerateVisitorKey.call(page);
    await vi.waitFor(() => expect(page.data.visitorMessage).toContain('访客码已轮换'));
    const regenerate = requests.find((candidate) => candidate.url.endsWith('/visitor-key'));
    expect(regenerate?.header['Idempotency-Key']).toBe(regenerate?.data.operationId);
    expect(regenerate?.data.expectedVersion).toBe(3);
  });
});

async function loadReadyPage(controller) {
  const page = createPageInstance(controller);
  controller.onLoad.call(page, { groupId });
  await vi.waitFor(() => expect(page.data.state).toBe('ready'));
  return page;
}

function createPageInstance(controller) {
  const page = {
    data: { ...controller.data },
    setData(patch) {
      this.data = { ...this.data, ...patch };
    },
  };
  for (const [key, value] of Object.entries(controller)) {
    if (key.startsWith('_')) page[key] = value;
  }
  return page;
}

function session() {
  return {
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    profile: { id: 'user-1', realName: '林医生', version: 1 },
    token: 'session-token',
  };
}

function group() {
  return { groupCode: '2608', id: groupId, name: '急诊科', role: 'owner', version: 3 };
}

function members() {
  return [
    { id: 'membership-1', isCurrentUser: true, realName: '林医生', role: 'owner', version: 3 },
    {
      id: 'roster-1',
      isCurrentUser: false,
      isPendingRoster: true,
      isUnclaimed: true,
      realName: '陈医生',
      role: 'member',
      version: 1,
    },
  ];
}

function config() {
  return {
    groupMembers: [
      { membershipId: 'membership-1', realName: '林医生' },
      { membershipId: 'roster-1', realName: '陈医生' },
    ],
    roles: [
      {
        id: 'role-1',
        members: [],
        name: '一线',
        rotationRule: {
          currentPosition: 1,
          defaultShiftTypeId: 'shift-1',
          requiredMembersPerDay: 1,
          version: 1,
        },
        version: 1,
      },
    ],
    rulesVersion: 1,
    shiftTypes: [
      {
        abbreviation: '全',
        color: '#1F5AA6',
        configurationVersion: 1,
        countsTowardStatistics: true,
        crossesMidnight: false,
        displayOrder: 1,
        id: 'shift-1',
        isAllDay: true,
        isBuiltIn: true,
        isEnabled: true,
        name: '全天班',
        textColor: '#FFFFFF',
        version: 1,
      },
    ],
  };
}

function invite() {
  return {
    expiresAt: '2026-08-26T08:00:00.000Z',
    groupName: '急诊科',
    permissionRole: 'member',
    realName: '林医生',
    scheduleRoleName: '一线',
    sharePath: 'pages/invite/invite?t=redacted-in-memory',
    token: 'invite-token-secret',
    version: 1,
  };
}
