import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  getPushSubscription,
  resubscribeToPush,
  subscribeToPush,
  urlBase64ToUint8Array,
} from './register-service-worker.js';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('browser push subscription helpers', () => {
  it('reuses an existing subscription without asking for permission again', async () => {
    const existingSubscription = {} as PushSubscription;
    const registration = {
      pushManager: {
        getSubscription: vi.fn().mockResolvedValue(existingSubscription),
        subscribe: vi.fn(),
      },
    } as unknown as ServiceWorkerRegistration;

    await expect(getPushSubscription(registration)).resolves.toBe(existingSubscription);
    await expect(subscribeToPush(registration, 'public-key')).resolves.toBe(existingSubscription);
    expect(registration.pushManager.subscribe).not.toHaveBeenCalled();
  });

  it('unsubscribes the old subscription before an explicit re-registration', async () => {
    const unsubscribe = vi.fn().mockResolvedValue(true);
    const replacementSubscription = {} as PushSubscription;
    const registration = {
      pushManager: {
        getSubscription: vi.fn().mockResolvedValue({ unsubscribe }),
        subscribe: vi.fn().mockResolvedValue(replacementSubscription),
      },
    } as unknown as ServiceWorkerRegistration;
    vi.stubGlobal('window', { atob: () => '\u0001\u0002' });

    await expect(resubscribeToPush(registration, 'AQI')).resolves.toBe(replacementSubscription);
    expect(unsubscribe).toHaveBeenCalledOnce();
    expect(registration.pushManager.subscribe).toHaveBeenCalledOnce();
  });

  it('decodes URL-safe base64 VAPID keys', () => {
    vi.stubGlobal('window', { atob: (value: string) => value });

    expect([...urlBase64ToUint8Array('-_8')]).toEqual([43, 47, 56, 61]);
  });
});
