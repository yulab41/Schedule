declare const __MINIPROGRAM_API_BASE_URL__: string;
declare const __MINIPROGRAM_BUILD_COMMIT__: string;
declare const __MINIPROGRAM_BUILD_DESCRIPTION__: string;
declare const __MINIPROGRAM_BUILD_DIRTY__: boolean;
declare const __MINIPROGRAM_BUILD_PROFILE__: 'staging' | 'production';
declare const __MINIPROGRAM_BUILD_TIME__: string;
declare const __MINIPROGRAM_BUILD_VERSION__: string;
/** Requested renderer from `src/app.json`: 'webview' | 'skyline'. */
declare const __MINIPROGRAM_RENDERER__: string;

declare function App<TOptions extends Record<string, unknown>>(options: TOptions): void;
declare function Component<TOptions extends Record<string, unknown>>(options: TOptions): void;
declare function getApp<TApp = Record<string, unknown>>(): TApp;
declare function Page<TOptions extends Record<string, unknown>>(options: TOptions): void;
declare function setTimeout(callback: () => void, milliseconds: number): unknown;
declare function clearTimeout(timeout: unknown): void;

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
  readonly fontSizeSetting?: number;
  readonly language?: string;
  readonly theme?: string;
  readonly version: string;
}

interface MiniProgramDeviceInfo {
  readonly benchmarkLevel?: number;
  readonly brand?: string;
  readonly model: string;
  readonly platform: string;
  readonly system: string;
}

interface MiniProgramRequestOptions {
  readonly data?: unknown;
  readonly enableProfile?: boolean;
  readonly fail: (error: unknown) => void;
  readonly header: Readonly<Record<string, string>>;
  readonly method: 'DELETE' | 'GET' | 'POST' | 'PUT';
  readonly success: (response: {
    readonly data: unknown;
    readonly header?: Readonly<Record<string, unknown>>;
    readonly profile?: unknown;
    readonly statusCode: number;
  }) => void;
  readonly timeout?: number;
  readonly url: string;
}

interface MiniProgramLoginSuccess {
  readonly code: string;
}

interface MiniProgramNetworkTypeOptions {
  readonly fail: (error: unknown) => void;
  readonly success: (response: { readonly networkType?: unknown }) => void;
}

declare const wx: {
  getUpdateManager?(): {
    onUpdateReady(callback: () => void): void;
    onUpdateFailed(callback: () => void): void;
    applyUpdate(): void;
  };
  getAccountInfoSync?(): {
    readonly miniProgram?: {
      readonly envVersion?: string;
      readonly version?: string;
    };
  };
  createSelectorQuery(): MiniProgramSelectorQuery;
  getAppBaseInfo(): MiniProgramAppBaseInfo;
  getDeviceInfo(): MiniProgramDeviceInfo;
  getNetworkType(options: MiniProgramNetworkTypeOptions): unknown;
  getMenuButtonBoundingClientRect(): MiniProgramRect;
  getStorageInfoSync(): {
    readonly currentSize?: number;
    readonly keys: readonly string[];
    readonly limitSize?: number;
  };
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
  setClipboardData?(options: {
    readonly data: string;
    readonly fail?: (error: unknown) => void;
    readonly success?: () => void;
  }): unknown;
  navigateBack(options?: {
    readonly delta?: number;
    readonly fail?: (error: unknown) => void;
  }): void;
  navigateTo(options: { readonly fail?: (error: unknown) => void; readonly url: string }): void;
  reLaunch(options: { readonly fail?: (error: unknown) => void; readonly url: string }): void;
  redirectTo(options: { readonly fail?: (error: unknown) => void; readonly url: string }): void;
  showModal(options: {
    readonly cancelText?: string;
    readonly confirmText?: string;
    readonly content: string;
    readonly fail?: (error: unknown) => void;
    readonly success?: (result: { readonly cancel: boolean; readonly confirm: boolean }) => void;
    readonly title?: string;
  }): void;
  showToast?(options: { readonly icon: 'none' | 'success'; readonly title: string }): void;
};
