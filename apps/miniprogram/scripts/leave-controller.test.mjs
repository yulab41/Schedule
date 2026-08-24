import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { enableTestClientCapabilities } from './test-client-capabilities.mjs';

const groupId = '11111111-1111-4111-8111-111111111111';
const memberId = '22222222-2222-4222-8222-222222222222';
const requestId = '33333333-3333-4333-8333-333333333333';

describe('P7 native leave workflow controller', () => {
  let createResponses;
  let controllerModule;
  let definition;
  let groupRole;
  let requests;

  beforeEach(async () => {
    vi.resetModules();
    createResponses = [];
    groupRole = 'member';
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
      request: vi.fn(handleRequest),
      setStorageSync: vi.fn(),
      showModal: vi.fn(({ success }) => success({ confirm: true })),
    });
    controllerModule =
      await import('../src/subpackages/workflows/components/workflow-leave-panel/controller.ts');
    definition = controllerModule.createLeavePanelControllerDefinition(false);
    await enableTestClientCapabilities();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('loads the selected member group and maps all Web leave statuses without admin reads', async () => {
    const instance = await loadReadyInstance();

    expect(instance.data).toMatchObject({
      canApprove: false,
      currentGroupName: '急诊一组',
      currentGroupRole: '成员',
      myCount: 3,
      pendingApprovalCount: 0,
      state: 'ready',
    });
    expect(instance.data.myRequests.map((item) => item.statusLabel)).toEqual([
      '待审批',
      '已批准',
      '已驳回',
    ]);
    expect(requests.some((request) => request.url.endsWith('/approvals'))).toBe(false);
  });

  it('keeps date trigger labels aligned with Web weekday formatting', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      vi.setSystemTime(new Date('2026-08-23T18:00:00.000Z'));
      vi.resetModules();
      controllerModule =
        await import('../src/subpackages/workflows/components/workflow-leave-panel/controller.ts');
      definition = controllerModule.createLeavePanelControllerDefinition(false);
      await enableTestClientCapabilities();
      const instance = await loadReadyInstance();

      definition.handleStartDateChange.call(instance, { detail: { value: '2026-08-24' } });

      expect(instance.data.startDateDisplay).toBe('2026-08-24 周一');
      expect(instance.data.endDateDisplay).toMatch(/^\d{4}-\d{2}-\d{2} 周[一二三四五六日]$/u);
    } finally {
      vi.useRealTimers();
    }
  });

  it('renders affected shifts with the same neutral list and uncovered guidance as Web', async () => {
    const instance = await loadReadyInstance();

    definition.handleOpenForm.call(instance);
    await vi.waitFor(() => expect(instance.data.affectedShiftsLoading).toBe(false));

    expect(instance.data.affectedShiftMessage).toBe('');
    expect(instance.data.affectedShifts).toEqual([
      {
        detail: '2026-08-26 全天班',
        id: '44444444-4444-4444-8444-444444444444',
        statusLabel: '未安排',
        tone: 'warning',
      },
    ]);
    expect(instance.data.affectedWarningMessage).toBe(
      '可先到“换班”或“加扣班”安排替班；未安排也可以提交申请。',
    );
  });

  it('blocks a start date before today before requesting affected shifts', async () => {
    const instance = await loadReadyInstance();
    const originalDate = instance.data.startDate;

    definition.handleStartDateChange.call(instance, { detail: { value: '2000-01-01' } });

    expect(instance.data.startDate).toBe(originalDate);
    expect(instance.data.formErrorMessage).toBe('开始日期最早只能是当天。');
  });

  it('uses the China Standard Time natural date before the 08:00 duty handover', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-23T18:00:00.000Z'));

    expect(controllerModule.getTodayCalendarDate()).toBe('2026-08-24');

    vi.useRealTimers();
  });

  it('refreshes and clamps the leave date range when the form opens after midnight', async () => {
    const instance = await loadReadyInstance();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-25T02:00:00.000Z'));

    definition.handleOpenForm.call(instance);

    expect(instance.data).toMatchObject({
      endDate: '2026-08-25',
      endDateMin: '2026-08-25',
      startDate: '2026-08-25',
      todayDate: '2026-08-25',
    });
    vi.useRealTimers();
  });

  it('loads the owner review tab and complete conflict preview before approval', async () => {
    groupRole = 'owner';
    const instance = await loadReadyInstance();

    definition.handleTabChange.call(instance, { currentTarget: { dataset: { tab: 'review' } } });
    definition.handleOpenApproval.call(instance, {
      currentTarget: { dataset: { id: requestId } },
    });
    await vi.waitFor(() => expect(instance.data.approvalPreviewReady).toBe(true));

    expect(instance.data).toMatchObject({
      activeTab: 'review',
      approvalVisible: true,
      canApprove: true,
      pendingApprovalCount: 1,
    });
    expect(instance.data.approvalAlerts.map((item) => item.tone)).toEqual([
      'danger',
      'danger',
      'warning',
      'warning',
    ]);
    const displayedPreviewRequestCount = previewRequests().length;

    definition.handleApprove.call(instance);
    expect(approveRequests()).toHaveLength(0);
    expect(instance.data.approvalErrorMessage).toContain('知晓冲突和空缺');

    definition.handleApprovalAcknowledge.call(instance, { detail: { checked: true } });
    definition.handleApprove.call(instance);
    await vi.waitFor(() => expect(approveRequests()).toHaveLength(1));
    expect(previewRequests()).toHaveLength(displayedPreviewRequestCount);
    expect(approveRequests()[0].header['Idempotency-Key']).toBe(
      approveRequests()[0].data.operationId,
    );
  });

  it('reuses one frozen create operation after an ambiguous network result', async () => {
    createResponses.push(...Array.from({ length: 6 }, () => new Error('network unknown')));
    const instance = await loadReadyInstance();
    definition.handleOpenForm.call(instance);
    definition.handleReasonInput.call(instance, { detail: { value: '门诊进修' } });

    definition.handleSubmitLeave.call(instance);
    await vi.waitFor(() => expect(instance.data.formBusy).toBe(false));
    definition.handleSubmitLeave.call(instance);
    await vi.waitFor(() => expect(createRequests()).toHaveLength(6));

    const first = createRequests()[0];
    const last = createRequests()[5];
    expect(last.data).toEqual(first.data);
    expect(last.header['Idempotency-Key']).toBe(first.header['Idempotency-Key']);
    expect(first.header['Idempotency-Key']).toBe(first.data.operationId);
    expect(instance.data.formErrorMessage).toContain('本次结果尚未确认，可直接重试');
  });

  it('changes the create operation id after the form payload changes', async () => {
    createResponses.push(...Array.from({ length: 6 }, () => new Error('network unknown')));
    const instance = await loadReadyInstance();
    definition.handleOpenForm.call(instance);

    definition.handleSubmitLeave.call(instance);
    await vi.waitFor(() => expect(instance.data.formBusy).toBe(false));
    const firstKey = createRequests()[0].header['Idempotency-Key'];
    definition.handleReasonInput.call(instance, { detail: { value: '新的请假原因' } });
    definition.handleSubmitLeave.call(instance);
    await vi.waitFor(() => expect(createRequests()).toHaveLength(6));

    expect(createRequests()[3].header['Idempotency-Key']).not.toBe(firstKey);
  });

  it('fails a deep link closed when workflows capability is disabled', async () => {
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
        { groupCode: '0796', id: groupId, name: '急诊一组', role: groupRole, version: 1 },
      ]);
      return;
    }
    if (path.endsWith('/leave-reflow-strategy')) {
      respond(options, { strategy: 'keep-original-order' });
      return;
    }
    if (path.endsWith('/leave-requests/affected-shifts')) {
      respond(options, [
        {
          assignmentId: '44444444-4444-4444-8444-444444444444',
          businessDate: '2026-08-26',
          isCovered: false,
          shiftTypeAbbreviation: '全',
          shiftTypeName: '全天班',
        },
      ]);
      return;
    }
    if (path.endsWith('/leave-requests/approvals')) {
      respond(options, [leave('pending', requestId, '陈医生')]);
      return;
    }
    if (/\/leave-requests\/[^/]+\/preview$/u.test(path)) {
      respond(options, preview());
      return;
    }
    if (/\/leave-requests\/[^/]+\/approve$/u.test(path)) {
      respond(options, {
        leaveRequest: leave('approved', requestId, '陈医生'),
        operationId: options.data.operationId,
        preview: preview(),
        status: 'approved',
        strategy: 'keep-original-order',
      });
      return;
    }
    if (path.endsWith('/leave-requests') && options.method === 'GET') {
      respond(options, [
        leave('pending', '55555555-5555-4555-8555-555555555551', '林医生'),
        leave('approved', '55555555-5555-4555-8555-555555555552', '林医生'),
        leave('rejected', '55555555-5555-4555-8555-555555555553', '林医生'),
      ]);
      return;
    }
    if (path.endsWith('/leave-requests') && options.method === 'POST') {
      const response = createResponses.shift();
      if (response instanceof Error) options.fail(response);
      else respond(options, leave('pending', requestId, '林医生'), 201);
      return;
    }
    throw new Error(`unexpected request ${options.method} ${path}`);
  }

  function createRequests() {
    return requests.filter(
      (request) => request.method === 'POST' && request.url.endsWith('/leave-requests'),
    );
  }

  function approveRequests() {
    return requests.filter((request) => request.url.endsWith('/approve'));
  }

  function previewRequests() {
    return requests.filter((request) => request.url.endsWith('/preview'));
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
      _approvalTarget: undefined,
      _currentGroupId: '',
      _hasShown: false,
      _loadSerial: 0,
      _operationAttempts: new Map(),
      _requestedGroupId: '',
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

function leave(status, id, memberName) {
  return {
    createdAt: '2026-08-24T00:00:00.000Z',
    endsAt: '2026-08-26T16:00:00.000Z',
    groupId,
    id,
    isAllDay: true,
    ...(status === 'approved' ? { isRevocable: true } : {}),
    leaveType: status === 'rejected' ? 'training' : 'sick',
    memberName,
    membershipId: memberId,
    reason: '门诊进修',
    reflowStrategy: 'keep-original-order',
    startsAt: '2026-08-24T16:00:00.000Z',
    status,
    version: 1,
  };
}

function preview() {
  return {
    affectedAssignments: [
      {
        assignmentId: '44444444-4444-4444-8444-444444444444',
        businessDate: '2026-08-26',
        endsAt: '2026-08-27T00:00:00.000Z',
        nextMemberName: '王医生',
        previousMemberName: '陈医生',
        shiftTypeAbbreviation: '全',
        shiftTypeColor: '#1F5AA6',
        shiftTypeId: '66666666-6666-4666-8666-666666666666',
        shiftTypeName: '全天班',
        shiftTypeTextColor: '#FFFFFF',
        slotPosition: 1,
        startsAt: '2026-08-26T00:00:00.000Z',
      },
    ],
    affectedShiftCount: 1,
    affectedShifts: [
      {
        businessDate: '2026-08-26',
        memberName: '陈医生',
        shiftTypeAbbreviation: '全',
        shiftTypeName: '全天班',
      },
    ],
    conflicts: [
      {
        assignmentBusinessKeys: ['2026-08-26:role:1'],
        code: 'MEMBER_TIME_OVERLAP',
        memberName: '王医生',
        membershipId: memberId,
      },
    ],
    continuousDutyWarnings: [
      {
        assignmentBusinessKeys: ['a', 'b'],
        code: 'CONTINUOUS_DUTY_24_HOURS',
        endsAt: '2026-08-28T00:00:00.000Z',
        memberName: '王医生',
        membershipId: memberId,
        startsAt: '2026-08-26T00:00:00.000Z',
      },
    ],
    groupDefaultStrategy: 'keep-original-order',
    leaveRequestId: requestId,
    leaveRequestVersion: 1,
    overlapsUnpublishedPeriod: true,
    periodVersions: { '77777777-7777-4777-8777-777777777777': 2 },
    rulesVersion: 3,
    statisticsDelta: {
      byMember: [
        {
          assignmentDelta: 1,
          countedDelta: 1,
          membershipId: memberId,
          realName: '王医生',
          weekendDelta: 0,
        },
      ],
      totalAssignmentDelta: 0,
      totalCountedDelta: 0,
      totalWeekendDelta: 0,
    },
    strategy: 'keep-original-order',
    vacancies: [
      {
        assignmentBusinessKey: '2026-08-27:role:1',
        businessDate: '2026-08-27',
        code: 'NO_ELIGIBLE_MEMBER',
        scheduleRoleId: '88888888-8888-4888-8888-888888888888',
        slotPosition: 1,
      },
    ],
    workflowBlockers: [
      {
        assignmentId: '44444444-4444-4444-8444-444444444444',
        message: '该班次已有待审批换班。',
      },
    ],
  };
}

function validSession() {
  return {
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    profile: { id: 'user-1', realName: '林医生', version: 1 },
    token: 'test-token',
  };
}
