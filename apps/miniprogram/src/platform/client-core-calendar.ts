import {
  calendarReadEndpoints,
  calendarReadModelDecoder,
  createAuthenticationRequiredError,
  createCalendarReadClient,
  createHttpClientError,
  createInvalidResponseError,
  createManualScheduleClient,
  createNetworkError,
  createSchedulePublicationClient,
  holidayReadModelDecoder,
  type CalendarReadClient,
  type ClientTransport,
  type ManualScheduleClient,
  type SchedulePublicationClient,
} from '@schedule/client-core';

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
  readonly url: string;
}

export type WxJsonRequest = (options: WxJsonRequestOptions) => unknown;

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
  readonly getAccessToken: () => string | undefined;
  readonly request: WxJsonRequest;
}): ClientTransport {
  const baseUrl = options.apiBaseUrl.replace(/\/$/u, '');
  return {
    request(endpoint, input) {
      return new Promise((resolve, reject) => {
        const accessToken = endpoint.auth === 'bearer' ? options.getAccessToken() : undefined;
        if (endpoint.auth === 'bearer' && (accessToken === undefined || accessToken.length === 0)) {
          reject(createAuthenticationRequiredError());
          return;
        }

        try {
          const idempotencyKey = endpoint.idempotencyKey?.(input);
          const body = endpoint.body?.(input);
          const header = {
            ...(accessToken === undefined ? {} : { Authorization: `Bearer ${accessToken}` }),
            ...(idempotencyKey === undefined ? {} : { 'Idempotency-Key': idempotencyKey }),
          };
          const requestOptions: WxJsonRequestOptions = {
            ...(body === undefined ? {} : { data: body }),
            fail: () => reject(createNetworkError()),
            header,
            method: endpoint.method,
            success: (response) => {
              if (response.statusCode < 200 || response.statusCode >= 300) {
                reject(createHttpClientError(response.statusCode, response.data));
                return;
              }
              const decoded = endpoint.decoder.safeDecode(response.data);
              if (!decoded.success) {
                reject(createInvalidResponseError(response.statusCode));
                return;
              }
              resolve(decoded.data);
            },
            url: `${baseUrl}${endpoint.path(input)}`,
          };
          options.request(requestOptions);
        } catch {
          reject(createNetworkError());
        }
      });
    },
  };
}

export function createRuntimeManualScheduleClient(
  getAccessToken: () => string | undefined,
): ManualScheduleClient {
  return createManualScheduleClient(
    createWxJsonTransport({
      apiBaseUrl: __MINIPROGRAM_API_BASE_URL__,
      getAccessToken,
      request: (requestOptions) => wx.request(requestOptions),
    }),
  );
}

export function createRuntimeSchedulePublicationClient(
  getAccessToken: () => string | undefined,
): SchedulePublicationClient {
  return createSchedulePublicationClient(
    createWxJsonTransport({
      apiBaseUrl: __MINIPROGRAM_API_BASE_URL__,
      getAccessToken,
      request: (requestOptions) => wx.request(requestOptions),
    }),
  );
}

export function createRuntimeCalendarReadClient(
  getAccessToken: () => string | undefined,
): CalendarReadClient {
  return createCalendarReadClient(
    createWxJsonTransport({
      apiBaseUrl: __MINIPROGRAM_API_BASE_URL__,
      getAccessToken,
      request: (requestOptions) => wx.request(requestOptions),
    }),
  );
}
