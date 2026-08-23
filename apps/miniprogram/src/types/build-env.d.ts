declare const __MINIPROGRAM_API_BASE_URL__: string;
declare const __MINIPROGRAM_BUILD_COMMIT__: string;
declare const __MINIPROGRAM_BUILD_PROFILE__: 'staging' | 'production';
declare const __MINIPROGRAM_BUILD_VERSION__: string;

declare function App<TOptions extends Record<string, unknown>>(options: TOptions): void;
declare function Component<TOptions extends Record<string, unknown>>(options: TOptions): void;
declare function getApp<TApp = Record<string, unknown>>(): TApp;
declare function Page<TOptions extends Record<string, unknown>>(options: TOptions): void;
declare function setTimeout(callback: () => void, milliseconds: number): unknown;

interface MiniProgramSharedValue<T> {
  value: T;
}

interface MiniProgramWorkletAnimationConfig {
  readonly duration: number;
  readonly easing: unknown;
}

interface MiniProgramWindowInfo {
  readonly screenHeight: number;
  readonly safeArea?: {
    readonly bottom: number;
    readonly height: number;
    readonly left: number;
    readonly right: number;
    readonly top: number;
    readonly width: number;
  };
  readonly statusBarHeight?: number;
  readonly windowHeight: number;
  readonly windowWidth: number;
}

interface MiniProgramRect {
  readonly bottom: number;
  readonly height: number;
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly width: number;
}

interface MiniProgramSelectorQuery {
  boundingClientRect(): MiniProgramSelectorQuery;
  exec(callback: (results: readonly (MiniProgramRect | null | undefined)[]) => void): void;
  select(selector: string): MiniProgramSelectorQuery;
}

interface MiniProgramAppBaseInfo {
  readonly SDKVersion: string;
  readonly version: string;
}

interface MiniProgramDeviceInfo {
  readonly model: string;
  readonly platform: string;
  readonly system: string;
}

interface MiniProgramRequestOptions {
  readonly data?: unknown;
  readonly fail: (error: unknown) => void;
  readonly header: Readonly<Record<string, string>>;
  readonly method: 'DELETE' | 'GET' | 'POST' | 'PUT';
  readonly success: (response: { readonly data: unknown; readonly statusCode: number }) => void;
  readonly timeout?: number;
  readonly url: string;
}

interface MiniProgramLoginSuccess {
  readonly code: string;
}

declare const wx: {
  createSelectorQuery(): MiniProgramSelectorQuery;
  getAppBaseInfo(): MiniProgramAppBaseInfo;
  getDeviceInfo(): MiniProgramDeviceInfo;
  getMenuButtonBoundingClientRect(): MiniProgramRect;
  getStorageInfoSync(): { readonly keys: readonly string[] };
  getWindowInfo(): MiniProgramWindowInfo;
  getStorageSync(key: string): unknown;
  login(options: {
    readonly fail: (error: unknown) => void;
    readonly success: (response: MiniProgramLoginSuccess) => void;
  }): unknown;
  makePhoneCall(options: {
    readonly fail?: (error: unknown) => void;
    readonly phoneNumber: string;
    readonly success?: () => void;
  }): unknown;
  removeStorageSync(key: string): void;
  request(options: MiniProgramRequestOptions): unknown;
  setStorageSync(key: string, value: unknown): void;
  navigateBack(options?: { readonly delta?: number }): void;
  navigateTo(options: { readonly url: string }): void;
  readonly worklet: {
    readonly Easing: {
      bezier(x1: number, y1: number, x2: number, y2: number): unknown;
    };
    cancelAnimation<T>(sharedValue: MiniProgramSharedValue<T>): void;
    decay(
      options: {
        readonly clamp?: readonly [number, number];
        readonly deceleration?: number;
        readonly velocity?: number;
      },
      callback?: (finished: boolean) => void,
    ): number;
    runOnJS<TArguments extends readonly unknown[]>(
      callback: (...arguments_: TArguments) => void,
    ): (...arguments_: TArguments) => void;
    readonly scrollViewContext: {
      scrollTo(
        reference: unknown,
        options: {
          readonly animated?: boolean;
          readonly duration?: number;
          readonly left?: number;
          readonly top?: number;
        },
      ): void;
    };
    shared<T>(initialValue: T): MiniProgramSharedValue<T>;
    timing(
      target: number,
      config: MiniProgramWorkletAnimationConfig,
      callback?: (finished: boolean) => void,
    ): number;
  };
};
