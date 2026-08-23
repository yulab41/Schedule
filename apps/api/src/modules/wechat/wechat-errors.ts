import type { ApiErrorCode } from '@schedule/contracts';

import { ApiError } from '../../plugins/error-handler.js';
import { WechatGatewayError } from './wechat-gateway.js';

const wechatGatewayStatusCodes: Readonly<Record<ApiErrorCode, number>> = {
  AUTHENTICATION_REQUIRED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  VALIDATION_FAILED: 400,
  UNSUPPORTED_MEDIA_TYPE: 415,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  SERVICE_UNAVAILABLE: 503,
  INTERNAL_ERROR: 500,
  WECHAT_LOGIN_FAILED: 401,
  WECHAT_LINK_TOKEN_INVALID: 401,
  WECHAT_LINK_TOKEN_USED: 409,
  WECHAT_LINK_TOKEN_EXPIRED: 410,
  WECHAT_MESSAGE_SEND_FAILED: 502,
  INVITE_INVALID: 400,
  INVITE_USED: 409,
  INVITE_EXPIRED: 410,
  VISITOR_KEY_INVALID: 404,
  CLIENT_VERSION_UNSUPPORTED: 426,
  CLIENT_CAPABILITY_DISABLED: 503,
};

const wechatGatewayUserMessages: Readonly<Record<ApiErrorCode, string>> = {
  AUTHENTICATION_REQUIRED: '需要先登录后才能继续。',
  FORBIDDEN: '当前账号无法执行该操作。',
  NOT_FOUND: '请求的资源不存在。',
  VALIDATION_FAILED: '请求数据不符合要求。',
  UNSUPPORTED_MEDIA_TYPE: '不支持的请求内容类型。',
  CONFLICT: '数据已更新，请刷新后重试。',
  RATE_LIMITED: '请求过于频繁，请稍后重试。',
  SERVICE_UNAVAILABLE: '微信服务暂时不可用，请稍后重试。',
  INTERNAL_ERROR: '服务器暂时无法处理请求，请稍后重试。',
  WECHAT_LOGIN_FAILED: '微信登录失败，请重新尝试。',
  WECHAT_LINK_TOKEN_INVALID: '微信绑定凭证无效，请重新登录。',
  WECHAT_LINK_TOKEN_USED: '微信绑定凭证已使用，请重新登录。',
  WECHAT_LINK_TOKEN_EXPIRED: '微信绑定凭证已过期，请重新登录。',
  WECHAT_MESSAGE_SEND_FAILED: '微信消息发送失败。',
  INVITE_INVALID: '邀请链接无效。',
  INVITE_USED: '邀请链接已被使用。',
  INVITE_EXPIRED: '邀请链接已过期。',
  VISITOR_KEY_INVALID: '访客链接无效。',
  CLIENT_VERSION_UNSUPPORTED: '当前客户端版本不受支持，请更新后重试。',
  CLIENT_CAPABILITY_DISABLED: '当前客户端功能已暂停，请稍后重试。',
};

export function toWechatGatewayApiError(error: WechatGatewayError): ApiError {
  return new ApiError({
    code: error.mappedCode,
    statusCode: wechatGatewayStatusCodes[error.mappedCode] ?? 500,
    userMessage: wechatGatewayUserMessages[error.mappedCode] ?? '微信服务暂时不可用，请稍后重试。',
  });
}
