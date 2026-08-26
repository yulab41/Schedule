import { describe, expect, it } from 'vitest';

import {
  buildVisitorAccessAggregateCards,
  formatVisitorAccessDateTime,
  formatVisitorAccessMonth,
  maskVisitorAccessIp,
  maskVisitorAccessRequestId,
  sumVisitorAccessCounts,
} from './visitor-access.js';

describe('visitor access presentation rules', () => {
  it('formats timestamps with China-standard time and keeps Web month text', () => {
    expect(formatVisitorAccessDateTime('2026-08-01T16:30:00.000Z')).toBe('2026-08-02 00:30');
    expect(formatVisitorAccessMonth('2026-08')).toBe('2026-08');
    expect(formatVisitorAccessDateTime('invalid')).toBe('访问时间未知');
  });

  it('builds oldest-first chart cards and sums the visible access count', () => {
    const rows = [
      { accessCount: '6', accessMonth: '2026-09', businessMonth: '2026-09' },
      { accessCount: '2', accessMonth: '2026-09', businessMonth: '2026-08' },
      { accessCount: '12', accessMonth: '2026-08', businessMonth: '2026-08' },
    ];

    expect(buildVisitorAccessAggregateCards(rows)).toEqual([
      {
        accessCountLabel: '12',
        accessMonth: '2026-08',
        accessMonthLabel: '08月',
        barHeight: 100,
      },
      {
        accessCountLabel: '8',
        accessMonth: '2026-09',
        accessMonthLabel: '09月',
        barHeight: 67,
      },
    ]);
    expect(sumVisitorAccessCounts(rows)).toBe('20 次');
  });

  it('keeps source clues minimally masked in the Mini display model', () => {
    expect(maskVisitorAccessIp('203.0.113.10')).toBe('203.0.113.*');
    expect(maskVisitorAccessIp('2001:db8::1')).toBe('来源已脱敏');
    expect(maskVisitorAccessIp(undefined)).toBe('来源已脱敏');
    expect(maskVisitorAccessRequestId('req-9a2b3c4d5e6f')).toBe('请求 req-9a2…5e6f');
    expect(maskVisitorAccessRequestId(undefined)).toBe('请求标识已隐藏');
  });
});
