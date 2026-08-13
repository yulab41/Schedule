import { describe, expect, it } from 'vitest';

import { createPushDispatcher } from './notification-dispatcher.js';

describe('WebPushDispatcher configuration', () => {
  it('exposes the public key only when the complete VAPID configuration is present', () => {
    const dispatcher = createPushDispatcher({
      VAPID_PRIVATE_KEY: 'private-key',
      VAPID_PUBLIC_KEY: 'public-key',
      VAPID_SUBJECT: 'mailto:admin@example.com',
    });

    expect(dispatcher.isConfigured).toBe(true);
    expect(dispatcher.vapidPublicKey).toBe('public-key');
  });

  it('keeps the application-inbox fallback when VAPID is not configured', () => {
    const dispatcher = createPushDispatcher({});

    expect(dispatcher.isConfigured).toBe(false);
    expect(dispatcher.vapidPublicKey).toBeNull();
  });
});
