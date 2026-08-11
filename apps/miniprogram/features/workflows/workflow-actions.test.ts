import type { GroupMember } from '@schedule/contracts';
import { describe, expect, it } from 'vitest';

import { resolveCurrentMembershipId, resolveWorkflowActions } from './workflow-actions.js';

describe('workflow action matrix', () => {
  it.each([
    {
      expected: { accept: true, reject: true },
      input: {
        actorRelation: 'target' as const,
        domain: 'swap' as const,
        groupRole: 'member' as const,
        status: 'pending_target' as const,
      },
      label: 'member swap target accepts or rejects pending target',
    },
    {
      expected: { cancel: true },
      input: {
        actorRelation: 'initiator' as const,
        domain: 'swap' as const,
        groupRole: 'member' as const,
        status: 'pending_approval' as const,
      },
      label: 'member swap initiator cancels pending approval',
    },
    {
      expected: { accept: true, reject: true },
      input: {
        actorRelation: 'overtime' as const,
        domain: 'duty' as const,
        groupRole: 'member' as const,
        status: 'pending_target' as const,
      },
      label: 'member overtime participant accepts or rejects',
    },
    {
      expected: { cancel: true },
      input: {
        actorRelation: 'deducted' as const,
        domain: 'duty' as const,
        groupRole: 'member' as const,
        status: 'pending_target' as const,
      },
      label: 'member deducted participant cancels',
    },
    {
      expected: { cancel: true },
      input: {
        actorRelation: 'applicant' as const,
        domain: 'leave' as const,
        groupRole: 'member' as const,
        status: 'pending' as const,
      },
      label: 'member leave applicant cancels pending request',
    },
    {
      expected: { approve: true, reject: true },
      input: {
        actorRelation: 'unrelated' as const,
        domain: 'leave' as const,
        groupRole: 'administrator' as const,
        status: 'pending' as const,
      },
      label: 'administrator decides pending leave',
    },
    {
      expected: { approve: true, reject: true },
      input: {
        actorRelation: 'unrelated' as const,
        domain: 'duty' as const,
        groupRole: 'owner' as const,
        status: 'pending_approval' as const,
      },
      label: 'owner decides pending duty request',
    },
  ])('$label', ({ input, expected }) => {
    expect(resolveWorkflowActions(input)).toMatchObject(expected);
  });

  it('keeps guest and a non-participating member out of every workflow action', () => {
    expect(
      resolveWorkflowActions({
        actorRelation: 'unrelated',
        domain: 'swap',
        groupRole: 'guest',
        isRevocable: true,
        status: 'completed',
      }),
    ).toEqual({
      accept: false,
      approve: false,
      autoArchived: false,
      cancel: false,
      reject: false,
      revoke: false,
    });
    expect(
      resolveWorkflowActions({
        actorRelation: 'unrelated',
        domain: 'duty',
        groupRole: 'member',
        status: 'pending_target',
      }).accept,
    ).toBe(false);
  });

  it('maps ordinary target, initiator, and administrator actions to server statuses', () => {
    expect(
      resolveWorkflowActions({
        actorRelation: 'target',
        domain: 'swap',
        groupRole: 'member',
        status: 'pending_target',
      }),
    ).toMatchObject({ accept: true, reject: true });
    expect(
      resolveWorkflowActions({
        actorRelation: 'initiator',
        domain: 'swap',
        groupRole: 'member',
        status: 'pending_approval',
      }),
    ).toMatchObject({ cancel: true });
    expect(
      resolveWorkflowActions({
        actorRelation: 'unrelated',
        domain: 'duty',
        groupRole: 'administrator',
        status: 'pending_approval',
      }),
    ).toMatchObject({ approve: true, reject: true });
    expect(
      resolveWorkflowActions({
        actorRelation: 'applicant',
        domain: 'leave',
        groupRole: 'member',
        status: 'pending',
      }),
    ).toMatchObject({ cancel: true });
  });

  it('treats only completed swap/duty records with isRevocable false as auto-archived', () => {
    expect(
      resolveWorkflowActions({
        actorRelation: 'initiator',
        domain: 'swap',
        groupRole: 'member',
        isRevocable: false,
        status: 'completed',
      }),
    ).toMatchObject({ autoArchived: true, revoke: false });
    expect(
      resolveWorkflowActions({
        actorRelation: 'deducted',
        domain: 'duty',
        groupRole: 'member',
        isRevocable: true,
        status: 'completed',
      }),
    ).toMatchObject({ autoArchived: false, revoke: true });
    expect(
      resolveWorkflowActions({
        actorRelation: 'target',
        domain: 'swap',
        groupRole: 'member',
        status: 'completed',
      }),
    ).toMatchObject({ autoArchived: false, revoke: true });
  });

  it('resolves the current membership only from the unique isCurrentUser record', () => {
    const members: readonly GroupMember[] = [
      { id: 'member-1', isCurrentUser: false, realName: '张医生', role: 'member' },
      { id: 'member-2', isCurrentUser: true, realName: '李医生', role: 'member' },
    ];
    expect(resolveCurrentMembershipId(members)).toBe('member-2');
    expect(() =>
      resolveCurrentMembershipId(members.filter(({ id }) => id !== 'member-2')),
    ).toThrow();
    expect(() =>
      resolveCurrentMembershipId([...members, { ...members[1]!, id: 'member-3' }]),
    ).toThrow();
  });
});
