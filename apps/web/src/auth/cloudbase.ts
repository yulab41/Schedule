import cloudbase from '@cloudbase/js-sdk';

export interface CloudbaseAuthError {
  readonly message?: string;
}

export interface CloudbaseSession {
  readonly access_token: string;
  readonly user?: {
    readonly is_anonymous?: boolean;
  };
}

export interface CloudbaseAuthResult<T> {
  readonly data?: T;
  readonly error?: CloudbaseAuthError | null;
}

export interface CloudbaseAuthClient {
  clearDevIdentity(): void;
  getSession(): Promise<CloudbaseAuthResult<{ readonly session?: CloudbaseSession }>>;
  setDevIdentity(uid: string): void;
  signInWithPassword(input: {
    readonly password: string;
    readonly username: string;
  }): Promise<CloudbaseAuthResult<{ readonly session?: CloudbaseSession }>>;
  signOut(): Promise<CloudbaseAuthResult<unknown>>;
}

let authClient: CloudbaseAuthClient | undefined;
let devIdentityUid: string | undefined;

// Resolving the SDK lazily keeps the startup shell available when local env is incomplete.
export const cloudbaseAuth: CloudbaseAuthClient = {
  clearDevIdentity() {
    devIdentityUid = undefined;
  },
  getSession() {
    if (devIdentityUid !== undefined) {
      return Promise.resolve({
        data: { session: { access_token: devIdentityUid } },
      });
    }
    return getCloudbaseAuthClient().getSession();
  },
  setDevIdentity(uid) {
    devIdentityUid = uid;
  },
  signInWithPassword(input) {
    return getCloudbaseAuthClient().signInWithPassword(input);
  },
  signOut() {
    devIdentityUid = undefined;
    return getCloudbaseAuthClient().signOut();
  },
};

export function getCloudbaseAuthClient(): CloudbaseAuthClient {
  if (authClient !== undefined) {
    return authClient;
  }

  const environmentId = import.meta.env.VITE_CLOUDBASE_ENV_ID;

  if (environmentId === undefined || environmentId.length === 0) {
    throw new CloudbaseConfigurationError('缺少 CloudBase 环境配置。');
  }

  const accessKey = import.meta.env.VITE_CLOUDBASE_ACCESS_KEY;
  const app = cloudbase.init({
    env: environmentId,
    ...(accessKey === undefined || accessKey.length === 0 ? {} : { accessKey }),
    auth: { detectSessionInUrl: true },
  });

  authClient = app.auth as unknown as CloudbaseAuthClient;
  return authClient;
}

export class CloudbaseConfigurationError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'CloudbaseConfigurationError';
  }
}

export function getAuthenticatedSession(
  result: CloudbaseAuthResult<{ readonly session?: CloudbaseSession }>,
): CloudbaseSession | undefined {
  const session = result.data?.session;

  if (result.error !== null && result.error !== undefined) {
    throw new CloudbaseAuthenticationError(result.error.message ?? '身份验证服务暂时不可用。');
  }

  if (
    session === undefined ||
    session.access_token.length === 0 ||
    session.user?.is_anonymous === true
  ) {
    return undefined;
  }

  return session;
}

export class CloudbaseAuthenticationError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'CloudbaseAuthenticationError';
  }
}
