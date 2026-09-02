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
        if (options.method === 'PUT' && options.url.endsWith('/rotation-rule')) {
          const requestedRoleId = decodeURIComponent(
            options.url.split('/schedule-roles/')[1]?.split('/')[0] ?? '',
          );
          const existingRole = fixtureConfig.roles.find(
            (candidate) => candidate.id === requestedRoleId,
          );
          if (existingRole === undefined) throw new Error(`unknown role ${requestedRoleId}`);
          options.success({
            data: {
              ...existingRole,
              rotationRule: {
                ...existingRole.rotationRule,
                currentPosition: options.data.currentPosition,
                defaultShiftTypeId: options.data.defaultShiftTypeId,
                requiredMembersPerDay: options.data.requiredMembersPerDay,
                startDate: options.data.startDate,
                startingMemberScheduleRoleId: options.data.startingMemberScheduleRoleId,
                version: existingRole.rotationRule.version + 1,
              },
            },
            statusCode: 200,
          });
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
      roleCards: [expect.objectContaining({ name: '一线', requiredMembersPerDay: 1 })],
      rulesVersion: 4,
      shiftDrafts: [expect.objectContaining({ name: '全天班', isAllDay: true })],
    });
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

  it('updates one numeric rotation draft without rebuilding role or member views', async () => {
    const result = await measureRotationInput({ memberCount: 100, roleCount: 4 });
    const expectedPatch = { 'roleCards[2].requiredMembersPerDay': 12 };

    expect(result.metrics).toEqual({
      memberListCopies: 0,
      memberViewCopies: 0,
      patchKeys: Object.keys(expectedPatch),
      payloadBytes: Buffer.byteLength(JSON.stringify(expectedPatch), 'utf8'),
      roleCardRebuilds: 0,
      setDataCalls: 1,
      sortCalls: 0,
    });
    expect(result.page.data.roleCards.find((roleCard) => roleCard.id === 'role-3')).toMatchObject({
      requiredMembersPerDay: 12,
    });
  });

  it('keeps the numeric input patch constant when member scale grows', async () => {
    const small = await measureRotationInput({ memberCount: 2, roleCount: 4 });
    const large = await measureRotationInput({ memberCount: 100, roleCount: 4 });
    const expectedPatch = { 'roleCards[2].requiredMembersPerDay': 12 };
    const expectedMetrics = {
      memberListCopies: 0,
      memberViewCopies: 0,
      patchKeys: Object.keys(expectedPatch),
      payloadBytes: Buffer.byteLength(JSON.stringify(expectedPatch), 'utf8'),
      roleCardRebuilds: 0,
      setDataCalls: 1,
      sortCalls: 0,
    };

    expect({
      growth: {
        memberListCopies: large.metrics.memberListCopies - small.metrics.memberListCopies,
        memberViewCopies: large.metrics.memberViewCopies - small.metrics.memberViewCopies,
        payloadBytes: large.metrics.payloadBytes - small.metrics.payloadBytes,
        roleCardRebuilds: large.metrics.roleCardRebuilds - small.metrics.roleCardRebuilds,
        sortCalls: large.metrics.sortCalls - small.metrics.sortCalls,
      },
      large: large.metrics,
      small: small.metrics,
    }).toEqual({
      growth: {
        memberListCopies: 0,
        memberViewCopies: 0,
        payloadBytes: 0,
        roleCardRebuilds: 0,
        sortCalls: 0,
      },
      large: expectedMetrics,
      small: expectedMetrics,
    });
  });

  it('keeps stable-id input, normalization, prompts, and the latest saved values', async () => {
    const page = await createReadyPage({ memberCount: 5, roleCount: 4 });
    const targetRole = page.data.roleCards.find((roleCard) => roleCard.id === 'role-3');
    expect(targetRole).toBeDefined();
    const otherRoles = page.data.roleCards.filter((roleCard) => roleCard.id !== 'role-3');
    page.data.roleCards = [targetRole, ...otherRoles];
    const targetMembers = targetRole.members;
    const otherRoleSnapshots = otherRoles.map((roleCard) => structuredClone(roleCard));
    page.data.managementError = '保留现有校验提示';
    page.patches.length = 0;

    inputRotation(page, 'role-3', 'requiredMembersPerDay', '2');
    inputRotation(page, 'role-3', 'requiredMembersPerDay', '27');

    expect(page.patches.map((patch) => Object.keys(patch))).toEqual([
      ['roleCards[0].requiredMembersPerDay'],
      ['roleCards[0].requiredMembersPerDay'],
    ]);
    expect(page.data.roleCards[0]).toMatchObject({ id: 'role-3', requiredMembersPerDay: 27 });
    expect(page.data.roleCards[0].members).toBe(targetMembers);
    expect(page.data.roleCards.slice(1)).toEqual(otherRoleSnapshots);
    expect(page.data.managementError).toBe('保留现有校验提示');

    inputRotation(page, 'role-3', 'requiredMembersPerDay', '');
    expect(page.data.roleCards[0].requiredMembersPerDay).toBe(1);
    inputRotation(page, 'role-3', 'requiredMembersPerDay', 'invalid');
    expect(page.data.roleCards[0].requiredMembersPerDay).toBe(1);
    inputRotation(page, 'role-3', 'requiredMembersPerDay', '9');
    inputRotation(page, 'role-3', 'currentPosition', '04');
    inputRotation(page, 'role-3', 'startDate', '2026-09-02');

    expect(page.data.roleCards[0]).toMatchObject({
      currentPosition: 4,
      id: 'role-3',
      requiredMembersPerDay: 9,
      startDate: '2026-09-02',
    });
    expect(page.data.managementError).toBe('保留现有校验提示');
    expect(definition.handleRotationBlur).toBeUndefined();

    definition.handleSaveRotation.call(page, {
      currentTarget: { dataset: { roleId: 'role-3' } },
    });
    await vi.waitFor(() =>
      expect(
        requests.some(
          (candidate) =>
            candidate.method === 'PUT' && candidate.url.endsWith('/role-3/rotation-rule'),
        ),
      ).toBe(true),
    );
    await vi.waitFor(() => expect(page.data.managementInfo).toBe('轮转规则已保存。'));
    const saveRequest = requests.find(
      (candidate) => candidate.method === 'PUT' && candidate.url.endsWith('/role-3/rotation-rule'),
    );
    expect(saveRequest?.data).toMatchObject({
      currentPosition: 4,
      requiredMembersPerDay: 9,
      startDate: '2026-09-02',
    });
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

async function measureRotationInput({ memberCount, roleCount }) {
  const page = await createReadyPage({ memberCount, roleCount });
  const beforeCards = new Map(page.data.roleCards.map((roleCard) => [roleCard.id, roleCard]));
  const beforeMembers = new Map(
    page.data.roleCards.map((roleCard) => [roleCard.id, roleCard.members]),
  );
  const beforeMemberViews = new Set(page.data.roleCards.flatMap((roleCard) => roleCard.members));
  page.patches.length = 0;
  const sortSpy = vi.spyOn(Array.prototype, 'sort');
  inputRotation(page, 'role-3', 'requiredMembersPerDay', '12');
  const sortCalls = sortSpy.mock.calls.length;
  sortSpy.mockRestore();
  const patch = page.patches[0] ?? {};

  return {
    metrics: {
      memberListCopies: page.data.roleCards.filter(
        (roleCard) => beforeMembers.get(roleCard.id) !== roleCard.members,
      ).length,
      memberViewCopies: page.data.roleCards
        .flatMap((roleCard) => roleCard.members)
        .filter((member) => !beforeMemberViews.has(member)).length,
      patchKeys: Object.keys(patch).sort(),
      payloadBytes: Buffer.byteLength(JSON.stringify(patch), 'utf8'),
      roleCardRebuilds: page.data.roleCards.filter(
        (roleCard) => beforeCards.get(roleCard.id) !== roleCard,
      ).length,
      setDataCalls: page.patches.length,
      sortCalls,
    },
    page,
  };
}

function inputRotation(page, targetRoleId, field, value) {
  definition.handleRotationInput.call(page, {
    currentTarget: { dataset: { field, roleId: targetRoleId } },
    detail: { value },
  });
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
    position: index + 1,
    realName: member.realName,
    version: 2,
  }));
  return {
    id: resolvedRoleId,
    members,
    name: `${roleOrdinal}线`,
    rotationRule: {
      currentPosition: 1,
      defaultShiftTypeId: 'shift-1',
      requiredMembersPerDay: 1,
      startDate: '2026-08-01',
      startingMemberScheduleRoleId: members[0]?.id ?? null,
      version: 2,
    },
    version: 2,
  };
}
