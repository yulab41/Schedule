import type { ClientCapabilityResponse } from '@schedule/contracts';

export const clientCapabilityGoldenResponse = {
  platform: 'miniprogram',
  version: '0.1.0-p6.20260824.79',
  global: true,
  core: true,
  workflows: false,
  organization: true,
  insights: false,
  externalMessages: false,
  guest: true,
} as const satisfies ClientCapabilityResponse;
