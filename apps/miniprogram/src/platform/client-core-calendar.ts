import {
  calendarReadEndpoints,
  calendarReadModelDecoder,
  createAuthenticationRequiredError,
  createCalendarReadClient,
  createGroupMobilePhoneConsentClient,
  createHttpClientError,
  createInvalidResponseError,
  createManualScheduleClient,
  createNetworkError,
  createPastScheduleClient,
  createSchedulePublicationClient,
  holidayReadModelDecoder,
  type CalendarReadClient,
  type ClientTransport,
  type GroupMobilePhoneConsentClient,
  type ManualScheduleClient,
  type PastScheduleClient,
  type SchedulePublicationClient,
} from '@schedule/client-core';
import type { ClientEndpoint } from '@schedule/client-core';
import {
  requireClientCapability,
  type ClientCapabilityRequirement,
} from '../app/client-capability-store.js';
import {
  executeWxJsonRequest,
  WxRequestNetworkError,
  WxRequestStaleSessionError,
  type WxJsonRequest,
  type WxJsonRequestOptions,
  type WxJsonRequestSuccess,
} from './wx-request-executor.js';

export type { WxJsonRequest, WxJsonRequestOptions, WxJsonRequestSuccess };

export interface RuntimeWechatRequestAuthentication {
  readonly awaitAccessToken: () => Promise<string | undefined>;
  readonly finalizeUnauthorized: (failedToken: string) => void;
  readonly getSessionGeneration: () => number;
  readonly recoverAccessToken: (failedToken: string) => Promise<string | undefined>;
}

type CapabilityResolver = (
  endpoint: ClientEndpoint<unknown, unknown>,
  input: unknown,
) => ClientCapabilityRequirement;

export function decodeCalendarReadPayload(value: unknown): unknown | undefined {
  const decoded = calendarReadModelDecoder.safeDecode(value);
  return decoded.success ? decoded.data : undefined;
}

export function decodeHolidayReadPayload(value: unknown): unknown | undefined {
  const decoded = holidayReadModelDecoder.safeDecode(value);
  return decoded.success ? decoded.data : undefined;
}

export function getCalendarReadPath(groupId: string, businessMonth: string): string {
  return calendarReadEndpoints.calendar.path({ businessMonth, groupId });
}

export function createWxJsonTransport(options: {
  readonly apiBaseUrl: string;
  readonly awaitAccessToken?: (() => Promise<string | undefined>) | undefined;
  readonly capability: ClientCapabilityRequirement | CapabilityResolver;
  readonly delay?: ((milliseconds: number) => Promise<void>) | undefined;
  readonly finalizeUnauthorized?: ((failedToken: string) => void) | undefined;
  readonly getSessionGeneration?: (() => number) | undefined;
  readonly getAccessToken: () => string | undefined;
  readonly recoverAccessToken?: ((failedToken: string) => Promise<string | undefined>) | undefined;
  readonly sessionGeneration?: (() => number) | undefined;
  readonly request: WxJsonRequest;
}): ClientTransport {
  const baseUrl = options.apiBaseUrl.replace(/\/$/u, '');
  return {
    async request(endpoint, input) {
      try {
        const idempotencyKey = endpoint.idempotencyKey?.(input);
        const body = endpoint.body?.(input);
        const path = endpoint.path(input);
        const capability =
          typeof options.capability === 'function'
            ? options.capability(endpoint as ClientEndpoint<unknown, unknown>, input)
            : options.capability;
        await requireClientCapability(capability);
        let accessToken = endpoint.auth === 'bearer' ? options.getAccessToken() : undefined;
        if (
          endpoint.auth === 'bearer' &&
          (accessToken === undefined || accessToken.length === 0) &&
          options.awaitAccessToken !== undefined
        ) {
          accessToken = await options.awaitAccessToken();
        }
        if (endpoint.auth === 'bearer' && (accessToken === undefined || accessToken.length === 0)) {
          throw createAuthenticationRequiredError();
        }
        const response = await executeWxJsonRequest({
          ...(accessToken === undefined
            ? {}
            : {
                authentication: {
                  accessToken,
                  ...(options.finalizeUnauthorized === undefined
                    ? {}
                    : { finalizeUnauthorized: options.finalizeUnauthorized }),
                  ...(options.getSessionGeneration === undefined
                    ? {}
                    : { getSessionGeneration: options.getSessionGeneration }),
                  ...(options.recoverAccessToken === undefined
                    ? {}
                    : { recoverAccessToken: options.recoverAccessToken }),
                  ...(options.sessionGeneration === undefined
                    ? {}
                    : { sessionGeneration: options.sessionGeneration() }),
                },
              }),
          capability,
          ...(body === undefined ? {} : { data: body }),
          ...(options.delay === undefined ? {} : { delay: options.delay }),
          ...(idempotencyKey === undefined ? {} : { idempotencyKey }),
          method: endpoint.method,
          request: options.request,
          url: `${baseUrl}${path}`,
        });
        if (response.statusCode < 200 || response.statusCode >= 300) {
          throw createHttpClientError(response.statusCode, response.data);
        }
        const decoded = endpoint.decoder.safeDecode(response.data);
        if (!decoded.success) throw createInvalidResponseError(response.statusCode);
        return decoded.data;
      } catch (error) {
        if (error instanceof WxRequestNetworkError) throw createNetworkError();
        if (error instanceof WxRequestStaleSessionError) throw createAuthenticationRequiredError();
        if (error instanceof Error) throw error;
        throw createNetworkError();
      }
    },
  };
}

function createRuntimeWxJsonTransport(
  getAccessToken: () => string | undefined,
  authentication?: RuntimeWechatRequestAuthentication,
  capability: ClientCapabilityRequirement | CapabilityResolver = 'core',
): ClientTransport {
  return createWxJsonTransport({
    apiBaseUrl: __MINIPROGRAM_API_BASE_URL__,
    capability,
    ...(authentication === undefined
      ? {}
      : {
          awaitAccessToken: authentication.awaitAccessToken,
          finalizeUnauthorized: authentication.finalizeUnauthorized,
          getSessionGeneration: authentication.getSessionGeneration,
          recoverAccessToken: authentication.recoverAccessToken,
          sessionGeneration: authentication.getSessionGeneration,
        }),
    getAccessToken,
    request: (requestOptions) => wx.request(requestOptions),
  });
}

export function createRuntimeManualScheduleClient(
  getAccessToken: () => string | undefined,
  authentication?: RuntimeWechatRequestAuthentication,
): ManualScheduleClient {
  return createManualScheduleClient(createRuntimeWxJsonTransport(getAccessToken, authentication));
}

export function createRuntimeGroupMobilePhoneConsentClient(
  getAccessToken: () => string | undefined,
  authentication?: RuntimeWechatRequestAuthentication,
): GroupMobilePhoneConsentClient {
  return createGroupMobilePhoneConsentClient(
    createRuntimeWxJsonTransport(getAccessToken, authentication, resolvePhoneConsentCapability),
  );
}

export function createRuntimeSchedulePublicationClient(
  getAccessToken: () => string | undefined,
  authentication?: RuntimeWechatRequestAuthentication,
): SchedulePublicationClient {
  return createSchedulePublicationClient(
    createRuntimeWxJsonTransport(getAccessToken, authentication),
  );
}

export function createRuntimePastScheduleClient(
  getAccessToken: () => string | undefined,
  authentication?: RuntimeWechatRequestAuthentication,
): PastScheduleClient {
  return createPastScheduleClient(createRuntimeWxJsonTransport(getAccessToken, authentication));
}

export function createRuntimeCalendarReadClient(
  getAccessToken: () => string | undefined,
  authentication?: RuntimeWechatRequestAuthentication,
): CalendarReadClient {
  return createCalendarReadClient(createRuntimeWxJsonTransport(getAccessToken, authentication));
}

function resolvePhoneConsentCapability(
  endpoint: ClientEndpoint<unknown, unknown>,
  input: unknown,
): ClientCapabilityRequirement {
  if (endpoint.id === 'group-mobile-phone-consent.status') return 'bypass';
  if (
    endpoint.id === 'group-mobile-phone-consent.update' &&
    isRecord(input) &&
    isRecord(input['request']) &&
    input['request']['consented'] === false
  ) {
    return 'bypass';
  }
  return 'core';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
