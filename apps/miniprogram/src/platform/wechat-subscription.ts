import {
  ClientCapabilityDisabledError,
  getClientCapabilitySnapshot,
} from '../app/client-capability-store.js';
import { captureSubscriptionDiagnosticRecorder } from './subscription-diagnostics.js';

export class WechatSubscriptionError extends Error {
  public constructor(public readonly code: number | undefined) {
    super(
      code === 20004
        ? '微信通知总开关已关闭，请在微信设置中开启后再次订阅。'
        : code === 10005
          ? '微信暂时无法显示订阅窗口，请再次点击订阅。'
          : code === 10004
            ? '微信订阅模板暂不可用，请联系管理员。'
            : code === 20005
              ? '当前小程序的微信订阅能力已暂停。'
              : '微信订阅授权暂时不可用，请检查网络后重试。',
    );
    this.name = 'WechatSubscriptionError';
  }
}

export type WechatSubscriptionStatus = 'accepted' | 'rejected' | 'blocked' | 'filtered' | 'unknown';

export interface WechatSubscriptionGrant {
  readonly templateId: string;
  readonly status: WechatSubscriptionStatus;
  readonly granted: boolean;
}

interface WxSubscribeMessageResult {
  readonly [templateId: string]: string | undefined;
  readonly errMsg?: string;
}

interface WxSubscribeMessageOptions {
  readonly fail: (error: unknown) => void;
  readonly success: (result: WxSubscribeMessageResult) => void;
  readonly tmplIds: readonly string[];
}

/**
 * Request subscription consent only after an explicit user action.
 *
 * The adapter deliberately keeps the raw WeChat response in memory only. The
 * caller owns the corresponding API preference write and may decide how to
 * audit the grant; no token, template payload, or decision is persisted here.
 */
export async function requestWechatSubscriptions(
  templateIds: readonly string[],
): Promise<readonly WechatSubscriptionGrant[]> {
  // Page loading warms this snapshot. Never await before the native call:
  // subscription must still belong to the user's original tap stack.
  const capability = getClientCapabilitySnapshot();
  if (!capability.global || !capability.externalMessages) {
    throw new ClientCapabilityDisabledError('externalMessages');
  }
  const normalizedTemplateIds = normalizeTemplateIds(templateIds);
  const record = captureSubscriptionDiagnosticRecorder();
  const startedAt = Date.now();
  record({ stage: 'authorization', outcome: 'started' });
  return new Promise((resolve, reject) => {
    (
      wx as unknown as {
        requestSubscribeMessage: (options: WxSubscribeMessageOptions) => unknown;
      }
    ).requestSubscribeMessage({
      fail: (error) => {
        const code =
          typeof error === 'object' &&
          error !== null &&
          'errCode' in error &&
          typeof error.errCode === 'number' &&
          Number.isFinite(error.errCode)
            ? error.errCode
            : undefined;
        record({
          stage: 'authorization',
          outcome: 'failed',
          durationMs: Date.now() - startedAt,
          ...(code === undefined ? {} : { errCode: code }),
        });
        reject(new WechatSubscriptionError(code));
      },
      success: (result) =>
        resolve(
          normalizedTemplateIds.map((templateId) => {
            const status = normalizeWechatSubscriptionStatus(result[templateId]);
            record({ stage: 'authorization', outcome: status, durationMs: Date.now() - startedAt });
            return { granted: status === 'accepted', status, templateId };
          }),
        ),
      tmplIds: normalizedTemplateIds,
    });
  });
}

export function normalizeWechatSubscriptionStatus(value: unknown): WechatSubscriptionStatus {
  switch (value) {
    case 'accept':
      return 'accepted';
    case 'reject':
      return 'rejected';
    case 'ban':
      return 'blocked';
    case 'filter':
      return 'filtered';
    default:
      return 'unknown';
  }
}

function normalizeTemplateIds(templateIds: readonly string[]): readonly string[] {
  const normalized = [...new Set(templateIds.map((templateId) => templateId.trim()))].filter(
    (templateId) => templateId.length > 0,
  );
  if (normalized.length === 0 || normalized.length > 3) {
    throw new Error('一次最多选择 3 个有效的微信订阅模板。');
  }
  return normalized;
}
