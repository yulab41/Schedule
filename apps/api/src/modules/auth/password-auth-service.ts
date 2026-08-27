import { randomBytes, randomUUID, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';

import type {
  PasswordAuthResponse,
  PasswordChangeRequest,
  PasswordChangeResponse,
  PasswordProofChangeRequest,
  PasswordStatusResponse,
} from '@schedule/contracts';
import {
  type DatabaseClient,
  type DatabaseTransaction,
  userPasswordCredentials,
  userAuthIdentities,
  userProfileAvatars,
  userProfiles,
  users,
  withTransaction,
} from '@schedule/database';
import { and, eq, isNull, sql } from 'drizzle-orm';

import { createPasswordSessionToken } from '../../adapters/auth/wechat-auth.js';
import { ApiError } from '../../plugins/error-handler.js';
import { AuditWriter } from '../audit/audit-writer.js';
import type { AuthenticatedIdentity } from '../../adapters/auth/auth-port.js';
import { WechatGatewayError, type WechatGateway } from '../wechat/wechat-gateway.js';
import { toWechatGatewayApiError } from '../wechat/wechat-errors.js';
import { toUserProfile } from '../users/user-profile.js';

const PASSWORD_HASH_ALGORITHM = 'scrypt';
const SCRYPT_COST = 16_384;
const SCRYPT_BLOCK_SIZE = 8;
const SCRYPT_PARALLELIZATION = 1;
const PASSWORD_HASH_KEY_LENGTH = 64;
const PASSWORD_HASH_SALT_LENGTH = 16;
const PASSWORD_HASH_MAX_MEMORY = 32 * 1024 * 1024;
const DEFAULT_INITIAL_PASSWORD = '123';

export interface PasswordAuthServiceOptions {
  readonly databaseClient: DatabaseClient;
  readonly gateway?: WechatGateway | undefined;
  readonly sessionSecret: string | undefined;
}

export class PasswordAuthService {
  private readonly auditWriter = new AuditWriter();
  private readonly databaseClient: DatabaseClient;
  private readonly gateway: WechatGateway | undefined;
  private readonly sessionSecret: string | undefined;

  public constructor(options: PasswordAuthServiceOptions) {
    this.databaseClient = options.databaseClient;
    this.gateway = options.gateway;
    this.sessionSecret = options.sessionSecret;
  }

  public async register(username: string, password: string): Promise<PasswordAuthResponse> {
    const normalizedUsername = normalizeUsername(username);
    const passwordHash = await hashPassword(password);
    const userId = randomUUID();

    try {
      await withTransaction(this.databaseClient, async (transaction) => {
        await transaction.insert(users).values({
          cloudbaseUid: `password_${userId}`,
          id: userId,
        });
        await transaction.insert(userPasswordCredentials).values({
          passwordHash,
          userId,
          username: normalizedUsername,
        });
        await this.auditWriter.append(transaction, {
          action: 'password_user_created',
          actorUserId: userId,
          metadata: { loginChannel: PASSWORD_HASH_ALGORITHM },
          operationId: randomUUID(),
          outcome: 'completed',
          targetId: userId,
          targetType: 'user',
        });
      });
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        throw duplicateUsernameError();
      }
      throw error;
    }

    return {
      isNewUser: true,
      mustChangePassword: isDefaultPassword(password),
      profile: undefined,
      token: createPasswordSessionToken(
        { authVersion: 1, sub: userId, username: normalizedUsername },
        this.sessionSecret,
      ),
    };
  }

  public async login(username: string, password: string): Promise<PasswordAuthResponse> {
    const normalizedUsername = normalizeUsername(username);
    const [credential] = await this.databaseClient.database
      .select({
        authVersion: users.authVersion,
        cloudbaseUid: users.cloudbaseUid,
        passwordHash: userPasswordCredentials.passwordHash,
        status: users.status,
        userId: users.id,
      })
      .from(userPasswordCredentials)
      .innerJoin(users, eq(users.id, userPasswordCredentials.userId))
      .where(eq(userPasswordCredentials.username, normalizedUsername))
      .limit(1);

    if (
      credential === undefined ||
      credential.cloudbaseUid === null ||
      credential.passwordHash === null ||
      credential.status !== 'active' ||
      !(await verifyPassword(password, credential.passwordHash))
    ) {
      throw invalidCredentialsError();
    }

    return {
      isNewUser: false,
      mustChangePassword: isDefaultPassword(password),
      profile: await this.findProfile(credential.userId),
      token: createPasswordSessionToken(
        {
          authVersion: credential.authVersion,
          sub: credential.userId,
          username: normalizedUsername,
        },
        this.sessionSecret,
      ),
    };
  }

  public async getStatus(identity: AuthenticatedIdentity): Promise<PasswordStatusResponse> {
    const [credential] = await this.databaseClient.database
      .select({ passwordHash: userPasswordCredentials.passwordHash })
      .from(userPasswordCredentials)
      .innerJoin(users, eq(users.id, userPasswordCredentials.userId))
      .where(
        and(
          eq(users.cloudbaseUid, identity.cloudbaseUid),
          eq(users.status, 'active'),
          isNull(users.deletedAt),
        ),
      )
      .limit(1);

    return credential === undefined || credential.passwordHash === null
      ? { hasPassword: false, mustChangePassword: false }
      : {
          hasPassword: true,
          mustChangePassword: await verifyPassword(
            DEFAULT_INITIAL_PASSWORD,
            credential.passwordHash,
          ),
        };
  }

  public async changePassword(
    identity: AuthenticatedIdentity,
    input: PasswordChangeRequest,
  ): Promise<PasswordChangeResponse> {
    return withTransaction(this.databaseClient, async (transaction) => {
      const [credential] = await transaction
        .select({
          passwordHash: userPasswordCredentials.passwordHash,
          userId: users.id,
        })
        .from(userPasswordCredentials)
        .innerJoin(users, eq(users.id, userPasswordCredentials.userId))
        .where(
          and(
            eq(users.cloudbaseUid, identity.cloudbaseUid),
            eq(users.status, 'active'),
            isNull(users.deletedAt),
          ),
        )
        .limit(1)
        .for('update');

      if (credential === undefined || credential.passwordHash === null) {
        throw passwordChangeUnavailableError();
      }
      if (!(await verifyPassword(input.currentPassword, credential.passwordHash))) {
        throw invalidCurrentPasswordError();
      }

      const passwordHash = await hashPassword(input.newPassword);
      await transaction
        .update(userPasswordCredentials)
        .set({ passwordHash })
        .where(eq(userPasswordCredentials.userId, credential.userId));
      await this.auditWriter.append(transaction, {
        action: 'password_changed',
        actorUserId: credential.userId,
        metadata: { loginChannel: PASSWORD_HASH_ALGORITHM },
        operationId: randomUUID(),
        outcome: 'completed',
        targetId: credential.userId,
        targetType: 'user',
      });

      return { passwordChanged: true };
    });
  }

  public async changePasswordWithProof(
    identity: AuthenticatedIdentity,
    input: PasswordProofChangeRequest,
  ): Promise<PasswordChangeResponse> {
    return withTransaction(this.databaseClient, async (transaction) => {
      const [credential] = await transaction
        .select({
          passwordHash: userPasswordCredentials.passwordHash,
          userId: users.id,
        })
        .from(userPasswordCredentials)
        .innerJoin(users, eq(users.id, userPasswordCredentials.userId))
        .where(
          and(
            eq(users.cloudbaseUid, identity.cloudbaseUid),
            eq(users.status, 'active'),
            isNull(users.deletedAt),
          ),
        )
        .limit(1)
        .for('update');
      if (credential === undefined) throw passwordChangeUnavailableError();

      if ('currentPassword' in input) {
        if (
          credential.passwordHash === null ||
          !(await verifyPassword(input.currentPassword, credential.passwordHash))
        ) {
          throw invalidCurrentPasswordError();
        }
      } else {
        await this.assertWechatCodeProof(transaction, credential.userId, input.code);
      }

      const passwordHash = await hashPassword(input.newPassword);
      await transaction
        .update(userPasswordCredentials)
        .set({ passwordHash })
        .where(eq(userPasswordCredentials.userId, credential.userId));
      await transaction
        .update(users)
        .set({
          authVersion: sql`${users.authVersion} + 1`,
          version: sql`${users.version} + 1`,
        })
        .where(eq(users.id, credential.userId));
      await this.auditWriter.append(transaction, {
        action: 'password_changed',
        actorUserId: credential.userId,
        metadata: {
          loginChannel: 'password_proof',
          proof: 'currentPassword' in input ? 'current_password' : 'wechat_code',
        },
        operationId: randomUUID(),
        outcome: 'completed',
        targetId: credential.userId,
        targetType: 'user',
      });
      return { passwordChanged: true };
    });
  }

  private async assertWechatCodeProof(
    transaction: DatabaseTransaction,
    userId: string,
    code: string,
  ): Promise<void> {
    if (this.gateway === undefined) throw passwordChangeUnavailableError();
    let exchanged;
    try {
      exchanged = await this.gateway.exchangeCode(code);
    } catch (error) {
      if (error instanceof WechatGatewayError) throw toWechatGatewayApiError(error);
      throw error;
    }
    const appId = this.gateway.appId;
    if (appId === undefined || appId.length === 0) throw passwordChangeUnavailableError();
    const [wechatIdentity] = await transaction
      .select({ userId: userAuthIdentities.userId })
      .from(userAuthIdentities)
      .where(
        and(
          eq(userAuthIdentities.provider, 'wechat_mini_program'),
          eq(userAuthIdentities.appId, appId),
          eq(userAuthIdentities.subject, exchanged.openid),
          eq(userAuthIdentities.userId, userId),
        ),
      )
      .limit(1)
      .for('update');
    if (wechatIdentity === undefined) throw invalidWechatCodeProofError();
  }

  private async findProfile(userId: string): Promise<PasswordAuthResponse['profile']> {
    const [profile] = await this.databaseClient.database
      .select({
        avatarVersion: userProfileAvatars.version,
        id: userProfiles.userId,
        realName: userProfiles.realName,
        version: userProfiles.version,
      })
      .from(userProfiles)
      .leftJoin(userProfileAvatars, eq(userProfileAvatars.userId, userProfiles.userId))
      .where(and(eq(userProfiles.userId, userId), isNull(userProfiles.deletedAt)))
      .limit(1);

    return profile === undefined ? undefined : toUserProfile(profile);
  }
}

export function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}

export function isDefaultPassword(password: string): boolean {
  return password === DEFAULT_INITIAL_PASSWORD;
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(PASSWORD_HASH_SALT_LENGTH);
  const derivedKey = await derivePasswordKey(password, salt);
  return [
    PASSWORD_HASH_ALGORITHM,
    SCRYPT_COST,
    SCRYPT_BLOCK_SIZE,
    SCRYPT_PARALLELIZATION,
    salt.toString('base64url'),
    derivedKey.toString('base64url'),
  ].join('$');
}

export async function verifyPassword(password: string, encodedHash: string): Promise<boolean> {
  const parts = encodedHash.split('$');
  if (parts.length !== 6 || parts[0] !== PASSWORD_HASH_ALGORITHM) {
    return false;
  }

  const [, cost, blockSize, parallelization, encodedSalt, encodedKey] = parts;
  const salt = decodeBase64Url(encodedSalt);
  const expectedKey = decodeBase64Url(encodedKey);
  if (
    salt === undefined ||
    expectedKey === undefined ||
    expectedKey.length !== PASSWORD_HASH_KEY_LENGTH ||
    !isPositiveInteger(cost) ||
    !isPositiveInteger(blockSize) ||
    !isPositiveInteger(parallelization)
  ) {
    return false;
  }

  try {
    const actualKey = await derivePasswordKey(password, salt, {
      N: Number(cost),
      p: Number(parallelization),
      r: Number(blockSize),
    });
    return actualKey.length === expectedKey.length && timingSafeEqual(actualKey, expectedKey);
  } catch {
    return false;
  }
}

async function derivePasswordKey(
  password: string,
  salt: Buffer,
  options: { readonly N?: number; readonly p?: number; readonly r?: number } = {},
): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    scryptCallback(
      password,
      salt,
      PASSWORD_HASH_KEY_LENGTH,
      {
        N: options.N ?? SCRYPT_COST,
        maxmem: PASSWORD_HASH_MAX_MEMORY,
        p: options.p ?? SCRYPT_PARALLELIZATION,
        r: options.r ?? SCRYPT_BLOCK_SIZE,
      },
      (error, derivedKey) => {
        if (error !== null) {
          reject(error);
          return;
        }
        resolve(derivedKey);
      },
    );
  });
}

function decodeBase64Url(value: string | undefined): Buffer | undefined {
  if (value === undefined || value.length === 0 || !/^[A-Za-z0-9_-]+$/u.test(value)) {
    return undefined;
  }
  try {
    return Buffer.from(value, 'base64url');
  } catch {
    return undefined;
  }
}

function isPositiveInteger(value: string | undefined): boolean {
  return value !== undefined && /^[1-9]\d*$/u.test(value) && Number.isSafeInteger(Number(value));
}

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === 'object' && error !== null && 'code' in error && error.code === 'ER_DUP_ENTRY'
  );
}

function duplicateUsernameError(): ApiError {
  return new ApiError({
    code: 'CONFLICT',
    statusCode: 409,
    userMessage: '该账号已存在，请换一个账号。',
  });
}

function invalidCredentialsError(): ApiError {
  return new ApiError({
    code: 'AUTHENTICATION_REQUIRED',
    statusCode: 401,
    userMessage: '账号或密码不正确，请重试。',
  });
}

function invalidCurrentPasswordError(): ApiError {
  return new ApiError({
    code: 'VALIDATION_FAILED',
    statusCode: 400,
    userMessage: '当前密码不正确，请重新输入。',
  });
}

function passwordChangeUnavailableError(): ApiError {
  return new ApiError({
    code: 'FORBIDDEN',
    statusCode: 403,
    userMessage: '当前登录方式不支持修改密码。',
  });
}

function invalidWechatCodeProofError(): ApiError {
  return new ApiError({
    code: 'AUTHENTICATION_REQUIRED',
    statusCode: 401,
    userMessage: '微信身份校验失败，请重新登录后重试。',
  });
}
