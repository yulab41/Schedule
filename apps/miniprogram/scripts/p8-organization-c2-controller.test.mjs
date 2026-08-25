import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { enableTestClientCapabilities } from './test-client-capabilities.mjs';

const groupId = '11111111-1111-4111-8111-111111111111';
const roleId = 'role-1';
let rulesVersion = 4;

describe('P8-C-2 native scheduling configuration controller', () => {
  let definition;
  let requests;

  beforeEach(async () => {
    vi.resetModules();
    requests = [];
    rulesVersion = 4;
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
        if (options.url.endsWith('/groups') && options.method === 'GET') {
          options.success({ data: [group()], statusCode: 200 });
          return;
        }
        if (
          options.url.endsWith(`/groups/${groupId}/scheduling-config`) &&
          options.method === 'GET'
        ) {
          options.success({ data: config(), statusCode: 200 });
          return;
        }
        if (
          options.url.endsWith(`/groups/${groupId}/schedule-roles`) &&
          options.method === 'POST'
        ) {
          rulesVersion += 1;
          options.success({ data: role(), statusCode: 201 });
          return;
        }
        throw new Error(`unexpected request ${options.method} ${options.url}`);
      }),
      showModal: vi.fn(({ success }) => success({ confirm: true, cancel: false })),
    });
    const module =
      await import('../src/subpackages/organization/components/scheduling-config-panel/controller.ts');
    definition = module.createSchedulingConfigPanelControllerDefinition();
    await enableTestClientCapabilities();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('loads scheduling configuration read-only data and readiness state', async () => {
    const page = createPageInstance(definition);
    definition.onLoad.call(page, { groupId });
    await vi.waitFor(() => expect(page.data.state).toBe('ready'));

    expect(page.data).toMatchObject({
      canManage: true,
      currentGroupName: '急诊科',
      organizationEnabled: true,
      roleCards: [expect.objectContaining({ name: '一线', requiredMembersPerDay: 1 })],
      rulesVersion: 4,
      shiftDrafts: [expect.objectContaining({ name: '全天班', isAllDay: true })],
    });
  });

  it('uses one operation id and expected rules version for role creation', async () => {
    const page = createPageInstance(definition);
    definition.onLoad.call(page, { groupId });
    await vi.waitFor(() => expect(page.data.state).toBe('ready'));
    definition.handleNewRoleInput.call(page, { detail: { value: '二线' } });
    definition.handleCreateRole.call(page);
    await vi.waitFor(() => expect(page.data.managementInfo).toContain('岗位已创建'));

    const request = requests.find(
      (candidate) =>
        candidate.url.endsWith(`/groups/${groupId}/schedule-roles`) && candidate.method === 'POST',
    );
    expect(request?.header['Idempotency-Key']).toBe(request?.data.operationId);
    expect(request?.data.expectedRulesVersion).toBe(4);
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

function session() {
  return {
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    profile: { id: 'user-1', realName: '林医生', version: 1 },
    token: 'session-token',
  };
}

function group() {
  return { id: groupId, isDeveloperAdmin: true, name: '急诊科', role: 'owner', version: 3 };
}

function config() {
  return {
    groupMembers: [{ membershipId: 'membership-1', realName: '林医生' }],
    roles: [role()],
    rulesVersion,
    shiftTypes: [
      {
        abbreviation: '全',
        color: '#1F5AA6',
        configurationVersion: 4,
        countsTowardStatistics: true,
        crossesMidnight: false,
        displayOrder: 1,
        id: 'shift-1',
        isAllDay: true,
        isBuiltIn: true,
        isEnabled: true,
        name: '全天班',
        textColor: '#FFFFFF',
        version: 2,
      },
    ],
  };
}

function role() {
  return {
    id: roleId,
    members: [
      {
        id: 'role-member-1',
        membershipId: 'membership-1',
        position: 1,
        realName: '林医生',
        version: 2,
      },
    ],
    name: '一线',
    rotationRule: {
      currentPosition: 1,
      defaultShiftTypeId: 'shift-1',
      requiredMembersPerDay: 1,
      startDate: '2026-08-01',
      startingMemberScheduleRoleId: 'role-member-1',
      version: 2,
    },
    version: 2,
  };
}
