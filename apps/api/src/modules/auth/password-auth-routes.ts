import {
  passwordChangeRequestSchema,
  passwordLoginRequestSchema,
  passwordProofChangeRequestSchema,
  passwordRegisterRequestSchema,
} from '@schedule/contracts';
import type { FastifyInstance, FastifyRequest } from 'fastify';

import { ApiError } from '../../plugins/error-handler.js';
import type { PasswordAuthService } from './password-auth-service.js';

export function registerPasswordAuthRoutes(
  app: FastifyInstance,
  passwordAuthService: PasswordAuthService,
): void {
  app.post('/auth/password/register', async (request, reply) => {
    const input = parsePasswordRegisterRequest(request.body);
    return reply.code(201).send(await passwordAuthService.register(input.username, input.password));
  });

  app.post('/auth/password/login', async (request) => {
    const input = parsePasswordLoginRequest(request.body);
    return passwordAuthService.login(input.username, input.password);
  });

  app.get('/auth/password/status', { preHandler: app.authenticate }, async (request) =>
    passwordAuthService.getStatus(getAuthenticatedIdentity(request)),
  );

  app.patch('/auth/password', { preHandler: app.authenticate }, async (request) =>
    passwordAuthService.changePassword(
      getAuthenticatedIdentity(request),
      parsePasswordChangeRequest(request.body),
    ),
  );

  app.put('/me/password', { preHandler: app.authenticate }, async (request) =>
    passwordAuthService.changePasswordWithProof(
      getAuthenticatedIdentity(request),
      parsePasswordProofChangeRequest(request.body),
    ),
  );
}

function parsePasswordRegisterRequest(value: unknown) {
  const result = passwordRegisterRequestSchema.safeParse(value);
  if (!result.success) {
    throw invalidRequestError();
  }
  return result.data;
}

function parsePasswordLoginRequest(value: unknown) {
  const result = passwordLoginRequestSchema.safeParse(value);
  if (!result.success) {
    throw invalidRequestError();
  }
  return result.data;
}

function parsePasswordChangeRequest(value: unknown) {
  const result = passwordChangeRequestSchema.safeParse(value);
  if (!result.success) {
    throw new ApiError({
      code: 'VALIDATION_FAILED',
      statusCode: 400,
      userMessage: '当前密码和新密码不能为空，且新密码不能与当前密码相同。',
    });
  }
  return result.data;
}

function parsePasswordProofChangeRequest(value: unknown) {
  const result = passwordProofChangeRequestSchema.safeParse(value);
  if (!result.success) {
    throw new ApiError({
      code: 'VALIDATION_FAILED',
      statusCode: 400,
      userMessage: '当前密码或微信校验码与新密码不能为空。',
    });
  }
  return result.data;
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

function invalidRequestError(): ApiError {
  return new ApiError({
    code: 'VALIDATION_FAILED',
    statusCode: 400,
    userMessage: '账号需为 3-64 位字母、数字或 ._-，密码不能为空。',
  });
}
