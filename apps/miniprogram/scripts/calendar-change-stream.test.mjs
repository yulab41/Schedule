import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createCalendarChangeSubscription } from '../src/platform/calendar-change-subscription.ts';

describe('foreground change subscription', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());
  it('parses split hints, ignores heartbeats and closes without reconnecting after disposal', async () => {
    let receive;
    let completed;
    const abort = vi.fn();
    const changed = vi.fn();
    const connect = vi.fn((options) => {
      completed = options.complete;
      return {
        abort,
        onChunkReceived(fn) {
          receive = fn;
        },
        onHeadersReceived() {},
      };
    });
    const stop = createCalendarChangeSubscription({
      connect,
      onChange: changed,
      onRevoked: vi.fn(),
    });
    receive({ data: bytes(':keepalive\n\ndata:rea') });
    expect(changed).not.toHaveBeenCalled();
    receive({ data: bytes('dy\n\ndata:changed\n\n') });
    expect(changed).toHaveBeenCalledTimes(2);
    stop();
    completed();
    await vi.advanceTimersByTimeAsync(240_000);
    expect(connect).toHaveBeenCalledTimes(1);
    expect(abort).toHaveBeenCalledTimes(1);
  });
  it('uses one low-frequency fallback when streaming is unavailable', async () => {
    const changed = vi.fn();
    const connect = vi.fn(() => undefined);
    const stop = createCalendarChangeSubscription({
      connect,
      onChange: changed,
      onRevoked: vi.fn(),
    });
    await vi.advanceTimersByTimeAsync(119_999);
    expect(changed).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(changed).toHaveBeenCalledTimes(1);
    expect(connect).toHaveBeenCalledTimes(1);
    stop();
  });
  it('stops and revokes on forbidden access instead of retrying cached contacts forever', async () => {
    let receive;
    const revoked = vi.fn();
    const abort = vi.fn();
    const connect = vi.fn(() => ({
      abort,
      onChunkReceived(fn) {
        receive = fn;
      },
      onHeadersReceived() {},
    }));
    createCalendarChangeSubscription({ connect, onChange: vi.fn(), onRevoked: revoked });
    receive({ data: bytes('data:revoked\n\n') });
    await vi.advanceTimersByTimeAsync(240_000);
    expect(revoked).toHaveBeenCalledTimes(1);
    expect(connect).toHaveBeenCalledTimes(1);
    expect(abort).toHaveBeenCalledTimes(1);
  });

  it('validates no later than two minutes after the last hint if a connection stalls', async () => {
    let receive;
    const changed = vi.fn();
    const stop = createCalendarChangeSubscription({
      connect: () => ({
        abort: vi.fn(),
        onChunkReceived(fn) {
          receive = fn;
        },
        onHeadersReceived() {},
      }),
      onChange: changed,
      onRevoked: vi.fn(),
    });
    await vi.advanceTimersByTimeAsync(30_000);
    receive({ data: bytes('data:ready\n\n') });
    await vi.advanceTimersByTimeAsync(120_000);
    expect(changed).toHaveBeenCalledTimes(2);
    stop();
  });
});
function bytes(text) {
  return Uint8Array.from(text, (character) => character.charCodeAt(0)).buffer;
}
