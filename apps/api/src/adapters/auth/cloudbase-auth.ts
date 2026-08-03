import { createRequire } from 'node:module';
import { gunzipSync } from 'node:zlib';

import type { AuthPort } from './auth-port.js';

interface CloudbaseUserInfo {
  readonly isAnonymous: boolean;
  readonly uid: string;
}

type CloudbaseUserInfoReader = () => CloudbaseUserInfo;

interface CloudbaseSdk {
  init(): {
    auth(): {
      getUserInfo(): CloudbaseUserInfo;
    };
  };
}

export function createCloudbaseAuthPort(readUserInfo?: CloudbaseUserInfoReader): AuthPort {
  return {
    async authenticate() {
      const userInfo = (readUserInfo ?? readCloudbaseSdkUserInfo)();

      if (userInfo.uid === '' || userInfo.isAnonymous) {
        return undefined;
      }

      return { cloudbaseUid: userInfo.uid };
    },
  };
}

function readCloudbaseSdkUserInfo(): CloudbaseUserInfo {
  return loadCloudbaseSdk().init().auth().getUserInfo();
}

function loadCloudbaseSdk(): CloudbaseSdk {
  const require = createRequire(import.meta.url);
  return require('@cloudbase/node-sdk') as CloudbaseSdk;
}

/**
 * This adapter is for CloudBase HTTP functions behind an authenticated gateway.
 * The gateway injects a gzip-compressed Base64 context for each request. Its
 * `userId` is normalized to the business-layer CloudBase UID.
 */
export function createCloudbaseHttpAuthPort(): AuthPort {
  return {
    async authenticate(request) {
      const userInfo = readCloudbaseHttpUserInfo(request.trustedCloudbaseContext);

      if (userInfo === undefined || userInfo.isAnonymous || userInfo.uid === '') {
        return undefined;
      }

      return { cloudbaseUid: userInfo.uid };
    },
  };
}

function readCloudbaseHttpUserInfo(context: string | undefined): CloudbaseUserInfo | undefined {
  if (context === undefined || context.length === 0 || context.length > 4096) {
    return undefined;
  }

  try {
    const decoded = gunzipSync(Buffer.from(context, 'base64'), { maxOutputLength: 4096 }).toString(
      'utf8',
    );
    const parsed: unknown = JSON.parse(decoded);

    if (!isCloudbaseHttpContext(parsed)) {
      return undefined;
    }

    return {
      isAnonymous: parsed.authMethod === 'UNAUTHORIZED' || parsed.userType === 'NONE',
      uid: parsed.userId,
    };
  } catch {
    return undefined;
  }
}

function isCloudbaseHttpContext(
  value: unknown,
): value is { authMethod?: unknown; userId: string; userType?: unknown } {
  return (
    value !== null &&
    typeof value === 'object' &&
    typeof (value as { userId?: unknown }).userId === 'string' &&
    (value as { userId: string }).userId.length > 0
  );
}
