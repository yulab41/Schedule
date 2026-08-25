import type {
  DissolvedGroup,
  GroupCatalogEntry,
  GroupMember,
  GroupMemberContact,
  GroupSummary,
  MembershipClaimLookupResponse,
  MembershipClaimRequest,
  PlatformAdminUserAccountList,
  ResolveInviteResponse,
  SchedulingConfig,
} from '@schedule/contracts';

export const organizationReadApiGoldenResponse = {
  groupQr: { imageBase64: 'iVBORw0KGgo=' } as const,
  claimLookup: {
    matches: [
      {
        isUnclaimed: true,
        membershipId: 'membership-2',
        realName: '陈医生',
        role: 'member',
      },
    ],
  } as const satisfies MembershipClaimLookupResponse,
  claimRequests: [
    {
      createdAt: '2026-08-25T08:00:00.000Z',
      groupId: 'group-1',
      id: 'claim-1',
      requestingUserId: 'user-2',
      requestingUserRealName: '陈医生',
      status: 'pending',
      targetMemberRealName: '陈医生',
      targetMembershipId: 'membership-2',
      version: 1,
    },
  ] as const satisfies readonly MembershipClaimRequest[],
  contacts: [
    {
      isConfirmed: true,
      membershipId: 'membership-1',
      mobilePhone: '13800000000',
      shortPhone: '6601',
      updatedAt: '2026-08-25T08:00:00.000Z',
      version: 2,
    },
  ] as const satisfies readonly GroupMemberContact[],
  dissolvedGroups: [
    {
      deletedAt: '2026-08-20T08:00:00.000Z',
      id: 'group-old',
      name: '历史群组',
      version: 4,
    },
  ] as const satisfies readonly DissolvedGroup[],
  groupCatalog: [
    { id: 'group-1', name: '急诊科', relation: 'active-member' },
    { id: 'group-2', name: '麻醉科', relation: 'none' },
  ] as const satisfies readonly GroupCatalogEntry[],
  groups: [
    {
      groupCode: '2608',
      id: 'group-1',
      isDeveloperAdmin: true,
      name: '急诊科',
      role: 'owner',
      version: 3,
    },
  ] as const satisfies readonly GroupSummary[],
  invite: {
    groupId: 'group-1',
    groupName: '急诊科',
    inviteeRealName: '陈医生',
    permissionRole: 'member',
    scheduleRoleName: '一线',
    version: 1,
  } as const satisfies ResolveInviteResponse,
  members: [
    {
      id: 'membership-1',
      isCurrentUser: true,
      realName: '林医生',
      role: 'owner',
      version: 3,
    },
    {
      id: 'roster-1',
      isCurrentUser: false,
      isPendingRoster: true,
      isUnclaimed: true,
      realName: '陈医生',
      role: 'member',
      version: 1,
    },
  ] as const satisfies readonly GroupMember[],
  platformAccounts: {
    users: [
      {
        authVersion: 4,
        hasPassword: true,
        id: 'user-1',
        status: 'active',
        username: 'doctor.lin',
      },
      {
        authVersion: 1,
        hasPassword: false,
        id: 'user-2',
        status: 'suspended',
      },
    ],
  } as const satisfies PlatformAdminUserAccountList,
  schedulingConfig: {
    groupMembers: [
      { membershipId: 'membership-1', realName: '林医生' },
      { membershipId: 'membership-2', realName: '陈医生' },
    ],
    roles: [
      {
        id: 'role-1',
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
      },
    ],
    rulesVersion: 4,
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
  } as const satisfies SchedulingConfig,
} as const;
