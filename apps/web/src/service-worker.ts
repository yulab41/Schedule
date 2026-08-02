interface PushNotificationPayload {
  readonly body?: string;
  readonly data?: { readonly notificationId?: string };
  readonly title?: string;
  readonly url?: string;
}

interface ResolvedPushNotification {
  readonly body: string;
  readonly title: string;
  readonly url: string;
}

interface PushEventLike {
  readonly data?: { readonly json: () => unknown };
  waitUntil(promise: Promise<unknown>): void;
}

interface NotificationClickEventLike {
  readonly notification: {
    close(): void;
    readonly data?: unknown;
  };
  waitUntil(promise: Promise<unknown>): void;
}

interface WindowClientLike {
  focus(): Promise<unknown>;
  readonly url: string;
}

const workerScope = self as unknown as {
  addEventListener(type: 'push', listener: (event: PushEventLike) => void): void;
  addEventListener(
    type: 'notificationclick',
    listener: (event: NotificationClickEventLike) => void,
  ): void;
  clients: {
    matchAll(options: {
      includeUncontrolled: boolean;
      type: 'window';
    }): Promise<readonly WindowClientLike[]>;
    openWindow(url: string): Promise<unknown>;
  };
  registration: {
    showNotification(title: string, options: NotificationOptions): Promise<void>;
  };
};

workerScope.addEventListener('push', (event) => {
  const payload = parsePushPayload(event.data?.json());
  event.waitUntil(
    workerScope.registration.showNotification(payload.title, {
      body: payload.body,
      data: { url: payload.url },
      tag: 'schedule-update',
    }),
  );
});

workerScope.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data as { url?: string } | undefined)?.url ?? '/';
  event.waitUntil(
    workerScope.clients
      .matchAll({ includeUncontrolled: true, type: 'window' })
      .then((windowClients) => {
        const existingClient = windowClients[0];
        if (existingClient !== undefined) {
          return existingClient.focus();
        }
        return workerScope.clients.openWindow(targetUrl);
      }),
  );
});

function parsePushPayload(value: unknown): ResolvedPushNotification {
  if (value === null || typeof value !== 'object') {
    return { body: '排班信息有更新', title: '排班信息有更新', url: '/' };
  }

  const payload = value as PushNotificationPayload;
  return {
    ...(typeof payload.body === 'string' && payload.body.length > 0
      ? { body: payload.body }
      : { body: '排班信息有更新' }),
    ...(typeof payload.title === 'string' && payload.title.length > 0
      ? { title: payload.title }
      : { title: '排班信息有更新' }),
    ...(typeof payload.url === 'string' ? { url: payload.url } : { url: '/' }),
  };
}
