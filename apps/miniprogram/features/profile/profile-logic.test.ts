import type { GroupMember, GroupMemberContact, GroupSummary } from '@schedule/contracts';
import { describe, expect, it, vi } from 'vitest';

import { loadOwnGroupContacts } from './profile-logic.js';

const groups: readonly GroupSummary[] = [
  { id: 'owner', name: '业主组', role: 'owner', version: 1 },
  { id: 'member', name: '成员组', role: 'member', version: 1 },
  { id: 'guest', name: '访客组', role: 'guest', version: 1 },
];
const members: readonly GroupMember[] = [
  { id: 'me', isCurrentUser: true, realName: '同名', role: 'owner' },
];
const contacts: readonly GroupMemberContact[] = [
  { isConfirmed: true, membershipId: 'other', version: 1 },
  { isConfirmed: true, membershipId: 'me', shortPhone: '1234', version: 1 },
];

describe('profile contact logic', () => {
  it('loads non-guest contacts by membership ID, never by name', async () => {
    const dependencies = {
      listGroupContacts: vi.fn(() => Promise.resolve([...contacts])),
      listGroupMembers: vi.fn(() => Promise.resolve([...members])),
    };
    const summaries = await loadOwnGroupContacts(groups, dependencies);
    expect(dependencies.listGroupMembers).toHaveBeenCalledTimes(2);
    expect(dependencies.listGroupContacts).toHaveBeenCalledTimes(2);
    expect(summaries.map(({ state }) => state)).toEqual([
      'available',
      'available',
      'not-applicable',
    ]);
    expect(summaries[0]).toMatchObject({ membershipId: 'me', contact: { membershipId: 'me' } });
  });

  it('distinguishes a missing current member from a missing contact', async () => {
    const unavailable = await loadOwnGroupContacts([groups[0]], {
      listGroupContacts: vi.fn(() => Promise.resolve([])),
      listGroupMembers: vi.fn(() => Promise.resolve([])),
    });
    const missing = await loadOwnGroupContacts([groups[0]], {
      listGroupContacts: vi.fn(() => Promise.resolve([])),
      listGroupMembers: vi.fn(() => Promise.resolve([...members])),
    });
    expect(unavailable[0]?.state).toBe('unavailable');
    expect(missing[0]).toMatchObject({ membershipId: 'me', state: 'missing' });
  });
});
