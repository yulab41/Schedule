import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { enableTestClientCapabilities } from './test-client-capabilities.mjs';

const groupId = '11111111-1111-4111-8111-111111111111';
let definition;
let fixtureConfig;
let requests;
let rulesVersion = 4;

describe('P8-C-2 native scheduling configuration controller', () => {
  beforeEach(async () => {
    vi.resetModules();
    requests = [];
    rulesVersion = 4;
    fixtureConfig = config();
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
          options.success({ data: fixtureConfig, statusCode: 200 });
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
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('loads scheduling configuration read-only data and readiness state', async () => {
    const page = createPageInstance(definition);
    page.properties = { groupId };
    definition.lifetimes.attached.call(page);
    await vi.waitFor(() => expect(page.data.state).toBe('ready'));

    expect(page.data).toMatchObject({
      canManage: true,
      currentGroupName: '急诊科',
      organizationEnabled: true,
      roleCards: [expect.objectContaining({ name: '一线' })],
      shiftDrafts: [expect.objectContaining({ name: '全天班', isAllDay: true })],
    });
  });

  it('renames in a prefilled dialog, preserving unsaved member selections and retry identity', async () => {
    const page = await createReadyPage({ memberCount: 2 });
    definition.handleToggleRoleMember.call(page, {
      currentTarget: { dataset: { roleId: 'role-1', membershipId: 'membership-1' } },
    });
    const selected = [...page._roleMemberIds.get('role-1')];
    definition.handleRoleRename.call(page, { currentTarget: { dataset: { roleId: 'role-1' } } });
    expect(page.data.roleEditName).toBe('一线');
    definition.handleRoleEditInput.call(page, { detail: { value: '  新岗位  ' } });
    const update = vi
      .fn()
      .mockRejectedValueOnce(new Error('网络中断'))
      .mockResolvedValue({ ...fixtureConfig.roles[0], name: '新岗位', version: 3 });
    page._schedulingWriteClient.updateScheduleRole = update;
    definition.handleRoleRenameSave.call(page);
    await vi.waitFor(() => expect(page.data.roleEditError).toContain('网络中断'));
    expect(page.data.roleEditName).toBe('  新岗位  ');
    definition.handleRoleRenameSave.call(page);
    await vi.waitFor(() => expect(page.data.roleEditId).toBe(''));
    expect(update.mock.calls[0]).toEqual(update.mock.calls[1]);
    expect(update.mock.calls[1][2]).toMatchObject({
      name: '新岗位',
      expectedVersion: 2,
      expectedRulesVersion: 4,
    });
    expect(page.data.roleCards[0].name).toBe('新岗位');
    expect(page._roleMemberIds.get('role-1')).toEqual(selected);
  });

  it('uses one operation id and expected rules version for role creation', async () => {
    const page = createPageInstance(definition);
    page.properties = { groupId };
    definition.lifetimes.attached.call(page);
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

  it('still rebuilds the member view when membership selection changes', async () => {
    const page = await createReadyPage({ memberCount: 2, roleCount: 2 });
    page.patches.length = 0;

    definition.handleToggleRoleMember.call(page, {
      currentTarget: {
        dataset: { membershipId: 'membership-1', roleId: 'role-1' },
      },
    });

    expect(page.patches).toHaveLength(1);
    expect(Object.keys(page.patches[0])).toEqual(['roleCards']);
    expect(
      page.data.roleCards[0].members.find((member) => member.membershipId === 'membership-1')
        ?.selected,
    ).toBe(false);
  });
});

function createPageInstance(controller) {
  const patches = [];
  const page = {
    data: structuredClone(controller.data),
    patches,
    setData(patch, callback) {
      patches.push(patch);
      applySetDataPatch(this.data, patch);
      callback?.();
    },
  };
  return page;
}

async function createReadyPage(options) {
  fixtureConfig = config(options);
  const page = createPageInstance(definition);
  page.properties = { groupId };
  definition.lifetimes.attached.call(page);
  await vi.waitFor(() => expect(page.data.state).toBe('ready'));
  return page;
}

function applySetDataPatch(target, patch) {
  for (const [path, value] of Object.entries(patch)) {
    const roleField = /^roleCards\[(\d+)\]\.([A-Za-z][A-Za-z0-9]*)$/u.exec(path);
    if (roleField === null) {
      target[path] = value;
      continue;
    }
    const roleCard = target.roleCards[Number(roleField[1])];
    if (roleCard === undefined) throw new Error(`missing role card for ${path}`);
    roleCard[roleField[2]] = value;
  }
}

function session() {
  return {
    clientVersion: 'test',
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    profile: { id: 'user-1', realName: '林医生', version: 1 },
    token: 'session-token',
  };
}

function group() {
  return { id: groupId, isDeveloperAdmin: true, name: '急诊科', role: 'owner', version: 3 };
}

function config({ memberCount = 1, roleCount = 1 } = {}) {
  const groupMembers = Array.from({ length: memberCount }, (_, index) => ({
    membershipId: `membership-${index + 1}`,
    realName: `成员${String(index + 1).padStart(3, '0')}`,
  }));
  return {
    groupMembers,
    roles: Array.from({ length: roleCount }, (_, index) => role(index, groupMembers)),
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

function role(
  roleIndex = 0,
  groupMembers = [{ membershipId: 'membership-1', realName: '林医生' }],
) {
  const resolvedRoleId = `role-${roleIndex + 1}`;
  const roleOrdinal = ['一', '二', '三', '四'][roleIndex] ?? String(roleIndex + 1);
  const members = groupMembers.map((member, index) => ({
    id: `${resolvedRoleId}-member-${index + 1}`,
    membershipId: member.membershipId,
    realName: member.realName,
    version: 2,
  }));
  return {
    id: resolvedRoleId,
    members,
    name: `${roleOrdinal}线`,
    version: 2,
  };
}
