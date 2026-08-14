import { describe, expect, it } from 'vitest';

import { createWechatWebState, verifyWechatWebState } from './wechat-web-auth-service.js';

describe('WeChat web login state', () => {
  it('round-trips a signed state and rejects tampering or expiry', () => {
    const secret = 's'.repeat(32);
    const state = createWechatWebState('client-state-123456', secret, 1_000);

    expect(verifyWechatWebState(state, secret, 1_299)).toBe(true);
    expect(verifyWechatWebState(state, secret, 1_300)).toBe(false);
    expect(verifyWechatWebState(`${state}x`, secret, 1_000)).toBe(false);
    expect(verifyWechatWebState(state, 't'.repeat(32), 1_000)).toBe(false);
  });

  it('does not create a state with a missing or short session secret', () => {
    expect(() => createWechatWebState('client-state-123456', undefined, 1_000)).toThrow();
    expect(() => createWechatWebState('client-state-123456', 'short', 1_000)).toThrow();
  });
});
