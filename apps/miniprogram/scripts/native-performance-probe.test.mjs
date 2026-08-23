import { describe, expect, it, vi } from 'vitest';

import {
  createNativePerformanceProbe,
  formatNativePerformanceEvidence,
} from '../src/platform/performance-probe.ts';

describe('P6 native performance probe', () => {
  it('records callback-delimited samples with an injected monotonic clock', () => {
    const now = vi
      .fn()
      .mockReturnValueOnce(100)
      .mockReturnValueOnce(148)
      .mockReturnValueOnce(200)
      .mockReturnValueOnce(231);
    const probe = createNativePerformanceProbe(now);

    probe.start('tap-feedback');
    expect(probe.complete('tap-feedback')).toEqual({
      durationMs: 48,
      maxMs: 48,
      metric: 'tap-feedback',
      sampleCount: 1,
      samplesMs: [48],
    });
    probe.start('tap-feedback');
    expect(probe.complete('tap-feedback')).toEqual({
      durationMs: 31,
      maxMs: 48,
      metric: 'tap-feedback',
      sampleCount: 2,
      samplesMs: [48, 31],
    });
  });

  it('does nothing until an explicit diagnostic route creates a probe', () => {
    const now = vi.fn();
    const probe = createNativePerformanceProbe(now);

    expect(probe.complete('core-ready')).toBeUndefined();
    expect(now).not.toHaveBeenCalled();
  });

  it('formats the exact sample count, maximum, and threshold for manual evidence', () => {
    expect(
      formatNativePerformanceEvidence(
        {
          durationMs: 48,
          maxMs: 48,
          metric: 'tap-feedback',
          sampleCount: 1,
          samplesMs: [48],
        },
        { label: '点击反馈', requiredSamples: 10, thresholdMs: 100 },
      ),
    ).toBe('P6 性能 · 点击反馈 48ms · 本页 1/10 次 · 最大 48ms · 门槛 ≤100ms');
  });
});
