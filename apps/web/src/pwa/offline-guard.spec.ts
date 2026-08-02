import { describe, expect, it } from 'vitest';

import { getOfflineSubmitError, isMutationMethod, offlineSubmitMessage } from './offline-guard.js';

describe('Offline submit guard', () => {
  it('blocks every mutation while offline with an explanatory message', () => {
    for (const method of ['POST', 'PUT', 'DELETE']) {
      expect(isMutationMethod(method)).toBe(true);
      expect(getOfflineSubmitError(false, method)).toBe(offlineSubmitMessage);
    }
  });

  it('never queues writes silently and lets reads continue offline', () => {
    expect(isMutationMethod('GET')).toBe(false);
    expect(getOfflineSubmitError(false, 'GET')).toBeUndefined();
    expect(getOfflineSubmitError(true, 'POST')).toBeUndefined();
  });
});
