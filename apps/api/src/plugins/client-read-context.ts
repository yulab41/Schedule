import type { FastifyRequest } from 'fastify';

// Presentation only: password sessions have no signed platform claim. The Mini request
// header may select a smaller list, but must never grant permissions or capabilities.
export function isMiniprogramRead(request: FastifyRequest): boolean {
  return (
    request.authenticatedIdentity?.clientPlatform === 'miniprogram' ||
    request.headers['x-schedule-client-platform'] === 'miniprogram'
  );
}
