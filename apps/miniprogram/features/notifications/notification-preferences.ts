import type {
  MemberNotificationPreferences,
  UpdateMemberNotificationPreferencesInput,
} from '@schedule/contracts';

import { formatReminderHours, parseReminderHoursInput } from './notification-logic.js';

export type ReminderMode = 'custom' | 'default' | 'disabled';

export interface NotificationPreferencesContext {
  readonly groupId: string;
  readonly userId: string;
}

export interface NotificationPreferencesControllerDependencies {
  getMyNotificationPreferences(groupId: string): Promise<MemberNotificationPreferences>;
  updateMyNotificationPreferences(
    groupId: string,
    input: UpdateMemberNotificationPreferencesInput,
  ): Promise<MemberNotificationPreferences>;
  publish?(state: NotificationPreferencesState): void;
}

export interface NotificationPreferencesState {
  readonly errorMessage: string | undefined;
  readonly isLoading: boolean;
  readonly isSaving: boolean;
  readonly reminderHoursInput: string;
  readonly reminderMode: ReminderMode;
  readonly wechatNotificationsEnabled: boolean;
}

export interface NotificationPreferencesController {
  readonly state: NotificationPreferencesState;
  activate(context: NotificationPreferencesContext): void;
  load(): Promise<void>;
  save(): Promise<MemberNotificationPreferences>;
  setReminderHoursInput(value: string): void;
  setReminderMode(mode: ReminderMode): void;
  setWechatNotificationsEnabled(value: boolean): void;
}

const initialState: NotificationPreferencesState = {
  errorMessage: undefined,
  isLoading: false,
  isSaving: false,
  reminderHoursInput: '',
  reminderMode: 'default',
  wechatNotificationsEnabled: true,
};

function messageFor(error: unknown): string {
  return error instanceof Error && error.message.length > 0
    ? error.message
    : '提醒偏好暂时无法保存，请稍后重试。';
}

function reminderModeFor(hours: readonly number[] | null): ReminderMode {
  if (hours === null) return 'default';
  return hours.length === 0 ? 'disabled' : 'custom';
}

export function createNotificationPreferencesController(
  dependencies: NotificationPreferencesControllerDependencies,
): NotificationPreferencesController {
  let state = initialState;
  let context: NotificationPreferencesContext | undefined;
  let generation = 0;
  let loadPromise: Promise<void> | undefined;
  let savePromise: Promise<MemberNotificationPreferences> | undefined;

  const publish = (): void => dependencies.publish?.(state);
  const isCurrent = (operationGeneration: number): boolean => operationGeneration === generation;
  const setState = (next: NotificationPreferencesState): void => {
    state = next;
    publish();
  };
  const applyPreferences = (preferences: MemberNotificationPreferences): void => {
    setState({
      ...state,
      errorMessage: undefined,
      isLoading: false,
      isSaving: false,
      reminderHoursInput: formatReminderHours(preferences.dutyReminderHours),
      reminderMode: reminderModeFor(preferences.dutyReminderHours),
      wechatNotificationsEnabled: preferences.wechatNotificationsEnabled,
    });
  };

  return {
    get state() {
      return state;
    },
    activate(nextContext) {
      if (context?.groupId === nextContext.groupId && context.userId === nextContext.userId) return;
      context = nextContext;
      generation += 1;
      loadPromise = undefined;
      savePromise = undefined;
      setState(initialState);
    },
    load() {
      if (loadPromise !== undefined) return loadPromise;
      if (context === undefined) return Promise.reject(new Error('请先选择群组。'));
      const operationGeneration = generation;
      const groupId = context.groupId;
      setState({ ...state, errorMessage: undefined, isLoading: true });
      const operation = dependencies
        .getMyNotificationPreferences(groupId)
        .then((preferences) => {
          if (isCurrent(operationGeneration)) applyPreferences(preferences);
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
    },
    save() {
      if (savePromise !== undefined) return savePromise;
      if (context === undefined) return Promise.reject(new Error('请先选择群组。'));
      let dutyReminderHours: readonly number[] | null;
      try {
        dutyReminderHours =
          state.reminderMode === 'default'
            ? null
            : state.reminderMode === 'disabled'
              ? []
              : parseReminderHoursInput(state.reminderHoursInput);
      } catch (error) {
        setState({ ...state, errorMessage: messageFor(error) });
        return Promise.reject(error);
      }
      const input: UpdateMemberNotificationPreferencesInput = {
        dutyReminderHours,
        wechatNotificationsEnabled: state.wechatNotificationsEnabled,
      };
      const operationGeneration = generation;
      const groupId = context.groupId;
      setState({ ...state, errorMessage: undefined, isSaving: true });
      const operation = dependencies
        .updateMyNotificationPreferences(groupId, input)
        .then((preferences) => {
          if (isCurrent(operationGeneration)) applyPreferences(preferences);
          return preferences;
        })
        .catch((error: unknown) => {
          if (isCurrent(operationGeneration))
            setState({ ...state, errorMessage: messageFor(error), isSaving: false });
          throw error;
        });
      savePromise = operation;
      void operation.then(
        () => {
          if (savePromise === operation) savePromise = undefined;
        },
        () => {
          if (savePromise === operation) savePromise = undefined;
        },
      );
      return operation;
    },
    setReminderHoursInput(value) {
      setState({ ...state, reminderHoursInput: value });
    },
    setReminderMode(mode) {
      setState({ ...state, reminderMode: mode });
    },
    setWechatNotificationsEnabled(value) {
      setState({ ...state, wechatNotificationsEnabled: value });
    },
  };
}
