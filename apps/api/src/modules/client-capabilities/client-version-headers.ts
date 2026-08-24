import {
  CLIENT_PLATFORM_HEADER_NAME,
  CLIENT_VERSION_HEADER_NAME,
  clientPlatformSchema,
  clientVersionSchema,
  type ClientVersion,
} from '@schedule/contracts';
import type { FastifyRequest } from 'fastify';

import { ApiError } from '../../plugins/error-handler.js';
import type { ClientCapabilityPolicy } from './client-capability-policy.js';

export function resolveMiniClientVersion(
  request: FastifyRequest,
  policy: ClientCapabilityPolicy,
): ClientVersion | undefined {
  const rawPlatformHeader = request.headers[CLIENT_PLATFORM_HEADER_NAME];
  const rawVersionHeader = request.headers[CLIENT_VERSION_HEADER_NAME];

  if (rawPlatformHeader === undefined && rawVersionHeader === undefined) {
    return undefined;
  }
  if (rawPlatformHeader === undefined || rawVersionHeader === undefined) {
    throw invalidClientHeadersError();
  }
  const platformHeader = readSingleHeader(rawPlatformHeader);
  const versionHeader = readSingleHeader(rawVersionHeader);
  if (platformHeader === undefined || versionHeader === undefined) {
    throw invalidClientHeadersError();
  }

  const platform = clientPlatformSchema.safeParse(platformHeader);
  const version = clientVersionSchema.safeParse(versionHeader);
  if (!platform.success || !version.success) {
    throw invalidClientHeadersError();
  }
  if (policy.resolve(platform.data, version.data) === undefined) {
    throw unsupportedClientVersionError();
  }
  return version.data;
}

export function resolveRequiredMiniClientVersion(
  request: FastifyRequest,
  policy: ClientCapabilityPolicy,
): ClientVersion {
  const version = resolveMiniClientVersion(request, policy);
  if (version === undefined) throw invalidClientHeadersError();
  return version;
}

function readSingleHeader(value: string | readonly string[] | undefined): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function invalidClientHeadersError(): ApiError {
  return new ApiError({
    code: 'VALIDATION_FAILED',
    statusCode: 400,
    userMessage: '客户端平台与版本标识不符合要求。',
  });
}

export function unsupportedClientVersionError(): ApiError {
  return new ApiError({
    code: 'CLIENT_VERSION_UNSUPPORTED',
    statusCode: 426,
    userMessage: '当前客户端版本不受支持，请更新后重试。',
  });
}
