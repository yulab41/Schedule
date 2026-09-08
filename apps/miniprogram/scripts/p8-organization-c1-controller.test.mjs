import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { enableTestClientCapabilities } from './test-client-capabilities.mjs';

const groupId = '11111111-1111-4111-8111-111111111111';
const membershipId = '22222222-2222-4222-8222-222222222222';
const shiftTypeId = '33333333-3333-4333-8333-333333333333';
let groupVersion = 1;
let contactOverrides = {};

describe('P8-C-1 native organization management controller', () => {
  let definition;
  let requests;

  beforeEach(async () => {
    vi.resetModules();
    requests = [];
    groupVersion = 1;
    contactOverrides = {};
    vi.stubGlobal('__MINIPROGRAM_API_BASE_URL__', 'https://example.test/api');
    vi.stubGlobal('__MINIPROGRAM_BUILD_COMMIT__', 'test');
    vi.stubGlobal('__MINIPROGRAM_BUILD_PROFILE__', 'production');
    vi.stubGlobal('__MINIPROGRAM_BUILD_VERSION__', 'test');
    vi.stubGlobal('wx', {
      makePhoneCall: vi.fn(),
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
            data: group({ name: options.data.name }),
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
        if (url.split('?')[0].endsWith(`/groups/${groupId}/contacts`) && options.method === 'GET') {
          options.success({ data: [contact()], statusCode: 200 });
          return;
        }
        if (url.endsWith(`/groups/${groupId}/claim-requests`) && options.method === 'GET') {
          options.success({ data: [], statusCode: 200 });
          return;
        }
        if (url.endsWith(`/groups/${groupId}/calendar-preferences`) && options.method === 'GET') {
          options.success({ data: calendarPreferences(), statusCode: 200 });
          return;
        }
        if (url.endsWith(`/groups/${groupId}/scheduling-config`) && options.method === 'GET') {
          options.success({ data: schedulingConfig(), statusCode: 200 });
          return;
        }
        if (
          url.endsWith(`/groups/${groupId}/members/${membershipId}/contact`) &&
          options.method === 'PUT'
        ) {
          options.success({
            data: {
              isConfirmed: options.data.isConfirmed,
              membershipId,
              mobilePhone: options.data.mobilePhone ?? undefined,
              shortPhone: options.data.shortPhone ?? undefined,
              version: 4,
            },
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

  it('loads developer-admin member/contact reads without retired claims alongside the P5 consent state', async () => {
    const page = createPageInstance(definition);
    definition.onLoad.call(page, { groupId });

    await vi.waitFor(() => expect(page.data.state).toBe('ready'));

    expect(page.data).toMatchObject({
      canManageGroup: true,
      canManageGroupCalendarDefaults: true,
      canManageGroupLifecycle: true,
      canManageMembers: true,
      calendarPreferencesState: 'ready',
      currentGroupName: '头颈外科医生',
      memberCards: [
        expect.objectContaining({
          name: '林医生',
        }),
      ],
      organizationEnabled: true,
    });
    expect(requests.filter((request) => request.method === 'GET')).toHaveLength(7);
    expect(requests.some((request) => request.url.includes('claim'))).toBe(false);
  });

  it('reuses a self directory card and only dials a current authorized number', async () => {
    const page = await loadReadyPage(definition);
    const member = page.data.memberCards[0];
    expect(member.entry.title).toBe(member.name);
    expect(member.isCurrentUser).toBe(true);
    expect(member.entry.kindLabel).toBe('群主');
    expect(member.entry.jobTitles).toEqual([]);
    definition.handleMemberCall.call(page, { detail: { groupId: membershipId, number: '6601' } });
    expect(globalThis.wx.makePhoneCall).toHaveBeenCalledExactlyOnceWith({ phoneNumber: '6601' });
    definition.handleMemberCall.call(page, { detail: { groupId: 'stale-member', number: '6601' } });
    definition.handleMemberCall.call(page, { detail: { groupId: membershipId, number: '9999' } });
    expect(globalThis.wx.makePhoneCall).toHaveBeenCalledTimes(1);
  });

  it('does not derive dialable numbers from masked or missing mobile phones', async () => {
    contactOverrides = { mobilePhone: '138 **** 0000', shortPhone: undefined };
    const page = await loadReadyPage(definition);
    expect(page.data.memberCards[0].entry.contacts[0].numbers[0].dialable).toBe(false);
    definition.handleMemberCall.call(page, {
      detail: { groupId: membershipId, number: '1380000' },
    });
    expect(globalThis.wx.makePhoneCall).not.toHaveBeenCalled();
  });

  it('changes dropdown drafts without writing until the explicit save action', async () => {
    const page = await loadReadyPage(definition);
    definition.handleGroupCalendarViewSelect.call(page, { detail: { option: { value: 'week' } } });
    definition.handleMemberCalendarViewSelect.call(page, {
      detail: { option: { value: 'follow' } },
    });
    definition.handleGroupCalendarShiftChange.call(page, { detail: { value: '0' } });
    expect(page.data.groupCalendarView).toBe('week');
    expect(page.data.memberCalendarView).toBe('follow');
    expect(requests.filter((request) => request.method !== 'GET')).toHaveLength(0);
    page.data.canManageGroupCalendarDefaults = false;
    definition.handleGroupCalendarViewSelect.call(page, { detail: { option: { value: 'list' } } });
    expect(page.data.groupCalendarView).toBe('week');
  });

  it('keeps the existing contact editor payload when member cards are reused', async () => {
    const page = await loadReadyPage(definition);
    definition.handleOpenContactEditor.call(page, {
      currentTarget: { dataset: { memberId: membershipId } },
    });
    definition.handleContactMobileInput.call(page, { detail: { value: '13000000000' } });
    definition.handleContactShortInput.call(page, { detail: { value: '' } });
    definition.handleSaveContact.call(page);
    await vi.waitFor(() =>
      expect(
        requests.some(
          (request) =>
            request.url.endsWith(`/members/${membershipId}/contact`) && request.method === 'PUT',
        ),
      ).toBe(true),
    );
    const write = requests.find(
      (request) =>
        request.url.endsWith(`/members/${membershipId}/contact`) && request.method === 'PUT',
    );
    expect(write.data).toMatchObject({
      mobilePhone: '13000000000',
      shortPhone: null,
      expectedVersion: 3,
    });
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

  it('creates without a group code and retains the idempotency boundary', async () => {
    const page = await loadReadyPage(definition);

    definition.handleCreateGroupNameInput.call(page, { detail: { value: '夜班协作组' } });
    definition.handleCreateGroup.call(page);
    await vi.waitFor(() => expect(page.data.managementInfo).toContain('群组已创建'));

    const create = requests.find(
      (request) => request.url.endsWith('/groups') && request.method === 'POST',
    );
    expect(create?.header['Idempotency-Key']).toBe(create?.data.operationId);
    expect(create?.data).toMatchObject({ name: '夜班协作组' });

    expect(create?.data).not.toHaveProperty('groupCode');
    expect(definition.handleJoinGroup).toBeUndefined();
    expect(definition.handleSaveGroupCode).toBeUndefined();
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
    clientVersion: 'test',
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    profile: { id: 'user-1', realName: '林恩宇', version: 1 },
    token: 'session-token',
  };
}

function group(overrides = {}) {
  return {
    id: groupId,
    isDeveloperAdmin: true,
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
    ...contactOverrides,
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

function calendarPreferences() {
  return {
    canManageGroupDefaults: true,
    effectiveMonthShiftTypeId: shiftTypeId,
    effectiveView: 'month',
    groupDefaultMonthShiftTypeId: shiftTypeId,
    groupDefaultView: 'month',
    groupId,
    memberDefaultMonthShiftTypeId: null,
    memberDefaultView: null,
    membershipId,
  };
}

function schedulingConfig() {
  return {
    groupMembers: [{ membershipId, realName: '林医生' }],
    roles: [],
    rulesVersion: 1,
    shiftTypes: [
      {
        abbreviation: '全',
        color: '#1F5AA6',
        configurationVersion: 1,
        countsTowardStatistics: true,
        crossesMidnight: false,
        displayOrder: 1,
        id: shiftTypeId,
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
