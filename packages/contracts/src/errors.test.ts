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
    ]);
    expect(new Set(apiErrorCodes).size).toBe(apiErrorCodes.length);
  });
});
