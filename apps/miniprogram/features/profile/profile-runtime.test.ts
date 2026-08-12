import { describe, expect, it } from 'vitest';

import { getMiniProgramRuntimeInfo } from './profile-runtime.js';

describe('profile runtime info', () => {
  it('separates mini-program runtime version from the user profile version with a safe fallback', () => {
    expect(
      getMiniProgramRuntimeInfo(() => ({
        miniProgram: { envVersion: 'trial', version: '1.2.3' },
      })),
    ).toEqual({ envVersion: 'trial', version: '1.2.3' });
    expect(
      getMiniProgramRuntimeInfo(() => {
        throw new Error('unavailable');
      }),
    ).toEqual({
      envVersion: '未知环境',
      version: '未提供',
    });
  });
});
