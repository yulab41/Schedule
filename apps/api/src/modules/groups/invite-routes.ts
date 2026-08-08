import {
  acceptInviteRequestSchema,
  createInviteLinkRequestSchema,
  resolveInviteRequestSchema,
} from '@schedule/contracts';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';

import { ApiError } from '../../plugins/error-handler.js';
import type { InviteService } from './invite-service.js';

const groupIdSchema = z.string().uuid();
const tokenSchema = z.string().min(1).max(200);

export function registerInviteRoutes(app: FastifyInstance, inviteService: InviteService): void {
  app.post(
    '/groups/:groupId/invite-links',
    { preHandler: app.authenticate },
    async (request, reply) => {
      const input = parseCreateInviteLink(request.body);
      return reply
        .code(201)
        .send(
          await inviteService.createLink(
            getAuthenticatedIdentity(request),
            parseGroupId(request),
            input,
          ),
        );
    },
  );

  app.post('/invites/resolve', { preHandler: app.authenticate }, (request) =>
    inviteService.resolve(getAuthenticatedIdentity(request), parseResolveToken(request.body)),
  );

  app.post('/invites/accept', { preHandler: app.authenticate }, (request) =>
    inviteService.accept(
      getAuthenticatedIdentity(request),
      parseAcceptToken(request.body),
      parseConfirmRealName(request.body),
    ),
  );

  app.post(
    '/groups/:groupId/invite-links/:token/revoke',
    { preHandler: app.authenticate },
    async (request, reply) => {
      await inviteService.revoke(
        getAuthenticatedIdentity(request),
        parseGroupId(request),
        parseRevokeToken(request),
      );
      return reply.code(204).send();
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

function parseRevokeToken(request: FastifyRequest): string {
  return parseOrThrow(tokenSchema, (request.params as { token?: unknown }).token);
}

function parseCreateInviteLink(value: unknown) {
  const result = createInviteLinkRequestSchema.safeParse(value);
  if (!result.success) {
    throwValidationError();
  }
  return {
    ...(result.data.permissionRole === undefined
      ? {}
      : { permissionRole: result.data.permissionRole }),
    ...(result.data.scheduleRoleId === undefined
      ? {}
      : { scheduleRoleId: result.data.scheduleRoleId }),
    ...(result.data.targetMembershipId === undefined
      ? {}
      : { targetMembershipId: result.data.targetMembershipId }),
    ...(result.data.targetRosterEntryId === undefined
      ? {}
      : { targetRosterEntryId: result.data.targetRosterEntryId }),
  };
}

function parseResolveToken(value: unknown): string {
  const result = resolveInviteRequestSchema.safeParse(value);
  if (!result.success) {
    throwValidationError();
  }
  return result.data.token;
}

function parseAcceptToken(value: unknown): string {
  const result = acceptInviteRequestSchema.safeParse(value);
  if (!result.success) {
    throwValidationError();
  }
  return result.data.token;
}

function parseConfirmRealName(value: unknown): string {
  const result = acceptInviteRequestSchema.safeParse(value);
  if (!result.success) {
    throwValidationError();
  }
  return result.data.confirmRealName;
}

function parseOrThrow<Output>(schema: z.ZodType<Output>, value: unknown): Output {
  const result = schema.safeParse(value);
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
