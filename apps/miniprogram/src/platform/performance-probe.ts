export type NativePerformanceMetric =
  'core-ready' | 'foreground-ready' | 'maximum-matrix-render' | 'tap-feedback';

export interface NativePerformanceMeasurement {
  readonly durationMs: number;
  readonly maxMs: number;
  readonly metric: NativePerformanceMetric;
  readonly sampleCount: number;
  readonly samplesMs: readonly number[];
}

export interface NativePerformanceProbe {
  complete(metric: NativePerformanceMetric): NativePerformanceMeasurement | undefined;
  start(metric: NativePerformanceMetric): void;
}

export function createNativePerformanceProbe(
  now: () => number = readNativePerformanceClock,
): NativePerformanceProbe {
  const starts = new Map<NativePerformanceMetric, number>();
  const samples = new Map<NativePerformanceMetric, number[]>();
  return {
    complete(metric) {
      const startedAt = starts.get(metric);
      if (startedAt === undefined) return undefined;
      starts.delete(metric);
      const durationMs = Math.max(0, Math.round(now() - startedAt));
      const metricSamples = [...(samples.get(metric) ?? []), durationMs].slice(-20);
      samples.set(metric, metricSamples);
      return {
        durationMs,
        maxMs: Math.max(...metricSamples),
        metric,
        sampleCount: metricSamples.length,
        samplesMs: metricSamples,
      };
    },
    start(metric) {
      starts.set(metric, now());
    },
  };
}

export function formatNativePerformanceEvidence(
  measurement: NativePerformanceMeasurement,
  options: {
    readonly label: string;
    readonly requiredSamples: number;
    readonly thresholdMs: number;
  },
): string {
  return (
    `P6 性能 · ${options.label} ${measurement.durationMs}ms · ` +
    `本页 ${measurement.sampleCount}/${options.requiredSamples} 次 · ` +
    `最大 ${measurement.maxMs}ms · 门槛 ≤${options.thresholdMs}ms`
  );
}

function readNativePerformanceClock(): number {
  const runtime =
    typeof wx === 'undefined'
      ? undefined
      : (wx as unknown as { readonly getPerformance?: () => { now(): number } });
  if (typeof runtime?.getPerformance === 'function') {
    return runtime.getPerformance().now();
  }
  return Date.now();
}
