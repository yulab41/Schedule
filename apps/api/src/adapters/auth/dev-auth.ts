import type { AuthPort } from './auth-port.js';

export function createDevAuthPort(): AuthPort {
  return {
    async authenticate({ authorization }) {
      const token = authorization?.replace(/^Bearer\s+/iu, '');
      if (token === undefined || token.length === 0) {
        return undefined;
      }
      return { cloudbaseUid: token };
    },
  };
}
