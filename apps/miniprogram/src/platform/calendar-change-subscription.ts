export interface CalendarStreamTask {
  abort(): void;
  onChunkReceived(listener: (result: { readonly data: ArrayBuffer }) => void): void;
  onHeadersReceived(listener: (result: { readonly statusCode: number }) => void): void;
}

export interface CalendarStreamCallbacks {
  readonly complete: () => void;
  readonly fail: () => void;
  readonly success: (result: { readonly statusCode: number }) => void;
}

/** One foreground stream; all hints are ASCII and contain no business data. */
export function createCalendarChangeSubscription(input: {
  readonly connect: (callbacks: CalendarStreamCallbacks) => CalendarStreamTask | undefined;
  readonly onChange: () => void;
  readonly onRevoked: () => void;
}): () => void {
  let stopped = false;
  let unsupported = false;
  let task: CalendarStreamTask | undefined;
  let reconnect: ReturnType<typeof setTimeout> | undefined;
  let fallback: ReturnType<typeof setTimeout> | undefined;
  let generation = 0;
  let failures = 0;
  const stop = () => {
    if (stopped) return;
    stopped = true;
    generation++;
    clearTimeout(reconnect);
    clearTimeout(fallback);
    task?.abort();
    task = undefined;
  };
  const revoke = () => {
    stop();
    input.onRevoked();
  };
  const changed = () => {
    input.onChange();
    scheduleFallback();
  };
  const scheduleFallback = () => {
    if (stopped) return;
    clearTimeout(fallback);
    fallback = setTimeout(() => {
      if (stopped) return;
      changed();
    }, 120_000);
  };
  const open = () => {
    if (stopped || unsupported) return;
    const current = ++generation;
    let buffer = '';
    let received = false;
    let ended = false;
    const complete = () => {
      if (stopped || ended || generation !== current) return;
      ended = true;
      if (unsupported) return;
      failures = received ? 0 : failures + 1;
      reconnect = setTimeout(
        open,
        received ? 1_000 : Math.min(60_000, 5_000 * 2 ** Math.min(failures, 4)),
      );
    };
    const status = (result: { readonly statusCode: number }) => {
      if (stopped || generation !== current) return;
      if (result.statusCode === 401 || result.statusCode === 403) revoke();
      else if (result.statusCode === 404) {
        unsupported = true;
        clearTimeout(reconnect);
        task?.abort();
      }
    };
    try {
      task = input.connect({ complete, fail: complete, success: status });
      if (
        task === undefined ||
        typeof task.onChunkReceived !== 'function' ||
        typeof task.onHeadersReceived !== 'function'
      ) {
        unsupported = true;
        clearTimeout(reconnect);
        task?.abort();
        task = undefined;
        return;
      }
      task.onHeadersReceived(status);
      task.onChunkReceived(({ data }) => {
        if (stopped || generation !== current) return;
        for (const byte of new Uint8Array(data)) {
          buffer += String.fromCharCode(byte);
          if (buffer.length > 2048) {
            task?.abort();
            complete();
            return;
          }
          if (!buffer.endsWith('\n\n')) continue;
          const message = buffer.trim();
          buffer = '';
          if (message === 'data:revoked') {
            revoke();
            return;
          }
          if (message === 'data:ready' || message === 'data:changed') {
            received = true;
            changed();
          }
        }
      });
      if (stopped) task.abort();
    } catch {
      unsupported = true;
      clearTimeout(reconnect);
    }
  };
  scheduleFallback();
  open();
  return stop;
}
