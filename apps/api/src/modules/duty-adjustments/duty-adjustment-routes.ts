import type {
  CreateDirectDutyAdjustmentInput,
  CreateDutyAdjustmentRequestInput,
  DutyAdjustmentMutationInput,
  DutyAdjustmentPairInput,
  RevokeDutyAdjustmentInput,
  UpdateGroupDutyAdjustmentSettingsInput,
} from '@schedule/contracts';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';

import { ApiError } from '../../plugins/error-handler.js';
import { DutyAdjustmentService } from './duty-adjustment-service.js';

const groupIdSchema = z.string().uuid();
const dutyAdjustmentIdSchema = z.string().uuid();
const operationIdSchema = z.string().uuid();
const uuidSchema = z.string().uuid();
const versionSchema = z.number().int().min(1);
const reasonSchema = z.string().min(1).max(1000);

const pairInputSchema = z
  .object({
    coveredAssignmentId: uuidSchema,
    overtimeMembershipId: uuidSchema,
  })
  .strict();

const createInputSchema = pairInputSchema
  .extend({
    operationId: operationIdSchema,
    reason: reasonSchema.optional(),
  })
  .strict();

const directCreateInputSchema = pairInputSchema
  .extend({
    operationId: operationIdSchema,
    reason: reasonSchema.optional(),
  })
  .strict();

const mutationInputSchema = z
  .object({
    expectedVersion: versionSchema,
    operationId: operationIdSchema,
  })
  .strict();

const revokeInputSchema = z
  .object({
    expectedVersion: versionSchema,
    operationId: operationIdSchema,
    reason: reasonSchema.optional(),
  })
  .strict();

const updateGroupSettingsSchema = z
  .object({
    requiresApproval: z.boolean(),
  })
  .strict();

export function registerDutyAdjustmentRoutes(
  app: FastifyInstance,
  dutyAdjustmentService: DutyAdjustmentService,
): void {
  app.post(
    '/groups/:groupId/duty-adjustments/preview',
    { preHandler: app.authenticate },
    (request) =>
      dutyAdjustmentService.preview(
        getAuthenticatedIdentity(request),
        parseGroupId(request),
        parsePairInput(request.body),
      ),
  );

  app.post(
    '/groups/:groupId/duty-adjustments',
    { preHandler: app.authenticate },
    (request, reply) =>
      dutyAdjustmentService
        .create(
          getAuthenticatedIdentity(request),
          parseGroupId(request),
          parseCreateInput(request.body),
        )
        .then((dutyAdjustment) => reply.code(201).send(dutyAdjustment)),
  );

  app.post(
    '/groups/:groupId/duty-adjustments/direct',
    { preHandler: app.authenticate },
    (request, reply) =>
      dutyAdjustmentService
        .createDirect(
          getAuthenticatedIdentity(request),
          parseGroupId(request),
          parseDirectCreateInput(request.body),
        )
        .then((dutyAdjustment) => reply.code(201).send(dutyAdjustment)),
  );

  app.get('/groups/:groupId/duty-adjustments', { preHandler: app.authenticate }, (request) =>
    dutyAdjustmentService.listMine(getAuthenticatedIdentity(request), parseGroupId(request)),
  );

  app.get(
    '/groups/:groupId/duty-adjustments/approvals',
    { preHandler: app.authenticate },
    (request) =>
      dutyAdjustmentService.listApprovals(getAuthenticatedIdentity(request), parseGroupId(request)),
  );

  app.post(
    '/groups/:groupId/duty-adjustments/:dutyAdjustmentId/accept',
    { preHandler: app.authenticate },
    (request) =>
      dutyAdjustmentService.accept(
        getAuthenticatedIdentity(request),
        parseGroupId(request),
        parseDutyAdjustmentId(request),
        parseMutationInput(request.body),
      ),
  );

  app.post(
    '/groups/:groupId/duty-adjustments/:dutyAdjustmentId/approve',
    { preHandler: app.authenticate },
    (request) =>
      dutyAdjustmentService.approve(
        getAuthenticatedIdentity(request),
        parseGroupId(request),
        parseDutyAdjustmentId(request),
        parseMutationInput(request.body),
      ),
  );

  app.post(
    '/groups/:groupId/duty-adjustments/:dutyAdjustmentId/reject',
    { preHandler: app.authenticate },
    (request) =>
      dutyAdjustmentService.reject(
        getAuthenticatedIdentity(request),
        parseGroupId(request),
        parseDutyAdjustmentId(request),
        parseMutationInput(request.body),
      ),
  );

  app.post(
    '/groups/:groupId/duty-adjustments/:dutyAdjustmentId/cancel',
    { preHandler: app.authenticate },
    (request) =>
      dutyAdjustmentService.cancel(
        getAuthenticatedIdentity(request),
        parseGroupId(request),
        parseDutyAdjustmentId(request),
        parseMutationInput(request.body),
      ),
  );

  app.post(
    '/groups/:groupId/duty-adjustments/:dutyAdjustmentId/revoke',
    { preHandler: app.authenticate },
    (request) =>
      dutyAdjustmentService.revoke(
        getAuthenticatedIdentity(request),
        parseGroupId(request),
        parseDutyAdjustmentId(request),
        parseRevokeInput(request.body),
      ),
  );

  app.get(
    '/groups/:groupId/duty-adjustments/settings',
    { preHandler: app.authenticate },
    (request) =>
      dutyAdjustmentService.getGroupSettings(
        getAuthenticatedIdentity(request),
        parseGroupId(request),
      ),
  );

  app.put(
    '/groups/:groupId/duty-adjustments/settings',
    { preHandler: app.authenticate },
    (request) =>
      dutyAdjustmentService.updateGroupSettings(
        getAuthenticatedIdentity(request),
        parseGroupId(request),
        parseUpdateGroupSettingsInput(request.body),
      ),
  );

  app.get(
    '/groups/:groupId/duty-adjustments/my-settings',
    { preHandler: app.authenticate },
    (request) =>
      dutyAdjustmentService.getMySettings(getAuthenticatedIdentity(request), parseGroupId(request)),
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

function parseDutyAdjustmentId(request: FastifyRequest): string {
  return parseOrThrow(
    dutyAdjustmentIdSchema,
    (request.params as { dutyAdjustmentId?: unknown }).dutyAdjustmentId,
  );
}

function parsePairInput(value: unknown): DutyAdjustmentPairInput {
  return parseOrThrow(pairInputSchema, value);
}

function parseCreateInput(value: unknown): CreateDutyAdjustmentRequestInput {
  const parsed = parseOrThrow(createInputSchema, value);
  return parsed.reason === undefined
    ? {
        coveredAssignmentId: parsed.coveredAssignmentId,
        operationId: parsed.operationId,
        overtimeMembershipId: parsed.overtimeMembershipId,
      }
    : {
        coveredAssignmentId: parsed.coveredAssignmentId,
        operationId: parsed.operationId,
        overtimeMembershipId: parsed.overtimeMembershipId,
        reason: parsed.reason,
      };
}

function parseDirectCreateInput(value: unknown): CreateDirectDutyAdjustmentInput {
  const parsed = parseOrThrow(directCreateInputSchema, value);
  return parsed.reason === undefined
    ? {
        coveredAssignmentId: parsed.coveredAssignmentId,
        operationId: parsed.operationId,
        overtimeMembershipId: parsed.overtimeMembershipId,
      }
    : {
        coveredAssignmentId: parsed.coveredAssignmentId,
        operationId: parsed.operationId,
        overtimeMembershipId: parsed.overtimeMembershipId,
        reason: parsed.reason,
      };
}

function parseMutationInput(value: unknown): DutyAdjustmentMutationInput {
  return parseOrThrow(mutationInputSchema, value);
}

function parseRevokeInput(value: unknown): RevokeDutyAdjustmentInput {
  const parsed = parseOrThrow(revokeInputSchema, value);
  return parsed.reason === undefined
    ? {
        expectedVersion: parsed.expectedVersion,
        operationId: parsed.operationId,
      }
    : {
        expectedVersion: parsed.expectedVersion,
        operationId: parsed.operationId,
        reason: parsed.reason,
      };
}

function parseUpdateGroupSettingsInput(value: unknown): UpdateGroupDutyAdjustmentSettingsInput {
  return parseOrThrow(updateGroupSettingsSchema, value);
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
