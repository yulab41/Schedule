import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

let createProfilePanelControllerDefinition;

beforeAll(async () => {
  vi.stubGlobal('__MINIPROGRAM_API_BASE_URL__', 'https://example.test/api');
  vi.stubGlobal('__MINIPROGRAM_BUILD_COMMIT__', 'test');
  vi.stubGlobal('__MINIPROGRAM_BUILD_PROFILE__', 'production');
  vi.stubGlobal('__MINIPROGRAM_BUILD_VERSION__', 'test');
  vi.stubGlobal('wx', {
    getWindowInfo: vi.fn(() => ({ fontSizeSetting: 16 })),
  });
  ({ createProfilePanelControllerDefinition } =
    await import('../src/components/profile-panel/controller.ts'));
});

afterAll(() => {
  vi.unstubAllGlobals();
});

describe('Mini Web-parity profile controller', () => {
  it('builds the same statistics, trend, next duty, contacts, binding, and avatar view model', async () => {
    const dependencies = createDependencies();
    const definition = createProfilePanelControllerDefinition(true, dependencies);
    const panel = createPanel(definition);

    definition.onLoad.call(panel);
    definition.handleGroupChange.call(panel, group('group-1', '头颈外科医生'));

    await vi.waitFor(() => expect(panel.data.overviewState).toBe('ready'));
    expect(panel.data).toMatchObject({
      avatarPath: 'wxfile://usr/avatar.jpg',
      bindingLabel: '已绑定',
      canUnbindWechat: true,
      groupName: '头颈外科医生',
      mobilePhone: '13412348339',
      monthCountLabel: '8',
      monthDeltaLabel: '较上月 +2 次',
      nextDutyDateLabel: '8月22日 周六',
      nextDutyRoleLabel: '头颈外科 · 头颈外科医生',
      nextDutyShiftLabel: '日班',
      overviewYearLabel: '2026 年个人值班',
      roleLabel: '成员',
      shortPhone: '68339',
      showDutyOverview: true,
      specialDateCountLabel: '3',
      yearCountLabel: '24',
    });
    expect(panel.data.trend).toEqual([
      expect.objectContaining({ count: 4, current: false, label: '5月' }),
      expect.objectContaining({ count: 6, current: false, label: '6月' }),
      expect.objectContaining({ count: 6, current: false, label: '7月' }),
      expect.objectContaining({ count: 8, current: true, label: '8月' }),
    ]);
    expect(dependencies.listGroupMembers).toHaveBeenCalledOnce();
    expect(dependencies.getCalendar).toHaveBeenCalledTimes(2);
  });

  it('retains partial calendar/contact success and shows a statistics-only error', async () => {
    const dependencies = createDependencies({
      getMonthStatistics: vi.fn().mockRejectedValue(new Error('month unavailable')),
      getYearStatistics: vi.fn().mockRejectedValue(new Error('year unavailable')),
    });
    const definition = createProfilePanelControllerDefinition(true, dependencies);
    const panel = createPanel(definition);

    definition.onLoad.call(panel);
    definition.handleGroupChange.call(panel, group('group-1', '头颈外科医生'));

    await vi.waitFor(() => expect(panel.data.overviewState).toBe('ready'));
    expect(panel.data.overviewError).toBe('个人统计暂时无法加载，请稍后重试。');
    expect(panel.data.mobilePhone).toBe('13412348339');
    expect(panel.data.nextDutyShiftLabel).toBe('日班');
  });

  it('keeps available statistics when contacts and both calendars fail', async () => {
    const dependencies = createDependencies({
      getCalendar: vi.fn().mockRejectedValue(new Error('calendar unavailable')),
      listGroupContacts: vi.fn().mockRejectedValue(new Error('contacts unavailable')),
    });
    const definition = createProfilePanelControllerDefinition(true, dependencies);
    const panel = createPanel(definition);

    definition.onLoad.call(panel);
    definition.handleGroupChange.call(panel, group('group-1', '头颈外科医生'));

    await vi.waitFor(() => expect(panel.data.overviewState).toBe('ready'));
    expect(panel.data.monthCountLabel).toBe('8');
    expect(panel.data.yearCountLabel).toBe('24');
    expect(panel.data.mobilePhone).toBe('');
    expect(panel.data.nextDutyEmpty).toBe(true);
    expect(panel.data.overviewError).toBe('');
  });

  it('turns a member failure into an explicit retry state', async () => {
    const dependencies = createDependencies({
      listGroupMembers: vi
        .fn()
        .mockRejectedValueOnce(new Error('members unavailable'))
        .mockResolvedValue([member('member-current', true)]),
    });
    const definition = createProfilePanelControllerDefinition(true, dependencies);
    const panel = createPanel(definition);

    definition.onLoad.call(panel);
    definition.handleGroupChange.call(panel, group('group-1', '头颈外科医生'));
    await vi.waitFor(() => expect(panel.data.overviewState).toBe('error'));
    expect(panel.data.overviewError).toBe('个人值班数据暂时无法加载，请稍后重试。');

    definition.handleOverviewRetry.call(panel);
    await vi.waitFor(() => expect(panel.data.overviewState).toBe('ready'));
    expect(dependencies.listGroupMembers).toHaveBeenCalledTimes(2);
  });

  it('isolates stale group requests and preserves the newest group', async () => {
    let resolveFirst;
    const firstMembers = new Promise((resolve) => {
      resolveFirst = resolve;
    });
    const dependencies = createDependencies({
      listGroupMembers: vi.fn((groupId) =>
        groupId === 'group-old' ? firstMembers : Promise.resolve([member('member-current', true)]),
      ),
    });
    const definition = createProfilePanelControllerDefinition(true, dependencies);
    const panel = createPanel(definition);
    definition.onLoad.call(panel);

    definition.handleGroupChange.call(panel, group('group-old', '旧群组'));
    definition.handleGroupChange.call(panel, group('group-new', '新群组'));
    await vi.waitFor(() => expect(panel.data.overviewState).toBe('ready'));
    resolveFirst([member('member-current', true)]);
    await Promise.resolve();
    await Promise.resolve();

    expect(panel.data.groupId).toBe('group-new');
    expect(panel.data.groupName).toBe('新群组');
  });

  it('hides all duty requests for visitors and keeps an account-only no-group state', async () => {
    const dependencies = createDependencies();
    const definition = createProfilePanelControllerDefinition(true, dependencies);
    const panel = createPanel(definition);
    definition.onLoad.call(panel);

    definition.handleGroupChange.call(panel, group('guest-group', '访客群组', 'guest'));
    await vi.waitFor(() => expect(panel.data.bindingState).toBe('ready'));
    expect(panel.data.showDutyOverview).toBe(false);
    expect(dependencies.listGroupMembers).not.toHaveBeenCalled();

    definition.handleGroupChange.call(panel, undefined);
    expect(panel.data).toMatchObject({
      groupId: '',
      groupName: '未加入排班群组',
      roleLabel: '未加入群组',
      showDutyOverview: false,
    });
  });

  it('routes statistics/calendar, changes passwords safely, and restores the initial avatar', async () => {
    const dependencies = createDependencies();
    const definition = createProfilePanelControllerDefinition(true, dependencies);
    const panel = createPanel(definition);
    definition.onLoad.call(panel);
    definition.handleGroupChange.call(panel, group('group-1', '头颈外科医生'));
    await vi.waitFor(() => expect(panel.data.overviewState).toBe('ready'));

    definition.handleOpenStatistics.call(panel);
    definition.handleOpenCalendar.call(panel);
    expect(panel.triggerEvent).toHaveBeenNthCalledWith(1, 'openstatistics');
    expect(panel.triggerEvent).toHaveBeenNthCalledWith(2, 'opencalendar');

    definition.handlePasswordOpen.call(panel);
    definition.handleCurrentPasswordInput.call(panel, { detail: { value: 'old-password' } });
    definition.handleNewPasswordInput.call(panel, { detail: { value: 'new-password' } });
    definition.handlePasswordConfirmInput.call(panel, { detail: { value: 'new-password' } });
    definition.handlePasswordSubmit.call(panel);
    await vi.waitFor(() => expect(dependencies.finishSensitiveSessionChange).toHaveBeenCalled());
    expect(dependencies.changePassword).toHaveBeenCalledWith({
      authMethod: 'password',
      currentPassword: 'old-password',
      newPassword: 'new-password',
    });

    definition.handleAvatarRestore.call(panel);
    await vi.waitFor(() => expect(dependencies.removeAvatar).toHaveBeenCalledWith('user-1'));
    expect(panel.data.avatarPath).toBe('');
  });

  it('submits a WeChat proof password change without a current-password field', async () => {
    const dependencies = createDependencies({ getAuthMethod: vi.fn(() => 'wechat') });
    const definition = createProfilePanelControllerDefinition(true, dependencies);
    const panel = createPanel(definition);
    definition.onLoad.call(panel);
    definition.handlePasswordOpen.call(panel);
    definition.handleNewPasswordInput.call(panel, { detail: { value: 'new-password' } });
    definition.handlePasswordConfirmInput.call(panel, { detail: { value: 'new-password' } });

    definition.handlePasswordSubmit.call(panel);

    await vi.waitFor(() => expect(dependencies.finishSensitiveSessionChange).toHaveBeenCalled());
    expect(dependencies.changePassword).toHaveBeenCalledWith({
      authMethod: 'wechat',
      newPassword: 'new-password',
    });
  });
});

function createPanel(definition) {
  return {
    data: structuredClone(definition.data),
    overviewRequestSerial: 0,
    setData(patch) {
      this.data = { ...this.data, ...patch };
    },
    triggerEvent: vi.fn(),
  };
}

function createDependencies(overrides = {}) {
  const dependencies = {
    changePassword: vi.fn().mockResolvedValue({ passwordChanged: true }),
    confirmAvatarRemoval: vi.fn().mockResolvedValue(true),
    finishSensitiveSessionChange: vi.fn(),
    getAuthMethod: vi.fn(() => 'password'),
    getBusinessDate: vi.fn(() => '2026-08-20'),
    getBusinessMonth: vi.fn(() => '2026-08'),
    getCalendar: vi.fn(async (_groupId, month) => calendar(month, [assignment()])),
    getMonthStatistics: vi.fn(async () => monthStatistics(memberRow(8, 2, 1))),
    getProfile: vi.fn(() => ({
      avatarVersion: 3,
      id: 'user-1',
      realName: '徐漫彬',
      version: 1,
    })),
    getWechatBinding: vi.fn().mockResolvedValue({ bound: true, canUnbind: true }),
    getYearStatistics: vi.fn(async () =>
      yearStatistics([
        ['2026-05', 4],
        ['2026-06', 6],
        ['2026-07', 6],
        ['2026-08', 8],
      ]),
    ),
    listGroupContacts: vi.fn(async () => [
      {
        membershipId: 'member-current',
        mobilePhone: '13412348339',
        shortPhone: '68339',
      },
    ]),
    listGroupMembers: vi.fn(async () => [member('member-current', true)]),
    listGroups: vi.fn(async () => [group('group-1', '头颈外科医生')]),
    navigateTo: vi.fn(),
    now: vi.fn(() => '2026-08-20T00:00:00.000Z'),
    removeAvatar: vi.fn().mockResolvedValue({ removed: true }),
    resolveAvatar: vi.fn().mockResolvedValue('wxfile://usr/avatar.jpg'),
    signOut: vi.fn(),
  };
  return { ...dependencies, ...overrides };
}

function group(id, name, role = 'member') {
  return { id, isDeveloperAdmin: false, name, role };
}

function member(id, isCurrentUser) {
  return { id, isCurrentUser };
}

function memberRow(actualCount, weekendCount = 0, holidayCount = 0) {
  return { actualCount, holidayCount, membershipId: 'member-current', weekendCount };
}

function summary(rows) {
  return { members: rows };
}

function monthStatistics(row) {
  return { summary: summary([row]) };
}

function yearStatistics(months) {
  const rows = months.map(([businessMonth, count]) => ({
    businessMonth,
    summary: summary([memberRow(count)]),
  }));
  return {
    months: rows,
    summary: summary([memberRow(months.reduce((total, [, count]) => total + count, 0))]),
  };
}

function assignment() {
  return {
    businessDate: '2026-08-22',
    endsAt: '2026-08-22T09:30:00.000Z',
    id: 'next-duty',
    plannedMembershipId: 'member-current',
    scheduleRoleName: '头颈外科',
    shiftTypeName: '日班',
    startsAt: '2026-08-22T00:00:00.000Z',
  };
}

function calendar(businessMonth, assignments) {
  return { assignments, businessMonth };
}
