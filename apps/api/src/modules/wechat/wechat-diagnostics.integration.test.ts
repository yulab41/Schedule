import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import {
  createTestDatabaseClient,
  migrateDatabase,
  users,
  groups,
  groupMemberships,
  userAuthIdentities,
  idempotencyKeys,
  notificationPreferences,
  type DatabaseClient,
} from '@schedule/database';
import { and, eq } from 'drizzle-orm';
import { beforeAll, afterAll, beforeEach, describe, it, expect, vi } from 'vitest';
import { WechatDiagnosticsService } from './wechat-diagnostics-service.js';
import { WechatGatewayError, type WechatGateway } from './wechat-gateway.js';
import { createApp } from '../../app.js';

const enabled =
  process.env.TEST_MYSQL_DATABASE === 'schedule_test' &&
  !!process.env.TEST_MYSQL_PASSWORD &&
  !!process.env.TEST_MYSQL_USER;
const suite = enabled ? describe : describe.skip;
const actor = '00000000-0000-4000-8000-000000000001';
const identity = { cloudbaseUid: 'feedback5-diagnostic-admin' };
suite('persistent self-only WeChat diagnostics (local MySQL)', () => {
  let client: DatabaseClient;
  let service: WechatDiagnosticsService;
  let original: typeof users.$inferSelect;
  const group = randomUUID();
  const membership = randomUUID();
  const binding = randomUUID();
  const send = vi.fn();
  const gateway = {
    appId: 'diagnostic-test-app',
    isConfigured: true,
    sendSubscribeMessage: send,
  } as unknown as WechatGateway;
  const originalTemplate = process.env.WECHAT_DUTY_REMINDER_TEMPLATE_ID;
  const originalMock = process.env.WECHAT_MOCK_MODE;
  beforeAll(async () => {
    client = createTestDatabaseClient({
      host: '127.0.0.1',
      port: Number(process.env.TEST_MYSQL_PORT ?? 3307),
      database: 'schedule_test',
      user: process.env.TEST_MYSQL_USER!,
      password: process.env.TEST_MYSQL_PASSWORD!,
    });
    await migrateDatabase(
      client,
      fileURLToPath(new URL('../../../../../migrations', import.meta.url)),
    );
    [original] = (await client.database.select().from(users).where(eq(users.id, actor))) as [
      typeof users.$inferSelect,
    ];
    await client.database
      .update(users)
      .set({
        cloudbaseUid: identity.cloudbaseUid,
        isDeveloperAdmin: 1,
        wechatOpenid: 'diagnostic-test-openid',
        status: 'active',
        deletedAt: null,
      })
      .where(eq(users.id, actor));
    await client.database
      .insert(groups)
      .values({ id: group, name: 'diagnostic fixture', ownerUserId: actor });
    await client.database
      .insert(groupMemberships)
      .values({ id: membership, groupId: group, userId: actor });
    await client.database.insert(userAuthIdentities).values({
      id: binding,
      userId: actor,
      provider: 'wechat_mini_program',
      appId: 'diagnostic-test-app',
      subject: 'diagnostic-test-openid',
    });
    service = new WechatDiagnosticsService(client, gateway);
  });
  beforeEach(async () => {
    await client.database
      .delete(idempotencyKeys)
      .where(
        and(
          eq(idempotencyKeys.actorUserId, actor),
          eq(idempotencyKeys.scope, 'wechat-diagnostic-send'),
        ),
      );
    await client.database.update(groups).set({ deletedAt: null }).where(eq(groups.id, group));
    await client.database
      .update(groupMemberships)
      .set({ status: 'active' })
      .where(eq(groupMemberships.id, membership));
    process.env.WECHAT_DUTY_REMINDER_TEMPLATE_ID = 'diagnostic-template';
    delete process.env.WECHAT_MOCK_MODE;
    send.mockReset().mockResolvedValue({ messageId: null });
  });
  afterAll(async () => {
    if (client) {
      await client.database
        .delete(idempotencyKeys)
        .where(
          and(
            eq(idempotencyKeys.actorUserId, actor),
            eq(idempotencyKeys.scope, 'wechat-diagnostic-send'),
          ),
        );
      await client.database
        .delete(notificationPreferences)
        .where(eq(notificationPreferences.membershipId, membership));
      await client.database.delete(userAuthIdentities).where(eq(userAuthIdentities.id, binding));
      await client.database.delete(groupMemberships).where(eq(groupMemberships.id, membership));
      await client.database.delete(groups).where(eq(groups.id, group));
      if (original) await client.database.update(users).set(original).where(eq(users.id, actor));
      await client.close();
    }
    if (originalTemplate === undefined) delete process.env.WECHAT_DUTY_REMINDER_TEMPLATE_ID;
    else process.env.WECHAT_DUTY_REMINDER_TEMPLATE_ID = originalTemplate;
    if (originalMock === undefined) delete process.env.WECHAT_MOCK_MODE;
    else process.env.WECHAT_MOCK_MODE = originalMock;
  });
  it('serializes concurrent same-key requests to exactly one external send', async () => {
    const key = randomUUID();
    const issuedAt = Date.now();
    const results = await Promise.all([
      service.sendTest(identity, group, key, issuedAt),
      service.sendTest(identity, group, key, issuedAt),
    ]);
    expect(send).toHaveBeenCalledTimes(1);
    expect(results.some((result) => result.outcome === 'accepted')).toBe(true);
    expect((await service.sendTest(identity, group, key, issuedAt)).outcome).toBe('accepted');
    expect(send).toHaveBeenCalledTimes(1);
  });
  it('serializes different keys under the same user rate limit', async () => {
    const results = await Promise.allSettled([
      service.sendTest(identity, group, randomUUID(), Date.now()),
      service.sendTest(identity, group, randomUUID(), Date.now()),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(send).toHaveBeenCalledTimes(1);
  });
  it('durably replays transport unknown without another external attempt', async () => {
    send.mockRejectedValue(
      new WechatGatewayError(null, null, 'SERVICE_UNAVAILABLE', 'PRIVATE URL'),
    );
    const key = randomUUID();
    const issuedAt = Date.now();
    expect((await service.sendTest(identity, group, key, issuedAt)).outcome).toBe('unknown');
    expect((await service.sendTest(identity, group, key, issuedAt)).outcome).toBe('unknown');
    expect(send).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(await service.inspect(identity, group))).not.toMatch(
      /PRIVATE|diagnostic-test-openid|diagnostic-template/,
    );
  });
  it('refuses old requests, inactive membership, deleted groups and mock mode without sending', async () => {
    await expect(
      service.sendTest(identity, group, randomUUID(), Date.now() - 700_000),
    ).rejects.toMatchObject({ statusCode: 400 });
    await client.database
      .update(groupMemberships)
      .set({ status: 'inactive' })
      .where(eq(groupMemberships.id, membership));
    await expect(service.sendTest(identity, group, randomUUID(), Date.now())).rejects.toMatchObject(
      { statusCode: 403 },
    );
    await client.database
      .update(groupMemberships)
      .set({ status: 'active' })
      .where(eq(groupMemberships.id, membership));
    await client.database.update(groups).set({ deletedAt: new Date() }).where(eq(groups.id, group));
    await expect(service.sendTest(identity, group, randomUUID(), Date.now())).rejects.toMatchObject(
      { statusCode: 403 },
    );
    await client.database.update(groups).set({ deletedAt: null }).where(eq(groups.id, group));
    process.env.WECHAT_MOCK_MODE = 'true';
    await expect(service.sendTest(identity, group, randomUUID(), Date.now())).rejects.toMatchObject(
      { statusCode: 400 },
    );
    expect(send).not.toHaveBeenCalled();
  });
  it('enforces route permissions and rejects arbitrary recipients', async () => {
    const app = createApp({
      databaseClient: client,
      wechatGateway: gateway,
      logger: false,
      authPort: {
        authenticate: async ({ authorization }) =>
          authorization === 'Bearer admin' ? identity : { cloudbaseUid: 'outsider' },
      },
    });
    const url = '/me/wechat-notification-test';
    const headers = { authorization: 'Bearer admin', 'idempotency-key': randomUUID() };
    expect(
      (
        await app.inject({
          method: 'GET',
          url: `/me/wechat-notification-diagnostics?groupId=${group}`,
          headers: { authorization: 'Bearer outsider' },
        })
      ).statusCode,
    ).toBe(403);
    expect(
      (
        await app.inject({
          method: 'POST',
          url,
          headers,
          payload: { groupId: group, issuedAt: Date.now(), userId: randomUUID() },
        })
      ).statusCode,
    ).toBe(400);
    expect(
      (
        await app.inject({
          method: 'POST',
          url,
          headers: { authorization: 'Bearer admin' },
          payload: { groupId: group, issuedAt: Date.now() },
        })
      ).statusCode,
    ).toBe(400);
    expect(send).not.toHaveBeenCalled();
    await app.close();
  });
});
