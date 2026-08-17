import {
  directoryQuerySchema,
  type DirectoryQuery as DirectoryQueryInput,
} from '@schedule/contracts';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';

import { ApiError } from '../../plugins/error-handler.js';
import { DirectoryQuery } from './directory-query.js';

const groupIdSchema = z.string().uuid();

export function registerDirectoryRoutes(
  app: FastifyInstance,
  directoryQuery: DirectoryQuery,
): void {
  app.get('/groups/:groupId/directory/facets', { preHandler: app.authenticate }, (request) =>
    directoryQuery.facets(getAuthenticatedIdentity(request), parseGroupId(request)),
  );
  app.get('/groups/:groupId/directory', { preHandler: app.authenticate }, (request) =>
    directoryQuery.list(
      getAuthenticatedIdentity(request),
      parseGroupId(request),
      parseDirectoryQuery(request.query),
    ),
  );
}

function getAuthenticatedIdentity(request: FastifyRequest) {
  if (request.authenticatedIdentity === null) {
    throw new ApiError({
      code: 'AUTHENTICATION_REQUIRED',
      statusCode: 401,
      userMessage: '需要先登录后才能继续。',
    });
  }
  return request.authenticatedIdentity;
}

function parseGroupId(request: FastifyRequest): string {
  const result = groupIdSchema.safeParse((request.params as { groupId?: unknown }).groupId);
  if (!result.success) throwValidationError();
  return result.data;
}

function parseDirectoryQuery(value: unknown): DirectoryQueryInput {
  const result = directoryQuerySchema.safeParse(value);
  if (!result.success) throwValidationError();
  return result.data;
}

function throwValidationError(): never {
  throw new ApiError({
    code: 'VALIDATION_FAILED',
    statusCode: 400,
    userMessage: '通讯录检索条件不符合要求。',
  });
}
