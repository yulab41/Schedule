import type { UpdateUserProfileRequest, UserProfile } from '@schedule/contracts';

export interface ProfileControllerDependencies {
  clearSession(): void;
  getCurrentProfile(): Promise<UserProfile>;
  navigateToLogin(): void;
  replaceSessionProfile(profile: UserProfile): boolean;
  updateProfile(input: UpdateUserProfileRequest): Promise<UserProfile>;
  publish?(state: ProfileControllerState): void;
}

export interface ProfileControllerState {
  readonly draftRealName: string;
  readonly errorMessage: string | undefined;
  readonly isLoggingOut: boolean;
  readonly isSaving: boolean;
  readonly profile: UserProfile | undefined;
}

export interface ProfileController {
  readonly state: ProfileControllerState;
  activate(profile: UserProfile): void;
  logout(): void;
  saveProfile(): Promise<UserProfile>;
  setDraftRealName(realName: string): void;
}

const initialState: ProfileControllerState = {
  draftRealName: '',
  errorMessage: undefined,
  isLoggingOut: false,
  isSaving: false,
  profile: undefined,
};

function messageFor(error: unknown): string {
  return error instanceof Error && error.message.length > 0
    ? error.message
    : '资料暂时无法保存，请稍后重试。';
}

function isConflict(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    ((error as { readonly status?: unknown }).status === 409 ||
      (error as { readonly code?: unknown }).code === 'CONFLICT')
  );
}

export function createProfileController(
  dependencies: ProfileControllerDependencies,
): ProfileController {
  let state = initialState;
  let generation = 0;
  let savePromise: Promise<UserProfile> | undefined;

  const publish = (): void => dependencies.publish?.(state);
  const isCurrent = (operationGeneration: number): boolean => operationGeneration === generation;
  const setState = (next: ProfileControllerState): void => {
    state = next;
    publish();
  };

  return {
    get state() {
      return state;
    },
    activate(profile) {
      generation += 1;
      savePromise = undefined;
      setState({
        draftRealName: profile.realName,
        errorMessage: undefined,
        isLoggingOut: false,
        isSaving: false,
        profile,
      });
    },
    logout() {
      if (state.isLoggingOut) return;
      generation += 1;
      savePromise = undefined;
      setState({ ...state, isLoggingOut: true });
      try {
        dependencies.clearSession();
      } catch {
        // Session cleanup is expected to contain storage faults, but navigation remains mandatory.
      }
      dependencies.navigateToLogin();
    },
    saveProfile() {
      if (savePromise !== undefined) return savePromise;
      const profile = state.profile;
      const realName = state.draftRealName.trim();
      if (profile === undefined) return Promise.reject(new Error('请先登录。'));
      if (realName.length === 0) return Promise.reject(new Error('请输入真实姓名。'));
      const operationGeneration = generation;
      setState({ ...state, errorMessage: undefined, isSaving: true });
      const operation = dependencies
        .updateProfile({ realName, version: profile.version })
        .then((updated) => {
          if (isCurrent(operationGeneration)) {
            dependencies.replaceSessionProfile(updated);
            setState({
              ...state,
              draftRealName: updated.realName,
              errorMessage: undefined,
              isSaving: false,
              profile: updated,
            });
          }
          return updated;
        })
        .catch(async (error: unknown) => {
          if (!isCurrent(operationGeneration)) throw error;
          if (isConflict(error)) {
            try {
              const latest = await dependencies.getCurrentProfile();
              if (isCurrent(operationGeneration)) {
                dependencies.replaceSessionProfile(latest);
                setState({
                  ...state,
                  draftRealName: latest.realName,
                  errorMessage: messageFor(error),
                  isSaving: false,
                  profile: latest,
                });
              }
            } catch {
              if (isCurrent(operationGeneration))
                setState({ ...state, errorMessage: messageFor(error), isSaving: false });
            }
          } else setState({ ...state, errorMessage: messageFor(error), isSaving: false });
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
    setDraftRealName(realName) {
      setState({ ...state, draftRealName: realName });
    },
  };
}
