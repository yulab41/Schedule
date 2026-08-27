import type { CreateUserProfileRequest, UpdateUserProfileRequest } from '@schedule/contracts';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';

import { ApiError } from '../../plugins/error-handler.js';
import { MAX_USER_PROFILE_AVATAR_BYTES } from './user-avatar.js';
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
  app.addContentTypeParser(
    ['image/jpeg', 'image/png', 'image/webp'],
    { bodyLimit: MAX_USER_PROFILE_AVATAR_BYTES, parseAs: 'buffer' },
    (_request, body, done) => done(null, body),
  );

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

  app.put('/users/me/avatar', { preHandler: app.authenticate }, async (request) =>
    userService.replaceCurrentAvatar(
      getAuthenticatedIdentity(request),
      parseAvatarBody(request.body),
      request.headers['content-type'] ?? '',
    ),
  );

  app.get('/users/me/avatar', { preHandler: app.authenticate }, async (request, reply) => {
    const avatar = await userService.getCurrentAvatar(getAuthenticatedIdentity(request));
    const etag = `"avatar-${avatar.version}-${avatar.sha256}"`;
    reply
      .header('Cache-Control', 'private, no-cache')
      .header('ETag', etag)
      .header('X-Content-Type-Options', 'nosniff');
    if (request.headers['if-none-match'] === etag) return reply.code(304).send();
    return reply.type(avatar.contentType).send(avatar.content);
  });

  app.delete('/users/me/avatar', { preHandler: app.authenticate }, async (request) =>
    userService.deleteCurrentAvatar(getAuthenticatedIdentity(request)),
  );
}

function parseAvatarBody(value: unknown): Buffer {
  if (!Buffer.isBuffer(value)) throwValidationError();
  return value;
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
