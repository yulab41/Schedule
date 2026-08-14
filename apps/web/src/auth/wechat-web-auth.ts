import {
  wechatWebLoginExchangeRequestSchema,
  wechatWebLoginResponseSchema,
  wechatWebLoginStartResponseSchema,
} from '@schedule/contracts';

export async function startWechatWebLogin(clientState: string): Promise<{
  readonly authorizeUrl: string;
  readonly state: string;
}> {
  const response = await fetch(
    `/api/auth/wechat/web/start?state=${encodeURIComponent(clientState)}`,
    {
      headers: { Accept: 'application/json' },
    },
  );
  return parseResponse(response, wechatWebLoginStartResponseSchema);
}

export async function exchangeWechatWebLogin(code: string, state: string) {
  const request = wechatWebLoginExchangeRequestSchema.parse({ code, state });
  const response = await fetch('/api/auth/wechat/web/exchange', {
    body: JSON.stringify(request),
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    method: 'POST',
  });
  return parseResponse(response, wechatWebLoginResponseSchema);
}

async function parseResponse<T>(
  response: Response,
  schema: { parse(value: unknown): T },
): Promise<T> {
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new Error(`登录服务返回了无效响应（HTTP ${response.status}）。`);
  }
  if (!response.ok) {
    const message =
      typeof payload === 'object' &&
      payload !== null &&
      'message' in payload &&
      typeof payload.message === 'string'
        ? payload.message
        : `登录服务暂时不可用（HTTP ${response.status}）。`;
    throw new Error(message);
  }
  return schema.parse(payload);
}
