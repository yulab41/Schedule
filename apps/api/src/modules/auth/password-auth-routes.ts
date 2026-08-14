import { passwordLoginRequestSchema, passwordRegisterRequestSchema } from '@schedule/contracts';
import type { FastifyInstance } from 'fastify';

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

function invalidRequestError(): ApiError {
  return new ApiError({
    code: 'VALIDATION_FAILED',
    statusCode: 400,
    userMessage: '账号需为 3-64 位字母、数字或 ._-，密码不能为空。',
  });
}
