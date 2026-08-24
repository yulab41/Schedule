import type { ClientCapabilityName, ClientVersion } from '@schedule/contracts';
import type { FastifyRequest, preHandlerHookHandler } from 'fastify';

import type { AuthenticatedIdentity } from '../adapters/auth/auth-port.js';
import type { ClientCapabilityPolicy } from '../modules/client-capabilities/client-capability-policy.js';
import {
  resolveMiniClientVersion,
  resolveRequiredMiniClientVersion,
  unsupportedClientVersionError,
} from '../modules/client-capabilities/client-version-headers.js';
import { ApiError } from './error-handler.js';

export function assertClientCapability(
  request: FastifyRequest,
  identity: AuthenticatedIdentity,
  policy: ClientCapabilityPolicy,
): void {
  if (identity.clientPlatform !== 'miniprogram') {
    return;
  }

  if (isPrivacyEscapeRoute(request)) {
    return;
  }
  const capabilities = resolveCapabilities(identity.clientVersion, policy);
  const capability = classifyRoute(request);
  if (capability === undefined || !capabilities[capability]) {
    throw disabledCapabilityError();
  }
}

export function createPublicMiniCapabilityGuard(
  policy: ClientCapabilityPolicy,
): preHandlerHookHandler {
  return async (request) => {
    const clientVersion = resolvePublicMiniClientVersion(request, policy);
    if (clientVersion === undefined) return;
    const capabilities = policy.resolve('miniprogram', clientVersion);
    if (capabilities === undefined) throw unsupportedClientVersionError();
    if (!capabilities.guest) throw disabledCapabilityError();
  };
}

export function createPublicMiniCoreCapabilityGuard(
  policy: ClientCapabilityPolicy,
): preHandlerHookHandler {
  return async (request) => {
    const clientVersion = resolveRequiredMiniClientVersion(request, policy);
    const capabilities = policy.resolve('miniprogram', clientVersion);
    if (capabilities === undefined) throw unsupportedClientVersionError();
    if (!capabilities.global || !capabilities.core) throw disabledCapabilityError();
  };
}

function resolvePublicMiniClientVersion(
  request: FastifyRequest,
  policy: ClientCapabilityPolicy,
): ClientVersion | undefined {
  return resolveMiniClientVersion(request, policy);
}

function resolveCapabilities(
  clientVersion: ClientVersion | undefined,
  policy: ClientCapabilityPolicy,
) {
  const capabilities =
    clientVersion === undefined
      ? policy.resolveLegacyMini()
      : policy.resolve('miniprogram', clientVersion);
  if (capabilities === undefined) {
    throw unsupportedClientVersionError();
  }
  return capabilities;
}

function isPrivacyEscapeRoute(request: FastifyRequest): boolean {
  const route = request.routeOptions.url;
  if (route === undefined) return false;
  const method = request.method;
  if (method === 'POST' && route === '/me/wechat/miniprogram/unbind') {
    return true;
  }
  if (route !== '/groups/:groupId/mobile-phone-consent') {
    return false;
  }
  if (method === 'GET') {
    return true;
  }
  return method === 'PUT' && readConsentDecision(request.body) === false;
}

function readConsentDecision(value: unknown): boolean | undefined {
  if (value === null || typeof value !== 'object') return undefined;
  const consented = (value as { consented?: unknown }).consented;
  return typeof consented === 'boolean' ? consented : undefined;
}

export function classifyRoute(request: FastifyRequest): ClientCapabilityName | undefined {
  const route = request.routeOptions.url;
  if (route === undefined) return undefined;
  const method = request.method;

  if (isCoreRoute(method, route)) return 'core';
  if (isWorkflowRoute(route)) return 'workflows';
  if (isExternalMessageRoute(route)) return 'externalMessages';
  if (isGuestRoute(route)) return 'guest';
  if (isInsightsRoute(route)) return 'insights';
  if (isOrganizationRoute(route)) return 'organization';
  return undefined;
}

function isCoreRoute(method: string, route: string): boolean {
  if (
    route === '/users/me' ||
    route === '/auth/password/status' ||
    route === '/auth/password' ||
    route === '/me/password' ||
    route === '/invites/resolve' ||
    route === '/invites/accept' ||
    route === '/groups/:groupId/mobile-phone-consent'
  ) {
    return true;
  }
  if (
    route.includes('/manual-schedule-templates') ||
    route.includes('/schedule-periods') ||
    route.includes('/schedule-publish-mode') ||
    route.includes('/schedules/') ||
    route.endsWith('/schedules/generate') ||
    route.endsWith('/schedules/generate-preview') ||
    route.includes('/past-schedules')
  ) {
    return true;
  }
  if (route === '/holidays' || route.startsWith('/groups/:groupId/calendar')) {
    return method === 'GET' || route.includes('calendar-preferences') || route.includes('settings');
  }
  if (route.includes('/calendar-preferences') || route.includes('/calendar-settings')) {
    return true;
  }
  if (method !== 'GET') return false;
  return (
    route === '/groups' ||
    route === '/groups/catalog' ||
    route === '/groups/:groupId/members' ||
    route === '/groups/:groupId/contacts' ||
    route === '/groups/:groupId/claim-requests' ||
    route === '/groups/:groupId/scheduling-config'
  );
}

function isWorkflowRoute(route: string): boolean {
  return (
    route.includes('/leave-requests') ||
    route.includes('/leave-reflow-strategy') ||
    route.includes('/swaps') ||
    route.includes('/duty-adjustments')
  );
}

function isExternalMessageRoute(route: string): boolean {
  return (
    route === '/notifications/push-config' ||
    route === '/notifications/push-subscription' ||
    route.includes('/notification-settings') ||
    route.includes('/notification-preferences')
  );
}

function isGuestRoute(route: string): boolean {
  return (
    route.includes('/visitor-key') ||
    route.includes('/group-qr') ||
    route.includes('/guest-calendar') ||
    route.includes('/visitor-access')
  );
}

function isInsightsRoute(route: string): boolean {
  return (
    route === '/notifications' ||
    route.startsWith('/notifications/') ||
    route.includes('/events') ||
    route.includes('/statistics') ||
    route.includes('/exports')
  );
}

function isOrganizationRoute(route: string): boolean {
  return (
    route === '/groups' ||
    route.startsWith('/groups/') ||
    route.startsWith('/invites/') ||
    route.startsWith('/platform') ||
    route.startsWith('/users') ||
    route.includes('/directory')
  );
}

function disabledCapabilityError(): ApiError {
  return new ApiError({
    code: 'CLIENT_CAPABILITY_DISABLED',
    statusCode: 503,
    userMessage: '当前客户端功能已暂停，请稍后重试。',
  });
}
