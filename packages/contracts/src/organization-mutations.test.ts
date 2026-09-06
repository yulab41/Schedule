import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

describe('P8 organization mutation contracts', () => {
  it('requires operation ids on every group, roster, membership and contact request', () => {
    const source = readFileSync(new URL('./groups.ts', import.meta.url), 'utf8');
    for (const typeName of [
      'CreateGroupRequest',
      'AddRosterEntriesRequest',
      'AddGroupMembersRequest',
      'ConvertPendingRosterRequest',
      'OrganizationOperationRequest',
      'GroupVersionMutationRequest',
      'GroupMemberVersionMutationRequest',
      'UpdateGroupNameRequest',
      'UpdateGroupMemberRoleRequest',
      'UpdateGroupMemberNameRequest',
      'UpdateGroupMemberContactRequest',
      'TransferGroupOwnershipRequest',
    ]) {
      expect(source).toMatch(
        new RegExp(
          `export interface ${typeName}[\\s\\S]*?readonly operationId: string;[\\s\\S]*?\\n\\}`,
          'u',
        ),
      );
    }
  });

  it('exposes versions for every mutable group, member, roster and contact object', () => {
    const source = readFileSync(new URL('./groups.ts', import.meta.url), 'utf8');
    expect(source).toMatch(/groupMemberSchema[\s\S]*?version: z\.number\(\)\.int\(\)\.min\(1\)/u);
    expect(source).toMatch(
      /dissolvedGroupSchema[\s\S]*?version: z\.number\(\)\.int\(\)\.min\(1\)/u,
    );
    for (const typeName of [
      'GroupVersionMutationRequest',
      'GroupMemberVersionMutationRequest',
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
  });
});
