import { requireClientCapability } from '../app/client-capability-store.js';

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
  await requireClientCapability('externalMessages');
  const normalizedTemplateIds = normalizeTemplateIds(templateIds);
  return new Promise((resolve, reject) => {
    (
      wx as unknown as {
        requestSubscribeMessage: (options: WxSubscribeMessageOptions) => unknown;
      }
    ).requestSubscribeMessage({
      fail: () => reject(new Error('微信订阅授权暂时不可用，请稍后重试。')),
      success: (result) =>
        resolve(
          normalizedTemplateIds.map((templateId) => {
            const status = normalizeWechatSubscriptionStatus(result[templateId]);
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
