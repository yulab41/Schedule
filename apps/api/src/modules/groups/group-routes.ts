import type {
  AddRosterEntriesRequest,
  ClaimGroupRequest,
  CreateGroupRequest,
  RegenerateGroupCodeRequest,
} from '@schedule/contracts';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';

import { ApiError } from '../../plugins/error-handler.js';
import { GroupService } from './group-service.js';

const groupCodeSchema = z.string().regex(/^\d{4}$/);
const groupIdSchema = z.string().uuid();
const groupNameSchema = z.string().trim().min(1).max(100);
const realNameSchema = z.string().trim().min(1).max(100);

const createGroupInputSchema = z
  .object({
    groupCode: groupCodeSchema.optional(),
    name: groupNameSchema,
  })
  .strict();

const rosterEntriesInputSchema = z
  .object({
    realNames: z.array(realNameSchema).min(1).max(500),
  })
  .strict();

const claimGroupInputSchema = z
  .object({
    groupCode: groupCodeSchema,
  })
  .strict();

const regenerateGroupCodeInputSchema = z
  .object({
    groupCode: groupCodeSchema.optional(),
  })
  .strict();

export function registerGroupRoutes(app: FastifyInstance, groupService: GroupService): void {
  app.post('/groups', { preHandler: app.authenticate }, async (request, reply) => {
    const group = await groupService.create(
      getAuthenticatedIdentity(request),
      parseCreateGroupInput(request.body),
    );

    return reply.code(201).send(group);
  });

  app.post('/groups/claim', { preHandler: app.authenticate }, async (request, reply) => {
    const result = await groupService.claim(
      getAuthenticatedIdentity(request),
      parseClaimGroupInput(request.body),
    );

    return reply.code(result.status === 'claimed' ? 201 : 202).send(result);
  });

  app.post('/groups/:groupId/roster-entries', { preHandler: app.authenticate }, async (request) =>
    groupService.addRosterEntries(
      getAuthenticatedIdentity(request),
      parseGroupId(request),
      parseRosterEntriesInput(request.body),
    ),
  );

  app.put('/groups/:groupId/group-code', { preHandler: app.authenticate }, async (request) =>
    groupService.regenerateCode(
      getAuthenticatedIdentity(request),
      parseGroupId(request),
      parseRegenerateGroupCodeInput(request.body),
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

function parseCreateGroupInput(value: unknown): CreateGroupRequest {
  const result = createGroupInputSchema.safeParse(value);
  if (!result.success) {
    throwValidationError();
  }

  return result.data.groupCode === undefined
    ? { name: result.data.name }
    : { groupCode: result.data.groupCode, name: result.data.name };
}

function parseRosterEntriesInput(value: unknown): AddRosterEntriesRequest {
  const result = rosterEntriesInputSchema.safeParse(value);
  if (!result.success) {
    throwValidationError();
  }

  return result.data;
}

function parseClaimGroupInput(value: unknown): ClaimGroupRequest {
  const result = claimGroupInputSchema.safeParse(value);
  if (!result.success) {
    throwValidationError();
  }

  return result.data;
}

function parseRegenerateGroupCodeInput(value: unknown): RegenerateGroupCodeRequest {
  const result = regenerateGroupCodeInputSchema.safeParse(value);
  if (!result.success) {
    throwValidationError();
  }

  return result.data.groupCode === undefined ? {} : { groupCode: result.data.groupCode };
}

function parseGroupId(request: FastifyRequest): string {
  const result = groupIdSchema.safeParse((request.params as { groupId?: unknown }).groupId);
  if (!result.success) {
    throwValidationError();
  }

  return result.data;
}

function throwValidationError(): never {
  throw new ApiError({
    code: 'VALIDATION_FAILED',
    statusCode: 400,
    userMessage: '请求数据不符合要求。',
  });
}
