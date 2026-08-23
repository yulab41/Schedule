import { describe, expect, it } from 'vitest';

import { ApiError } from '../../plugins/error-handler.js';
import { resolveScheduleOperationId } from './schedule-routes.js';

const operationId = '11111111-1111-4111-8111-111111111111';

describe('schedule dangerous-write idempotency boundary', () => {
  it('accepts the canonical header and temporarily compatible body field', () => {
    expect(resolveScheduleOperationId(operationId)).toBe(operationId);
    expect(resolveScheduleOperationId(undefined, operationId)).toBe(operationId);
    expect(resolveScheduleOperationId(operationId, operationId)).toBe(operationId);
  });

  it('rejects a missing, malformed, duplicated, or mismatched key', () => {
    for (const invoke of [
      () => resolveScheduleOperationId(undefined),
      () => resolveScheduleOperationId('not-a-uuid'),
      () => resolveScheduleOperationId([operationId, operationId]),
      () => resolveScheduleOperationId(operationId, '22222222-2222-4222-8222-222222222222'),
    ]) {
      expect(invoke).toThrowError(ApiError);
      try {
        invoke();
      } catch (error) {
        expect(error).toMatchObject({ code: 'VALIDATION_FAILED', statusCode: 400 });
      }
    }
  });
});
