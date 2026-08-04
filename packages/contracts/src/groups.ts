export type GroupRole = 'administrator' | 'member' | 'owner';

export interface GroupSummary {
  readonly groupCode: string;
  readonly id: string;
  readonly name: string;
  readonly role: GroupRole;
  readonly version: number;
}

export interface CreateGroupRequest {
  readonly groupCode?: string;
  readonly name: string;
}

export interface AddRosterEntriesRequest {
  readonly realNames: readonly string[];
}

export interface AddRosterEntriesResponse {
  readonly added: number;
}

export interface AddGroupMembersRequest {
  readonly realNames: readonly string[];
}

export interface AddGroupMembersResponse {
  readonly added: number;
}

export interface ConvertPendingRosterRequest {
  readonly realNames: readonly string[];
}

export interface ConvertPendingRosterResponse {
  readonly converted: number;
  readonly skipped: number;
}

export interface ClaimGroupRequest {
  readonly groupCode: string;
  readonly realName?: string;
}

export type ClaimGroupResponse =
  | {
      readonly group: GroupSummary;
      readonly status: 'claimed';
    }
  | {
      readonly status: 'request_created';
    };

export interface RegenerateGroupCodeRequest {
  readonly groupCode?: string;
}

export interface GroupMember {
  readonly claimRequestStatus?: 'pending' | 'rejected';
  readonly claimedByName?: string;
  readonly id: string;
  readonly isClaimedByCurrentUser?: boolean;
  readonly isPendingRoster?: boolean;
  readonly isUnclaimed?: boolean;
  readonly isCurrentUser: boolean;
  readonly realName: string;
  readonly role: GroupRole;
}

export type MembershipClaimRequestStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export interface MembershipClaimLookupRequest {
  readonly realName: string;
}

export interface MembershipClaimLookupEntry {
  readonly isUnclaimed: boolean;
  readonly membershipId: string;
  readonly realName: string;
  readonly role: GroupRole;
}

export interface MembershipClaimLookupResponse {
  readonly matches: readonly MembershipClaimLookupEntry[];
}

export interface CreateMembershipClaimRequest {
  readonly membershipId: string;
}

export interface MembershipClaimRequest {
  readonly createdAt: string;
  readonly decidedAt?: string;
  readonly decidedByRealName?: string;
  readonly decidedByUserId?: string;
  readonly groupId: string;
  readonly id: string;
  readonly requestingUserRealName: string;
  readonly requestingUserId: string;
  readonly status: MembershipClaimRequestStatus;
  readonly targetMemberRealName: string;
  readonly targetMembershipId: string;
  readonly version: number;
}

export type CreateMembershipClaimResponse =
  | {
      readonly direct: true;
    }
  | {
      readonly direct: false;
      readonly request: MembershipClaimRequest;
    };

export interface GroupMemberContact {
  readonly isConfirmed: boolean;
  readonly membershipId: string;
  readonly mobilePhone?: string;
  readonly shortPhone?: string;
  readonly updatedAt?: string;
  readonly version: number;
}

export interface UpdateGroupMemberRoleRequest {
  readonly role: Extract<GroupRole, 'administrator' | 'member'>;
}

export interface TransferGroupOwnershipRequest {
  readonly membershipId: string;
}

export interface UpdateGroupMemberContactRequest {
  readonly confirm?: true;
  readonly mobilePhone?: string | null;
  readonly shortPhone?: string | null;
}
