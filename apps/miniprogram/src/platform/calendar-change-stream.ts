import { requireClientCapability } from '../app/client-capability-store.js';
import { buildInfo } from './build-info.js';
import { runtimeConfig } from './runtime-config.js';
import { getStoredWechatProfile, getStoredWechatToken } from './wechat-identity.js';
import {
  createCalendarChangeSubscription,
  type CalendarStreamTask,
  type CalendarStreamCallbacks,
} from './calendar-change-subscription.js';

export function subscribeCalendarChanges(
  groupId: string,
  onChange: () => void,
  onRevoked: () => void,
): () => void {
  let stopped = false;
  let dispose: (() => void) | undefined;
  const owner = getStoredWechatProfile()?.id;
  void requireClientCapability('core')
    .then(() => {
      if (stopped || owner === undefined || owner !== getStoredWechatProfile()?.id) return;
      dispose = createCalendarChangeSubscription({
        onChange: () => {
          if (!stopped && owner === getStoredWechatProfile()?.id) onChange();
        },
        onRevoked: () => {
          if (!stopped && owner === getStoredWechatProfile()?.id) onRevoked();
        },
        connect: (callbacks) => {
          const token = getStoredWechatToken();
          if (token === undefined || owner !== getStoredWechatProfile()?.id) return undefined;
          const request = wx.request as unknown as (
            options: CalendarStreamCallbacks & {
              url: string;
              method: 'GET';
              header: Record<string, string>;
              enableChunked: true;
              timeout: number;
              dataType: string;
            },
          ) => CalendarStreamTask | undefined;
          return request.call(wx, {
            ...callbacks,
            url: `${runtimeConfig.apiBaseUrl}/groups/${encodeURIComponent(groupId)}/calendar-change-stream`,
            method: 'GET',
            header: {
              Authorization: `Bearer ${token}`,
              'X-Schedule-Client-Platform': 'miniprogram',
              'X-Schedule-Client-Version': buildInfo.buildVersion,
            },
            enableChunked: true,
            dataType: 'text',
            timeout: 120_000,
          });
        },
      });
    })
    .catch(() => undefined);
  return () => {
    stopped = true;
    dispose?.();
  };
}
