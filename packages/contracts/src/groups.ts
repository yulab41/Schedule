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
