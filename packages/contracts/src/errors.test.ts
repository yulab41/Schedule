import { describe, expect, it } from 'vitest';

import { apiErrorCodes } from './errors.js';

describe('API error codes', () => {
  it('exposes every supported code exactly once in the canonical order', () => {
    expect(apiErrorCodes).toEqual([
      'AUTHENTICATION_REQUIRED',
      'FORBIDDEN',
      'NOT_FOUND',
      'VALIDATION_FAILED',
      'UNSUPPORTED_MEDIA_TYPE',
      'CONFLICT',
      'RATE_LIMITED',
      'SERVICE_UNAVAILABLE',
      'INTERNAL_ERROR',
      'WECHAT_LOGIN_FAILED',
      'WECHAT_MESSAGE_SEND_FAILED',
      'INVITE_INVALID',
      'INVITE_USED',
      'INVITE_EXPIRED',
      'VISITOR_KEY_INVALID',
    ]);
    expect(new Set(apiErrorCodes).size).toBe(apiErrorCodes.length);
  });
});
