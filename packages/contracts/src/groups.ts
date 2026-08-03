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
  readonly id: string;
  readonly isPendingRoster?: boolean;
  readonly isUnclaimed?: boolean;
  readonly isCurrentUser: boolean;
  readonly realName: string;
  readonly role: GroupRole;
}

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
