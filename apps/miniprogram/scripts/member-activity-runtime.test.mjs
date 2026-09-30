import { describe, expect, it, vi } from 'vitest';
import { createMemberActivityRuntime } from '../src/platform/member-activity-runtime.ts';
describe('member foreground activity', () => {
  it('records onShow once, omits anonymous and backfills login, bounds each account to one event', async () => {
    let account;
    let next = 0;
    const report = vi.fn().mockResolvedValue(undefined);
    const runtime = createMemberActivityRuntime({
      createEventId: () => `event-${++next}`,
      currentAccount: () => account,
      report,
    });
    runtime.onShow();
    expect(report).not.toHaveBeenCalled();
    account = 'a';
    runtime.authenticated();
    runtime.authenticated();
    expect(report).toHaveBeenCalledTimes(1);
    account = 'b';
    runtime.authenticated();
    account = 'a';
    runtime.authenticated();
    expect(report).toHaveBeenCalledTimes(2);
    expect(report.mock.calls[0][0]).toEqual(report.mock.calls[1][0]);
    runtime.onHide();
    runtime.authenticated();
    expect(report).toHaveBeenCalledTimes(2);
    runtime.onShow();
    expect(report).toHaveBeenCalledTimes(3);
    expect(report.mock.calls[2][0].eventId).not.toBe(report.mock.calls[0][0].eventId);
  });
  it('keeps statistics failures outside business and has no offline replay queue', async () => {
    const onError = vi.fn();
    const report = vi.fn().mockRejectedValue(new Error('private details'));
    const runtime = createMemberActivityRuntime({
      createEventId: () => 'event',
      currentAccount: () => 'a',
      report,
      onError,
    });
    runtime.onShow();
    runtime.authenticated();
    await Promise.resolve();
    expect(report).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith();
  });
});
