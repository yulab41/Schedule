import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { enableTestClientCapabilities } from './test-client-capabilities.mjs';

const groupId = '11111111-1111-4111-8111-111111111111';
const membershipId = '22222222-2222-4222-8222-222222222222';
const shiftTypeId = '33333333-3333-4333-8333-333333333333';
let role = 'member';

describe('Mini group settings member permissions and calendar preferences', () => {
  let definition;
  let preferenceFailure;
  let preferenceSaveFailure;
  let requests;

  beforeEach(async () => {
    vi.resetModules();
    preferenceFailure = false;
    preferenceSaveFailure = false;
    requests = [];
    role = 'member';
    vi.stubGlobal('__MINIPROGRAM_API_BASE_URL__', 'https://example.test/api');
    vi.stubGlobal('__MINIPROGRAM_BUILD_COMMIT__', 'test');
    vi.stubGlobal('__MINIPROGRAM_BUILD_PROFILE__', 'production');
    vi.stubGlobal('__MINIPROGRAM_BUILD_VERSION__', 'test');
    vi.stubGlobal('wx', {
      getStorageSync: vi.fn((key) => (key === 'schedule.wechat.session' ? session() : groupId)),
      getWindowInfo: () => ({ statusBarHeight: 24, windowHeight: 844, windowWidth: 390 }),
      navigateBack: vi.fn(),
      request: vi.fn(handleRequest),
      showModal: vi.fn(),
    });
    const module =
      await import('../src/subpackages/organization/components/group-settings-panel/controller.ts');
    definition = module.createGroupSettingsPanelControllerDefinition(false);
    await enableTestClientCapabilities();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('keeps member group data read-only while preserving leave and personal preferences', async () => {
    const page = await loadReadyPage();
    await vi.waitFor(() => expect(page.data.calendarPreferencesState).toBe('ready'));

    expect(page.data).toMatchObject({
      canLeaveGroup: true,
      canManageGroup: false,
      canManageGroupCalendarDefaults: false,
      canManageGroupLifecycle: false,
      canManageMembers: false,
      memberCalendarView: 'follow',
    });
    expect(requests.some((request) => request.url.endsWith('/groups/catalog'))).toBe(false);
    expect(requests.some((request) => request.url.endsWith('/claim-requests'))).toBe(false);

    definition.handleCreateGroupNameInput.call(page, { detail: { value: '越权群组' } });
    definition.handleCreateGroupCodeInput.call(page, { detail: { value: '7310' } });
    definition.handleCreateGroup.call(page);
    definition.handleJoinGroup.call(page);
    definition.handleOpenContactEditor.call(page, tap({ memberId: membershipId }));
    await Promise.resolve();

    expect(requests.filter((request) => request.method === 'POST')).toHaveLength(0);
    expect(page.data.contactEditorOpen).toBe(false);

    definition.handleMemberCalendarViewSelect.call(page, tap({ view: 'week' }));
    definition.handleMemberCalendarShiftChange.call(page, { detail: { value: 1 } });
    definition.handleSaveMemberCalendarPreferences.call(page);
    await vi.waitFor(() => expect(page.data.calendarPreferencesInfo).toContain('个人日历偏好'));

    const update = requests.find((request) =>
      request.url.endsWith(`/groups/${groupId}/calendar-preferences/mine`),
    );
    expect(update?.data).toEqual({
      defaultMonthShiftTypeId: shiftTypeId,
      defaultView: 'week',
    });

    definition.handleMemberCalendarViewSelect.call(page, tap({ view: 'follow' }));
    definition.handleMemberCalendarShiftChange.call(page, { detail: { value: 0 } });
    definition.handleSaveMemberCalendarPreferences.call(page);
    await vi.waitFor(() => expect(page.data.calendarPreferencesInfo).toContain('个人日历偏好'));

    const updates = requests.filter((request) =>
      request.url.endsWith(`/groups/${groupId}/calendar-preferences/mine`),
    );
    expect(updates.at(-1)?.data).toEqual({
      defaultMonthShiftTypeId: null,
      defaultView: null,
    });
  });

  it('lets owners update group defaults and preserves nullable follow semantics', async () => {
    role = 'owner';
    const page = await loadReadyPage();
    await vi.waitFor(() => expect(page.data.calendarPreferencesState).toBe('ready'));

    expect(page.data).toMatchObject({
      canManageGroupCalendarDefaults: true,
      canManageGroupLifecycle: true,
    });
    expect(requests.some((request) => request.url.endsWith('/groups/catalog'))).toBe(true);

    definition.handleGroupCalendarViewSelect.call(page, tap({ view: 'list' }));
    definition.handleGroupCalendarShiftChange.call(page, { detail: { value: 0 } });
    definition.handleSaveGroupCalendarDefaults.call(page);
    await vi.waitFor(() => expect(page.data.calendarPreferencesInfo).toContain('群组日历默认'));

    const update = requests.find((request) =>
      request.url.endsWith(`/groups/${groupId}/calendar-settings`),
    );
    expect(update?.data).toEqual({ defaultMonthShiftTypeId: null, defaultView: 'list' });
  });

  it('isolates calendar preference read failures from the ready group and consent state', async () => {
    preferenceFailure = true;
    const page = await loadReadyPage();
    await vi.waitFor(() => expect(page.data.calendarPreferencesState).toBe('error'));

    expect(page.data.state).toBe('ready');
    expect(page.data.memberCards).toHaveLength(1);
    expect(page.data.calendarPreferencesError).not.toBe('');
    expect(page.data.maskedMobilePhone).toBe('138 **** 7926');
  });

  it('preserves the personal preference draft after a failed save and supports retry', async () => {
    const page = await loadReadyPage();
    await vi.waitFor(() => expect(page.data.calendarPreferencesState).toBe('ready'));
    preferenceSaveFailure = true;

    definition.handleMemberCalendarViewSelect.call(page, tap({ view: 'week' }));
    definition.handleMemberCalendarShiftChange.call(page, { detail: { value: 1 } });
    definition.handleSaveMemberCalendarPreferences.call(page);
    await vi.waitFor(() => expect(page.data.calendarPreferencesError).not.toBe(''));

    expect(page.data).toMatchObject({
      isSavingMemberCalendarPreferences: false,
      memberCalendarShiftIndex: 1,
      memberCalendarView: 'week',
    });

    preferenceSaveFailure = false;
    definition.handleSaveMemberCalendarPreferences.call(page);
    await vi.waitFor(() => expect(page.data.calendarPreferencesInfo).toContain('个人日历偏好'));
    expect(page.data.calendarPreferencesError).toBe('');
  });

  function handleRequest(options) {
    requests.push(options);
    const { method, url } = options;
    if (url.endsWith('/groups') && method === 'GET') {
      options.success({ data: [group()], statusCode: 200 });
      return;
    }
    if (url.endsWith('/groups') && method === 'POST') {
      options.success({ data: group({ name: options.data.name }), statusCode: 201 });
      return;
    }
    if (url.endsWith('/groups/catalog') && method === 'GET') {
      options.success({
        data: [{ id: groupId, name: '当前群组', relation: 'active-member' }],
        statusCode: 200,
      });
      return;
    }
    if (url.endsWith('/groups/dissolved') && method === 'GET') {
      options.success({ data: [], statusCode: 200 });
      return;
    }
    if (url.endsWith(`/groups/${groupId}/mobile-phone-consent`) && method === 'GET') {
      options.success({ data: consent(), statusCode: 200 });
      return;
    }
    if (url.endsWith(`/groups/${groupId}/members`) && method === 'GET') {
      options.success({ data: [member()], statusCode: 200 });
      return;
    }
    if (url.endsWith(`/groups/${groupId}/contacts`) && method === 'GET') {
      options.success({ data: [contact()], statusCode: 200 });
      return;
    }
    if (url.endsWith(`/groups/${groupId}/claim-requests`) && method === 'GET') {
      options.success({ data: [], statusCode: 200 });
      return;
    }
    if (url.endsWith(`/groups/${groupId}/scheduling-config`) && method === 'GET') {
      options.success({ data: schedulingConfig(), statusCode: 200 });
      return;
    }
    if (url.endsWith(`/groups/${groupId}/calendar-preferences`) && method === 'GET') {
      if (preferenceFailure) {
        options.success({
          data: { error: { code: 'INTERNAL_ERROR', message: '日历偏好读取失败' } },
          statusCode: 500,
        });
      } else {
        options.success({ data: preferences(), statusCode: 200 });
      }
      return;
    }
    if (url.endsWith(`/groups/${groupId}/calendar-preferences/mine`) && method === 'PUT') {
      if (preferenceSaveFailure) {
        options.success({
          data: { error: { code: 'INTERNAL_ERROR', message: '个人日历偏好保存失败' } },
          statusCode: 500,
        });
        return;
      }
      options.success({
        data: preferences({
          effectiveMonthShiftTypeId: options.data.defaultMonthShiftTypeId,
          effectiveView: options.data.defaultView ?? 'month',
          memberDefaultMonthShiftTypeId: options.data.defaultMonthShiftTypeId,
          memberDefaultView: options.data.defaultView,
        }),
        statusCode: 200,
      });
      return;
    }
    if (url.endsWith(`/groups/${groupId}/calendar-settings`) && method === 'PUT') {
      options.success({
        data: preferences({
          canManageGroupDefaults: true,
          effectiveMonthShiftTypeId: options.data.defaultMonthShiftTypeId,
          effectiveView: options.data.defaultView,
          groupDefaultMonthShiftTypeId: options.data.defaultMonthShiftTypeId,
          groupDefaultView: options.data.defaultView,
        }),
        statusCode: 200,
      });
      return;
    }
    if (url.endsWith('/groups/claim') && method === 'POST') {
      options.success({ data: { group: group(), status: 'claimed' }, statusCode: 200 });
      return;
    }
    throw new Error(`unexpected request ${method} ${url}`);
  }

  async function loadReadyPage() {
    const page = createPageInstance(definition);
    definition.onLoad.call(page, { groupId });
    await vi.waitFor(() => expect(page.data.state).toBe('ready'));
    return page;
  }
});

function createPageInstance(controller) {
  const data = structuredClone(controller.data);
  const page = {
    data,
    setData(patch, callback) {
      Object.assign(data, patch);
      callback?.();
    },
  };
  for (const [key, value] of Object.entries(controller)) {
    if (key.startsWith('_')) page[key] = value;
  }
  return page;
}

function tap(dataset) {
  return { currentTarget: { dataset } };
}

function group(overrides = {}) {
  return { groupCode: '2608', id: groupId, name: '头颈外科医生', role, version: 1, ...overrides };
}

function member() {
  return { id: membershipId, isCurrentUser: true, realName: '林医生', role, version: 3 };
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

function preferences(overrides = {}) {
  return {
    canManageGroupDefaults: role === 'owner' || role === 'administrator',
    effectiveMonthShiftTypeId: shiftTypeId,
    effectiveView: 'month',
    groupDefaultMonthShiftTypeId: shiftTypeId,
    groupDefaultView: 'month',
    groupId,
    memberDefaultMonthShiftTypeId: null,
    memberDefaultView: null,
    membershipId,
    ...overrides,
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

function session() {
  return {
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    profile: { id: 'user-1', realName: '林恩宇', version: 1 },
    token: 'session-token',
  };
}
