import type { GroupMember, GroupRole } from '@schedule/contracts';

export type WorkflowActorRelation =
  'applicant' | 'deducted' | 'initiator' | 'overtime' | 'target' | 'unrelated';
export type WorkflowDomain = 'duty' | 'leave' | 'swap';
export type WorkflowStatus =
  | 'approved'
  | 'cancelled'
  | 'completed'
  | 'pending'
  | 'pending_approval'
  | 'pending_target'
  | 'rejected'
  | 'revoked';

export interface WorkflowActionInput {
  readonly actorRelation: WorkflowActorRelation;
  readonly domain: WorkflowDomain;
  readonly groupRole: GroupRole;
  readonly isRevocable?: boolean;
  readonly status: WorkflowStatus;
}

export interface WorkflowActions {
  readonly accept: boolean;
  readonly approve: boolean;
  readonly autoArchived: boolean;
  readonly cancel: boolean;
  readonly reject: boolean;
  readonly revoke: boolean;
}

const noActions: WorkflowActions = {
  accept: false,
  approve: false,
  autoArchived: false,
  cancel: false,
  reject: false,
  revoke: false,
};

function isAdministrator(role: GroupRole): boolean {
  return role === 'administrator' || role === 'owner';
}

function isTargetRelation(relation: WorkflowActorRelation): boolean {
  return relation === 'target' || relation === 'overtime';
}

export function resolveCurrentMembershipId(members: readonly GroupMember[]): string {
  const current = members.filter(({ isCurrentUser }) => isCurrentUser);
  if (current.length !== 1) throw new Error('当前成员身份无法确定。');
  return current[0]!.id;
}

export function resolveWorkflowActions(input: WorkflowActionInput): WorkflowActions {
  if (input.groupRole === 'guest') return noActions;
  const administrator = isAdministrator(input.groupRole);
  const autoArchived =
    (input.domain === 'swap' || input.domain === 'duty') &&
    input.status === 'completed' &&
    input.isRevocable === false;
  if (autoArchived) return { ...noActions, autoArchived: true };

  if (input.domain === 'leave') {
    return {
      ...noActions,
      approve: administrator && input.status === 'pending',
      cancel: input.actorRelation === 'applicant' && input.status === 'pending',
      reject: administrator && input.status === 'pending',
      revoke:
        input.status === 'approved' &&
        input.isRevocable !== false &&
        (administrator || input.actorRelation === 'applicant'),
    };
  }

  const initiatorCanCancel =
    input.actorRelation === 'initiator' ||
    (input.domain === 'duty' && input.actorRelation === 'deducted');
  const participantCanRevoke =
    input.domain === 'swap'
      ? input.actorRelation === 'initiator' || input.actorRelation === 'target'
      : input.actorRelation === 'deducted' || isTargetRelation(input.actorRelation);
  return {
    ...noActions,
    accept: input.status === 'pending_target' && isTargetRelation(input.actorRelation),
    approve: administrator && input.status === 'pending_approval',
    cancel:
      initiatorCanCancel &&
      (input.status === 'pending_target' || input.status === 'pending_approval'),
    reject:
      (input.status === 'pending_target' && isTargetRelation(input.actorRelation)) ||
      (input.status === 'pending_approval' && administrator),
    revoke:
      input.status === 'completed' &&
      input.isRevocable !== false &&
      (administrator || participantCanRevoke),
  };
}
