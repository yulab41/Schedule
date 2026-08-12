import type { NotificationPage, NotificationRecord } from '@schedule/contracts';

export interface NotificationContext {
  readonly userId: string;
}

export interface NotificationControllerDependencies {
  getUnreadCount(): Promise<{ readonly unreadCount: number }>;
  listNotifications(cursor?: string, pageSize?: number): Promise<NotificationPage>;
  markAllNotificationsRead(): Promise<{ readonly count: number }>;
  markNotificationRead(notificationId: string): Promise<NotificationRecord>;
  publish?(state: NotificationControllerState): void;
}

export interface NotificationControllerState {
  readonly errorMessage: string | undefined;
  readonly hasLoaded: boolean;
  readonly isLoading: boolean;
  readonly isMarkingAllRead: boolean;
  readonly nextCursor: string | undefined;
  readonly notifications: readonly NotificationRecord[];
  readonly unreadCount: number;
}

export interface NotificationController {
  readonly state: NotificationControllerState;
  activate(context: NotificationContext): void;
  loadMore(): Promise<void>;
  markAllRead(): Promise<void>;
  markRead(notificationId: string): Promise<void>;
  refresh(): Promise<void>;
  retry(): Promise<void>;
}

const initialState: NotificationControllerState = {
  errorMessage: undefined,
  hasLoaded: false,
  isLoading: false,
  isMarkingAllRead: false,
  nextCursor: undefined,
  notifications: [],
  unreadCount: 0,
};

function messageFor(error: unknown): string {
  return error instanceof Error && error.message.length > 0
    ? error.message
    : '通知暂时无法加载，请稍后重试。';
}

export function createNotificationController(
  dependencies: NotificationControllerDependencies,
): NotificationController {
  let state = initialState;
  let context: NotificationContext | undefined;
  let generation = 0;
  let loadPromise: Promise<void> | undefined;
  let markAllPromise: Promise<void> | undefined;
  const markReadPromises = new Map<string, Promise<void>>();
  let loadedCursors = new Set<string | undefined>();

  const publish = (): void => dependencies.publish?.(state);
  const isCurrent = (operationGeneration: number): boolean => operationGeneration === generation;
  const setState = (next: NotificationControllerState): void => {
    state = next;
    publish();
  };

  const load = (cursor: string | undefined, replace: boolean): Promise<void> => {
    if (context === undefined) return Promise.reject(new Error('请先登录。'));
    if (loadPromise !== undefined) return loadPromise;
    if (!replace && (cursor === undefined || loadedCursors.has(cursor))) return Promise.resolve();

    const operationGeneration = generation;
    setState({ ...state, errorMessage: undefined, isLoading: true });
    const operation = dependencies
      .listNotifications(cursor, 30)
      .then((page) => {
        if (!isCurrent(operationGeneration)) return;
        const nextCursor =
          page.nextCursor === cursor || loadedCursors.has(page.nextCursor)
            ? undefined
            : page.nextCursor;
        loadedCursors.add(cursor);
        setState({
          ...state,
          hasLoaded: true,
          isLoading: false,
          nextCursor,
          notifications: replace
            ? page.notifications
            : [...state.notifications, ...page.notifications],
          unreadCount: page.unreadCount,
        });
      })
      .catch((error: unknown) => {
        if (isCurrent(operationGeneration))
          setState({ ...state, errorMessage: messageFor(error), isLoading: false });
      });
    loadPromise = operation;
    void operation.then(
      () => {
        if (loadPromise === operation) loadPromise = undefined;
      },
      () => {
        if (loadPromise === operation) loadPromise = undefined;
      },
    );
    return operation;
  };

  return {
    get state() {
      return state;
    },
    activate(nextContext) {
      if (context?.userId === nextContext.userId) return;
      context = nextContext;
      generation += 1;
      loadPromise = undefined;
      markAllPromise = undefined;
      markReadPromises.clear();
      loadedCursors = new Set();
      setState(initialState);
    },
    loadMore() {
      if (!state.hasLoaded) return load(undefined, true);
      if (state.nextCursor === undefined) return Promise.resolve();
      return load(state.nextCursor, false);
    },
    markAllRead() {
      if (markAllPromise !== undefined) return markAllPromise;
      if (context === undefined) return Promise.reject(new Error('请先登录。'));
      const operationGeneration = generation;
      setState({ ...state, errorMessage: undefined, isMarkingAllRead: true });
      const operation = dependencies
        .markAllNotificationsRead()
        .then(() => dependencies.getUnreadCount())
        .then(({ unreadCount }) => {
          if (!isCurrent(operationGeneration)) return;
          setState({
            ...state,
            isMarkingAllRead: false,
            notifications: state.notifications.map((notification) => ({
              ...notification,
              isRead: true,
            })),
            unreadCount,
          });
        })
        .catch((error: unknown) => {
          if (isCurrent(operationGeneration))
            setState({ ...state, errorMessage: messageFor(error), isMarkingAllRead: false });
        });
      markAllPromise = operation;
      void operation.then(
        () => {
          if (markAllPromise === operation) markAllPromise = undefined;
        },
        () => {
          if (markAllPromise === operation) markAllPromise = undefined;
        },
      );
      return operation;
    },
    markRead(notificationId) {
      const existing = state.notifications.find(
        (notification) => notification.id === notificationId,
      );
      if (existing === undefined || existing.isRead) return Promise.resolve();
      const activeFlight = markReadPromises.get(notificationId);
      if (activeFlight !== undefined) return activeFlight;
      if (context === undefined) return Promise.reject(new Error('请先登录。'));
      const operationGeneration = generation;
      const operation = dependencies
        .markNotificationRead(notificationId)
        .then((updated) =>
          dependencies.getUnreadCount().then(({ unreadCount }) => ({ updated, unreadCount })),
        )
        .then(({ updated, unreadCount }) => {
          if (!isCurrent(operationGeneration)) return;
          setState({
            ...state,
            errorMessage: undefined,
            notifications: state.notifications.map((notification) =>
              notification.id === updated.id ? updated : notification,
            ),
            unreadCount,
          });
        })
        .catch((error: unknown) => {
          if (isCurrent(operationGeneration))
            setState({ ...state, errorMessage: messageFor(error) });
        });
      markReadPromises.set(notificationId, operation);
      void operation.then(
        () => {
          if (markReadPromises.get(notificationId) === operation)
            markReadPromises.delete(notificationId);
        },
        () => {
          if (markReadPromises.get(notificationId) === operation)
            markReadPromises.delete(notificationId);
        },
      );
      return operation;
    },
    refresh() {
      if (loadPromise !== undefined) return loadPromise;
      loadedCursors = new Set();
      return load(undefined, true);
    },
    retry() {
      return state.hasLoaded && state.nextCursor !== undefined ? this.loadMore() : this.refresh();
    },
  };
}
