import type { OutgoingHttpHeaders } from 'node:http';

import type { FastifyInstance, InjectOptions } from 'fastify';

import { createCloudbaseRuntimeApp } from './runtime.js';

export interface CloudbaseHttpEvent {
  readonly body?: string;
  readonly headers?: Readonly<Record<string, string | undefined>>;
  readonly httpMethod?: NonNullable<InjectOptions['method']>;
  readonly isBase64Encoded?: boolean;
  readonly path?: string;
  readonly queryStringParameters?: Readonly<Record<string, string | undefined>>;
}

export interface CloudbaseHttpResponse {
  readonly body: string;
  readonly headers: Readonly<Record<string, string | string[]>>;
  readonly isBase64Encoded: false;
  readonly statusCode: number;
}

/**
 * Path prefix used by the CloudBase HTTP access service for the same-domain
 * `/api` route. The gateway may pass the full path (with this prefix) or the
 * remainder after the trigger path, so the handler accepts both forms.
 */
export const cloudbaseApiPathPrefix = '/api';

export function createCloudbaseHandler(app?: FastifyInstance) {
  let runtimeApp = app;

  return async (event: CloudbaseHttpEvent): Promise<CloudbaseHttpResponse> => {
    const request: InjectOptions = {
      method: event.httpMethod ?? 'GET',
      url: getUrl(event),
    };
    const headers = getHeaders(event.headers);
    const payload = getPayload(event);

    if (headers !== undefined) {
      request.headers = headers;
    }

    if (payload !== undefined) {
      request.payload = payload;
    }

    runtimeApp ??= createCloudbaseRuntimeApp();
    const response = await runtimeApp.inject(request);

    return {
      body: response.body,
      headers: getResponseHeaders(response.headers),
      isBase64Encoded: false,
      statusCode: response.statusCode,
    };
  };
}

export const handler = createCloudbaseHandler();

export function normalizeCloudbasePath(path: string): string {
  if (path === cloudbaseApiPathPrefix) {
    return '/';
  }

  return path.startsWith(`${cloudbaseApiPathPrefix}/`)
    ? path.slice(cloudbaseApiPathPrefix.length)
    : path;
}

function getHeaders(headers: CloudbaseHttpEvent['headers']): Record<string, string> | undefined {
  if (headers === undefined) {
    return undefined;
  }

  return Object.fromEntries(
    Object.entries(headers).filter((entry): entry is [string, string] => entry[1] !== undefined),
  );
}

function getPayload(event: CloudbaseHttpEvent): Buffer | string | undefined {
  if (event.body === undefined) {
    return undefined;
  }

  return event.isBase64Encoded ? Buffer.from(event.body, 'base64') : event.body;
}

function getResponseHeaders(headers: OutgoingHttpHeaders): Record<string, string | string[]> {
  return Object.fromEntries(
    Object.entries(headers)
      .filter((entry): entry is [string, number | string | string[]] => entry[1] !== undefined)
      .map(([name, value]) => [name, Array.isArray(value) ? value : String(value)]),
  );
}

function getUrl(event: CloudbaseHttpEvent): string {
  const url = new URL(normalizeCloudbasePath(event.path ?? '/'), 'http://cloudbase.local');

  for (const [name, value] of Object.entries(event.queryStringParameters ?? {})) {
    if (value !== undefined) {
      url.searchParams.set(name, value);
    }
  }

  return `${url.pathname}${url.search}`;
}
