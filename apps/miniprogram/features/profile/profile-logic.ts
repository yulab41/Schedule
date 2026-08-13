import type { GroupMember, GroupMemberContact, GroupSummary } from '@schedule/contracts';

export type OwnContactState = 'available' | 'missing' | 'not-applicable' | 'unavailable';

export interface OwnGroupContactSummary {
  readonly contact?: GroupMemberContact;
  readonly groupId: string;
  readonly groupName: string;
  readonly membershipId?: string;
  readonly role: GroupSummary['role'];
  readonly state: OwnContactState;
}

export interface ProfileLogicDependencies {
  readonly listGroupContacts: (groupId: string) => Promise<GroupMemberContact[]>;
  readonly listGroupMembers: (groupId: string) => Promise<GroupMember[]>;
}

export type ProfileSurfaceMode = 'full' | 'guest-minimal';

export function getProfileSurfaceMode(
  activeGroupRole: GroupSummary['role'] | undefined,
): ProfileSurfaceMode {
  return activeGroupRole === 'guest' ? 'guest-minimal' : 'full';
}

export function getOwnContactTarget(
  summary: OwnGroupContactSummary,
): { readonly groupId: string; readonly membershipId: string } | undefined {
  if (
    (summary.state !== 'available' && summary.state !== 'missing') ||
    summary.membershipId === undefined
  )
    return undefined;
  return { groupId: summary.groupId, membershipId: summary.membershipId };
}

export async function loadOwnGroupContacts(
  groups: readonly GroupSummary[],
  dependencies: ProfileLogicDependencies,
): Promise<readonly OwnGroupContactSummary[]> {
  return Promise.all(
    groups.map(async (group) => {
      const base = { groupId: group.id, groupName: group.name, role: group.role } as const;
      if (group.role === 'guest') return { ...base, state: 'not-applicable' as const };
      const [members, contacts] = await Promise.all([
        dependencies.listGroupMembers(group.id),
        dependencies.listGroupContacts(group.id),
      ]);
      const currentMember = members.find((member) => member.isCurrentUser);
      if (currentMember === undefined) return { ...base, state: 'unavailable' as const };
      const contact = contacts.find(({ membershipId }) => membershipId === currentMember.id);
      return contact === undefined
        ? { ...base, membershipId: currentMember.id, state: 'missing' as const }
        : { ...base, contact, membershipId: currentMember.id, state: 'available' as const };
    }),
  );
}
