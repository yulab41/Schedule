import type { GroupMember, MembershipClaimRequestStatus } from '@schedule/contracts';

export type MemberStatusTone = 'danger' | 'neutral' | 'success' | 'warning';

type MemberClaimState = Pick<
  GroupMember,
  'claimRequestStatus' | 'isClaimedByCurrentUser' | 'isPendingRoster' | 'isUnclaimed'
>;

export function getMemberClaimTone(member: MemberClaimState): MemberStatusTone {
  if (
    member.isPendingRoster === true ||
    member.isUnclaimed === true ||
    member.claimRequestStatus === 'pending'
  ) {
    return 'warning';
  }

  return 'success';
}

export function getClaimRequestTone(status: MembershipClaimRequestStatus): MemberStatusTone {
  switch (status) {
    case 'pending':
      return 'warning';
    case 'approved':
      return 'success';
    case 'rejected':
      return 'danger';
    case 'cancelled':
      return 'neutral';
  }
}
