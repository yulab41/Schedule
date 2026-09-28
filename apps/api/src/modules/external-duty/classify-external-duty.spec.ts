import { describe, expect, it } from 'vitest';
import { classifyExternalDuty, scopedExternalDutyDates } from './classify-external-duty.js';

const previous = {
  baselineName: '甲',
  remoteName: '甲',
  localName: '乙',
  fingerprint: 'old',
  changeSource: 'local' as const,
  status: 'pending' as const,
  isInScope: 1,
};

const compare = (baselineName: string, remoteName: string, localName: string) =>
  classifyExternalDuty({
    baselineName,
    remoteName,
    localName,
    fingerprint: 'new',
    blockReason: null,
  });

describe('external duty published baseline comparison', () => {
  it('checks today only when both the webpage and a published assignment have the date', () => {
    expect(
      scopedExternalDutyDates(
        new Map([
          ['2026-09-27', '甲'],
          ['2026-09-28', '乙'],
          ['2026-09-29', '丙'],
          ['2026-09-30', '丁'],
        ]),
        new Map([
          ['2026-09-28', 1],
          ['2026-09-29', 0],
          ['2026-10-01', 1],
        ]),
        '2026-09-28',
      ),
    ).toEqual([['2026-09-28', '乙']]);
  });
  it('hides every date whose remote and effective roster agree', () => {
    expect(compare('甲', '甲', '甲').status).toBe('aligned');
    expect(compare('甲', '乙', '乙').status).toBe('aligned');
  });

  it('classifies the changed side against the current published baseline on first scan', () => {
    expect(compare('甲', '甲', '乙').changeSource).toBe('local');
    expect(compare('甲', '乙', '甲').changeSource).toBe('remote');
    expect(compare('甲', '乙', '丙').changeSource).toBe('both');
  });

  it('does not infer the changed side from the previous scan', () => {
    expect(
      classifyExternalDuty({
        previous,
        baselineName: '甲',
        remoteName: '甲',
        localName: '丙',
        fingerprint: 'changed',
        blockReason: null,
      }).changeSource,
    ).toBe('local');
  });

  it('reminds once per changed discrepancy, not every scan or assignment ID change', () => {
    expect(
      classifyExternalDuty({
        previous,
        baselineName: '甲',
        remoteName: '甲',
        localName: '乙',
        fingerprint: 'recreated-assignment',
        blockReason: null,
      }).newDifference,
    ).toBe(false);
    expect(
      classifyExternalDuty({
        previous,
        baselineName: '丁',
        remoteName: '甲',
        localName: '乙',
        fingerprint: 'new-publication',
        blockReason: null,
      }).newDifference,
    ).toBe(true);
  });

  it('keeps a request processing only while its effective roster is unchanged', () => {
    const processing = { ...previous, status: 'processing' as const };
    expect(
      classifyExternalDuty({
        previous: processing,
        baselineName: '甲',
        remoteName: '甲',
        localName: '乙',
        fingerprint: 'old',
        blockReason: null,
      }).status,
    ).toBe('processing');
    expect(compare('甲', '甲', '甲').status).toBe('aligned');
  });

  it('blocks ambiguous matches even if display names agree', () => {
    expect(
      classifyExternalDuty({
        baselineName: '甲',
        remoteName: '甲',
        localName: '甲',
        fingerprint: 'new',
        blockReason: 'duplicate assignment',
      }).status,
    ).toBe('blocked');
  });
});
