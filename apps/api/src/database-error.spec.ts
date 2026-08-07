import { describe, expect, it } from 'vitest';

import { getDatabaseErrorCode, isDuplicateKeyError } from './database-error.js';

describe('database error helpers', () => {
  it('reads the driver error code from the error', () => {
    expect(
      getDatabaseErrorCode(Object.assign(new Error('duplicate'), { code: 'ER_DUP_ENTRY' })),
    ).toBe('ER_DUP_ENTRY');
    expect(getDatabaseErrorCode(Object.assign(new Error('down'), { code: 'ECONNREFUSED' }))).toBe(
      'ECONNREFUSED',
    );
  });

  it('walks the cause chain for wrapped driver errors', () => {
    const cause = Object.assign(new Error('duplicate'), { code: 'ER_DUP_ENTRY' });
    const wrapped = new Error('insert failed', { cause });

    expect(getDatabaseErrorCode(wrapped)).toBe('ER_DUP_ENTRY');
  });

  it('returns undefined for non-error values', () => {
    expect(getDatabaseErrorCode(undefined)).toBeUndefined();
    expect(getDatabaseErrorCode('oops')).toBeUndefined();
    expect(getDatabaseErrorCode(new Error('plain'))).toBeUndefined();
  });

  it('treats only ER_DUP_ENTRY as a duplicate key error', () => {
    expect(isDuplicateKeyError(Object.assign(new Error('x'), { code: 'ER_DUP_ENTRY' }))).toBe(true);
    expect(isDuplicateKeyError(new Error('wrapped', { cause: { code: 'ER_DUP_ENTRY' } }))).toBe(
      true,
    );
    expect(isDuplicateKeyError(Object.assign(new Error('x'), { code: 'ECONNREFUSED' }))).toBe(
      false,
    );
    expect(isDuplicateKeyError(new Error('plain'))).toBe(false);
  });
});
