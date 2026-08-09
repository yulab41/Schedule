import { describe, expect, it, vi } from 'vitest';

import {
  createUnauthorizedNavigator,
  getSessionLandingTarget,
  readInviteToken,
  requestWechatLoginCode,
  type ReLaunchPort,
  type WechatLoginPort,
} from './auth-flow.js';

type LoginOptions = Parameters<WechatLoginPort['login']>[0];
type ReLaunchOptions = Parameters<ReLaunchPort['reLaunch']>[0];

describe('requestWechatLoginCode', () => {
  it('calls the injected member exactly once and resolves its non-empty code', async () => {
    const port = {
      calls: 0,
      login({ success }: LoginOptions) {
        this.calls += 1;
        success({ code: 'wx-code' });
      },
    };

    await expect(requestWechatLoginCode(port)).resolves.toBe('wx-code');
    expect(port.calls).toBe(1);
  });

  it('rejects an empty code and a platform failure without retrying', async () => {
    const emptyLogin = vi.fn(({ success }: LoginOptions) => success({ code: '' }));
    const failedLogin = vi.fn(({ fail }: LoginOptions) => fail({ errMsg: 'login:fail denied' }));

    await expect(requestWechatLoginCode({ login: emptyLogin })).rejects.toMatchObject({
      name: 'WechatLoginError',
    });
    await expect(requestWechatLoginCode({ login: failedLogin })).rejects.toMatchObject({
      name: 'WechatLoginError',
    });
    expect(emptyLogin).toHaveBeenCalledTimes(1);
    expect(failedLogin).toHaveBeenCalledTimes(1);
  });
});

describe('auth landing', () => {
  it.each([
    ['anonymous', false, { kind: 'reLaunch', url: '/pages/auth/login/index' }],
    ['needs-profile', false, { kind: 'reLaunch', url: '/pages/auth/profile-setup/index' }],
    ['authenticated', true, { kind: 'reLaunch', url: '/pages/invite/invite' }],
    ['authenticated', false, { kind: 'switchTab', url: '/pages/workbench/index' }],
    ['loading', false, { kind: 'none' }],
    ['error', false, { kind: 'none' }],
  ] as const)('maps %s and pending=%s', (status, hasPendingInvite, expected) => {
    expect(getSessionLandingTarget(status, hasPendingInvite)).toEqual(expected);
  });

  it('accepts only a non-empty t query value', () => {
    expect(readInviteToken({ t: 'invite-token' })).toBe('invite-token');
    expect(readInviteToken({ t: '' })).toBeUndefined();
    expect(readInviteToken({})).toBeUndefined();
  });
});

describe('unauthorized navigation', () => {
  it('coalesces repeated protected 401 callbacks into one reLaunch', () => {
    const port = {
      calls: [] as ReLaunchOptions[],
      getCurrentRoute: () => 'pages/calendar/index',
      reLaunch(options: ReLaunchOptions) {
        this.calls.push(options);
      },
    };
    const navigator = createUnauthorizedNavigator(port);

    navigator.redirectToLogin();
    navigator.redirectToLogin();

    expect(port.calls).toHaveLength(1);
    expect(port.calls[0]).toEqual(expect.objectContaining({ url: '/pages/auth/login/index' }));
  });

  it('does not redirect from login and unlocks after a failed navigation or reset', () => {
    const reLaunch = vi.fn(({ fail }: ReLaunchOptions) => fail?.());
    const navigator = createUnauthorizedNavigator({
      getCurrentRoute: () => 'pages/calendar/index',
      reLaunch,
    });
    navigator.redirectToLogin();
    navigator.redirectToLogin();
    expect(reLaunch).toHaveBeenCalledTimes(2);

    const onLogin = createUnauthorizedNavigator({
      getCurrentRoute: () => 'pages/auth/login/index',
      reLaunch,
    });
    onLogin.redirectToLogin();
    expect(reLaunch).toHaveBeenCalledTimes(2);

    navigator.reset();
    navigator.redirectToLogin();
    expect(reLaunch).toHaveBeenCalledTimes(3);
  });

  it('unlocks and rethrows a synchronous reLaunch failure to its caller boundary', () => {
    const port = {
      calls: 0,
      getCurrentRoute: () => 'pages/calendar/index',
      reLaunch(options: ReLaunchOptions) {
        void options;
        this.calls += 1;
        if (this.calls === 1) throw new Error('sync navigation failure');
      },
    };
    const navigator = createUnauthorizedNavigator(port);
    expect(() => navigator.redirectToLogin()).toThrow('sync navigation failure');
    navigator.redirectToLogin();
    expect(port.calls).toBe(2);
  });
});
