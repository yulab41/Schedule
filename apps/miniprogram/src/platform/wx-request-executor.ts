import {
  requireClientCapability,
  type ClientCapabilityRequirement,
} from '../app/client-capability-store.js';
import { buildInfo } from './build-info.js';

export interface WxJsonRequestSuccess {
  readonly data: unknown;
  readonly statusCode: number;
}

export interface WxJsonRequestOptions {
  readonly data?: unknown;
  readonly fail: (error: unknown) => void;
  readonly header: Readonly<Record<string, string>>;
  readonly method: 'DELETE' | 'GET' | 'POST' | 'PUT';
  readonly success: (response: WxJsonRequestSuccess) => void;
  readonly timeout: number;
  readonly url: string;
}

export type WxJsonRequest = (options: WxJsonRequestOptions) => unknown;

export class WxRequestNetworkError extends Error {
  public constructor() {
    super('The Mini Program request bridge failed.');
    this.name = 'WxRequestNetworkError';
  }
}

export class WxRequestStaleSessionError extends Error {
  public constructor() {
    super('The response belongs to an obsolete Mini Program session.');
    this.name = 'WxRequestStaleSessionError';
  }
}

export interface WxRequestAuthenticationPolicy {
  readonly accessToken: string;
  readonly finalizeUnauthorized?: ((failedToken: string) => void) | undefined;
  readonly getSessionGeneration?: (() => number) | undefined;
  readonly isAuthenticationRequired?: ((response: WxJsonRequestSuccess) => boolean) | undefined;
  readonly recoverAccessToken?: ((failedToken: string) => Promise<string | undefined>) | undefined;
  readonly sessionGeneration?: number | undefined;
}

export interface ExecuteWxJsonRequestInput {
  readonly authentication?: WxRequestAuthenticationPolicy | undefined;
  readonly capability: ClientCapabilityRequirement;
  readonly data?: unknown;
  readonly delay?: ((milliseconds: number) => Promise<void>) | undefined;
  readonly header?: Readonly<Record<string, string>> | undefined;
  readonly idempotencyKey?: string | undefined;
  readonly method: WxJsonRequestOptions['method'];
  readonly request: WxJsonRequest;
  readonly timeout?: number | undefined;
  readonly url: string;
}

const transientStatuses = new Set([502, 503, 504]);
const retryDelays = [200, 400] as const;

export async function executeWxJsonRequest(
  input: ExecuteWxJsonRequestInput,
): Promise<WxJsonRequestSuccess> {
  const canRetry =
    input.method === 'GET' ||
    (typeof input.idempotencyKey === 'string' && input.idempotencyKey.length > 0);
  const delay = input.delay ?? wait;
  let accessToken = input.authentication?.accessToken;
  let authenticationReplayUsed = false;
  let retryCount = 0;
  let sessionGeneration = input.authentication?.sessionGeneration;

  for (;;) {
    await requireClientCapability(input.capability);
    let response: WxJsonRequestSuccess;
    try {
      response = await requestOnce(input, accessToken);
    } catch (error) {
      if (
        !(error instanceof WxRequestNetworkError) ||
        !canRetry ||
        retryCount >= retryDelays.length
      ) {
        throw error;
      }
      await delay(getRetryDelay(retryCount));
      retryCount += 1;
      continue;
    }

    if (
      accessToken !== undefined &&
      (input.authentication?.isAuthenticationRequired ?? isBearerAuthenticationRequired)(response)
    ) {
      if (!authenticationReplayUsed && input.authentication?.recoverAccessToken !== undefined) {
        authenticationReplayUsed = true;
        const recoveredToken = await input.authentication.recoverAccessToken(accessToken);
        if (recoveredToken !== undefined && recoveredToken.length > 0) {
          accessToken = recoveredToken;
          sessionGeneration = input.authentication.getSessionGeneration?.();
          continue;
        }
      }
      input.authentication?.finalizeUnauthorized?.(accessToken);
      return response;
    }

    if (
      sessionGeneration !== undefined &&
      input.authentication?.getSessionGeneration !== undefined &&
      input.authentication.getSessionGeneration() !== sessionGeneration
    ) {
      throw new WxRequestStaleSessionError();
    }

    if (transientStatuses.has(response.statusCode) && canRetry && retryCount < retryDelays.length) {
      await delay(getRetryDelay(retryCount));
      retryCount += 1;
      continue;
    }
    return response;
  }
}

export function isBearerAuthenticationRequired(response: WxJsonRequestSuccess): boolean {
  if (response.statusCode !== 401) return false;
  if (!isRecord(response.data)) return true;
  const error = isRecord(response.data['error']) ? response.data['error'] : response.data;
  const code = isRecord(error) ? error['code'] : undefined;
  return code === undefined || code === 'AUTHENTICATION_REQUIRED';
}

function requestOnce(
  input: ExecuteWxJsonRequestInput,
  accessToken: string | undefined,
): Promise<WxJsonRequestSuccess> {
  return new Promise((resolve, reject) => {
    const header = {
      ...(input.header ?? {}),
      'X-Schedule-Client-Platform': 'miniprogram',
      'X-Schedule-Client-Version': buildInfo.buildVersion,
      ...(accessToken === undefined ? {} : { Authorization: `Bearer ${accessToken}` }),
      ...(typeof input.idempotencyKey !== 'string' || input.idempotencyKey.length === 0
        ? {}
        : { 'Idempotency-Key': input.idempotencyKey }),
    };
    const requestOptions: WxJsonRequestOptions = {
      ...(input.data === undefined ? {} : { data: input.data }),
      fail: () => reject(new WxRequestNetworkError()),
      header,
      method: input.method,
      success: resolve,
      timeout: input.timeout ?? 12_000,
      url: input.url,
    };
    try {
      input.request(requestOptions);
    } catch {
      reject(new WxRequestNetworkError());
    }
  });
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function getRetryDelay(retryCount: number): number {
  return retryCount === 0 ? 200 : 400;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
