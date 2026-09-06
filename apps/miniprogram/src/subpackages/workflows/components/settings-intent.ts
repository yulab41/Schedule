import { getWechatSessionRuntimeState } from '../../../platform/wechat-session-runtime.js';
import {
  captureWorkflowControllerTask,
  captureWorkflowFeedbackTask,
  pauseWorkflowInfo,
  publishWorkflowInfo,
} from './controller-host.js';

interface SettingsHost {
  readonly _currentGroupId: string;
  readonly data: { readonly autoAcceptSwaps: boolean; readonly requiresApproval: boolean };
  setData(patch: Readonly<Record<string, unknown>>): void;
}
interface SettingIntent {
  readonly key: string;
  readonly field: 'autoAcceptSwaps' | 'requiresApproval';
  readonly value: boolean;
  readonly save: (value: boolean) => Promise<boolean>;
  readonly read: () => Promise<boolean>;
  readonly success: (value: boolean) => string;
  readonly failure: (error: unknown) => string;
}
interface Subscriber {
  readonly host: SettingsHost;
  readonly current: () => boolean;
  readonly feedbackCurrent: () => boolean;
}
interface PendingSetting {
  readonly current: () => boolean;
  readonly subscribers: Map<SettingsHost, Subscriber>;
  confirmed: boolean;
  pending: SettingIntent | undefined;
}

// Business serialization survives host navigation. No queue is shared across accounts or groups.
const states = new Map<string, PendingSetting>();
const busy = new WeakMap<object, Set<string>>();
export function enqueueSettingIntent(host: SettingsHost, intent: SettingIntent): void {
  const task = captureWorkflowControllerTask(host);
  if (!task.isCurrent()) return;
  const runtime = getWechatSessionRuntimeState();
  const generation = runtime.generation;
  const groupId = host._currentGroupId;
  const key = JSON.stringify([generation, host._currentGroupId, intent.key]);
  let state = states.get(key);
  const start = state === undefined;
  if (state === undefined) {
    state = {
      current: () => runtime.generation === generation && !runtime.invalidated,
      subscribers: new Map(),
      confirmed: host.data[intent.field],
      pending: undefined,
    };
    states.set(key, state);
  }
  if (!state.current()) return;
  const feedback = captureWorkflowFeedbackTask(host);
  state.subscribers.set(host, {
    host,
    current: () => task.isCurrent() && host._currentGroupId === groupId && state.current(),
    feedbackCurrent: () =>
      feedback.isCurrent() && host._currentGroupId === groupId && state.current(),
  });
  state.pending = intent;
  const keys = busy.get(host) ?? new Set<string>();
  keys.add(key);
  busy.set(host, keys);
  pauseWorkflowInfo(host, intent.key);
  host.setData({ [intent.field]: intent.value, settingsBusy: true });
  if (start) void drain(key, state);
}

async function drain(key: string, state: PendingSetting): Promise<void> {
  try {
    while (state.current() && state.pending !== undefined) {
      const intent = state.pending;
      state.pending = undefined;
      let failure: string | undefined;
      try {
        const value = await intent.save(intent.value);
        if (!state.current()) return;
        state.confirmed = value;
      } catch (error) {
        if (!state.current()) return;
        let verified = false;
        try {
          const value = await intent.read();
          if (!state.current()) return;
          state.confirmed = value;
          verified = true;
        } catch {
          /* Never claim success for an unknown write outcome. */
        }
        failure =
          intent.failure(error) + (verified ? '' : ' 当前保存结果暂无法确认，请刷新后重试。');
      }
      if (!state.current()) return;
      // An intermediate failure cannot override the queued newer intent.
      if (state.pending !== undefined) continue;
      for (const subscriber of state.subscribers.values()) {
        if (!subscriber.current()) continue;
        subscriber.host.setData({ [intent.field]: state.confirmed });
        if (subscriber.feedbackCurrent())
          publishWorkflowInfo(
            subscriber.host,
            failure ?? intent.success(state.confirmed),
            intent.key,
            failure === undefined ? 'success' : 'error',
          );
      }
    }
  } finally {
    for (const subscriber of state.subscribers.values()) {
      const keys = busy.get(subscriber.host);
      keys?.delete(key);
      if (subscriber.current()) subscriber.host.setData({ settingsBusy: (keys?.size ?? 0) > 0 });
    }
    state.subscribers.clear();
    state.pending = undefined;
    if (states.get(key) === state) states.delete(key);
  }
}
