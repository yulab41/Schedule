import type {
  CreateSwapRequestInput,
  SwapPairInput,
  SwapRequestMutationInput,
  UpdateGroupSwapSettingsInput,
  UpdateMemberSwapSettingsInput,
} from '@schedule/contracts';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';

import { ApiError } from '../../plugins/error-handler.js';
import { SwapService } from './swap-service.js';

const groupIdSchema = z.string().uuid();
const swapRequestIdSchema = z.string().uuid();
const operationIdSchema = z.string().uuid();
const uuidSchema = z.string().uuid();
const versionSchema = z.number().int().min(1);

const swapPairInputSchema = z
  .object({
    initiatorAssignmentId: uuidSchema,
    targetAssignmentId: uuidSchema,
    targetMembershipId: uuidSchema,
  })
  .strict();

const createSwapInputSchema = swapPairInputSchema
  .extend({
    operationId: operationIdSchema,
  })
  .strict();

const mutationInputSchema = z
  .object({
    expectedVersion: versionSchema,
    operationId: operationIdSchema,
  })
  .strict();

const updateGroupSettingsSchema = z
  .object({
    requiresApproval: z.boolean(),
  })
  .strict();

const updateMySettingsSchema = z
  .object({
    autoAcceptSwaps: z.boolean(),
  })
  .strict();

export function registerSwapRoutes(app: FastifyInstance, swapService: SwapService): void {
  app.post('/groups/:groupId/swaps/preview', { preHandler: app.authenticate }, (request) =>
    swapService.preview(
      getAuthenticatedIdentity(request),
      parseGroupId(request),
      parseSwapPairInput(request.body),
    ),
  );

  app.post('/groups/:groupId/swaps', { preHandler: app.authenticate }, (request, reply) =>
    swapService
      .create(
        getAuthenticatedIdentity(request),
        parseGroupId(request),
        parseCreateInput(request.body),
      )
      .then((swapRequest) => reply.code(201).send(swapRequest)),
  );

  app.get('/groups/:groupId/swaps', { preHandler: app.authenticate }, (request) =>
    swapService.listMine(getAuthenticatedIdentity(request), parseGroupId(request)),
  );

  app.get('/groups/:groupId/swaps/approvals', { preHandler: app.authenticate }, (request) =>
    swapService.listApprovals(getAuthenticatedIdentity(request), parseGroupId(request)),
  );

  app.post(
    '/groups/:groupId/swaps/:swapRequestId/accept',
    { preHandler: app.authenticate },
    (request) =>
      swapService.accept(
        getAuthenticatedIdentity(request),
        parseGroupId(request),
        parseSwapRequestId(request),
        parseMutationInput(request.body),
      ),
  );

  app.post(
    '/groups/:groupId/swaps/:swapRequestId/approve',
    { preHandler: app.authenticate },
    (request) =>
      swapService.approve(
        getAuthenticatedIdentity(request),
        parseGroupId(request),
        parseSwapRequestId(request),
        parseMutationInput(request.body),
      ),
  );

  app.post(
    '/groups/:groupId/swaps/:swapRequestId/reject',
    { preHandler: app.authenticate },
    (request) =>
      swapService.reject(
        getAuthenticatedIdentity(request),
        parseGroupId(request),
        parseSwapRequestId(request),
        parseMutationInput(request.body),
      ),
  );

  app.post(
    '/groups/:groupId/swaps/:swapRequestId/cancel',
    { preHandler: app.authenticate },
    (request) =>
      swapService.cancel(
        getAuthenticatedIdentity(request),
        parseGroupId(request),
        parseSwapRequestId(request),
        parseMutationInput(request.body),
      ),
  );

  app.get('/groups/:groupId/swaps/settings', { preHandler: app.authenticate }, (request) =>
    swapService.getGroupSettings(getAuthenticatedIdentity(request), parseGroupId(request)),
  );

  app.put('/groups/:groupId/swaps/settings', { preHandler: app.authenticate }, (request) =>
    swapService.updateGroupSettings(
      getAuthenticatedIdentity(request),
      parseGroupId(request),
      parseUpdateGroupSettingsInput(request.body),
    ),
  );

  app.get('/groups/:groupId/swaps/my-settings', { preHandler: app.authenticate }, (request) =>
    swapService.getMySettings(getAuthenticatedIdentity(request), parseGroupId(request)),
  );

  app.put('/groups/:groupId/swaps/my-settings', { preHandler: app.authenticate }, (request) =>
    swapService.updateMySettings(
      getAuthenticatedIdentity(request),
      parseGroupId(request),
      parseUpdateMySettingsInput(request.body),
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
  return parseOrThrow(groupIdSchema, (request.params as { groupId?: unknown }).groupId);
}

function parseSwapRequestId(request: FastifyRequest): string {
  return parseOrThrow(
    swapRequestIdSchema,
    (request.params as { swapRequestId?: unknown }).swapRequestId,
  );
}

function parseSwapPairInput(value: unknown): SwapPairInput {
  return parseOrThrow(swapPairInputSchema, value);
}

function parseCreateInput(value: unknown): CreateSwapRequestInput {
  return parseOrThrow(createSwapInputSchema, value);
}

function parseMutationInput(value: unknown): SwapRequestMutationInput {
  return parseOrThrow(mutationInputSchema, value);
}

function parseUpdateGroupSettingsInput(value: unknown): UpdateGroupSwapSettingsInput {
  return parseOrThrow(updateGroupSettingsSchema, value);
}

function parseUpdateMySettingsInput(value: unknown): UpdateMemberSwapSettingsInput {
  return parseOrThrow(updateMySettingsSchema, value);
}

function parseOrThrow<Output>(schema: z.ZodType<Output>, value: unknown): Output {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new ApiError({
      code: 'VALIDATION_FAILED',
      statusCode: 400,
      userMessage: '请求数据不符合要求。',
    });
  }

  return result.data;
}
