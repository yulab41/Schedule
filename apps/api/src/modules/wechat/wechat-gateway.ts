import type { ApiErrorCode } from '@schedule/contracts';

const WECHAT_API_BASE_URL = 'https://api.weixin.qq.com';
const ACCESS_TOKEN_CACHE_MARGIN_MS = 5 * 60 * 1000;
const DEFAULT_REQUEST_TIMEOUT_MS = 5_000;

export interface WechatExchangeCodeResult {
  readonly openid: string;
  readonly sessionKey: string | undefined;
  readonly unionid: string | undefined;
}

export interface WechatSubscribeMessageData {
  readonly [key: string]: { readonly value: string };
}

export interface WechatSubscribeMessageResult {
  // 微信订阅消息接口不返回 msgid；messageId 仅用于 mock/审计引用。
  readonly messageId: string | null;
}

export interface WechatGateway {
  readonly isConfigured: boolean;
  exchangeCode(code: string): Promise<WechatExchangeCodeResult>;
  getUnlimitedQr(scene: string, page: string, envVersion: string): Promise<Uint8Array>;
  sendSubscribeMessage(
    openid: string,
    templateId: string,
    data: WechatSubscribeMessageData,
  ): Promise<WechatSubscribeMessageResult>;
}

export class WechatGatewayError extends Error {
  public constructor(
    public readonly errcode: number | null,
    public readonly errmsg: string | null,
    public readonly mappedCode: ApiErrorCode,
    message: string | undefined = undefined,
  ) {
    super(message ?? `WeChat API error ${errcode ?? 'unknown'}: ${errmsg ?? 'unknown'}`);
    this.name = 'WechatGatewayError';
  }
}

// 微信接口错误码 → 本项目契约错误码。未列出的错误统一视为外部服务不可用。
export const wechatApiErrorCodeMapping: Readonly<Record<number, ApiErrorCode>> = {
  40013: 'INTERNAL_ERROR', // appid 无效（配置错误）
  40029: 'WECHAT_LOGIN_FAILED', // code 无效
  40125: 'INTERNAL_ERROR', // appsecret 无效（配置错误）
  40163: 'WECHAT_LOGIN_FAILED', // code 已被使用
  40226: 'RATE_LIMITED', // 高风险登录限制
  43101: 'WECHAT_MESSAGE_SEND_FAILED', // 用户拒绝接收订阅消息
  45009: 'RATE_LIMITED', // 接口分钟调用量超限
  45011: 'RATE_LIMITED', // 接口日调用量超限
  47003: 'VALIDATION_FAILED', // 模板参数不合法
};

export function mapWechatApiError(errcode: number): ApiErrorCode {
  return wechatApiErrorCodeMapping[errcode] ?? 'SERVICE_UNAVAILABLE';
}

export interface WechatApiGatewayOptions {
  readonly appId: string | undefined;
  readonly appSecret: string | undefined;
  readonly fetchFn?: typeof fetch;
  readonly now?: () => number;
  readonly requestTimeoutMs?: number;
}

export class WechatApiGateway implements WechatGateway {
  public readonly isConfigured: boolean;
  private readonly appId: string | undefined;
  private readonly appSecret: string | undefined;
  private readonly fetchFn: typeof fetch;
  private readonly now: () => number;
  private readonly requestTimeoutMs: number;
  private cachedAccessToken: { readonly expiresAt: number; readonly value: string } | undefined;

  public constructor(
    options: WechatApiGatewayOptions = { appId: undefined, appSecret: undefined },
  ) {
    this.appId = options.appId;
    this.appSecret = options.appSecret;
    this.fetchFn = options.fetchFn ?? fetch;
    this.now = options.now ?? Date.now;
    this.requestTimeoutMs = options.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
    this.isConfigured = this.appId !== undefined && this.appSecret !== undefined;
  }

  public async exchangeCode(code: string): Promise<WechatExchangeCodeResult> {
    this.assertConfigured();

    const url = new URL(`${WECHAT_API_BASE_URL}/sns/jscode2session`);
    url.searchParams.set('appid', this.appId as string);
    url.searchParams.set('secret', this.appSecret as string);
    url.searchParams.set('js_code', code);
    url.searchParams.set('grant_type', 'authorization_code');

    const payload = await this.requestJson(url);
    if (typeof payload.openid !== 'string' || payload.openid.length === 0) {
      throw new WechatGatewayError(
        null,
        null,
        'WECHAT_LOGIN_FAILED',
        'WeChat login exchange did not return an openid.',
      );
    }

    return {
      openid: payload.openid,
      sessionKey: typeof payload.session_key === 'string' ? payload.session_key : undefined,
      unionid: typeof payload.unionid === 'string' ? payload.unionid : undefined,
    };
  }

  public async getUnlimitedQr(
    scene: string,
    page: string,
    envVersion: string,
  ): Promise<Uint8Array> {
    this.assertConfigured();

    const accessToken = await this.getAccessToken();
    const response = await this.fetchWithTimeout(
      `${WECHAT_API_BASE_URL}/wxa/getwxacodeunlimit?access_token=${encodeURIComponent(accessToken)}`,
      {
        body: JSON.stringify({ check_path: false, env_version: envVersion, page, scene }),
        headers: { 'content-type': 'application/json' },
        method: 'POST',
      },
    );

    const contentType = response.headers.get('content-type') ?? '';
    if (contentType.includes('application/json') || !response.ok) {
      const payload = await this.readJsonResponse(response);
      this.throwForErrorPayload(payload, 'getUnlimitedQr returned an unexpected JSON response.');
    }

    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.length === 0) {
      throw new WechatGatewayError(
        null,
        null,
        'SERVICE_UNAVAILABLE',
        'WeChat QR API returned an empty body.',
      );
    }
    return bytes;
  }

  public async sendSubscribeMessage(
    openid: string,
    templateId: string,
    data: WechatSubscribeMessageData,
  ): Promise<WechatSubscribeMessageResult> {
    this.assertConfigured();

    const accessToken = await this.getAccessToken();
    const payload = await this.requestJson(
      `${WECHAT_API_BASE_URL}/cgi-bin/message/subscribe/send?access_token=${encodeURIComponent(accessToken)}`,
      {
        body: JSON.stringify({ data, template_id: templateId, touser: openid }),
        headers: { 'content-type': 'application/json' },
        method: 'POST',
      },
    );

    // 微信订阅消息接口成功时只返回 { errcode: 0, errmsg: 'ok' }，不返回 msgid。
    if (typeof payload.msgid === 'string' && payload.msgid.length > 0) {
      return { messageId: payload.msgid };
    }
    return { messageId: null };
  }

  private assertConfigured(): void {
    if (!this.isConfigured) {
      throw new WechatGatewayError(
        null,
        null,
        'INTERNAL_ERROR',
        'WeChat gateway is not configured.',
      );
    }
  }

  private async getAccessToken(): Promise<string> {
    const cached = this.cachedAccessToken;
    if (cached !== undefined && cached.expiresAt - this.now() > ACCESS_TOKEN_CACHE_MARGIN_MS) {
      return cached.value;
    }

    const url = new URL(`${WECHAT_API_BASE_URL}/cgi-bin/token`);
    url.searchParams.set('grant_type', 'client_credential');
    url.searchParams.set('appid', this.appId as string);
    url.searchParams.set('secret', this.appSecret as string);

    const payload = await this.requestJson(url);
    if (typeof payload.access_token !== 'string' || payload.access_token.length === 0) {
      this.throwForErrorPayload(payload, 'Access token response did not include a token.');
    }

    const expiresInSeconds = Number.isFinite(Number(payload.expires_in))
      ? Number(payload.expires_in)
      : 7200;
    this.cachedAccessToken = {
      expiresAt: this.now() + expiresInSeconds * 1000,
      value: payload.access_token,
    };
    return payload.access_token;
  }

  private async requestJson(
    input: string | URL,
    init?: RequestInit,
  ): Promise<Record<string, unknown>> {
    const response = await this.fetchWithTimeout(input, init);
    const payload = await this.readJsonResponse(response);
    if (typeof payload.errcode === 'number' && payload.errcode !== 0) {
      this.throwForErrorPayload(payload);
    }
    return payload;
  }

  private async readJsonResponse(response: Response): Promise<Record<string, unknown>> {
    if (!response.ok) {
      throw new WechatGatewayError(
        null,
        `HTTP ${response.status}`,
        'SERVICE_UNAVAILABLE',
        `WeChat API returned HTTP ${response.status}.`,
      );
    }

    try {
      const payload = (await response.json()) as unknown;
      if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new Error('WeChat API response is not a JSON object.');
      }
      return payload as Record<string, unknown>;
    } catch (error) {
      if (error instanceof WechatGatewayError) {
        throw error;
      }
      throw new WechatGatewayError(
        null,
        null,
        'SERVICE_UNAVAILABLE',
        'WeChat API returned a non-JSON response.',
      );
    }
  }

  private throwForErrorPayload(payload: Record<string, unknown>, fallbackMessage?: string): never {
    const errcode = typeof payload.errcode === 'number' ? payload.errcode : null;
    const errmsg = typeof payload.errmsg === 'string' ? payload.errmsg : null;
    throw new WechatGatewayError(
      errcode,
      errmsg,
      errcode === null ? 'SERVICE_UNAVAILABLE' : mapWechatApiError(errcode),
      fallbackMessage,
    );
  }

  private async fetchWithTimeout(input: string | URL, init?: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.requestTimeoutMs);
    try {
      return await this.fetchFn(input, { ...init, signal: controller.signal });
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new WechatGatewayError(
          null,
          null,
          'SERVICE_UNAVAILABLE',
          'WeChat API request timed out.',
        );
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
}

export interface MockWechatSentMessage {
  readonly data: WechatSubscribeMessageData;
  readonly openid: string;
  readonly templateId: string;
}

export interface MockWechatGateway extends WechatGateway {
  readonly sentMessages: readonly MockWechatSentMessage[];
}

export interface MockWechatGatewayOptions {
  readonly log?: (message: MockWechatSentMessage) => void;
}

const MOCK_QR_BYTES = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x01, 0x02, 0x03,
]);

export function createMockWechatGateway(options: MockWechatGatewayOptions = {}): MockWechatGateway {
  const sentMessages: MockWechatSentMessage[] = [];
  const log = options.log ?? (() => undefined);

  return {
    isConfigured: true,
    async exchangeCode(code) {
      return { openid: `mock-openid-${code}`, sessionKey: undefined, unionid: undefined };
    },
    async getUnlimitedQr() {
      return MOCK_QR_BYTES;
    },
    async sendSubscribeMessage(openid, templateId, data) {
      const message = { data, openid, templateId };
      sentMessages.push(message);
      log(message);
      return { messageId: 'mock-message-id' };
    },
    get sentMessages() {
      return sentMessages;
    },
  };
}

export interface WechatGatewayEnvironment {
  readonly WECHAT_APPID?: string | undefined;
  readonly WECHAT_APPSECRET?: string | undefined;
  readonly WECHAT_MOCK_MODE?: 'true' | 'false' | undefined;
}

export function createWechatGateway(environment: WechatGatewayEnvironment): WechatGateway {
  if (environment.WECHAT_MOCK_MODE === 'true') {
    return createMockWechatGateway();
  }
  return new WechatApiGateway({
    appId: environment.WECHAT_APPID,
    appSecret: environment.WECHAT_APPSECRET,
  });
}
