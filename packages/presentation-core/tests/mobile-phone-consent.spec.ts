import { describe, expect, it, vi } from 'vitest';

import {
  createGroupMobilePhoneConsentDraft,
  createGroupMobilePhoneConsentIntent,
  createGroupMobilePhoneConsentViewModel,
  resolveGroupMobilePhoneConsentSubmission,
  setGroupMobilePhoneConsentDesired,
  type GroupMobilePhoneConsentStatusLike,
} from '../src/mobile-phone-consent.js';

const notConsentedStatus = status({ state: 'not-consented' });

describe('group mobile phone consent presentation model', () => {
  it('maps missing, not-consented, stale, and consented server states fail closed', () => {
    const missing = status({
      contactVersion: 0,
      maskedMobilePhone: undefined,
      state: 'missing-phone',
    });
    const stale = status({ state: 'stale' });
    const consented = status({ consentedAt: '2026-08-24T01:02:03.000Z', state: 'consented' });

    expect(
      createGroupMobilePhoneConsentViewModel(missing, createGroupMobilePhoneConsentDraft(missing)),
    ).toMatchObject({
      actionLabel: '保存同意',
      canSave: false,
      desiredConsent: false,
      hasPhone: false,
      savedConsent: false,
    });
    expect(
      createGroupMobilePhoneConsentViewModel(
        notConsentedStatus,
        createGroupMobilePhoneConsentDraft(notConsentedStatus),
      ),
    ).toMatchObject({ actionLabel: '保存同意', canSave: false, savedConsent: false });
    expect(
      createGroupMobilePhoneConsentViewModel(stale, createGroupMobilePhoneConsentDraft(stale)),
    ).toMatchObject({
      actionLabel: '保存同意',
      canSave: false,
      requiresRenewal: true,
      savedConsent: false,
    });
    expect(
      createGroupMobilePhoneConsentViewModel(
        consented,
        createGroupMobilePhoneConsentDraft(consented),
      ),
    ).toMatchObject({
      actionLabel: '已同意',
      canSave: false,
      desiredConsent: true,
      savedConsent: true,
    });
  });

  it('creates grant and revoke intents only after the desired state changes', () => {
    const initial = createGroupMobilePhoneConsentDraft(notConsentedStatus);
    expect(createGroupMobilePhoneConsentIntent(notConsentedStatus, initial)).toBeUndefined();

    const grantDraft = setGroupMobilePhoneConsentDesired(initial, true);
    expect(createGroupMobilePhoneConsentViewModel(notConsentedStatus, grantDraft)).toMatchObject({
      actionLabel: '保存同意',
      canSave: true,
      desiredConsent: true,
    });
    expect(createGroupMobilePhoneConsentIntent(notConsentedStatus, grantDraft)).toEqual({
      consented: true,
      expectedContactVersion: 3,
      noticeVersion: 'v1',
    });

    const consented = status({ consentedAt: '2026-08-24T01:02:03.000Z', state: 'consented' });
    const revokeDraft = setGroupMobilePhoneConsentDesired(
      createGroupMobilePhoneConsentDraft(consented),
      false,
    );
    expect(createGroupMobilePhoneConsentViewModel(consented, revokeDraft)).toMatchObject({
      actionLabel: '撤回同意',
      canSave: true,
      desiredConsent: false,
    });
    expect(createGroupMobilePhoneConsentIntent(consented, revokeDraft)).toEqual({
      consented: false,
      expectedContactVersion: 3,
      noticeVersion: 'v1',
    });
  });

  it('reuses an operation id for an ambiguous retry and freezes its request snapshot', () => {
    const createOperationId = vi.fn(() => '11111111-1111-4111-8111-111111111111');
    const draft = setGroupMobilePhoneConsentDesired(
      createGroupMobilePhoneConsentDraft(notConsentedStatus),
      true,
    );
    const first = resolveGroupMobilePhoneConsentSubmission(
      notConsentedStatus,
      draft,
      createOperationId,
    );
    const retry = resolveGroupMobilePhoneConsentSubmission(
      notConsentedStatus,
      first.draft,
      createOperationId,
    );

    expect(retry.snapshot).toBe(first.snapshot);
    expect(retry.draft.attempt).toBe(first.draft.attempt);
    expect(createOperationId).toHaveBeenCalledTimes(1);
    expect(first.snapshot).toEqual({
      consented: true,
      expectedContactVersion: 3,
      noticeVersion: 'v1',
      operationId: '11111111-1111-4111-8111-111111111111',
    });
    expect(Object.isFrozen(first.snapshot)).toBe(true);
  });

  it('invalidates the retry key when the desired payload or server version changes', () => {
    const createOperationId = vi
      .fn()
      .mockReturnValueOnce('11111111-1111-4111-8111-111111111111')
      .mockReturnValueOnce('22222222-2222-4222-8222-222222222222')
      .mockReturnValueOnce('33333333-3333-4333-8333-333333333333')
      .mockReturnValueOnce('44444444-4444-4444-8444-444444444444');
    const grantDraft = setGroupMobilePhoneConsentDesired(
      createGroupMobilePhoneConsentDraft(notConsentedStatus),
      true,
    );
    const first = resolveGroupMobilePhoneConsentSubmission(
      notConsentedStatus,
      grantDraft,
      createOperationId,
    );
    const changedDesired = setGroupMobilePhoneConsentDesired(first.draft, false);
    const changedBack = setGroupMobilePhoneConsentDesired(changedDesired, true);
    const second = resolveGroupMobilePhoneConsentSubmission(
      notConsentedStatus,
      changedBack,
      createOperationId,
    );
    const changedVersion = status({ contactVersion: 4, state: 'not-consented' });
    const third = resolveGroupMobilePhoneConsentSubmission(
      changedVersion,
      second.draft,
      createOperationId,
    );
    const changedNotice = status({
      contactVersion: 4,
      noticeVersion: 'v2',
      state: 'not-consented',
    });
    const fourth = resolveGroupMobilePhoneConsentSubmission(
      changedNotice,
      third.draft,
      createOperationId,
    );

    expect(second.snapshot.operationId).toBe('22222222-2222-4222-8222-222222222222');
    expect(third.snapshot.operationId).toBe('33333333-3333-4333-8333-333333333333');
    expect(fourth.snapshot.operationId).toBe('44444444-4444-4444-8444-444444444444');
    expect(createOperationId).toHaveBeenCalledTimes(4);
  });
});

function status(
  overrides: Partial<GroupMobilePhoneConsentStatusLike>,
): GroupMobilePhoneConsentStatusLike {
  return {
    contactVersion: 3,
    groupId: 'group-1',
    maskedMobilePhone: '138 **** 7926',
    membershipId: 'membership-1',
    noticeVersion: 'v1',
    state: 'not-consented',
    ...overrides,
  };
}
