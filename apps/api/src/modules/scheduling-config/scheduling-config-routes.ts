import type {
  CreateScheduleRoleRequest,
  CreateShiftTypeRequest,
  ReorderRotationMembersRequest,
  ReplaceScheduleRoleMembersRequest,
  ScheduleRoleVersionMutationRequest,
  ShiftTypeVersionMutationRequest,
  UpdateRotationRuleRequest,
  UpdateShiftTypeRequest,
} from '@schedule/contracts';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';

import { ApiError } from '../../plugins/error-handler.js';
import { resolveDangerousOperationId } from '../../plugins/operation-id.js';
import { SchedulingConfigService } from './scheduling-config-service.js';

const groupIdSchema = z.string().uuid();
const membershipIdSchema = z.string().uuid();
const roleIdSchema = z.string().uuid();
const shiftTypeIdSchema = z.string().uuid();
const roleNameSchema = z.string().trim().min(1).max(100);
const shiftNameSchema = z.string().trim().min(1).max(100);
const abbreviationSchema = z.string().trim().min(1).max(16);
const colorSchema = z.string().regex(/^#[\dA-F]{6}$/iu);
const timeSchema = z.string().regex(/^\d{2}:\d{2}$/);
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const operationIdSchema = z.string().uuid().optional();
const versionSchema = z.number().int().min(1);

const createRoleInputSchema = z
  .object({
    expectedRulesVersion: versionSchema,
    name: roleNameSchema,
    operationId: operationIdSchema,
  })
  .strict();
const replaceRoleMembersInputSchema = z
  .object({
    expectedRoleVersion: versionSchema,
    expectedRotationRuleVersion: versionSchema,
    expectedRulesVersion: versionSchema,
    membershipIds: z.array(membershipIdSchema).max(500),
    operationId: operationIdSchema,
  })
  .strict()
  .refine((input) => new Set(input.membershipIds).size === input.membershipIds.length);
const reorderRotationMembersInputSchema = z
  .object({
    expectedRoleVersion: versionSchema,
    expectedRotationRuleVersion: versionSchema,
    expectedRulesVersion: versionSchema,
    members: z
      .array(
        z
          .object({
            position: z.number().int().min(1).max(500),
            scheduleRoleMemberId: z.string().uuid(),
          })
          .strict(),
      )
      .max(500),
    operationId: operationIdSchema,
  })
  .strict();
const rotationRuleInputSchema = z
  .object({
    currentPosition: z.number().int().min(1).max(500),
    defaultShiftTypeId: shiftTypeIdSchema,
    expectedRoleVersion: versionSchema,
    expectedRotationRuleVersion: versionSchema,
    expectedRulesVersion: versionSchema,
    operationId: operationIdSchema,
    requiredMembersPerDay: z.number().int().min(1).max(100),
    startDate: dateSchema.nullable().optional(),
    startingMemberScheduleRoleId: z.string().uuid().nullable().optional(),
  })
  .strict();
const shiftTypeInputShape = {
  abbreviation: abbreviationSchema,
  color: colorSchema,
  countsTowardStatistics: z.boolean(),
  crossesMidnight: z.boolean(),
  endTime: timeSchema.nullable().optional(),
  isEnabled: z.boolean(),
  name: shiftNameSchema,
  startTime: timeSchema.nullable().optional(),
} as const;
const createShiftTypeInputSchema = z
  .object({
    ...shiftTypeInputShape,
    expectedRulesVersion: versionSchema,
    operationId: operationIdSchema,
  })
  .strict();
const updateShiftTypeInputSchema = z
  .object({
    ...shiftTypeInputShape,
    expectedRulesVersion: versionSchema,
    expectedVersion: versionSchema,
    operationId: operationIdSchema,
  })
  .strict();
const entityVersionMutationInputSchema = z
  .object({
    expectedRulesVersion: versionSchema,
    expectedVersion: versionSchema,
    operationId: operationIdSchema,
  })
  .strict();

export function registerSchedulingConfigRoutes(
  app: FastifyInstance,
  schedulingConfigService: SchedulingConfigService,
): void {
  app.get('/groups/:groupId/scheduling-config', { preHandler: app.authenticate }, (request) =>
    schedulingConfigService.getConfig(getAuthenticatedIdentity(request), parseGroupId(request)),
  );

  app.post('/groups/:groupId/schedule-roles', { preHandler: app.authenticate }, (request, reply) =>
    schedulingConfigService
      .createRole(
        getAuthenticatedIdentity(request),
        parseGroupId(request),
        parseCreateRoleInput(request),
      )
      .then((role) => reply.code(201).send(role)),
  );

  app.put(
    '/groups/:groupId/schedule-roles/:roleId/members',
    { preHandler: app.authenticate },
    (request) =>
      schedulingConfigService.replaceRoleMembers(
        getAuthenticatedIdentity(request),
        parseGroupId(request),
        parseRoleId(request),
        parseReplaceRoleMembersInput(request),
      ),
  );

  app.put(
    '/groups/:groupId/schedule-roles/:roleId/rotation-members',
    { preHandler: app.authenticate },
    (request) =>
      schedulingConfigService.reorderRotationMembers(
        getAuthenticatedIdentity(request),
        parseGroupId(request),
        parseRoleId(request),
        parseReorderRotationMembersInput(request),
      ),
  );

  app.put(
    '/groups/:groupId/schedule-roles/:roleId/rotation-rule',
    { preHandler: app.authenticate },
    (request) =>
      schedulingConfigService.updateRotationRule(
        getAuthenticatedIdentity(request),
        parseGroupId(request),
        parseRoleId(request),
        parseRotationRuleInput(request),
      ),
  );

  app.delete(
    '/groups/:groupId/schedule-roles/:roleId',
    { preHandler: app.authenticate },
    async (request) => {
      await schedulingConfigService.deleteRole(
        getAuthenticatedIdentity(request),
        parseGroupId(request),
        parseRoleId(request),
        parseScheduleRoleVersionMutationInput(request),
      );
    },
  );

  app.post('/groups/:groupId/shift-types', { preHandler: app.authenticate }, (request, reply) =>
    schedulingConfigService
      .createShiftType(
        getAuthenticatedIdentity(request),
        parseGroupId(request),
        parseCreateShiftTypeInput(request),
      )
      .then((shiftType) => reply.code(201).send(shiftType)),
  );

  app.put(
    '/groups/:groupId/shift-types/:shiftTypeId',
    { preHandler: app.authenticate },
    (request) =>
      schedulingConfigService.updateShiftType(
        getAuthenticatedIdentity(request),
        parseGroupId(request),
        parseShiftTypeId(request),
        parseUpdateShiftTypeInput(request),
      ),
  );

  app.delete(
    '/groups/:groupId/shift-types/:shiftTypeId',
    { preHandler: app.authenticate },
    async (request) => {
      await schedulingConfigService.deleteShiftType(
        getAuthenticatedIdentity(request),
        parseGroupId(request),
        parseShiftTypeId(request),
        parseShiftTypeVersionMutationInput(request),
      );
    },
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

function parseRoleId(request: FastifyRequest): string {
  return parseOrThrow(roleIdSchema, (request.params as { roleId?: unknown }).roleId);
}

function parseShiftTypeId(request: FastifyRequest): string {
  return parseOrThrow(shiftTypeIdSchema, (request.params as { shiftTypeId?: unknown }).shiftTypeId);
}

function parseCreateRoleInput(request: FastifyRequest): CreateScheduleRoleRequest {
  return parseDangerousBody(request, createRoleInputSchema) as CreateScheduleRoleRequest;
}

function parseReplaceRoleMembersInput(request: FastifyRequest): ReplaceScheduleRoleMembersRequest {
  return parseDangerousBody(
    request,
    replaceRoleMembersInputSchema,
  ) as ReplaceScheduleRoleMembersRequest;
}

function parseReorderRotationMembersInput(request: FastifyRequest): ReorderRotationMembersRequest {
  return parseDangerousBody(
    request,
    reorderRotationMembersInputSchema,
  ) as ReorderRotationMembersRequest;
}

function parseRotationRuleInput(request: FastifyRequest): UpdateRotationRuleRequest {
  const input = parseDangerousBody(request, rotationRuleInputSchema);
  return {
    currentPosition: input.currentPosition,
    defaultShiftTypeId: input.defaultShiftTypeId,
    expectedRoleVersion: input.expectedRoleVersion,
    expectedRotationRuleVersion: input.expectedRotationRuleVersion,
    expectedRulesVersion: input.expectedRulesVersion,
    operationId: input.operationId,
    requiredMembersPerDay: input.requiredMembersPerDay,
    ...(input.startDate === undefined ? {} : { startDate: input.startDate }),
    ...(input.startingMemberScheduleRoleId === undefined
      ? {}
      : { startingMemberScheduleRoleId: input.startingMemberScheduleRoleId }),
  };
}

function parseCreateShiftTypeInput(request: FastifyRequest): CreateShiftTypeRequest {
  return parseShiftTypeInput(
    parseDangerousBody(request, createShiftTypeInputSchema),
  ) as CreateShiftTypeRequest;
}

function parseUpdateShiftTypeInput(request: FastifyRequest): UpdateShiftTypeRequest {
  return parseShiftTypeInput(
    parseDangerousBody(request, updateShiftTypeInputSchema),
  ) as UpdateShiftTypeRequest;
}

function parseShiftTypeInput<
  Input extends {
    readonly expectedRulesVersion: number;
    readonly expectedVersion?: number | undefined;
    readonly operationId: string;
  },
>(
  input: Input & z.infer<typeof createShiftTypeInputSchema>,
): CreateShiftTypeRequest | UpdateShiftTypeRequest {
  return {
    abbreviation: input.abbreviation,
    color: input.color,
    countsTowardStatistics: input.countsTowardStatistics,
    crossesMidnight: input.crossesMidnight,
    expectedRulesVersion: input.expectedRulesVersion,
    ...(input.expectedVersion === undefined ? {} : { expectedVersion: input.expectedVersion }),
    isEnabled: input.isEnabled,
    name: input.name,
    operationId: input.operationId,
    ...(input.endTime === undefined ? {} : { endTime: input.endTime }),
    ...(input.startTime === undefined ? {} : { startTime: input.startTime }),
  };
}

function parseScheduleRoleVersionMutationInput(
  request: FastifyRequest,
): ScheduleRoleVersionMutationRequest {
  return parseDangerousBody(
    request,
    entityVersionMutationInputSchema,
  ) as ScheduleRoleVersionMutationRequest;
}

function parseShiftTypeVersionMutationInput(
  request: FastifyRequest,
): ShiftTypeVersionMutationRequest {
  return parseDangerousBody(
    request,
    entityVersionMutationInputSchema,
  ) as ShiftTypeVersionMutationRequest;
}

function parseDangerousBody<Parsed extends { readonly operationId?: string | undefined }>(
  request: FastifyRequest,
  schema: z.ZodType<Parsed>,
): Parsed & { readonly operationId: string } {
  const result = schema.safeParse(request.body ?? {});
  if (!result.success) throwValidationError();
  return {
    ...result.data,
    operationId: resolveDangerousOperationId(
      request.headers['idempotency-key'],
      result.data.operationId,
    ),
  };
}

function throwValidationError(): never {
  throw new ApiError({
    code: 'VALIDATION_FAILED',
    statusCode: 400,
    userMessage: '请求数据不符合要求。',
  });
}

function parseOrThrow<Output>(schema: z.ZodType<Output>, value: unknown): Output {
  const result = schema.safeParse(value);
  if (!result.success) {
    throwValidationError();
  }

  return result.data;
}
