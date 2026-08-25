import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { enableTestClientCapabilities } from './test-client-capabilities.mjs';

const groupId = '11111111-1111-4111-8111-111111111111';
const membershipId = '22222222-2222-4222-8222-222222222222';
let groupVersion = 1;

describe('P8-C-1 native organization management controller', () => {
  let definition;
  let requests;

  beforeEach(async () => {
    vi.resetModules();
    requests = [];
    groupVersion = 1;
    vi.stubGlobal('__MINIPROGRAM_API_BASE_URL__', 'https://example.test/api');
    vi.stubGlobal('__MINIPROGRAM_BUILD_COMMIT__', 'test');
    vi.stubGlobal('__MINIPROGRAM_BUILD_PROFILE__', 'production');
    vi.stubGlobal('__MINIPROGRAM_BUILD_VERSION__', 'test');
    vi.stubGlobal('wx', {
      getStorageSync: vi.fn((key) => (key === 'schedule.wechat.session' ? session() : undefined)),
      removeStorageSync: vi.fn(),
      setStorageSync: vi.fn(),
      getWindowInfo: () => ({ statusBarHeight: 24, windowHeight: 844, windowWidth: 390 }),
      request: vi.fn((options) => {
        requests.push(options);
        const url = options.url;
        if (url.endsWith('/groups') && options.method === 'GET') {
          options.success({ data: [group()], statusCode: 200 });
          return;
        }
        if (url.endsWith('/groups') && options.method === 'POST') {
          options.success({
            data: group({ groupCode: options.data.groupCode, name: options.data.name }),
            statusCode: 201,
          });
          return;
        }
        if (url.endsWith('/groups/catalog') && options.method === 'GET') {
          options.success({
            data: [{ id: 'group-join', name: '可加入群组', relation: 'none' }],
            statusCode: 200,
          });
          return;
        }
        if (url.endsWith('/groups/dissolved') && options.method === 'GET') {
          options.success({ data: [], statusCode: 200 });
          return;
        }
        if (url.endsWith(`/groups/${groupId}/mobile-phone-consent`) && options.method === 'GET') {
          options.success({ data: consent(), statusCode: 200 });
          return;
        }
        if (url.endsWith(`/groups/${groupId}/members`) && options.method === 'GET') {
          options.success({ data: [member()], statusCode: 200 });
          return;
        }
        if (url.endsWith(`/groups/${groupId}/contacts`) && options.method === 'GET') {
          options.success({ data: [contact()], statusCode: 200 });
          return;
        }
        if (url.endsWith(`/groups/${groupId}/claim-requests`) && options.method === 'GET') {
          options.success({ data: [], statusCode: 200 });
          return;
        }
        if (url.endsWith('/groups/claim') && options.method === 'POST') {
          options.success({
            data: { group: group({ id: 'group-join', name: '可加入群组' }), status: 'claimed' },
            statusCode: 200,
          });
          return;
        }
        if (url.endsWith(`/groups/${groupId}/name`) && options.method === 'PUT') {
          groupVersion = 2;
          options.success({
            data: { ...group(), name: options.data.name, version: groupVersion },
            statusCode: 200,
          });
          return;
        }
        if (url.endsWith(`/groups/${groupId}/members`) && options.method === 'POST') {
          options.success({ data: { added: options.data.realNames.length }, statusCode: 200 });
          return;
        }
        throw new Error(`unexpected request ${options.method} ${url}`);
      }),
    });
    const module =
      await import('../src/subpackages/organization/components/group-settings-panel/controller.ts');
    definition = module.createGroupSettingsPanelControllerDefinition(true);
    await enableTestClientCapabilities();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('loads member/contact/claim reads alongside the P5 consent state', async () => {
    const page = createPageInstance(definition);
    definition.onLoad.call(page, { groupId });

    await vi.waitFor(() => expect(page.data.state).toBe('ready'));

    expect(page.data).toMatchObject({
      canManageGroup: true,
      canManageMembers: true,
      currentGroupName: '头颈外科医生',
      memberCards: [
        expect.objectContaining({
          hasMobilePhone: true,
          name: '林医生',
          shortPhone: '6601',
        }),
      ],
      organizationEnabled: true,
    });
    expect(requests.filter((request) => request.method === 'GET')).toHaveLength(7);
  });

  it('uses one operation id in shared write headers and bodies for group name and roster writes', async () => {
    const page = await loadReadyPage(definition);

    definition.handleGroupNameInput.call(page, { detail: { value: '夜班组' } });
    definition.handleSaveGroupName.call(page);
    await vi.waitFor(() => expect(page.data.managementInfo).toContain('群组名称已更新'));

    const rename = requests.find((request) => request.url.endsWith(`/groups/${groupId}/name`));
    expect(rename?.header['Idempotency-Key']).toBe(rename?.data.operationId);
    expect(rename?.data.expectedVersion).toBe(1);

    definition.handleRosterInput.call(page, { detail: { value: '赵医生\n孙医生' } });
    definition.handleAddRoster.call(page);
    await vi.waitFor(() => expect(page.data.managementInfo).toContain('已添加 2 位预设成员'));

    const roster = requests.find(
      (request) => request.url.endsWith(`/groups/${groupId}/members`) && request.method === 'POST',
    );
    expect(roster?.header['Idempotency-Key']).toBe(roster?.data.operationId);
    expect(roster?.data.realNames).toEqual(['赵医生', '孙医生']);
  });

  it('keeps create and claim writes idempotent through the shared transport', async () => {
    const page = await loadReadyPage(definition);

    definition.handleCreateGroupNameInput.call(page, { detail: { value: '夜班协作组' } });
    definition.handleCreateGroupCodeInput.call(page, { detail: { value: '7310' } });
    definition.handleCreateGroup.call(page);
    await vi.waitFor(() => expect(page.data.managementInfo).toContain('群组已创建'));

    const create = requests.find(
      (request) => request.url.endsWith('/groups') && request.method === 'POST',
    );
    expect(create?.header['Idempotency-Key']).toBe(create?.data.operationId);
    expect(create?.data).toMatchObject({ groupCode: '7310', name: '夜班协作组' });

    definition.handleJoinGroupCodeInput.call(page, { detail: { value: '2608' } });
    definition.handleJoinGroup.call(page);
    await vi.waitFor(() => expect(page.data.managementInfo).toContain('已加入'));

    const claim = requests.find((request) => request.url.endsWith('/groups/claim'));
    expect(claim?.header['Idempotency-Key']).toBe(claim?.data.operationId);
    expect(claim?.data.groupCode).toBe('2608');
  });
});

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

async function loadReadyPage(controller) {
  const page = createPageInstance(controller);
  controller.onLoad.call(page, { groupId });
  await vi.waitFor(() => expect(page.data.state).toBe('ready'));
  return page;
}

function session() {
  return {
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    profile: { id: 'user-1', realName: '林恩宇', version: 1 },
    token: 'session-token',
  };
}

function group(overrides = {}) {
  return {
    groupCode: '2608',
    id: groupId,
    name: '头颈外科医生',
    role: 'owner',
    version: groupVersion,
    ...overrides,
  };
}

function member() {
  return { id: membershipId, isCurrentUser: true, realName: '林医生', role: 'owner', version: 3 };
}

function contact() {
  return {
    isConfirmed: false,
    membershipId,
    mobilePhone: '13800007926',
    shortPhone: '6601',
    version: 3,
  };
}

function consent() {
  return {
    contactVersion: 3,
    groupId,
    maskedMobilePhone: '138 **** 7926',
    membershipId,
    noticeVersion: 'v1',
    state: 'not-consented',
  };
}
