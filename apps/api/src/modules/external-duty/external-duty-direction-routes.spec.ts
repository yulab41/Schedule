import Fastify from 'fastify';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { registerAuthentication } from '../../plugins/authenticate.js';
import { registerErrorHandler } from '../../plugins/error-handler.js';
import { registerRequestContext } from '../../plugins/request-context.js';
import { registerExternalDutyRoutes } from './external-duty-routes.js';
import type { ExternalDutyService } from './external-duty-service.js';

const apps: ReturnType<typeof Fastify>[] = [];
afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});
const input = { date: '2026-10-22', expectedFingerprint: 'a'.repeat(64), direction: 'to_local' };
function fixture() {
  const app = Fastify({ logger: false });
  apps.push(app);
  registerRequestContext(app);
  registerErrorHandler(app);
  registerAuthentication(app, {
    authenticate: async ({ authorization }) =>
      authorization === 'Bearer valid' ? { cloudbaseUid: 'admin' } : undefined,
  });
  const service = {
    previewDirection: vi.fn(async () => ({ changes: [] })),
    applyDirection: vi.fn(async () => ({ verified: true })),
  };
  registerExternalDutyRoutes(app, service as unknown as ExternalDutyService);
  return { app, service };
}
describe('external duty direction request boundary', () => {
  it('requires authentication on both manual routes', async () => {
    const { app, service } = fixture();
    for (const path of ['resolve-preview', 'resolve-apply']) {
      expect(
        (
          await app.inject({
            method: 'POST',
            url: `/platform/external-duty/${path}`,
            payload: input,
          })
        ).statusCode,
      ).toBe(401);
    }
    expect(service.previewDirection).not.toHaveBeenCalled();
    expect(service.applyDirection).not.toHaveBeenCalled();
  });
  it.each(['kind', 'targetAssignmentId', 'overtimeMembershipId', 'force'])(
    'rejects client supplied %s',
    async (field) => {
      const { app, service } = fixture();
      const response = await app.inject({
        method: 'POST',
        url: '/platform/external-duty/resolve-preview',
        headers: { authorization: 'Bearer valid' },
        payload: { ...input, [field]: 'arbitrary' },
      });
      expect(response.statusCode).toBe(400);
      expect(service.previewDirection).not.toHaveBeenCalled();
    },
  );
  it('requires the full plan fingerprint and accepts only the two explicit directions', async () => {
    const { app, service } = fixture();
    for (const payload of [
      input,
      { ...input, planFingerprint: 'invalid' },
      { ...input, direction: 'force', planFingerprint: 'b'.repeat(64) },
    ]) {
      expect(
        (
          await app.inject({
            method: 'POST',
            url: '/platform/external-duty/resolve-apply',
            headers: { authorization: 'Bearer valid' },
            payload,
          })
        ).statusCode,
      ).toBe(400);
    }
    const payload = { ...input, direction: 'to_external', planFingerprint: 'b'.repeat(64) };
    expect(
      (
        await app.inject({
          method: 'POST',
          url: '/platform/external-duty/resolve-apply',
          headers: { authorization: 'Bearer valid' },
          payload,
        })
      ).statusCode,
    ).toBe(200);
    expect(service.applyDirection).toHaveBeenCalledOnce();
    expect(service.applyDirection).toHaveBeenCalledWith({ cloudbaseUid: 'admin' }, payload);
  });
});
