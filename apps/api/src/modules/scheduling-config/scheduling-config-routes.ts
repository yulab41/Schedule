import type {
  CreateScheduleRoleRequest,
  CreateShiftTypeRequest,
  ReorderRotationMembersRequest,
  ReplaceScheduleRoleMembersRequest,
  UpdateRotationRuleRequest,
  UpdateShiftTypeRequest,
} from '@schedule/contracts';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';

import { ApiError } from '../../plugins/error-handler.js';
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

const createRoleInputSchema = z.object({ name: roleNameSchema }).strict();
const replaceRoleMembersInputSchema = z
  .object({ membershipIds: z.array(membershipIdSchema).max(500) })
  .strict()
  .refine((input) => new Set(input.membershipIds).size === input.membershipIds.length);
const reorderRotationMembersInputSchema = z
  .object({
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
  })
  .strict();
const rotationRuleInputSchema = z
  .object({
    currentPosition: z.number().int().min(1).max(500),
    defaultShiftTypeId: shiftTypeIdSchema,
    requiredMembersPerDay: z.number().int().min(1).max(100),
    startDate: dateSchema.nullable().optional(),
    startingMemberScheduleRoleId: z.string().uuid().nullable().optional(),
  })
  .strict();
const shiftTypeInputSchema = z
  .object({
    abbreviation: abbreviationSchema,
    color: colorSchema,
    countsTowardStatistics: z.boolean(),
    crossesMidnight: z.boolean(),
    endTime: timeSchema.nullable().optional(),
    isEnabled: z.boolean(),
    name: shiftNameSchema,
    startTime: timeSchema.nullable().optional(),
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
        parseCreateRoleInput(request.body),
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
        parseReplaceRoleMembersInput(request.body),
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
        parseReorderRotationMembersInput(request.body),
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
        parseRotationRuleInput(request.body),
      ),
  );

  app.delete(
    '/groups/:groupId/schedule-roles/:roleId',
    { preHandler: app.authenticate },
    (request) =>
      schedulingConfigService.deleteRole(
        getAuthenticatedIdentity(request),
        parseGroupId(request),
        parseRoleId(request),
      ),
  );

  app.post('/groups/:groupId/shift-types', { preHandler: app.authenticate }, (request, reply) =>
    schedulingConfigService
      .createShiftType(
        getAuthenticatedIdentity(request),
        parseGroupId(request),
        parseShiftTypeInput(request.body),
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
        parseShiftTypeInput(request.body),
      ),
  );

  app.delete(
    '/groups/:groupId/shift-types/:shiftTypeId',
    { preHandler: app.authenticate },
    (request) =>
      schedulingConfigService.deleteShiftType(
        getAuthenticatedIdentity(request),
        parseGroupId(request),
        parseShiftTypeId(request),
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

function parseRoleId(request: FastifyRequest): string {
  return parseOrThrow(roleIdSchema, (request.params as { roleId?: unknown }).roleId);
}

function parseShiftTypeId(request: FastifyRequest): string {
  return parseOrThrow(shiftTypeIdSchema, (request.params as { shiftTypeId?: unknown }).shiftTypeId);
}

function parseCreateRoleInput(value: unknown): CreateScheduleRoleRequest {
  return parseOrThrow(createRoleInputSchema, value);
}

function parseReplaceRoleMembersInput(value: unknown): ReplaceScheduleRoleMembersRequest {
  return parseOrThrow(replaceRoleMembersInputSchema, value);
}

function parseReorderRotationMembersInput(value: unknown): ReorderRotationMembersRequest {
  return parseOrThrow(reorderRotationMembersInputSchema, value);
}

function parseRotationRuleInput(value: unknown): UpdateRotationRuleRequest {
  const input = parseOrThrow(rotationRuleInputSchema, value);
  return {
    currentPosition: input.currentPosition,
    defaultShiftTypeId: input.defaultShiftTypeId,
    requiredMembersPerDay: input.requiredMembersPerDay,
    ...(input.startDate === undefined ? {} : { startDate: input.startDate }),
    ...(input.startingMemberScheduleRoleId === undefined
      ? {}
      : { startingMemberScheduleRoleId: input.startingMemberScheduleRoleId }),
  };
}

function parseShiftTypeInput(value: unknown): CreateShiftTypeRequest | UpdateShiftTypeRequest {
  const input = parseOrThrow(shiftTypeInputSchema, value);
  return {
    abbreviation: input.abbreviation,
    color: input.color,
    countsTowardStatistics: input.countsTowardStatistics,
    crossesMidnight: input.crossesMidnight,
    isEnabled: input.isEnabled,
    name: input.name,
    ...(input.endTime === undefined ? {} : { endTime: input.endTime }),
    ...(input.startTime === undefined ? {} : { startTime: input.startTime }),
  };
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
