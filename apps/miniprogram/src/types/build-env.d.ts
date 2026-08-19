declare const __MINIPROGRAM_API_BASE_URL__: string;
declare const __MINIPROGRAM_BUILD_PROFILE__: 'staging' | 'production';

declare function App<TOptions extends Record<string, unknown>>(options: TOptions): void;
declare function Component<TOptions extends Record<string, unknown>>(options: TOptions): void;
declare function Page<TOptions extends Record<string, unknown>>(options: TOptions): void;

interface MiniProgramSharedValue<T> {
  value: T;
}

interface MiniProgramWorkletAnimationConfig {
  readonly duration: number;
  readonly easing: unknown;
}

declare const wx: {
  readonly worklet: {
    readonly Easing: {
      bezier(x1: number, y1: number, x2: number, y2: number): unknown;
    };
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
