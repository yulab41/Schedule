export type GroupMobilePhoneConsentState =
  'consented' | 'missing-phone' | 'not-consented' | 'stale';

export interface GroupMobilePhoneConsentStatusLike {
  readonly consentedAt?: string | undefined;
  readonly contactVersion: number;
  readonly groupId: string;
  readonly maskedMobilePhone?: string | undefined;
  readonly membershipId: string;
  readonly noticeVersion: string;
  readonly state: GroupMobilePhoneConsentState;
}

export interface GroupMobilePhoneConsentIntent {
  readonly consented: boolean;
  readonly expectedContactVersion: number;
  readonly noticeVersion: string;
}

export interface GroupMobilePhoneConsentSnapshot extends GroupMobilePhoneConsentIntent {
  readonly operationId: string;
}

export interface GroupMobilePhoneConsentAttempt {
  readonly fingerprint: string;
  readonly snapshot: GroupMobilePhoneConsentSnapshot;
}

export interface GroupMobilePhoneConsentDraft {
  readonly attempt?: GroupMobilePhoneConsentAttempt | undefined;
  readonly desiredConsent: boolean;
}

export interface GroupMobilePhoneConsentViewModel {
  readonly actionLabel: '已同意' | '保存同意' | '撤回同意';
  readonly canSave: boolean;
  readonly desiredConsent: boolean;
  readonly hasPhone: boolean;
  readonly maskedMobilePhone: string;
  readonly requiresRenewal: boolean;
  readonly savedConsent: boolean;
}

export interface GroupMobilePhoneConsentSubmission {
  readonly draft: GroupMobilePhoneConsentDraft;
  readonly snapshot: GroupMobilePhoneConsentSnapshot;
}

export function createGroupMobilePhoneConsentDraft(
  status: GroupMobilePhoneConsentStatusLike,
): GroupMobilePhoneConsentDraft {
  return Object.freeze({ desiredConsent: status.state === 'consented' });
}

export function setGroupMobilePhoneConsentDesired(
  draft: GroupMobilePhoneConsentDraft,
  desiredConsent: boolean,
): GroupMobilePhoneConsentDraft {
  if (draft.desiredConsent === desiredConsent) return draft;
  return Object.freeze({ desiredConsent });
}

export function createGroupMobilePhoneConsentIntent(
  status: GroupMobilePhoneConsentStatusLike,
  draft: GroupMobilePhoneConsentDraft,
): GroupMobilePhoneConsentIntent | undefined {
  if (status.state === 'missing-phone') return undefined;
  const savedConsent = status.state === 'consented';
  if (draft.desiredConsent === savedConsent) return undefined;
  return Object.freeze({
    consented: draft.desiredConsent,
    expectedContactVersion: status.contactVersion,
    noticeVersion: status.noticeVersion,
  });
}

export function createGroupMobilePhoneConsentViewModel(
  status: GroupMobilePhoneConsentStatusLike,
  draft: GroupMobilePhoneConsentDraft,
): GroupMobilePhoneConsentViewModel {
  const savedConsent = status.state === 'consented';
  const canSave = createGroupMobilePhoneConsentIntent(status, draft) !== undefined;
  const actionLabel =
    savedConsent && draft.desiredConsent
      ? '已同意'
      : savedConsent && !draft.desiredConsent
        ? '撤回同意'
        : '保存同意';
  return Object.freeze({
    actionLabel,
    canSave,
    desiredConsent: draft.desiredConsent,
    hasPhone: status.state !== 'missing-phone',
    maskedMobilePhone: status.maskedMobilePhone ?? '',
    requiresRenewal: status.state === 'stale',
    savedConsent,
  });
}

export function resolveGroupMobilePhoneConsentSubmission(
  status: GroupMobilePhoneConsentStatusLike,
  draft: GroupMobilePhoneConsentDraft,
  createOperationId: () => string,
): GroupMobilePhoneConsentSubmission {
  const intent = createGroupMobilePhoneConsentIntent(status, draft);
  if (intent === undefined) {
    throw new Error('A changed mobile phone consent choice is required.');
  }
  const fingerprint = JSON.stringify(intent);
  if (draft.attempt?.fingerprint === fingerprint) {
    return Object.freeze({ draft, snapshot: draft.attempt.snapshot });
  }
  const snapshot = Object.freeze({ ...intent, operationId: createOperationId() });
  const attempt = Object.freeze({ fingerprint, snapshot });
  const nextDraft = Object.freeze({ attempt, desiredConsent: draft.desiredConsent });
  return Object.freeze({ draft: nextDraft, snapshot });
}
