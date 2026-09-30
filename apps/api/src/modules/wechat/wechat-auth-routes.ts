import {
  wechatLinkPasswordRequestSchema,
  wechatLoginRequestSchema,
  wechatRegisterRequestSchema,
} from '@schedule/contracts';
import type { FastifyInstance } from 'fastify';

import type { AccountActivityService } from '../account-activity/account-activity-service.js';
import { recordSuccessfulLogin } from '../account-activity/record-login.js';
import { ApiError } from '../../plugins/error-handler.js';
import { ClientCapabilityPolicy } from '../client-capabilities/client-capability-policy.js';
import { resolveMiniClientVersion } from '../client-capabilities/client-version-headers.js';
import type { WechatAuthService } from './wechat-auth-service.js';

export function registerWechatAuthRoutes(
  app: FastifyInstance,
  wechatAuthService: Pick<WechatAuthService, 'login' | 'linkPassword' | 'register'>,
  clientCapabilityPolicy: ClientCapabilityPolicy = ClientCapabilityPolicy.disabled(),
  activity?: Pick<AccountActivityService, 'recordLogin'>,
): void {
  app.post('/auth/wechat/login', async (request) => {
    const input = parseWechatLoginRequest(request.body);
    const result = await wechatAuthService.login(
      input.code,
      resolveMiniClientVersion(request, clientCapabilityPolicy),
    );
    if (result.status === 'authenticated')
      await recordSuccessfulLogin(
        activity,
        result.profile.id,
        input.loginSource === 'auto'
          ? 'wechat_auto'
          : input.loginSource === 'manual'
            ? 'wechat_manual'
            : 'wechat_unspecified',
        request.log,
      );
    return result;
  });
  app.post('/auth/wechat/link-password', async (request) => {
    const result = await wechatAuthService.linkPassword(
      parseWechatLinkPasswordRequest(request.body),
      request.id,
      resolveMiniClientVersion(request, clientCapabilityPolicy),
    );
    await recordSuccessfulLogin(activity, result.profile.id, 'wechat_binding', request.log);
    return result;
  });
  app.post('/auth/wechat/register', async (request, reply) => {
    const result = await wechatAuthService.register(
      parseWechatRegisterRequest(request.body),
      request.id,
      resolveMiniClientVersion(request, clientCapabilityPolicy),
    );
    await recordSuccessfulLogin(activity, result.profile.id, 'wechat_binding', request.log);
    return reply.code(201).send(result);
  });
}

function parseWechatLinkPasswordRequest(value: unknown) {
  const result = wechatLinkPasswordRequestSchema.safeParse(value);
  if (!result.success) throw invalidRequestError();
  return result.data;
}

function parseWechatLoginRequest(value: unknown) {
  const result = wechatLoginRequestSchema.safeParse(value);

  if (!result.success) {
    throw invalidRequestError();
  }

  return result.data;
}

function parseWechatRegisterRequest(value: unknown) {
  const result = wechatRegisterRequestSchema.safeParse(value);
  if (!result.success) throw invalidRequestError();
  return result.data;
}

function invalidRequestError(): ApiError {
  return new ApiError({
    code: 'VALIDATION_FAILED',
    statusCode: 400,
    userMessage: '请求数据不符合要求。',
  });
}
