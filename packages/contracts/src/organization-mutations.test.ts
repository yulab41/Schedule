import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

describe('P8 organization mutation contracts', () => {
  it('requires operation ids on every group, roster, membership, contact, and claim request', () => {
    const source = readFileSync(new URL('./groups.ts', import.meta.url), 'utf8');
    for (const typeName of [
      'CreateGroupRequest',
      'AddRosterEntriesRequest',
      'AddGroupMembersRequest',
      'ConvertPendingRosterRequest',
      'ClaimGroupRequest',
      'OrganizationOperationRequest',
      'GroupVersionMutationRequest',
      'GroupMemberVersionMutationRequest',
      'MembershipClaimDecisionRequest',
      'UpdateGroupCodeRequest',
      'UpdateGroupNameRequest',
      'UpdateGroupMemberRoleRequest',
      'UpdateGroupMemberNameRequest',
      'UpdateGroupMemberContactRequest',
      'TransferGroupOwnershipRequest',
      'CreateMembershipClaimRequest',
    ]) {
      expect(source).toMatch(
        new RegExp(
          `export interface ${typeName}[\\s\\S]*?readonly operationId: string;[\\s\\S]*?\\n\\}`,
          'u',
        ),
      );
    }
  });

  it('exposes versions for every mutable group, member, roster, contact, and claim object', () => {
    const source = readFileSync(new URL('./groups.ts', import.meta.url), 'utf8');
    expect(source).toMatch(/groupMemberSchema[\s\S]*?version: z\.number\(\)\.int\(\)\.min\(1\)/u);
    expect(source).toMatch(
      /dissolvedGroupSchema[\s\S]*?version: z\.number\(\)\.int\(\)\.min\(1\)/u,
    );
    for (const typeName of [
      'GroupVersionMutationRequest',
      'GroupMemberVersionMutationRequest',
      'MembershipClaimDecisionRequest',
      'UpdateGroupCodeRequest',
      'UpdateGroupNameRequest',
      'UpdateGroupMemberRoleRequest',
      'UpdateGroupMemberNameRequest',
      'UpdateGroupMemberContactRequest',
    ]) {
      expect(source).toMatch(
        new RegExp(
          `export interface ${typeName}[\\s\\S]*?readonly expectedVersion: number;[\\s\\S]*?\\n\\}`,
          'u',
        ),
      );
    }
    expect(source).toMatch(
      /export interface TransferGroupOwnershipRequest[\s\S]*?expectedGroupVersion[\s\S]*?expectedMemberVersion/u,
    );
    expect(source).toMatch(
      /export interface CreateMembershipClaimRequest[\s\S]*?expectedMemberVersion/u,
    );
  });
});
