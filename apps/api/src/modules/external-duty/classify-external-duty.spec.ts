import { describe, expect, it } from 'vitest';
import { classifyExternalDuty } from './classify-external-duty.js';

const base = {
  remoteName: '甲',
  localName: '乙',
  fingerprint: 'old',
  changeSource: 'initial' as const,
  status: 'pending' as const,
};

describe('external duty comparison', () => {
  it('surfaces an initial difference once', () => {
    expect(
      classifyExternalDuty({
        remoteName: '甲',
        localName: '乙',
        fingerprint: 'old',
        blockReason: null,
      }),
    ).toEqual({ changeSource: 'initial', status: 'pending', newDifference: true });
    expect(
      classifyExternalDuty({
        previous: base,
        remoteName: '甲',
        localName: '乙',
        fingerprint: 'old',
        blockReason: null,
      }).newDifference,
    ).toBe(false);
  });

  it('does not resend a reminder when the assignment identity changes but names do not', () => {
    expect(
      classifyExternalDuty({
        previous: base,
        remoteName: '甲',
        localName: '乙',
        fingerprint: 'recreated-assignment',
        blockReason: null,
      }).newDifference,
    ).toBe(false);
  });

  it('classifies the changed side and conflicting changes', () => {
    for (const [remoteName, localName, source] of [
      ['丙', '乙', 'remote'],
      ['甲', '丁', 'local'],
      ['丙', '丁', 'both'],
    ] as const) {
      expect(
        classifyExternalDuty({
          previous: base,
          remoteName,
          localName,
          fingerprint: 'new',
          blockReason: null,
        }).changeSource,
      ).toBe(source);
    }
  });

  it('keeps a request processing until the effective roster agrees', () => {
    const previous = { ...base, status: 'processing' as const };
    expect(
      classifyExternalDuty({
        previous,
        remoteName: '甲',
        localName: '乙',
        fingerprint: 'old',
        blockReason: null,
      }).status,
    ).toBe('processing');
    expect(
      classifyExternalDuty({
        previous,
        remoteName: '甲',
        localName: '甲',
        fingerprint: 'new',
        blockReason: null,
      }).status,
    ).toBe('aligned');
  });

  it('blocks uncertain matches even when names appear equal', () => {
    expect(
      classifyExternalDuty({
        previous: base,
        remoteName: '甲',
        localName: '甲',
        fingerprint: 'new',
        blockReason: 'duplicate assignment',
      }).status,
    ).toBe('blocked');
  });
});
