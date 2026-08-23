import { randomUUID } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { resolveDangerousOperationId } from './operation-id.js';

describe('resolveDangerousOperationId', () => {
  it('accepts header-only, body-only, and matching dual operation ids', () => {
    const operationId = randomUUID();

    expect(resolveDangerousOperationId(operationId)).toBe(operationId);
    expect(resolveDangerousOperationId(undefined, operationId)).toBe(operationId);
    expect(resolveDangerousOperationId(operationId, operationId)).toBe(operationId);
  });

  it('rejects missing, malformed, repeated, and mismatched operation ids', () => {
    const operationId = randomUUID();

    for (const resolve of [
      () => resolveDangerousOperationId(undefined),
      () => resolveDangerousOperationId('not-a-uuid'),
      () => resolveDangerousOperationId([operationId, operationId]),
      () => resolveDangerousOperationId(operationId, randomUUID()),
    ]) {
      expect(resolve).toThrow(
        expect.objectContaining({ code: 'VALIDATION_FAILED', statusCode: 400 }),
      );
    }
  });
});
