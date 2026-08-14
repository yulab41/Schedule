import { describe, expect, it } from 'vitest';

import { passwordRegisterRequestSchema } from './auth.js';

describe('password authentication contracts', () => {
  it('accepts any non-empty password without a length limit', () => {
    expect(
      passwordRegisterRequestSchema.safeParse({ username: 'linenyu', password: '!' }).success,
    ).toBe(true);
    expect(
      passwordRegisterRequestSchema.safeParse({
        username: 'linenyu',
        password: '密码'.repeat(1000),
      }).success,
    ).toBe(true);
  });

  it('rejects an empty password', () => {
    expect(
      passwordRegisterRequestSchema.safeParse({ username: 'linenyu', password: '' }).success,
    ).toBe(false);
  });
});
