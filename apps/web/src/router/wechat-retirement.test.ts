// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
vi.mock('../stores/session.js', () => ({
  useSessionStore: () => ({ status: 'anonymous', isAuthenticated: false, needsProfile: false }),
}));
vi.mock('../views/auth/LoginView.vue', () => ({ default: { template: '<div />' } }));
import { router } from './index.js';

describe('retired website WeChat callback', () => {
  it('lands on password login and discards the OAuth query and hash', async () => {
    await router.push('/auth/wechat/callback?code=private-code&state=private-state#private-hash');
    expect(router.currentRoute.value.name).toBe('login');
    expect(router.currentRoute.value.query).toEqual({});
    expect(router.currentRoute.value.hash).toBe('');
  });
});
