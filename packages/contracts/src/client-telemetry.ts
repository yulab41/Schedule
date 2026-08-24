import { z } from 'zod';

export const CLIENT_TELEMETRY_PAGE_NAMES = [
  'app',
  'identity',
  'workbench',
  'manual-matrix',
  'manual-schedule',
  'backfill',
  'group-settings',
  'unknown',
] as const;
export const clientTelemetryPageSchema = z.enum(CLIENT_TELEMETRY_PAGE_NAMES);
export type ClientTelemetryPage = z.infer<typeof clientTelemetryPageSchema>;

export const CLIENT_TELEMETRY_DEVICE_TIERS = ['low', 'medium', 'high', 'unknown'] as const;
export const clientTelemetryDeviceTierSchema = z.enum(CLIENT_TELEMETRY_DEVICE_TIERS);
export type ClientTelemetryDeviceTier = z.infer<typeof clientTelemetryDeviceTierSchema>;

export const CLIENT_TELEMETRY_NETWORK_TYPES = [
  'none',
  'wifi',
  '2g',
  '3g',
  '4g',
  '5g',
  'unknown',
] as const;
export const clientTelemetryNetworkTypeSchema = z.enum(CLIENT_TELEMETRY_NETWORK_TYPES);
export type ClientTelemetryNetworkType = z.infer<typeof clientTelemetryNetworkTypeSchema>;

export const CLIENT_TELEMETRY_ERROR_CODES = [
  'AUTHENTICATION_REQUIRED',
  'CLIENT_CAPABILITY_DISABLED',
  'CLIENT_VERSION_UNSUPPORTED',
  'INVALID_RESPONSE',
  'MINI_RUNTIME_ERROR',
  'NETWORK_ERROR',
  'TIMEOUT',
  'UNKNOWN',
] as const;
export const clientTelemetryErrorCodeSchema = z.enum(CLIENT_TELEMETRY_ERROR_CODES);
export type ClientTelemetryErrorCode = z.infer<typeof clientTelemetryErrorCodeSchema>;

export const CLIENT_TELEMETRY_PERFORMANCE_METRICS = [
  'core-ready',
  'foreground-ready',
  'maximum-matrix-render',
  'tap-feedback',
] as const;
export const clientTelemetryPerformanceMetricSchema = z.enum(CLIENT_TELEMETRY_PERFORMANCE_METRICS);
export type ClientTelemetryPerformanceMetric = z.infer<
  typeof clientTelemetryPerformanceMetricSchema
>;

export const clientTelemetryPerformanceSchema = z
  .object({
    durationMs: z.number().int().min(0).max(600_000).finite(),
    metric: clientTelemetryPerformanceMetricSchema,
  })
  .strict();
export type ClientTelemetryPerformance = z.infer<typeof clientTelemetryPerformanceSchema>;

export const clientTelemetryEventSchema = z
  .object({
    deviceTier: clientTelemetryDeviceTierSchema,
    errorCode: clientTelemetryErrorCodeSchema.optional(),
    networkType: clientTelemetryNetworkTypeSchema,
    page: clientTelemetryPageSchema,
    performance: clientTelemetryPerformanceSchema.optional(),
    stackFingerprint: z
      .string()
      .regex(/^[0-9a-f]{64}$/u)
      .optional(),
  })
  .strict()
  .refine((event) => event.errorCode !== undefined || event.performance !== undefined, {
    message: 'telemetry event requires an error or performance sample',
  })
  .refine((event) => event.stackFingerprint === undefined || event.errorCode !== undefined, {
    message: 'stack fingerprint requires an error code',
  });
export type ClientTelemetryEvent = z.infer<typeof clientTelemetryEventSchema>;

export const clientTelemetryRequestSchema = z
  .object({
    events: z.array(clientTelemetryEventSchema).min(1).max(10),
  })
  .strict();
export type ClientTelemetryRequest = z.infer<typeof clientTelemetryRequestSchema>;
