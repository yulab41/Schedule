import type { AccountOpenRequest } from '@schedule/contracts';
interface ForegroundPeriod {
  readonly event: AccountOpenRequest;
  readonly accounts: Set<string>;
}
export function createMemberActivityRuntime(options: {
  readonly createEventId: () => string;
  readonly now?: () => Date;
  readonly currentAccount: () => string | undefined;
  readonly report: (event: AccountOpenRequest, accountId: string) => Promise<unknown>;
  readonly onError?: () => void;
}) {
  let current: ForegroundPeriod | undefined;
  const reportCurrent = (): void => {
    const period = current;
    const accountId = options.currentAccount();
    if (period === undefined || accountId === undefined || period.accounts.has(accountId)) return;
    period.accounts.add(accountId);
    void options.report(period.event, accountId).catch(() => options.onError?.());
  };
  return {
    onShow(): void {
      current = {
        event: {
          eventId: options.createEventId(),
          openedAt: (options.now?.() ?? new Date()).toISOString(),
        },
        accounts: new Set(),
      };
      reportCurrent();
    },
    onHide(): void {
      current = undefined;
    },
    authenticated: reportCurrent,
  };
}
export type MemberActivityRuntime = ReturnType<typeof createMemberActivityRuntime>;
export function notifyMemberAuthenticated(): void {
  try {
    if (typeof getApp === 'function')
      getApp<{
        globalData?: { memberActivityRuntime?: MemberActivityRuntime };
      }>().globalData?.memberActivityRuntime?.authenticated();
  } catch {
    /* App may not be ready during a unit test or initial bootstrap. */
  }
}
