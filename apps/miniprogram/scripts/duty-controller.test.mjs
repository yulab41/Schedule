import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { enableTestClientCapabilities } from './test-client-capabilities.mjs';

const groupId = '11111111-1111-4111-8111-111111111111';
const currentMembershipId = '22222222-2222-4222-8222-222222222222';
const overtimeMembershipId = '33333333-3333-4333-8333-333333333333';
const assignmentId = '44444444-4444-4444-8444-444444444444';

describe('P7 native duty-adjustment workflow controller', () => {
  let createResponses;
  let definition;
  let groupRole;
  let hasCurrentMembership;
  let isDeveloperAdmin;
  let requests;

  beforeEach(async () => {
    vi.resetModules();
    vi.setSystemTime(new Date('2026-08-25T04:00:00.000Z'));
    createResponses = [];
    groupRole = 'member';
    hasCurrentMembership = true;
    isDeveloperAdmin = false;
    requests = [];
    vi.stubGlobal('Page', (value) => {
      definition = value;
    });
    vi.stubGlobal('__MINIPROGRAM_API_BASE_URL__', 'https://example.test/api');
    vi.stubGlobal('__MINIPROGRAM_BUILD_COMMIT__', 'test');
    vi.stubGlobal('__MINIPROGRAM_BUILD_PROFILE__', 'production');
    vi.stubGlobal('__MINIPROGRAM_BUILD_VERSION__', 'test');
    vi.stubGlobal('wx', {
      getStorageInfoSync: vi.fn(() => ({ keys: [] })),
      getStorageSync: vi.fn((key) =>
        key === 'schedule.wechat.session' ? validSession() : undefined,
      ),
      getWindowInfo: () => ({ statusBarHeight: 24, windowHeight: 844, windowWidth: 390 }),
      navigateBack: vi.fn(),
      navigateTo: vi.fn(),
      redirectTo: vi.fn(),
      removeStorageSync: vi.fn(),
      request: vi.fn(handleRequest),
      setStorageSync: vi.fn(),
      showModal: vi.fn(({ success }) => success?.({ cancel: false, confirm: true })),
    });
    const controller =
      await import('../src/subpackages/workflows/components/workflow-duty-panel/controller.ts');
    definition = controller.createDutyPanelControllerDefinition(false);
    await enableTestClientCapabilities();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('loads all six Web statuses for a member without admin approval reads', async () => {
    const instance = await loadReadyInstance();

    expect(instance.data).toMatchObject({
      autoAcceptSwaps: false,
      canApprove: false,
      currentGroupName: '急诊一组',
      incomingCount: 1,
      myRequestCount: 7,
      state: 'ready',
    });
    expect(instance.data.myRequests.map((item) => item.statusLabel)).toEqual([
      '待加班成员接受',
      '待加班成员接受',
      '待管理员审批',
      '已生效',
      '已驳回',
      '已取消',
      '已撤销',
    ]);
    expect(requests.some((request) => request.url.endsWith('/duty-adjustments/approvals'))).toBe(
      false,
    );
  });

  it('loads a changed month and reuses one reason-bearing create snapshot after ambiguity', async () => {
    createResponses.push(...Array.from({ length: 6 }, () => new Error('network unknown')));
    const instance = await loadReadyInstance();
    definition.handleOpenRequestForm.call(instance);
    definition.handleMonthChange.call(instance, { detail: { value: '2026-09' } });
    await vi.waitFor(() =>
      expect(requests.some((request) => request.url.includes('businessMonth=2026-09'))).toBe(true),
    );
    definition.handleMonthChange.call(instance, { detail: { value: '2026-08' } });
    await vi.waitFor(() => expect(instance.data.myAssignmentOptions.length).toBeGreaterThan(0));
    definition.handleMyAssignmentChange.call(instance, { detail: { value: '0' } });
    definition.handleOvertimeMemberChange.call(instance, { detail: { value: '0' } });
    definition.handleReasonInput.call(instance, { detail: { value: '门诊与急诊轮转调整' } });
    definition.handlePreview.call(instance);
    await vi.waitFor(() => expect(instance.data.requestPreviewReady).toBe(true));
    expect(instance._requestPreviewInput).toEqual({
      coveredAssignmentId: assignmentId,
      overtimeMembershipId,
    });
    const previewCount = previewRequests().length;

    definition.handleSubmit.call(instance);
    await vi.waitFor(() => expect(instance.data.requestBusy).toBe(false));
    definition.handleSubmit.call(instance);
    await vi.waitFor(() => expect(createRequests()).toHaveLength(6));

    expect(previewRequests()).toHaveLength(previewCount);
    expect(createRequests()[5].data).toEqual(createRequests()[0].data);
    expect(createRequests()[0].data.reason).toBe('门诊与急诊轮转调整');
    expect(createRequests()[0].header['Idempotency-Key']).toBe(
      createRequests()[0].data.operationId,
    );
    expect(instance.data.requestErrorMessage).toContain('本次结果尚未确认，可直接重试');
  });

  it('loads owner state and wires both settings plus direct preview snapshot', async () => {
    groupRole = 'owner';
    const instance = await loadReadyInstance();
    expect(instance.data).toMatchObject({
      archivedDutyCount: 0,
      canApprove: true,
      completedCount: 1,
      handledApprovalCount: 3,
      pendingApprovalCount: 1,
      requiresApproval: true,
    });
    definition.handleGroupApprovalToggle.call(instance, { detail: { checked: false } });
    await vi.waitFor(() => expect(settingsWrites()).toHaveLength(1));
    definition.handleAutoAcceptToggle.call(instance, { detail: { checked: true } });
    await vi.waitFor(() => expect(settingsWrites()).toHaveLength(2));

    definition.handleOpenAdminForm.call(instance);
    definition.handleAdminAssignmentChange.call(instance, { detail: { value: '0' } });
    definition.handleAdminOvertimeMemberChange.call(instance, { detail: { value: '0' } });
    definition.handleAdminReasonInput.call(instance, { detail: { value: '临时门诊支援' } });
    definition.handleAdminPreview.call(instance);
    await vi.waitFor(() => expect(instance.data.adminPreviewReady).toBe(true));
    const previewCount = previewRequests().length;
    definition.handleAdminSubmit.call(instance);
    await vi.waitFor(() => expect(directRequests()).toHaveLength(1));

    expect(previewRequests()).toHaveLength(previewCount);
    expect(directRequests()[0].data.reason).toBe('临时门诊支援');
    expect(directRequests()[0].header['Idempotency-Key']).toBe(
      directRequests()[0].data.operationId,
    );
  });

  it('keeps Web-equivalent direct controls available to a platform admin without membership', async () => {
    groupRole = 'owner';
    hasCurrentMembership = false;
    isDeveloperAdmin = true;
    const instance = await loadReadyInstance();

    expect(instance.data).toMatchObject({
      canApprove: true,
      currentGroupName: '急诊一组',
      myAssignmentOptions: [],
      state: 'ready',
    });
    expect(instance.data.adminAssignmentOptions.length).toBeGreaterThan(0);
  });

  it('fails a duty deep link closed before network access when workflows is disabled', async () => {
    const capability = await import('../src/app/client-capability-store.ts');
    capability.configureRuntimeClientCapabilityReader(
      () =>
        Promise.resolve({
          core: true,
          externalMessages: false,
          global: true,
          guest: true,
          insights: false,
          organization: false,
          platform: 'miniprogram',
          version: 'test',
          workflows: false,
        }),
      'test',
    );
    await capability.refreshClientCapabilities({ force: true });
    requests.length = 0;
    const instance = createPageInstance();
    definition.onLoad.call(instance, { groupId });
    await vi.waitFor(() => expect(instance.data.state).toBe('error'));

    expect(instance.data.errorMessage).toContain('已暂停');
    expect(requests).toHaveLength(0);
  });

  function handleRequest(options) {
    requests.push(options);
    const url = new URL(options.url);
    const path = url.pathname.replace(/^\/api/u, '');
    if (path === '/groups' && options.method === 'GET') {
      respond(options, [
        {
          groupCode: '0796',
          id: groupId,
          ...(isDeveloperAdmin ? { isDeveloperAdmin: true } : {}),
          name: '急诊一组',
          role: groupRole,
          version: 1,
        },
      ]);
      return;
    }
    if (path.endsWith('/members') && options.method === 'GET') {
      respond(options, [
        {
          id: currentMembershipId,
          isCurrentUser: hasCurrentMembership,
          realName: '林医生',
          role: 'member',
          version: 1,
        },
        {
          id: overtimeMembershipId,
          isCurrentUser: false,
          realName: '陈医生',
          role: 'member',
          version: 1,
        },
      ]);
      return;
    }
    if (path.endsWith('/calendar') && options.method === 'GET') {
      respond(options, calendar(url.searchParams.get('businessMonth') ?? '2026-08'));
      return;
    }
    if (path.endsWith('/duty-adjustments/settings')) {
      respond(options, {
        requiresApproval: options.method === 'PUT' ? options.data.requiresApproval : true,
      });
      return;
    }
    if (path.endsWith('/duty-adjustments/my-settings')) {
      respond(options, { autoAcceptSwaps: false });
      return;
    }
    if (path.endsWith('/swaps/my-settings')) {
      respond(options, {
        autoAcceptSwaps: options.method === 'PUT' ? options.data.autoAcceptSwaps : false,
      });
      return;
    }
    if (path.endsWith('/duty-adjustments/approvals') && options.method === 'GET') {
      respond(options, [
        duty('pending_approval', 21, 'incoming'),
        duty('completed', 22, 'incoming'),
        duty('rejected', 23, 'incoming'),
        duty('cancelled', 24, 'incoming'),
        duty('revoked', 25, 'incoming'),
      ]);
      return;
    }
    if (path.endsWith('/duty-adjustments/preview') && options.method === 'POST') {
      respond(options, preview());
      return;
    }
    if (path.endsWith('/duty-adjustments/direct') && options.method === 'POST') {
      respond(options, duty('completed', 40, 'mine'), 201);
      return;
    }
    if (path.endsWith('/duty-adjustments') && options.method === 'GET') {
      respond(options, [
        duty('pending_target', 1, 'mine'),
        duty('pending_target', 2, 'incoming'),
        duty('pending_approval', 3, 'mine'),
        duty('completed', 4, 'mine'),
        duty('rejected', 5, 'mine'),
        duty('cancelled', 6, 'mine'),
        duty('revoked', 7, 'mine'),
      ]);
      return;
    }
    if (path.endsWith('/duty-adjustments') && options.method === 'POST') {
      const response = createResponses.shift();
      if (response instanceof Error) options.fail(response);
      else respond(options, duty('pending_target', 30, 'mine'), 201);
      return;
    }
    if (/\/duty-adjustments\/[^/]+\/(accept|approve|cancel|reject)$/u.test(path)) {
      respond(options, duty('completed', 50, 'mine'));
      return;
    }
    if (/\/duty-adjustments\/[^/]+\/revoke$/u.test(path)) {
      respond(options, duty('revoked', 51, 'mine'));
      return;
    }
    throw new Error(`unexpected request ${options.method} ${path}`);
  }

  function createRequests() {
    return requests.filter(
      (request) => request.method === 'POST' && request.url.endsWith('/duty-adjustments'),
    );
  }

  function directRequests() {
    return requests.filter((request) => request.url.endsWith('/duty-adjustments/direct'));
  }

  function previewRequests() {
    return requests.filter((request) => request.url.endsWith('/duty-adjustments/preview'));
  }

  function settingsWrites() {
    return requests.filter(
      (request) =>
        request.method === 'PUT' &&
        (request.url.endsWith('/duty-adjustments/settings') ||
          request.url.endsWith('/swaps/my-settings')),
    );
  }

  async function loadReadyInstance() {
    const instance = createPageInstance();
    definition.onLoad.call(instance, { groupId });
    await vi.waitFor(() => expect(instance.data.state).toBe('ready'));
    return instance;
  }

  function createPageInstance() {
    const data = structuredClone(definition.data);
    return {
      ...definition,
      _adminPreview: undefined,
      _calendar: undefined,
      _calendarSerial: 0,
      _currentGroupId: '',
      _hasShown: false,
      _loadSerial: 0,
      _myMembershipId: '',
      _operationAttempts: new Map(),
      _rawApprovals: [],
      _rawMyRequests: [],
      _requestPreview: undefined,
      _requestedGroupId: '',
      _revokeTarget: undefined,
      data,
      setData(patch, callback) {
        Object.assign(data, patch);
        callback?.();
      },
    };
  }
});

function respond(options, data, statusCode = 200) {
  options.success({ data, statusCode });
}

function calendar(businessMonth) {
  return {
    assignments:
      businessMonth === '2026-08'
        ? [assignment(assignmentId, currentMembershipId, '林医生', '2026-08-26')]
        : [
            assignment(
              '44444444-4444-4444-8444-444444444445',
              currentMembershipId,
              '林医生',
              '2026-09-03',
            ),
          ],
    businessMonth,
    groupId,
    members: [
      { isConfirmed: true, membershipId: currentMembershipId, realName: '林医生' },
      { isConfirmed: true, membershipId: overtimeMembershipId, realName: '陈医生' },
    ],
    roles: [{ id: 'role-1', name: '一线值班' }],
    shiftTypes: [
      {
        abbreviation: '全',
        color: '#1F5AA6',
        crossesMidnight: false,
        id: 'shift-1',
        isAllDay: true,
        name: '全天班',
        textColor: '#FFFFFF',
      },
    ],
  };
}

function assignment(id, membershipId, memberName, businessDate) {
  return {
    actualMemberName: memberName,
    actualMembershipId: membershipId,
    businessDate,
    changeMarkers: [],
    endsAt: `${businessDate}T16:00:00.000Z`,
    id,
    plannedMemberName: memberName,
    plannedMembershipId: membershipId,
    schedulePeriodId: 'period-1',
    scheduleRoleId: 'role-1',
    scheduleRoleName: '一线值班',
    shiftTypeAbbreviation: '全',
    shiftTypeColor: '#1F5AA6',
    shiftTypeId: 'shift-1',
    shiftTypeName: '全天班',
    shiftTypeTextColor: '#FFFFFF',
    slotPosition: 1,
    startsAt: `${businessDate}T00:00:00.000Z`,
  };
}

function summary(value) {
  return {
    actualMemberId: value.actualMembershipId,
    actualMemberName: value.actualMemberName,
    assignmentId: value.id,
    businessDate: value.businessDate,
    endsAt: value.endsAt,
    plannedMemberId: value.plannedMembershipId,
    plannedMemberName: value.plannedMemberName,
    scheduleRoleId: value.scheduleRoleId,
    scheduleRoleName: value.scheduleRoleName,
    shiftTypeAbbreviation: value.shiftTypeAbbreviation,
    shiftTypeColor: value.shiftTypeColor,
    shiftTypeId: value.shiftTypeId,
    shiftTypeName: value.shiftTypeName,
    shiftTypeTextColor: value.shiftTypeTextColor,
    slotPosition: value.slotPosition,
    startsAt: value.startsAt,
    version: 1,
  };
}

function duty(status, index, direction) {
  const incoming = direction === 'incoming';
  const covered = assignment(assignmentId, currentMembershipId, '林医生', '2026-08-26');
  return {
    assignmentVersion: 1,
    coveredAssignment: summary(covered),
    coveredAssignmentId: covered.id,
    createdAt: '2026-08-24T00:00:00.000Z',
    deductedMemberName: '林医生',
    deductedMembershipId: currentMembershipId,
    groupId,
    id: `99999999-9999-4999-8999-${String(index).padStart(12, '0')}`,
    ...(status === 'completed' ? { isRevocable: true } : {}),
    overtimeMemberName: '陈医生',
    overtimeMembershipId: incoming ? currentMembershipId : overtimeMembershipId,
    reason: '门诊与急诊轮转调整',
    ...(status === 'revoked' ? { revocationReason: '临时调岗' } : {}),
    status,
    version: 1,
  };
}

function preview() {
  const covered = assignment(assignmentId, currentMembershipId, '林医生', '2026-08-26');
  return {
    conflicts: [],
    coveredAssignment: summary(covered),
    deductedMemberName: '林医生',
    groupId,
    nextStatus: 'pending_approval',
    overtimeAutoAccepts: true,
    overtimeMemberName: '陈医生',
    requiresApproval: true,
  };
}

function validSession() {
  return {
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    profile: { id: 'user-1', realName: '林医生', version: 1 },
    token: 'test-token',
  };
}
