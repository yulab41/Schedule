import type {
  CalendarPreferences,
  GroupMember,
  GroupMemberContact,
  GroupMobilePhoneConsent,
  GroupSummary,
  MembershipClaimRequest,
  PlatformAdminUserAccountList,
  ScheduleRole,
  SchedulingConfig,
} from '@schedule/contracts';

export type P8OrganizationArea = 'config' | 'group' | 'invite-visitor' | 'members' | 'platform';
export type P8OrganizationRole =
  'administrator' | 'developer' | 'member' | 'owner' | 'platform-admin';
export type P8OrganizationSurface =
  'confirm' | 'conflict' | 'disabled' | 'empty' | 'error' | 'loading' | 'ready' | 'success';

export interface P8OrganizationFixtureOptions {
  readonly area: P8OrganizationArea;
  readonly role: P8OrganizationRole;
  readonly surface: P8OrganizationSurface;
}

export const p8GroupId = '11111111-1111-4111-8111-111111111111';
const currentMembershipId = '22222222-2222-4222-8222-222222222221';
const adminMembershipId = '22222222-2222-4222-8222-222222222222';
const memberMembershipId = '22222222-2222-4222-8222-222222222223';
const pendingMembershipId = '22222222-2222-4222-8222-222222222224';
const shiftTypeId = '33333333-3333-4333-8333-333333333331';
const secondShiftTypeId = '33333333-3333-4333-8333-333333333332';
const scheduleRoleId = '44444444-4444-4444-8444-444444444441';

export function getP8OrganizationGroup(role: P8OrganizationRole): GroupSummary {
  const isDeveloperAdmin = role === 'developer';
  const groupRole =
    role === 'administrator' ? 'administrator' : role === 'member' ? 'member' : 'owner';
  return {
    groupCode: '2608',
    id: p8GroupId,
    ...(isDeveloperAdmin ? { isDeveloperAdmin: true } : {}),
    name: '急诊医学中心一组',
    role: isDeveloperAdmin ? 'member' : groupRole,
    version: 8,
  };
}

export function createP8OrganizationFixtureFetch(
  options: P8OrganizationFixtureOptions,
): typeof globalThis.fetch {
  return async (input, init) => {
    const request = input instanceof Request ? input : undefined;
    const url = new URL(
      request?.url ?? String(input),
      typeof window === 'undefined' ? 'http://storybook.local' : window.location.origin,
    );
    const path = url.pathname.replace(/^\/api/u, '');
    const method = String(init?.method ?? request?.method ?? 'GET').toUpperCase();

    if (options.surface === 'loading' && isPrimaryAreaRead(path, options.area)) {
      return new Promise<Response>(() => undefined);
    }
    if (options.surface === 'error' && isPrimaryAreaRead(path, options.area)) {
      return apiError('SERVICE_UNAVAILABLE', '组织管理资料暂时无法加载，请稍后重试。', 503);
    }

    if (path === '/groups/catalog' && method === 'GET') {
      return json(
        options.surface === 'empty'
          ? []
          : [
              { id: p8GroupId, name: '急诊医学中心一组', relation: 'active-member' },
              {
                id: '11111111-1111-4111-8111-111111111112',
                name: '麻醉恢复室',
                relation: 'none',
              },
            ],
      );
    }
    if (path === '/groups/dissolved' && method === 'GET') {
      return json(
        options.surface === 'empty'
          ? []
          : [
              {
                deletedAt: '2026-08-24T08:00:00.000Z',
                id: '11111111-1111-4111-8111-111111111113',
                name: '旧急诊机动组',
                version: 4,
              },
            ],
      );
    }
    if (path === `/groups/${p8GroupId}/calendar-preferences` && method === 'GET') {
      return json(calendarPreferences(options.role));
    }
    if (path === `/groups/${p8GroupId}/mobile-phone-consent` && method === 'GET') {
      return json(mobilePhoneConsent());
    }
    if (path === `/groups/${p8GroupId}/members` && method === 'GET') {
      return json(options.surface === 'empty' ? [] : groupMembers(options.role));
    }
    if (path === `/groups/${p8GroupId}/contacts` && method === 'GET') {
      return json(options.surface === 'empty' ? [] : groupContacts());
    }
    if (path === `/groups/${p8GroupId}/claim-requests` && method === 'GET') {
      return json(options.surface === 'empty' ? [] : claimRequests());
    }
    if (path === `/groups/${p8GroupId}/scheduling-config` && method === 'GET') {
      return json(schedulingConfig(options.surface === 'empty'));
    }
    if (path === '/platform-admin/users' && method === 'GET') {
      return json(platformAccounts(options.surface === 'empty'));
    }

    if (path === `/groups/${p8GroupId}/name` && method === 'PUT') {
      if (options.surface === 'conflict') return versionConflict('group', p8GroupId, 9);
      return json({
        ...getP8OrganizationGroup(options.role),
        name: '急诊医学中心夜班组',
        version: 9,
      });
    }
    if (path === `/groups/${p8GroupId}/members` && method === 'POST') {
      if (options.surface === 'conflict') return versionConflict('group', p8GroupId, 9);
      return json({ added: 2 });
    }
    if (path === `/groups/${p8GroupId}/schedule-roles` && method === 'POST') {
      if (options.surface === 'conflict') {
        return versionConflict('scheduling_rules', p8GroupId, 5);
      }
      return json(createdScheduleRole());
    }
    if (
      path === `/platform-admin/users/55555555-5555-4555-8555-555555555552/password-identity` &&
      method === 'PUT'
    ) {
      if (options.surface === 'conflict') {
        return json(
          {
            error: {
              code: 'CONFLICT',
              latestData: {
                authVersion: 2,
                id: '55555555-5555-4555-8555-555555555552',
                objectType: 'platform_user',
              },
              message: '账号身份状态已更新，请刷新后重新确认。',
              requestId: 'p8-platform-conflict',
            },
          },
          409,
        );
      }
      return json({ authVersion: 2, passwordConfigured: false, username: 'doctor.chen' });
    }
    if (
      path ===
        '/platform-admin/users/55555555-5555-4555-8555-555555555552/wechat-miniprogram-binding-links' &&
      method === 'POST'
    ) {
      return json({
        authVersion: 1,
        expiresAt: '2026-08-25T14:10:00.000Z',
        urlLink: 'https://wxaurl.cn/masked-story-link',
      });
    }

    return apiError('NOT_FOUND', `P8 Storybook fixture 未覆盖 ${method} ${path}`, 404);
  };
}

function isPrimaryAreaRead(path: string, area: P8OrganizationArea): boolean {
  if (area === 'group') return path === '/groups/catalog';
  if (area === 'members') return path === `/groups/${p8GroupId}/members`;
  if (area === 'config') return path === `/groups/${p8GroupId}/scheduling-config`;
  if (area === 'platform') return path === '/platform-admin/users';
  return false;
}

function groupMembers(role: P8OrganizationRole): readonly GroupMember[] {
  const currentRole =
    role === 'administrator' ? 'administrator' : role === 'member' ? 'member' : 'owner';
  return [
    {
      id: currentMembershipId,
      isCurrentUser: true,
      realName: '林医生',
      role: role === 'developer' ? 'member' : currentRole,
      version: 3,
    },
    {
      id: adminMembershipId,
      isCurrentUser: false,
      realName: '周主任',
      role: 'administrator',
      version: 2,
    },
    {
      id: memberMembershipId,
      isCurrentUser: false,
      realName: '陈医生',
      role: 'member',
      version: 2,
    },
    {
      id: pendingMembershipId,
      isCurrentUser: false,
      isPendingRoster: true,
      isUnclaimed: true,
      realName: '王医生',
      role: 'member',
      version: 1,
    },
  ];
}

function groupContacts(): readonly GroupMemberContact[] {
  return [
    {
      isConfirmed: true,
      membershipId: currentMembershipId,
      mobilePhone: '13800007926',
      shortPhone: '6601',
      updatedAt: '2026-08-25T08:00:00.000Z',
      version: 3,
    },
    {
      isConfirmed: true,
      membershipId: adminMembershipId,
      shortPhone: '6602',
      version: 2,
    },
    {
      isConfirmed: false,
      membershipId: memberMembershipId,
      version: 1,
    },
  ];
}

function claimRequests(): readonly MembershipClaimRequest[] {
  return [
    {
      createdAt: '2026-08-25T08:00:00.000Z',
      groupId: p8GroupId,
      id: '66666666-6666-4666-8666-666666666661',
      requestingUserId: '77777777-7777-4777-8777-777777777771',
      requestingUserRealName: '王医生',
      status: 'pending',
      targetMemberRealName: '王医生',
      targetMembershipId: pendingMembershipId,
      version: 1,
    },
  ];
}

function calendarPreferences(role: P8OrganizationRole): CalendarPreferences {
  return {
    canManageGroupDefaults: role === 'owner' || role === 'developer',
    effectiveMonthShiftTypeId: shiftTypeId,
    effectiveView: 'month',
    groupDefaultMonthShiftTypeId: shiftTypeId,
    groupDefaultView: 'month',
    groupId: p8GroupId,
    memberDefaultMonthShiftTypeId: null,
    memberDefaultView: null,
    membershipId: currentMembershipId,
  };
}

function mobilePhoneConsent(): GroupMobilePhoneConsent {
  return {
    contactVersion: 3,
    groupId: p8GroupId,
    maskedMobilePhone: '138 **** 7926',
    membershipId: currentMembershipId,
    noticeVersion: 'v1',
    state: 'not-consented',
  };
}

function schedulingConfig(empty: boolean): SchedulingConfig {
  if (empty) return { groupMembers: [], roles: [], rulesVersion: 4, shiftTypes: [] };
  return {
    groupMembers: [
      { membershipId: currentMembershipId, realName: '林医生' },
      { membershipId: adminMembershipId, realName: '周主任' },
      { membershipId: memberMembershipId, realName: '陈医生' },
    ],
    roles: [createdScheduleRole()],
    rulesVersion: 4,
    shiftTypes: [
      {
        abbreviation: '全',
        color: '#1F5AA6',
        configurationVersion: 4,
        countsTowardStatistics: true,
        crossesMidnight: true,
        displayOrder: 1,
        endTime: '08:00',
        id: shiftTypeId,
        isAllDay: true,
        isBuiltIn: true,
        isEnabled: true,
        name: '全天班',
        startTime: '08:00',
        textColor: '#FFFFFF',
        version: 2,
      },
      {
        abbreviation: 'NP',
        color: '#0A66D5',
        configurationVersion: 4,
        countsTowardStatistics: true,
        crossesMidnight: true,
        displayOrder: 2,
        endTime: '11:00',
        id: secondShiftTypeId,
        isAllDay: false,
        isBuiltIn: false,
        isEnabled: false,
        name: '夜间听班',
        startTime: '17:30',
        textColor: '#FFFFFF',
        version: 1,
      },
    ],
  };
}

function createdScheduleRole(): ScheduleRole {
  return {
    id: scheduleRoleId,
    members: [
      {
        id: '88888888-8888-4888-8888-888888888881',
        membershipId: currentMembershipId,
        position: 1,
        realName: '林医生',
        version: 2,
      },
      {
        id: '88888888-8888-4888-8888-888888888882',
        membershipId: memberMembershipId,
        position: 2,
        realName: '陈医生',
        version: 1,
      },
    ],
    name: '一线值班',
    rotationRule: {
      currentPosition: 1,
      defaultShiftTypeId: shiftTypeId,
      requiredMembersPerDay: 1,
      startDate: '2026-08-01',
      startingMemberScheduleRoleId: '88888888-8888-4888-8888-888888888881',
      version: 2,
    },
    version: 2,
  };
}

function platformAccounts(empty: boolean): PlatformAdminUserAccountList {
  return {
    users: empty
      ? []
      : [
          {
            authVersion: 4,
            hasPassword: true,
            id: '55555555-5555-4555-8555-555555555551',
            status: 'active',
            username: 'doctor.lin',
          },
          {
            authVersion: 1,
            hasPassword: false,
            id: '55555555-5555-4555-8555-555555555552',
            status: 'active',
          },
          {
            authVersion: 2,
            hasPassword: true,
            id: '55555555-5555-4555-8555-555555555553',
            status: 'suspended',
            username: 'doctor.zhou',
          },
        ],
  };
}

function versionConflict(objectType: string, id: string, version: number): Response {
  return json(
    {
      error: {
        code: 'CONFLICT',
        latestData: { id, objectType, version },
        message: '资料已被其他操作更新，请刷新后重新确认。',
        requestId: 'p8-storybook-conflict',
      },
    },
    409,
  );
}

function apiError(code: string, message: string, status: number): Response {
  return json({ error: { code, message, requestId: 'p8-storybook-error' } }, status);
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { 'content-type': 'application/json' },
    status,
  });
}
