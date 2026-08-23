import {
  ClientCoreError,
  createAuthenticationRequiredError,
  createHttpClientError,
  createInvalidResponseError,
  createNetworkError,
} from '../src/index.js';
import { describe, expect, it } from 'vitest';

describe('client-core error mapping', () => {
  it('preserves known API error details including latest conflict data', () => {
    const error = createHttpClientError(409, {
      error: {
        code: 'CONFLICT',
        latestData: { version: 3 },
        message: '资料版本冲突。',
        requestId: 'request-1',
      },
    });

    expect(error).toBeInstanceOf(ClientCoreError);
    expect(error).toMatchObject({
      code: 'CONFLICT',
      latestData: { version: 3 },
      message: '资料版本冲突。',
      requestId: 'request-1',
      status: 409,
    });
  });

  it('preserves capability and version gate errors from the generated protocol', () => {
    for (const [status, code] of [
      [426, 'CLIENT_VERSION_UNSUPPORTED'],
      [503, 'CLIENT_CAPABILITY_DISABLED'],
    ] as const) {
      expect(
        createHttpClientError(status, {
          error: {
            code,
            message: '客户端能力不可用。',
            requestId: `request-${status}`,
          },
        }),
      ).toMatchObject({ code, requestId: `request-${status}`, status });
    }
  });

  it('uses the existing Web fallback messages for malformed error bodies', () => {
    expect(createHttpClientError(401, undefined)).toMatchObject({
      code: undefined,
      message: '登录状态已失效，请重新登录。',
      status: 401,
    });
    expect(createHttpClientError(403, { error: { code: 'UNKNOWN' } })).toMatchObject({
      code: undefined,
      message: '当前账户无权执行此操作。',
      status: 403,
    });
    expect(createHttpClientError(409, null).message).toBe('资料已发生变化，请刷新后重试。');
    expect(createHttpClientError(500, null).message).toBe('服务暂时不可用，请稍后重试。');
  });

  it('constructs stable authentication, invalid-response, and network failures', () => {
    expect(createAuthenticationRequiredError()).toMatchObject({
      code: 'AUTHENTICATION_REQUIRED',
      status: 401,
    });
    expect(createInvalidResponseError(200)).toMatchObject({
      code: 'SERVICE_UNAVAILABLE',
      message: '服务返回了无效资料，请稍后重试。',
      status: 200,
    });
    expect(createNetworkError()).toMatchObject({
      code: 'NETWORK_ERROR',
      message: '无法连接到服务，请检查网络后重试。',
      status: undefined,
    });
  });
});
