import { describe, expect, it } from 'vitest';

import { logRedactionPaths, redactSensitiveFields } from './redact.js';

const canonicalSensitiveFields = [
  'accessToken',
  'appSecret',
  'authorization',
  'linkToken',
  'mobile',
  'mobilePhone',
  'openid',
  'password',
  'phone',
  'phoneNumber',
  'refreshToken',
  'shortPhone',
  'telephone',
  'token',
  'unionId',
  'visitorKey',
] as const;

describe('sensitive field redaction', () => {
  it('redacts every canonical sensitive field at any nesting depth', () => {
    for (const field of canonicalSensitiveFields) {
      expect(redactSensitiveFields({ section: { [field]: 'secret' } })).toEqual({
        section: { [field]: '[REDACTED]' },
      });
    }
  });

  it('matches field names after removing dashes and underscores', () => {
    expect(
      redactSensitiveFields({
        'mobile-phone': '13900000000',
        phone_number: '13800000000',
        user_name: 'doctor',
      }),
    ).toEqual({
      'mobile-phone': '[REDACTED]',
      phone_number: '[REDACTED]',
      user_name: 'doctor',
    });
  });

  it('redacts values inside arrays while preserving safe fields', () => {
    expect(
      redactSensitiveFields({
        members: [{ mobile: '13900000000' }, { name: 'doctor' }],
        requestId: 'req-1',
      }),
    ).toEqual({
      members: [{ mobile: '[REDACTED]' }, { name: 'doctor' }],
      requestId: 'req-1',
    });
  });

  it('does not recurse into non-plain objects', () => {
    const createdAt = new Date('2026-08-06T00:00:00.000Z');
    expect(redactSensitiveFields({ createdAt })).toEqual({ createdAt });
  });

  it('handles circular references without recursing forever', () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    expect(redactSensitiveFields(circular)).toEqual({ self: '[Circular]' });
  });

  it('derives pino redaction paths for every canonical field', () => {
    for (const field of canonicalSensitiveFields) {
      expect(logRedactionPaths).toContain(field);
      expect(logRedactionPaths).toContain(`*.${field}`);
      expect(logRedactionPaths).toContain(`*.*.${field}`);
      expect(logRedactionPaths).toContain(`*.*.*.${field}`);
    }
  });
});
