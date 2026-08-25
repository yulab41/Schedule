import {
  acceptInviteRequestSchema,
  createInviteLinkRequestSchema,
  resolveInviteRequestSchema,
  revokeInviteRequestSchema,
} from '@schedule/contracts';
import type {
  AcceptInviteRequest,
  CreateInviteLinkRequest,
  RevokeInviteRequest,
} from '@schedule/contracts';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';

import { ApiError } from '../../plugins/error-handler.js';
import { resolveDangerousOperationId } from '../../plugins/operation-id.js';
import type { InviteService } from './invite-service.js';

const groupIdSchema = z.string().uuid();
const tokenSchema = z.string().min(1).max(200);

export function registerInviteRoutes(app: FastifyInstance, inviteService: InviteService): void {
  app.post(
    '/groups/:groupId/invite-links',
    { preHandler: app.authenticate },
    async (request, reply) => {
      const input = parseCreateInviteLink(request);
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
    inviteService.accept(getAuthenticatedIdentity(request), parseAcceptInvite(request)),
  );

  app.post(
    '/groups/:groupId/invite-links/:token/revoke',
    { preHandler: app.authenticate },
    async (request, reply) => {
      await inviteService.revoke(
        getAuthenticatedIdentity(request),
        parseGroupId(request),
        parseRevokeToken(request),
        parseRevokeInvite(request),
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

function parseCreateInviteLink(request: FastifyRequest): CreateInviteLinkRequest {
  return parseDangerousContractBody(request, createInviteLinkRequestSchema);
}

function parseResolveToken(value: unknown): string {
  const result = resolveInviteRequestSchema.safeParse(value);
  if (!result.success) {
    throwValidationError();
  }
  return result.data.token;
}

function parseAcceptInvite(request: FastifyRequest): AcceptInviteRequest {
  return parseDangerousContractBody(request, acceptInviteRequestSchema);
}

function parseRevokeInvite(request: FastifyRequest): RevokeInviteRequest {
  return parseDangerousContractBody(request, revokeInviteRequestSchema);
}

function parseDangerousContractBody<Output extends { readonly operationId: string }>(
  request: FastifyRequest,
  schema: z.ZodType<Output>,
): Output {
  const body =
    typeof request.body === 'object' && request.body !== null && !Array.isArray(request.body)
      ? (request.body as Readonly<Record<string, unknown>>)
      : {};
  const result = schema.safeParse({
    ...body,
    operationId: resolveDangerousOperationId(
      request.headers['idempotency-key'],
      body['operationId'] as string | undefined,
    ),
  });
  if (!result.success) throwValidationError();
  return result.data;
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
