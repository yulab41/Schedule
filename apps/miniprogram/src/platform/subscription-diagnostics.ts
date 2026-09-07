import { getStoredWechatProfile, getWechatSessionGeneration } from './wechat-identity.js';

const stages = ['configuration', 'native-api', 'authorization', 'preference', 'test-send'] as const;
const outcomes = [
  'started',
  'accepted',
  'rejected',
  'blocked',
  'filtered',
  'unknown',
  'failed',
  'saved',
  'ready',
] as const;
export interface SubscriptionDiagnosticEntry {
  readonly stage: (typeof stages)[number];
  readonly outcome: (typeof outcomes)[number];
  readonly recordedAt: number;
  readonly durationMs?: number;
  readonly errCode?: number;
}

export function createSubscriptionDiagnosticStore() {
  let owner = '';
  let rows: SubscriptionDiagnosticEntry[] = [];
  const switchOwner = (next: string) => {
    if (owner !== next) {
      owner = next;
      rows = [];
    }
  };
  return {
    record(account: string, value: Omit<SubscriptionDiagnosticEntry, 'recordedAt'>): void {
      switchOwner(account);
      if (!stages.includes(value.stage) || !outcomes.includes(value.outcome)) return;
      rows.push({
        stage: value.stage,
        outcome: value.outcome,
        recordedAt: Date.now(),
        ...(Number.isFinite(value.durationMs)
          ? { durationMs: Math.max(0, Math.min(600_000, Math.round(value.durationMs!))) }
          : {}),
        ...(Number.isInteger(value.errCode) && Math.abs(value.errCode!) < 1_000_000
          ? { errCode: value.errCode }
          : {}),
      });
      if (rows.length > 12) rows.shift();
    },
    read(account: string): readonly SubscriptionDiagnosticEntry[] {
      switchOwner(account);
      return rows.map((row) => ({ ...row }));
    },
    clear(): void {
      owner = '';
      rows = [];
    },
  };
}

type Store = ReturnType<typeof createSubscriptionDiagnosticStore>;
function currentStore(): Store | undefined {
  try {
    const data = getApp<{
      globalData?: { subscriptionDiagnostics?: Store; runtimeDiagnostics?: unknown };
    }>().globalData;
    if (!data) return undefined;
    // The authorized slot is App-owned, unlike module-local permission state in separately bundled pages.
    if (data.runtimeDiagnostics === undefined) {
      data.subscriptionDiagnostics?.clear();
      return undefined;
    }
    return (data.subscriptionDiagnostics ??= createSubscriptionDiagnosticStore());
  } catch {
    return undefined;
  }
}
export function recordSubscriptionDiagnostic(
  value: Omit<SubscriptionDiagnosticEntry, 'recordedAt'>,
): void {
  currentStore()?.record(getStoredWechatProfile()?.id ?? '', value);
}
export function readSubscriptionDiagnostics(): readonly SubscriptionDiagnosticEntry[] {
  return currentStore()?.read(getStoredWechatProfile()?.id ?? '') ?? [];
}
export function captureSubscriptionDiagnosticRecorder() {
  const store = currentStore();
  if (!store) return (): void => {};
  const owner = getStoredWechatProfile()?.id;
  const generation = getWechatSessionGeneration();
  const authorization = authorizedSlot();
  return (value: Omit<SubscriptionDiagnosticEntry, 'recordedAt'>): void => {
    if (
      owner !== getStoredWechatProfile()?.id ||
      generation !== getWechatSessionGeneration() ||
      authorization !== authorizedSlot() ||
      currentStore() !== store
    )
      return;
    recordSubscriptionDiagnostic(value);
  };
}
function authorizedSlot(): unknown {
  try {
    return getApp<{ globalData?: { runtimeDiagnostics?: unknown } }>().globalData
      ?.runtimeDiagnostics;
  } catch {
    return undefined;
  }
}
