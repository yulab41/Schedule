import {
  directoryEntryLookupRequestSchema,
  directoryQuerySchema,
  type DirectoryEntryLookupRequest,
  type DirectoryQuery as DirectoryQueryInput,
} from '@schedule/contracts';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';

import { ApiError } from '../../plugins/error-handler.js';
import { DirectoryQuery } from './directory-query.js';
import {
  createDirectoryListTimingOptions,
  getDirectoryServerTimingTrace,
} from './directory-server-timing.js';

const groupIdSchema = z.string().uuid();

export function registerDirectoryRoutes(
  app: FastifyInstance,
  directoryQuery: DirectoryQuery,
): void {
  app.get('/groups/:groupId/directory/facets', { preHandler: app.authenticate }, (request) =>
    directoryQuery.facets(getAuthenticatedIdentity(request), parseGroupId(request)),
  );
  app.get('/groups/:groupId/directory', createDirectoryListTimingOptions(app), async (request) =>
    directoryQuery.list(
      getAuthenticatedIdentity(request),
      parseGroupId(request),
      parseDirectoryQuery(request.query),
      'internal',
      getDirectoryServerTimingTrace(request),
      (directoryQueryPlan) => {
        request.log.info(
          { directoryQueryPlan, event: 'directory_query_plan_selected' },
          'Directory query plan selected.',
        );
      },
    ),
  );
  app.post('/groups/:groupId/directory/lookup', { preHandler: app.authenticate }, (request) =>
    directoryQuery.lookup(
      getAuthenticatedIdentity(request),
      parseGroupId(request),
      parseDirectoryLookupRequest(request.body).entryIds,
    ),
  );

  app.get(
    '/groups/:groupId/employee-directory/facets',
    { preHandler: app.authenticate },
    (request) =>
      directoryQuery.facets(getAuthenticatedIdentity(request), parseGroupId(request), 'employee'),
  );
  app.get(
    '/groups/:groupId/employee-directory',
    createDirectoryListTimingOptions(app),
    async (request) =>
      directoryQuery.list(
        getAuthenticatedIdentity(request),
        parseGroupId(request),
        parseDirectoryQuery(request.query),
        'employee',
        getDirectoryServerTimingTrace(request),
        (directoryQueryPlan) => {
          request.log.info(
            { directoryQueryPlan, event: 'directory_query_plan_selected' },
            'Directory query plan selected.',
          );
        },
      ),
  );
  app.post(
    '/groups/:groupId/employee-directory/lookup',
    { preHandler: app.authenticate },
    (request) =>
      directoryQuery.lookup(
        getAuthenticatedIdentity(request),
        parseGroupId(request),
        parseDirectoryLookupRequest(request.body).entryIds,
        'employee',
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

function parseDirectoryLookupRequest(value: unknown): DirectoryEntryLookupRequest {
  const result = directoryEntryLookupRequestSchema.safeParse(value);
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
