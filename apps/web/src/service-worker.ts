import {
  isCalendarRequest,
  isStaticAsset,
  maxScheduleCacheEntries,
  scheduleCacheName,
  selectCacheKeysToRemove,
  shellCacheName,
  shouldCacheResponse,
} from './pwa/cache-logic.js';

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
}

interface FetchEventLike {
  readonly request: Request;
  respondWith(promise: Promise<Response | undefined>): void;
  waitUntil(promise: Promise<unknown>): void;
}

interface ExtendableEventLike {
  waitUntil(promise: Promise<unknown>): void;
}

const workerScope = self as unknown as {
  addEventListener(type: 'activate', listener: (event: ExtendableEventLike) => void): void;
  addEventListener(type: 'fetch', listener: (event: FetchEventLike) => void): void;
  addEventListener(type: 'install', listener: (event: ExtendableEventLike) => void): void;
  addEventListener(
    type: 'notificationclick',
    listener: (event: NotificationClickEventLike) => void,
  ): void;
  addEventListener(type: 'push', listener: (event: PushEventLike) => void): void;
  caches: CacheStorage;
  clients: {
    claim(): Promise<unknown>;
    matchAll(options: {
      includeUncontrolled: boolean;
      type: 'window';
    }): Promise<readonly WindowClientLike[]>;
    openWindow(url: string): Promise<unknown>;
  };
  location: { readonly origin: string };
  registration: {
    showNotification(title: string, options: NotificationOptions): Promise<void>;
  };
  skipWaiting(): Promise<unknown>;
};

workerScope.addEventListener('install', (event) => {
  event.waitUntil(
    workerScope.caches
      .open(shellCacheName)
      .then((cache) => cache.addAll(['/']))
      .catch(() => undefined),
  );
});

workerScope.addEventListener('activate', (event) => {
  event.waitUntil(
    workerScope.caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter((name) => name !== shellCacheName && name !== scheduleCacheName)
            .map((name) => workerScope.caches.delete(name)),
        ),
      )
      .then(() => workerScope.clients.claim()),
  );
});

workerScope.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);
  if (url.origin !== workerScope.location.origin) {
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request, '/'));
    return;
  }

  if (isCalendarRequest(url)) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  if (isStaticAsset(url)) {
    event.respondWith(cacheFirst(request));
  }
});

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

async function networkFirst(request: Request, fallbackUrl: string): Promise<Response | undefined> {
  const cache = await workerScope.caches.open(shellCacheName);
  try {
    const response = await fetch(request);
    if (shouldCacheResponse(response)) {
      await cache.put(request, response.clone());
    }
    return response;
  } catch {
    const fallback = await cache.match(fallbackUrl);
    return fallback ?? cache.match('/');
  }
}

async function cacheFirst(request: Request): Promise<Response | undefined> {
  const cache = await workerScope.caches.open(shellCacheName);
  const cached = await cache.match(request);
  if (cached !== undefined) {
    return cached;
  }

  const response = await fetch(request);
  if (shouldCacheResponse(response)) {
    await cache.put(request, response.clone());
  }
  return response;
}

async function staleWhileRevalidate(request: Request): Promise<Response | undefined> {
  const cache = await workerScope.caches.open(scheduleCacheName);
  const cached = await cache.match(request);
  const networkPromise = fetch(request)
    .then((response) => {
      if (shouldCacheResponse(response)) {
        void putScheduleResponse(cache, request, response.clone());
      }
      return response;
    })
    .catch(() => undefined);

  if (cached !== undefined) {
    void networkPromise.then((response) => response?.body?.cancel());
    return cached;
  }

  return networkPromise;
}

async function putScheduleResponse(
  cache: Cache,
  request: Request,
  response: Response,
): Promise<void> {
  await cache.put(request, response);
  const keys = await cache.keys();
  const keysToRemove = selectCacheKeysToRemove(
    keys.map((key) => key.url),
    maxScheduleCacheEntries,
  );
  await Promise.all(keysToRemove.map((key) => cache.delete(key)));
}

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
