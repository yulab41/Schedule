import { describe, expect, it } from 'vitest';

import { clientTelemetryRequestSchema } from './client-telemetry.js';

describe('client telemetry contract', () => {
  it('accepts only fixed anonymous error/performance fields in batches of at most ten', () => {
    expect(
      clientTelemetryRequestSchema.safeParse({
        events: [
          {
            deviceTier: 'medium',
            errorCode: 'MINI_RUNTIME_ERROR',
            networkType: 'wifi',
            page: 'workbench',
            stackFingerprint: 'a'.repeat(64),
          },
          {
            deviceTier: 'high',
            networkType: '5g',
            page: 'manual-matrix',
            performance: { durationMs: 87, metric: 'tap-feedback' },
          },
        ],
      }).success,
    ).toBe(true);
    expect(
      clientTelemetryRequestSchema.safeParse({
        events: Array.from({ length: 11 }, () => ({
          deviceTier: 'unknown',
          errorCode: 'UNKNOWN',
          networkType: 'unknown',
          page: 'unknown',
        })),
      }).success,
    ).toBe(false);
  });

  it('rejects identity, contact, credential, raw stack/message, timestamps, and schedule payloads', () => {
    for (const extra of [
      { userId: 'user-1' },
      { groupId: 'group-1' },
      { mobilePhone: '13800138000' },
      { authorization: 'Bearer secret' },
      { stack: 'raw stack' },
      { errorMessage: 'patient name' },
      { createdAt: '2026-08-24T00:00:00.000Z' },
      { assignment: { realName: '张三' } },
    ]) {
      expect(
        clientTelemetryRequestSchema.safeParse({
          events: [
            {
              deviceTier: 'unknown',
              errorCode: 'UNKNOWN',
              networkType: 'unknown',
              page: 'unknown',
              ...extra,
            },
          ],
        }).success,
      ).toBe(false);
    }
  });

  it('requires an error or performance and rejects invalid numeric/fingerprint values', () => {
    const base = { deviceTier: 'low', networkType: 'none', page: 'app' };
    expect(clientTelemetryRequestSchema.safeParse({ events: [base] }).success).toBe(false);
    expect(
      clientTelemetryRequestSchema.safeParse({
        events: [{ ...base, performance: { durationMs: Number.NaN, metric: 'core-ready' } }],
      }).success,
    ).toBe(false);
    expect(
      clientTelemetryRequestSchema.safeParse({
        events: [{ ...base, errorCode: 'UNKNOWN', stackFingerprint: 'RAW' }],
      }).success,
    ).toBe(false);
  });
});
