import { fileURLToPath } from 'node:url';

import {
  createTestDatabaseClient,
  migrateDatabase,
  type DatabaseClient,
  type DatabaseConnectionOptions,
  userProfiles,
  users,
} from '@schedule/database';
import { eq, sql } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { AuthPort } from '../../adapters/auth/auth-port.js';
import { createApp } from '../../app.js';
import { UserService } from './user-service.js';

const migrationsDirectory = fileURLToPath(new URL('../../../../../migrations', import.meta.url));
const databaseOptions = getTestDatabaseOptions();
const describeWithDatabase = databaseOptions === undefined ? describe.skip : describe;

describeWithDatabase('user authentication and profiles', () => {
  let app: ReturnType<typeof createApp>;
  let client: DatabaseClient;

  beforeEach(async () => {
    client = createTestDatabaseClient(databaseOptions as DatabaseConnectionOptions);
    await resetDatabase(client);
    await migrateDatabase(client, migrationsDirectory);
    app = createApp({
      authPort: createFakeAuthPort({
        'active-alpha': 'cloudbase-alpha',
        'active-beta': 'cloudbase-beta',
      }),
      databaseClient: client,
      logger: false,
    });
  });

  afterEach(async () => {
    if (app !== undefined) {
      await app.close();
    }

    if (client !== undefined) {
      await client.close();
    }
  });

  it('rejects anonymous, expired, and logged-out requests', async () => {
    for (const authorization of [undefined, 'Bearer expired-token', 'Bearer logged-out-token']) {
      const response =
        authorization === undefined
          ? await app.inject({ method: 'GET', url: '/users/me' })
          : await app.inject({
              headers: { authorization },
              method: 'GET',
              url: '/users/me',
            });

      expect(response.statusCode).toBe(401);
      expect(response.json()).toMatchObject({
        error: { code: 'AUTHENTICATION_REQUIRED' },
      });
    }
  });

  it('maps a verified CloudBase UID to a profile without persisting passwords', async () => {
    const registration = await registerUser('active-alpha', 'Alpha Doctor');

    expect(registration.statusCode).toBe(201);
    expect(registration.json()).toEqual({
      id: expect.stringMatching(/^[0-9a-f-]{36}$/i),
      realName: 'Alpha Doctor',
      version: 1,
    });

    const invalidRegistration = await app.inject({
      headers: { authorization: 'Bearer active-beta' },
      method: 'POST',
      payload: { password: 'must-not-reach-the-business-database', realName: 'Beta Doctor' },
      url: '/users',
    });

    expect(invalidRegistration.statusCode).toBe(400);
    expect(invalidRegistration.json()).toMatchObject({
      error: { code: 'VALIDATION_FAILED' },
    });
  });

  it('lets each authenticated user read and change only their own profile', async () => {
    const alphaRegistration = await registerUser('active-alpha', 'Alpha Doctor');
    const betaRegistration = await registerUser('active-beta', 'Beta Doctor');
    const alpha = alphaRegistration.json() as { id: string; version: number };
    const beta = betaRegistration.json() as { version: number };

    const betaUpdate = await app.inject({
      headers: { authorization: 'Bearer active-beta' },
      method: 'PATCH',
      payload: { realName: 'Beta Specialist', version: beta.version },
      url: '/users/me',
    });
    const alphaRead = await app.inject({
      headers: { authorization: 'Bearer active-alpha' },
      method: 'GET',
      url: '/users/me',
    });
    const attemptedCrossUserUpdate = await app.inject({
      headers: { authorization: 'Bearer active-beta' },
      method: 'PATCH',
      payload: { realName: 'Impersonated Alpha', userId: alpha.id, version: beta.version },
      url: '/users/me',
    });
    const staleUpdate = await app.inject({
      headers: { authorization: 'Bearer active-beta' },
      method: 'PATCH',
      payload: { realName: 'Stale Beta Name', version: beta.version },
      url: '/users/me',
    });

    expect(betaUpdate.statusCode).toBe(200);
    expect(betaUpdate.json()).toEqual({
      id: expect.stringMatching(/^[0-9a-f-]{36}$/i),
      realName: 'Beta Specialist',
      version: 2,
    });
    expect(alphaRead.json()).toEqual({ id: alpha.id, realName: 'Alpha Doctor', version: 1 });
    expect(attemptedCrossUserUpdate.statusCode).toBe(400);
    expect(staleUpdate.statusCode).toBe(409);
    expect(staleUpdate.json()).toMatchObject({ error: { code: 'CONFLICT' } });
  });

  it('does not expose a soft-deleted profile to its authenticated user', async () => {
    const registration = await registerUser('active-alpha', 'Alpha Doctor');
    const { id } = registration.json() as { id: string };
    await client.database.execute(
      sql`UPDATE user_profiles SET deleted_at = CURRENT_TIMESTAMP(3) WHERE user_id = ${id}`,
    );

    const response = await app.inject({
      headers: { authorization: 'Bearer active-alpha' },
      method: 'GET',
      url: '/users/me',
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toMatchObject({ error: { code: 'NOT_FOUND' } });
  });

  it('does not update a profile after its user is suspended between lookup and mutation', async () => {
    const registration = await registerUser('active-alpha', 'Alpha Doctor');
    const { id, version } = registration.json() as { id: string; version: number };
    const userService = new UserService(createSuspendingDatabaseClient(client, id));

    await expect(
      userService.updateCurrentProfile(
        { cloudbaseUid: 'cloudbase-alpha' },
        { realName: 'Changed After Suspension', version },
      ),
    ).rejects.toMatchObject({ code: 'CONFLICT', statusCode: 409 });

    const [storedProfile] = await client.database
      .select({ realName: userProfiles.realName, version: userProfiles.version })
      .from(userProfiles)
      .where(eq(userProfiles.userId, id));

    expect(storedProfile).toEqual({ realName: 'Alpha Doctor', version: 1 });
  });

  it('rejects duplicate profile registration for the same verified UID', async () => {
    await registerUser('active-alpha', 'Alpha Doctor');
    const duplicate = await registerUser('active-alpha', 'Changed Name');

    expect(duplicate.statusCode).toBe(409);
    expect(duplicate.json()).toMatchObject({ error: { code: 'CONFLICT' } });
  });

  async function registerUser(token: string, realName: string) {
    return app.inject({
      headers: { authorization: `Bearer ${token}` },
      method: 'POST',
      payload: { realName },
      url: '/users',
    });
  }
});

function createFakeAuthPort(tokens: Readonly<Record<string, string>>): AuthPort {
  return {
    authenticate: async ({ authorization }) => {
      const token = authorization?.replace(/^Bearer\s+/i, '');
      const cloudbaseUid = token === undefined ? undefined : tokens[token];

      return cloudbaseUid === undefined ? undefined : { cloudbaseUid };
    },
  };
}

function createSuspendingDatabaseClient(client: DatabaseClient, userId: string): DatabaseClient {
  let suspended = false;
  const database = new Proxy(client.database, {
    get(target, property) {
      if (property !== 'update') {
        const value = Reflect.get(target, property, target);
        return typeof value === 'function' ? value.bind(target) : value;
      }

      return (table: unknown) => {
        const update = target.update(table as typeof userProfiles);
        if (table !== userProfiles) {
          return update;
        }

        return new Proxy(update, {
          get(updateTarget, updateProperty) {
            const value = Reflect.get(updateTarget, updateProperty, updateTarget);
            if (updateProperty !== 'set' || typeof value !== 'function') {
              return typeof value === 'function' ? value.bind(updateTarget) : value;
            }

            return (...setArguments: unknown[]) => {
              const query = value.apply(updateTarget, setArguments);
              return new Proxy(query, {
                get(queryTarget, queryProperty) {
                  const queryValue = Reflect.get(queryTarget, queryProperty, queryTarget);
                  if (queryProperty !== 'where' || typeof queryValue !== 'function') {
                    return typeof queryValue === 'function'
                      ? queryValue.bind(queryTarget)
                      : queryValue;
                  }

                  return async (...whereArguments: unknown[]) => {
                    if (!suspended) {
                      suspended = true;
                      await client.database
                        .update(users)
                        .set({ status: 'suspended' })
                        .where(eq(users.id, userId));
                    }

                    return queryValue.apply(queryTarget, whereArguments);
                  };
                },
              });
            };
          },
        });
      };
    },
  });

  return { ...client, database };
}

function getTestDatabaseOptions(): DatabaseConnectionOptions | undefined {
  if (process.env.NODE_ENV !== 'test') {
    return undefined;
  }

  const {
    TEST_MYSQL_DATABASE,
    TEST_MYSQL_HOST,
    TEST_MYSQL_PASSWORD,
    TEST_MYSQL_PORT,
    TEST_MYSQL_USER,
  } = process.env;
  const port = Number(TEST_MYSQL_PORT ?? '3307');

  if (
    TEST_MYSQL_DATABASE === undefined ||
    TEST_MYSQL_PASSWORD === undefined ||
    TEST_MYSQL_USER === undefined ||
    !Number.isInteger(port) ||
    port < 1 ||
    port > 65_535
  ) {
    return undefined;
  }

  return {
    database: TEST_MYSQL_DATABASE,
    host: TEST_MYSQL_HOST ?? '127.0.0.1',
    password: TEST_MYSQL_PASSWORD,
    port,
    user: TEST_MYSQL_USER,
  };
}

async function resetDatabase(client: DatabaseClient): Promise<void> {
  await client.database.execute(sql`SET FOREIGN_KEY_CHECKS = 0`);
  await client.database.execute(sql`DROP TABLE IF EXISTS invite_tokens`);
  await client.database.execute(sql`DROP TABLE IF EXISTS visitor_access_logs`);
  await client.database.execute(sql`DROP TABLE IF EXISTS backup_archives`);
  await client.database.execute(sql`DROP TABLE IF EXISTS platform_job_runs`);
  await client.database.execute(sql`DROP TABLE IF EXISTS manual_schedule_cells`);
  await client.database.execute(sql`DROP TABLE IF EXISTS manual_schedule_template_members`);
  await client.database.execute(sql`DROP TABLE IF EXISTS manual_schedule_templates`);
  await client.database.execute(sql`DROP TABLE IF EXISTS duty_adjustments`);
  await client.database.execute(sql`DROP TABLE IF EXISTS workflow_sequence_allocations`);
  await client.database.execute(sql`DROP TABLE IF EXISTS notification_deliveries`);
  await client.database.execute(sql`DROP TABLE IF EXISTS notifications`);
  await client.database.execute(sql`DROP TABLE IF EXISTS notification_preferences`);
  await client.database.execute(sql`DROP TABLE IF EXISTS notification_settings`);
  await client.database.execute(sql`DROP TABLE IF EXISTS web_push_subscriptions`);
  await client.database.execute(sql`DROP TABLE IF EXISTS notification_batches`);
  await client.database.execute(sql`DROP TABLE IF EXISTS holiday_dates`);
  await client.database.execute(sql`DROP TABLE IF EXISTS holiday_calendar_versions`);
  await client.database.execute(sql`DROP TABLE IF EXISTS statistics_recalc_checks`);
  await client.database.execute(sql`DROP TABLE IF EXISTS statistics_snapshots`);
  await client.database.execute(sql`DROP TABLE IF EXISTS export_jobs`);
  await client.database.execute(sql`DROP TABLE IF EXISTS shift_assignments`);
  await client.database.execute(sql`DROP TABLE IF EXISTS schedule_periods`);
  await client.database.execute(sql`DROP TABLE IF EXISTS audit_logs`);
  await client.database.execute(sql`DROP TABLE IF EXISTS schedule_events`);
  await client.database.execute(sql`DROP TABLE IF EXISTS rotation_members`);
  await client.database.execute(sql`DROP TABLE IF EXISTS rotation_rules`);
  await client.database.execute(sql`DROP TABLE IF EXISTS shift_types`);
  await client.database.execute(sql`DROP TABLE IF EXISTS member_schedule_roles`);
  await client.database.execute(sql`DROP TABLE IF EXISTS schedule_roles`);
  await client.database.execute(sql`DROP TABLE IF EXISTS group_join_requests`);
  await client.database.execute(sql`DROP TABLE IF EXISTS guest_schedule_access_attempts`);
  await client.database.execute(sql`DROP TABLE IF EXISTS membership_claim_requests`);
  await client.database.execute(sql`DROP TABLE IF EXISTS group_code_attempts`);
  await client.database.execute(sql`DROP TABLE IF EXISTS group_member_contacts`);
  await client.database.execute(sql`DROP TABLE IF EXISTS leave_requests`);
  await client.database.execute(sql`DROP TABLE IF EXISTS swap_requests`);
  await client.database.execute(sql`DROP TABLE IF EXISTS group_memberships`);
  await client.database.execute(sql`DROP TABLE IF EXISTS roster_entries`);
  await client.database.execute(sql`DROP TABLE IF EXISTS idempotency_keys`);
  await client.database.execute(sql`DROP TABLE IF EXISTS \`groups\``);
  await client.database.execute(sql`DROP TABLE IF EXISTS user_profiles`);
  await client.database.execute(sql`DROP TABLE IF EXISTS users`);
  await client.database.execute(sql`DROP TABLE IF EXISTS __drizzle_migrations`);
  await client.database.execute(sql`SET FOREIGN_KEY_CHECKS = 1`);
}
