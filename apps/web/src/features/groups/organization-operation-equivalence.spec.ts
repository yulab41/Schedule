import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

describe('P8 Web organization mutation attempt equivalence', () => {
  it('delegates every organization mutation through the shared write client', () => {
    const client = readFileSync(new URL('../../api/client.ts', import.meta.url), 'utf8');
    expect(client).toContain('createOrganizationWriteClient');
    expect(client).toContain(
      'const organizationWriteClient = createOrganizationWriteClient(sharedClientTransport)',
    );
    for (const method of [
      'createGroup',
      'claimGroup',
      'joinGroupAsGuest',
      'leaveGroup',
      'addRosterEntries',
      'convertRosterEntries',
      'addGroupMembers',
      'updateGroupCode',
      'updateGroupName',
      'updateGroupMemberRole',
      'updateGroupMemberName',
      'updateGroupMemberContact',
      'deleteGroupMember',
      'transferGroupOwnership',
      'createMembershipClaimRequest',
      'approveMembershipClaimRequest',
      'rejectMembershipClaimRequest',
      'revokeMembershipClaim',
      'deleteGroup',
      'restoreGroup',
    ]) {
      expect(client).toContain(`return organizationWriteClient.${method}(`);
    }
  });

  it('freezes retries in every production organization write surface', () => {
    for (const relativePath of [
      './GroupSetupPanel.vue',
      '../members/MemberManager.vue',
      '../profile/GroupContactForm.vue',
    ]) {
      const source = readFileSync(new URL(relativePath, import.meta.url), 'utf8');
      expect(source).toContain('resolveWorkflowOperationAttempt');
      expect(source).toContain('operationAttempts');
      expect(source).toContain('crypto.randomUUID');
    }
  });
});
