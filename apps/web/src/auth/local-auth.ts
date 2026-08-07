export interface AuthError {
  readonly message?: string;
}

export interface AuthSession {
  readonly access_token: string;
  readonly user?: {
    readonly is_anonymous?: boolean;
  };
}

export interface AuthResult<T> {
  readonly data?: T;
  readonly error?: AuthError | null;
}

export interface AuthClient {
  clearDevIdentity(): void;
  getSession(): Promise<AuthResult<{ readonly session?: AuthSession }>>;
  setDevIdentity(uid: string): void;
  signInWithPassword(input: {
    readonly password: string;
    readonly username: string;
  }): Promise<AuthResult<{ readonly session?: AuthSession }>>;
  signOut(): Promise<AuthResult<unknown>>;
}

let devIdentityUid: string | undefined;

/**
 * 自建登录认证落地前的本地认证客户端：开发模式下由“本地管理员/本地成员”
 * 按钮写入 dev identity，请求以该 UID 作为 Bearer token；密码登录尚未实现。
 */
export const localAuth: AuthClient = {
  clearDevIdentity() {
    devIdentityUid = undefined;
  },
  getSession() {
    return Promise.resolve(
      devIdentityUid === undefined ? {} : { data: { session: { access_token: devIdentityUid } } },
    );
  },
  setDevIdentity(uid) {
    devIdentityUid = uid;
  },
  signInWithPassword() {
    return Promise.resolve({
      error: { message: '账号密码登录尚未实现，请使用本地开发登录。' },
    });
  },
  signOut() {
    devIdentityUid = undefined;
    return Promise.resolve({});
  },
};

export function getAuthenticatedSession(
  result: AuthResult<{ readonly session?: AuthSession }>,
): AuthSession | undefined {
  const session = result.data?.session;

  if (result.error !== null && result.error !== undefined) {
    throw new AuthenticationError(result.error.message ?? '身份验证服务暂时不可用。');
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

export class AuthenticationError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'AuthenticationError';
  }
}
