import { z } from 'zod';

export const CLIENT_CAPABILITY_NAMES = [
  'global',
  'core',
  'workflows',
  'organization',
  'insights',
  'externalMessages',
  'guest',
] as const;

export const CLIENT_PLATFORM_HEADER_NAME = 'x-schedule-client-platform';
export const CLIENT_VERSION_HEADER_NAME = 'x-schedule-client-version';

export const clientPlatformSchema = z.literal('miniprogram');
export type ClientPlatform = z.infer<typeof clientPlatformSchema>;

const semverLikePattern =
  /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*))*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/u;

export const clientVersionSchema = z.string().min(1).max(64).regex(semverLikePattern);
export type ClientVersion = z.infer<typeof clientVersionSchema>;

export const clientCapabilityNameSchema = z.enum(CLIENT_CAPABILITY_NAMES);
export type ClientCapabilityName = z.infer<typeof clientCapabilityNameSchema>;

export const clientCapabilityQuerySchema = z
  .object({
    platform: clientPlatformSchema,
    version: clientVersionSchema,
  })
  .strict();
export type ClientCapabilityQuery = z.infer<typeof clientCapabilityQuerySchema>;

export const clientCapabilityResponseSchema = z
  .object({
    platform: clientPlatformSchema,
    version: clientVersionSchema,
    global: z.boolean(),
    core: z.boolean(),
    workflows: z.boolean(),
    organization: z.boolean(),
    insights: z.boolean(),
    externalMessages: z.boolean(),
    guest: z.boolean(),
  })
  .strict();
export type ClientCapabilityResponse = z.infer<typeof clientCapabilityResponseSchema>;
