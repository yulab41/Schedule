import type { CreateUserProfileRequest, UpdateUserProfileRequest } from '@schedule/contracts';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';

import { ApiError } from '../../plugins/error-handler.js';
import { UserService } from './user-service.js';

const realNameSchema = z.string().trim().min(1).max(100);

const createProfileInputSchema = z
  .object({
    realName: realNameSchema,
  })
  .strict();

const updateProfileInputSchema = z
  .object({
    realName: realNameSchema,
    version: z.number().int().min(1),
  })
  .strict();

export function registerUserRoutes(app: FastifyInstance, userService: UserService): void {
  app.post('/users', { preHandler: app.authenticate }, async (request, reply) => {
    const profile = await userService.register(
      getAuthenticatedIdentity(request),
      parseCreateProfileInput(request.body),
    );

    return reply.code(201).send(profile);
  });

  app.get('/users/me', { preHandler: app.authenticate }, async (request) =>
    userService.getCurrentProfile(getAuthenticatedIdentity(request)),
  );

  app.patch('/users/me', { preHandler: app.authenticate }, async (request) =>
    userService.updateCurrentProfile(
      getAuthenticatedIdentity(request),
      parseUpdateProfileInput(request.body),
    ),
  );

  app.post('/users/me/deregister', { preHandler: app.authenticate }, async (request) =>
    userService.deregisterOwnAccount(getAuthenticatedIdentity(request)),
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

function parseCreateProfileInput(value: unknown): CreateUserProfileRequest {
  const result = createProfileInputSchema.safeParse(value);

  if (!result.success) {
    throwValidationError();
  }

  return result.data;
}

function parseUpdateProfileInput(value: unknown): UpdateUserProfileRequest {
  const result = updateProfileInputSchema.safeParse(value);

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
