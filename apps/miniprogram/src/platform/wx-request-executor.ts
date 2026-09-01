import {
  requireClientCapability,
  type ClientCapabilityRequirement,
} from '../app/client-capability-store.js';
import { buildInfo } from './build-info.js';
import { recordRuntimeDiagnosticRequest } from './runtime-diagnostics-bridge.js';
import type { RuntimeRequestDiagnosticObserver } from './runtime-diagnostics-types.js';

export interface WxJsonRequestSuccess {
  readonly data: unknown;
  readonly header?: Readonly<Record<string, unknown>> | undefined;
  readonly profile?: unknown;
  readonly statusCode: number;
}

export interface WxJsonRequestOptions {
  readonly data?: unknown;
  readonly enableProfile?: boolean;
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
  readonly diagnosticPreflight?:
    | {
        readonly capabilityWaitMs: number;
        readonly contextWaitMs: number;
      }
    | undefined;
  readonly diagnosticProfileEnabled?: boolean | undefined;
  readonly diagnosticObserver?: RuntimeRequestDiagnosticObserver | undefined;
  readonly diagnosticEndpoint?: string | undefined;
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
  const diagnosticStartedAt = Date.now();
  const canRetry =
    input.method === 'GET' ||
    (typeof input.idempotencyKey === 'string' && input.idempotencyKey.length > 0);
  const delay = input.delay ?? wait;
  let accessToken = input.authentication?.accessToken;
  let authenticationReplayUsed = false;
  let retryCount = 0;
  let sessionGeneration = input.authentication?.sessionGeneration;
  let diagnosticStatusCode: number | undefined;
  let diagnosticIssuedAt: number | undefined;
  const captureNetworkProfile = input.diagnosticProfileEnabled === true;

  try {
    for (;;) {
      await requireClientCapability(input.capability);
      let response: WxJsonRequestSuccess;
      try {
        response = await requestOnce(input, accessToken, captureNetworkProfile, (issuedAt) => {
          diagnosticIssuedAt ??= issuedAt;
        });
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
      diagnosticStatusCode = response.statusCode;

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
        recordCompletedDiagnosticRequest(
          input,
          diagnosticStartedAt,
          diagnosticIssuedAt,
          response,
          retryCount,
        );
        return response;
      }

      if (
        sessionGeneration !== undefined &&
        input.authentication?.getSessionGeneration !== undefined &&
        input.authentication.getSessionGeneration() !== sessionGeneration
      ) {
        throw new WxRequestStaleSessionError();
      }

      if (
        transientStatuses.has(response.statusCode) &&
        canRetry &&
        retryCount < retryDelays.length
      ) {
        await delay(getRetryDelay(retryCount));
        retryCount += 1;
        continue;
      }
      recordCompletedDiagnosticRequest(
        input,
        diagnosticStartedAt,
        diagnosticIssuedAt,
        response,
        retryCount,
      );
      return response;
    }
  } catch (error) {
    recordRuntimeDiagnosticRequest({
      ...(input.diagnosticPreflight === undefined
        ? {}
        : {
            capabilityWaitMs: input.diagnosticPreflight.capabilityWaitMs,
            contextWaitMs: input.diagnosticPreflight.contextWaitMs,
          }),
      completedAt: Date.now(),
      durationMs: Date.now() - diagnosticStartedAt,
      endpoint: input.diagnosticEndpoint ?? 'unknown',
      method: input.method,
      ...(diagnosticIssuedAt === undefined ? {} : { issuedAt: diagnosticIssuedAt }),
      ...(captureNetworkProfile ? { networkProfile: { supported: false } } : {}),
      outcome: 'failed',
      profileEnabled: captureNetworkProfile,
      retryCount,
      startedAt: diagnosticStartedAt,
      ...(diagnosticStatusCode === undefined ? {} : { statusCode: diagnosticStatusCode }),
    });
    throw error;
  }
}

function recordCompletedDiagnosticRequest(
  input: ExecuteWxJsonRequestInput,
  startedAt: number,
  issuedAt: number | undefined,
  response: WxJsonRequestSuccess,
  retryCount: number,
): void {
  const observation =
    input.diagnosticProfileEnabled === true
      ? input.diagnosticObserver?.observe({
          requestProfile: response.profile,
          responseHeader: response.header,
        })
      : undefined;
  recordRuntimeDiagnosticRequest({
    ...(input.diagnosticPreflight === undefined
      ? {}
      : {
          capabilityWaitMs: input.diagnosticPreflight.capabilityWaitMs,
          contextWaitMs: input.diagnosticPreflight.contextWaitMs,
        }),
    completedAt: Date.now(),
    durationMs: Date.now() - startedAt,
    endpoint: input.diagnosticEndpoint ?? 'unknown',
    method: input.method,
    ...(issuedAt === undefined ? {} : { issuedAt }),
    ...(observation?.networkProfile === undefined
      ? {}
      : { networkProfile: observation.networkProfile }),
    outcome: response.statusCode >= 200 && response.statusCode < 400 ? 'success' : 'http-error',
    profileEnabled: input.diagnosticProfileEnabled === true,
    ...(observation?.requestId === undefined ? {} : { requestId: observation.requestId }),
    retryCount,
    ...(observation?.serverTiming === undefined ? {} : { serverTiming: observation.serverTiming }),
    startedAt,
    statusCode: response.statusCode,
  });
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
  captureNetworkProfile: boolean,
  onIssued: (issuedAt: number) => void,
): Promise<WxJsonRequestSuccess> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const settleFailure = (): void => {
      if (settled) return;
      settled = true;
      if (timer !== undefined) clearTimeout(timer);
      reject(new WxRequestNetworkError());
    };
    const settleSuccess = (response: WxJsonRequestSuccess): void => {
      if (settled) return;
      settled = true;
      if (timer !== undefined) clearTimeout(timer);
      resolve(response);
    };
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
      ...(captureNetworkProfile ? { enableProfile: true } : {}),
      fail: settleFailure,
      header,
      method: input.method,
      success: settleSuccess,
      timeout: input.timeout ?? 12_000,
      url: input.url,
    };
    const timer = setTimeout(settleFailure, input.timeout ?? 12_000);
    try {
      onIssued(Date.now());
      input.request(requestOptions);
    } catch {
      settleFailure();
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
