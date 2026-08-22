import { describe, expect, it } from 'vitest';

import { createWechatSessionToken, verifyWechatSessionToken } from './wechat-auth.js';

const secret = 'session-secret-for-versioned-claims-123456';

describe('versioned WeChat session claims', () => {
  it('round-trips authVersion and AppID for new Mini sessions', () => {
    const token = createWechatSessionToken(
      {
        appId: 'mini-app-id',
        authVersion: 3,
        openid: 'mini-openid',
        provider: 'wechat_mini_program',
        sub: 'user-1',
      },
      secret,
      1_000,
    );

    expect(verifyWechatSessionToken(token, secret, 1_001)).toEqual({
      appId: 'mini-app-id',
      authVersion: 3,
      exp: 2_593_000,
      openid: 'mini-openid',
      provider: 'wechat_mini_program',
      sub: 'user-1',
    });
  });

  it('keeps rollout-era claims without authVersion or AppID readable as legacy version 1', () => {
    const token = createWechatSessionToken(
      { openid: 'legacy-openid', provider: 'wechat_mini_program', sub: 'user-legacy' },
      secret,
      1_000,
    );

    const claims = verifyWechatSessionToken(token, secret, 1_001);
    expect(claims).toMatchObject({ openid: 'legacy-openid', sub: 'user-legacy' });
    expect(claims).not.toHaveProperty('authVersion');
    expect(claims).not.toHaveProperty('appId');
  });

  it('rejects malformed version and AppID claims before database authentication', () => {
    for (const claims of [
      {
        appId: 'mini-app-id',
        authVersion: 0,
        openid: 'mini-openid',
        provider: 'wechat_mini_program' as const,
        sub: 'user-1',
      },
      {
        appId: '',
        authVersion: 1,
        openid: 'mini-openid',
        provider: 'wechat_mini_program' as const,
        sub: 'user-1',
      },
      {
        authVersion: 1.5,
        openid: 'username',
        provider: 'password' as const,
        sub: 'user-1',
      },
    ]) {
      const token = createWechatSessionToken(claims, secret, 1_000);
      expect(verifyWechatSessionToken(token, secret, 1_001)).toBeUndefined();
    }
  });
});
