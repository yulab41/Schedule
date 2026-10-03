import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { and, eq, sql } from 'drizzle-orm';
import {
  createDatabaseClient,
  migrateDatabase,
  groups,
  users,
  userProfiles,
  groupMemberships,
  scheduleRoles,
  schedulePeriods,
  shiftAssignments,
  shiftTypes,
  scheduleEvents,
  notifications,
  notificationDeliveries,
  webPushSubscriptions,
  platformJobRuns,
  backupArchives,
  withTransaction,
  type DatabaseClient,
} from '@schedule/database';
import { resetDatabase } from '@schedule/test-fixtures';
import { GroupPermissionService } from '../modules/groups/permission-service.js';
import { EventQuery } from '../modules/events/event-query.js';
import { HistoryMaintenanceJob } from './history-maintenance.js';
import { NotificationRetryJob } from './notification-retry.js';
import { purgeExpiredJobRuns } from './job-run-retention.js';
import { DatabaseBackupJob } from './database-backup.js';
import { LocalBackupStorage } from './backup-storage.js';
import {
  computeTableChecksum,
  encryptBackupArchive,
  restoreBackupArchive,
  restoreBackupArchiveFromFile,
} from './backup-archive.js';
import {
  decryptBackupFrames,
  encryptBackupFrames,
  type BackupFrame,
} from './backup-stream-format.js';
import { createBackupFrames } from './backup-stream-archive.js';

const enabled = process.env.SCHEDULE_AUDIT_FIXES_INTEGRATION === '1';
const suite = enabled ? describe : describe.skip;
const now = new Date('2026-10-03T00:00:00Z'),
  day = 86400000;
const groupId = '00000000-0000-4000-8000-000000000010';
const secondGroupId = '00000000-0000-4000-8000-000000000020';
const ownerId = randomUUID(),
  roleId = randomUUID(),
  periodId = randomUUID(),
  assignmentId = randomUUID();
const output = fileURLToPath(
  new URL('../../../../runtime/audit/full-fixes-integration/', import.meta.url),
);
let client: DatabaseClient, restore: DatabaseClient;
const deferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  return { promise, resolve };
};
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
async function chunks(frames: BackupFrame[]) {
  const result: Buffer[] = [];
  for await (const chunk of encryptBackupFrames(
    (async function* () {
      yield* frames;
    })(),
    Buffer.alloc(32, 1),
  ))
    result.push(chunk);
  return Buffer.concat(result);
}

suite('full audit fixes against isolated real MySQL', () => {
  beforeAll(async () => {
    if (
      process.env.NODE_ENV !== 'test' ||
      process.env.TEST_MYSQL_HOST !== '127.0.0.1' ||
      process.env.TEST_MYSQL_PORT !== '3318' ||
      process.env.TEST_MYSQL_DATABASE !== 'schedule_test'
    )
      throw new Error('Refusing non-isolated audit database');
    const options = {
      host: '127.0.0.1',
      port: 3318,
      database: 'schedule_test',
      user: 'schedule_test',
      password: process.env.TEST_MYSQL_PASSWORD!,
      connectionLimit: 4,
    };
    client = createDatabaseClient(options);
    restore = createDatabaseClient({ ...options, database: 'schedule_restore_test' });
    for (const target of [client, restore]) {
      const [identity] = (await target.database.execute(
        sql`SELECT @@hostname AS host`,
      )) as unknown as [{ host: string }[], unknown];
      if (identity[0]?.host !== 'full-fixes-20261003')
        throw new Error('Refusing unidentified audit MySQL');
      if (process.env.AUDIT_REUSE_ISOLATED_SCHEMA !== '1') await resetDatabase(target);
      await migrateDatabase(target);
      await target.database.execute(
        sql`CREATE TABLE IF NOT EXISTS audit_backup_binary_fixture (id INT PRIMARY KEY, content MEDIUMBLOB, document JSON, happened_at TIMESTAMP(3), content_size INT GENERATED ALWAYS AS (OCTET_LENGTH(content)) STORED)`,
      );
      if (process.env.AUDIT_REUSE_ISOLATED_SCHEMA === '1') {
        await withTransaction(target, async (tx) => {
          const [tables] = (await tx.execute(
            sql`SELECT TABLE_NAME AS name FROM information_schema.tables WHERE table_schema=DATABASE() AND TABLE_TYPE='BASE TABLE' AND TABLE_NAME<>'__drizzle_migrations'`,
          )) as unknown as [{ name: string }[], unknown];
          await tx.execute(sql`SET FOREIGN_KEY_CHECKS=0`);
          try {
            for (const table of tables)
              await tx.execute(sql.raw(`DELETE FROM \`${table.name.replaceAll('`', '``')}\``));
          } finally {
            await tx.execute(sql`SET FOREIGN_KEY_CHECKS=1`);
          }
        });
      }
    }
    await mkdir(output, { recursive: true });
    await client.database.insert(users).values({ id: ownerId, cloudbaseUid: 'audit-fixes-owner' });
    await client.database
      .insert(userProfiles)
      .values({ userId: ownerId, realName: '合成审计用户' });
    await client.database.insert(groups).values([
      { id: groupId, ownerUserId: ownerId, name: '合成群一' },
      { id: secondGroupId, ownerUserId: ownerId, name: '合成群二' },
    ]);
    await client.database
      .insert(groupMemberships)
      .values({ id: randomUUID(), groupId, userId: ownerId, role: 'owner' });
    await client.database.insert(scheduleRoles).values({ id: roleId, groupId, name: '合成护士' });
    const shiftTypeId = randomUUID();
    await client.database.insert(shiftTypes).values({
      id: shiftTypeId,
      groupId,
      name: '合成班',
      abbreviation: '值',
      displayOrder: 1,
      color: '#ffffff',
      textColor: '#000000',
      isAllDay: 1,
      isEnabled: 1,
      startTime: '00:00:00',
      endTime: '00:00:00',
      crossesMidnight: 1,
    });
    await client.database.insert(schedulePeriods).values({
      id: periodId,
      groupId,
      scheduleRoleId: roleId,
      businessMonth: '2026-09-01',
      revision: 1,
      rulesVersion: 1,
      status: 'published',
    });
    await client.database.insert(shiftAssignments).values({
      id: assignmentId,
      schedulePeriodId: periodId,
      businessDate: '2026-09-01',
      slotPosition: 1,
      shiftTypeId,
      shiftTypeName: '合成班',
      shiftTypeAbbreviation: '值',
      shiftTypeColor: '#ffffff',
      shiftTypeTextColor: '#000000',
      shiftTypeConfigurationVersion: 1,
      shiftStartTime: '00:00:00',
      shiftEndTime: '00:00:00',
      crossesMidnight: 1,
      isAllDay: 1,
      countsTowardStatistics: 1,
      startsAt: new Date('2026-08-31T16:00:00Z'),
      endsAt: new Date('2026-09-01T16:00:00Z'),
    });
  }, 300000);
  afterAll(async () => {
    await client?.close();
    await restore?.close();
  });

  it('allows overlapping authorized reads but holds revocation until both readers finish', async () => {
    const permission = new GroupPermissionService(),
      entered = deferred(),
      release = deferred(),
      second = deferred();
    const identity = { cloudbaseUid: 'audit-fixes-owner' };
    const first = withTransaction(client, async (tx) => {
      await permission.requireReadPermission(tx, identity, groupId, 'viewDirectory');
      entered.resolve();
      await release.promise;
    });
    await entered.promise;
    const concurrent = withTransaction(client, async (tx) => {
      await permission.requireReadPermission(tx, identity, groupId, 'viewDirectory');
      second.resolve();
      await release.promise;
    });
    try {
      await Promise.race([
        second.promise,
        pause(1000).then(() => {
          throw new Error('Concurrent read blocked by exclusive authorization lock');
        }),
      ]);
    } finally {
      release.resolve();
      await Promise.all([first, concurrent]);
    }
    const locked = deferred(),
      unlock = deferred();
    const reader = withTransaction(client, async (tx) => {
      await permission.requireReadPermission(tx, identity, groupId, 'viewDirectory');
      locked.resolve();
      await unlock.promise;
    });
    await locked.promise;
    let revoked = false;
    const writer = client.database
      .update(groupMemberships)
      .set({ status: 'inactive' })
      .where(and(eq(groupMemberships.groupId, groupId), eq(groupMemberships.userId, ownerId)))
      .then(() => {
        revoked = true;
      });
    await pause(100);
    expect(revoked).toBe(false);
    unlock.resolve();
    await Promise.all([reader, writer]);
    await expect(
      withTransaction(client, (tx) =>
        permission.requireReadPermission(tx, identity, groupId, 'viewDirectory'),
      ),
    ).rejects.toMatchObject({ statusCode: 403 });
    await client.database
      .update(groupMemberships)
      .set({ status: 'active' })
      .where(eq(groupMemberships.groupId, groupId));
  });
  it('matches role events exactly without truncated IDs, cross-group or soft-deleted matches', async () => {
    const ids = Array.from({ length: 6 }, () => randomUUID());
    const affected = [
      [assignmentId],
      [assignmentId.toUpperCase()],
      [assignmentId + '-suffix'],
      [],
      [assignmentId, assignmentId],
      [assignmentId],
    ];
    await client.database.insert(scheduleEvents).values(
      ids.map((id, i) => ({
        id,
        groupId: i === 5 ? secondGroupId : groupId,
        eventType: 'swap_approved',
        eventStatus: 'completed',
        objectType: 'shift_assignment',
        operationId: randomUUID(),
        affectedShiftIds: affected[i]!,
        affectedMembershipIds: [],
        schedulePeriodId: i === 3 ? periodId : null,
      })),
    );
    const query = new EventQuery(client),
      read = () => query.list({ groupId, scheduleRoleId: roleId, pageSize: 100 });
    expect((await read()).events.map((e) => e.id).sort()).toEqual([ids[0], ids[3], ids[4]].sort());
    await client.database
      .update(shiftAssignments)
      .set({ deletedAt: now })
      .where(eq(shiftAssignments.id, assignmentId));
    expect((await read()).events.map((e) => e.id)).toEqual([ids[3]]);
    await client.database
      .update(schedulePeriods)
      .set({ deletedAt: now })
      .where(eq(schedulePeriods.id, periodId));
    expect((await read()).events).toEqual([]);
    await client.database
      .update(schedulePeriods)
      .set({ deletedAt: null })
      .where(eq(schedulePeriods.id, periodId));
    await client.database
      .update(shiftAssignments)
      .set({ deletedAt: null })
      .where(eq(shiftAssignments.id, assignmentId));
    expect((await query.list({ groupId, scheduleRoleId: randomUUID() })).events).toEqual([]);
  });
  it('commits the first group before waiting for maintenance on the second group', async () => {
    const entered = deferred(),
      release = deferred();
    const blocker = withTransaction(client, async (tx) => {
      await tx.select().from(groups).where(eq(groups.id, secondGroupId)).for('update');
      entered.resolve();
      await release.promise;
    });
    await entered.promise;
    const job = new HistoryMaintenanceJob(client).run(now);
    let foreground: Promise<unknown> | undefined;
    try {
      for (let i = 0; i < 40; i++) {
        const [period] = await client.database
          .select({ status: schedulePeriods.status })
          .from(schedulePeriods)
          .where(eq(schedulePeriods.id, periodId));
        if (period?.status === 'past') break;
        await pause(50);
      }
      foreground = client.database
        .update(groups)
        .set({ name: '合成群一已验证' })
        .where(eq(groups.id, groupId))
        .execute();
      await Promise.race([
        foreground,
        pause(1000).then(() => {
          throw new Error('Finished group remained locked by another group');
        }),
      ]);
    } finally {
      release.resolve();
      await Promise.all([blocker, job, foreground]);
    }
    expect((await job).archivedPeriods).toBe(1);
    expect((await new HistoryMaintenanceJob(client).run(now)).archivedPeriods).toBe(0);
  });
  it('retains 30/90-day boundaries and running jobs, auditing bounded deletion once', async () => {
    const ids = Array.from({ length: 6 }, () => randomUUID());
    const rows = [
      ['completed', 31],
      ['completed', 30],
      ['failed', 91],
      ['failed', 90],
      ['running', 365],
      ['completed', 1],
    ] as const;
    await client.database.insert(platformJobRuns).values(
      rows.map(([status, days], i) => ({
        id: ids[i]!,
        jobName: 'synthetic-retention',
        status,
        startedAt: new Date(now.valueOf() - days * day),
        finishedAt: status === 'running' ? null : new Date(now.valueOf() - days * day),
      })),
    );
    expect(await purgeExpiredJobRuns(client, now, 1, 10)).toMatchObject({
      completedDeleted: 1,
      failedDeleted: 1,
      batches: 2,
    });
    const remaining = (
      await client.database.select({ id: platformJobRuns.id }).from(platformJobRuns)
    ).map((row) => row.id);
    expect(remaining.sort()).toEqual([ids[1], ids[3], ids[4], ids[5]].sort());
    expect(await purgeExpiredJobRuns(client, now, 1, 10)).toMatchObject({
      completedDeleted: 0,
      failedDeleted: 0,
    });
  });
  it('releases transaction/connection before send and prevents simultaneous double dispatch', async () => {
    const id = await seedNotification(),
      entered = deferred(),
      release = deferred();
    let sends = 0;
    const dispatcher = {
      isConfigured: true,
      vapidPublicKey: null,
      send: async () => {
        sends++;
        entered.resolve();
        await release.promise;
      },
    };
    const job = new NotificationRetryJob(client, dispatcher),
      first = job.run(now);
    await entered.promise;
    try {
      expect((await job.run(now)).attempted).toBe(0);
      await Promise.race([
        withTransaction(client, (tx) =>
          tx
            .select()
            .from(notificationDeliveries)
            .where(eq(notificationDeliveries.notificationId, id))
            .for('update'),
        ),
        pause(1000).then(() => {
          throw new Error('Remote send retained a row lock');
        }),
      ]);
    } finally {
      release.resolve();
    }
    expect(await first).toMatchObject({ sent: 1, failed: 0 });
    expect(sends).toBe(1);
    const [delivery] = await client.database
      .select()
      .from(notificationDeliveries)
      .where(eq(notificationDeliveries.notificationId, id));
    expect(delivery?.claimToken).toBeNull();
  });
  it('recovers an expired claim and retains existing retry backoff semantics', async () => {
    const id = await seedNotification();
    await client.database
      .update(notificationDeliveries)
      .set({ claimToken: randomUUID(), claimedUntil: new Date(now.valueOf() - 1) })
      .where(eq(notificationDeliveries.notificationId, id));
    let calls = 0;
    const job = new NotificationRetryJob(client, {
      isConfigured: true,
      vapidPublicKey: null,
      send: async () => {
        if (++calls === 1) throw new Error('synthetic provider failure');
      },
    });
    expect(await job.run(now)).toMatchObject({ failed: 1, sent: 0 });
    expect((await job.run(new Date(now.valueOf() + 60000))).attempted).toBe(0);
    expect(await job.run(new Date(now.valueOf() + 6 * 60000))).toMatchObject({ sent: 1 });
    expect(calls).toBe(2);
  });
  it('starts each lease at the current claim time even after a long batch', async () => {
    await seedNotification();
    await seedNotification();
    let clock = now;
    let calls = 0;
    const job = new NotificationRetryJob(
      client,
      {
        isConfigured: true,
        vapidPublicKey: null,
        send: async (_subscription, payload) => {
          const notificationId = payload.data?.notificationId;
          if (typeof notificationId !== 'string')
            throw new Error('Missing synthetic notification ID');
          const [delivery] = await client.database
            .select()
            .from(notificationDeliveries)
            .where(eq(notificationDeliveries.notificationId, notificationId));
          expect(delivery!.claimedUntil!.valueOf()).toBe(clock.valueOf() + 10 * 60000);
          calls++;
          clock = new Date(clock.valueOf() + 11 * 60000);
        },
      },
      undefined,
      { clock: () => clock },
    );
    expect(await job.run(now)).toMatchObject({ sent: 2, failed: 0 });
    expect(calls).toBe(2);
  });
  it('rejects completion by a stale claimant after its token has been replaced', async () => {
    const id = await seedNotification(),
      entered = deferred(),
      release = deferred();
    const old = new NotificationRetryJob(client, {
      isConfigured: true,
      vapidPublicKey: null,
      send: async () => {
        entered.resolve();
        await release.promise;
      },
    }).run(now);
    await entered.promise;
    const replacement = randomUUID();
    try {
      await client.database
        .update(notificationDeliveries)
        .set({ claimToken: replacement, claimedUntil: new Date(now.valueOf() + 20 * 60000) })
        .where(eq(notificationDeliveries.notificationId, id));
    } finally {
      release.resolve();
    }
    expect(await old).toMatchObject({ sent: 0, skipped: 1 });
    const [delivery] = await client.database
      .select()
      .from(notificationDeliveries)
      .where(eq(notificationDeliveries.notificationId, id));
    expect(delivery).toMatchObject({
      status: 'pending',
      claimToken: replacement,
      sentAt: null,
      attempts: 0,
    });
    await client.database
      .update(notificationDeliveries)
      .set({ claimedUntil: new Date(now.valueOf() - 1) })
      .where(eq(notificationDeliveries.notificationId, id));
    expect(
      await new NotificationRetryJob(client, {
        isConfigured: true,
        vapidPublicKey: null,
        send: async () => {},
      }).run(now),
    ).toMatchObject({ sent: 1 });
  });
  it('streams full-schema backup and restores nonempty BLOB, JSON, dates and generated columns', async () => {
    await client.database.execute(
      sql`INSERT INTO audit_backup_binary_fixture (id,content,document,happened_at) VALUES (1,${Buffer.from([0, 255, 1, 2, 3])},${JSON.stringify({ name: '合成🙂', nested: { a: 1 } })},${now})`,
    );
    for (const [index, value] of [[], 'hello', '123', 123, true, null].entries())
      await client.database.execute(
        sql`INSERT INTO audit_backup_binary_fixture(id,document) VALUES (${index + 2},${JSON.stringify(value)})`,
      );
    await client.database.execute(
      sql`INSERT INTO audit_backup_binary_fixture(id,document) VALUES (8,NULL)`,
    );
    await client.database.execute(
      sql`INSERT INTO audit_backup_binary_fixture(id,document) VALUES (9,'9007199254740993'),(10,'{"nested":9007199254740993}')`,
    );
    const storage = new LocalBackupStorage(output),
      key = Buffer.alloc(32, 1),
      result = await new DatabaseBackupJob(client, { storage, encryptionKey: key }).run(now);
    const tables = [];
    for await (const frame of decryptBackupFrames(storage.readStream(result.storageKey), key))
      if (frame.kind === 'table') tables.push(frame.name);
    expect(tables).toContain('audit_backup_binary_fixture');
    expect(tables).not.toContain('visitor_access_logs');
    const restored = await restoreBackupArchiveFromFile(
      restore,
      `${output}/${result.storageKey}`,
      key,
    );
    expect(restored).toMatchObject({
      rowCount: result.rowCount,
      tableCount: result.tableCount,
      mismatches: [],
    });
    const [rows] = (await restore.database.execute(
      sql`SELECT * FROM audit_backup_binary_fixture ORDER BY id`,
    )) as unknown as [Record<string, unknown>[], unknown];
    expect(rows[0]?.content).toEqual(Buffer.from([0, 255, 1, 2, 3]));
    expect(rows[0]?.document).toEqual({ name: '合成🙂', nested: { a: 1 } });
    expect(rows[0]?.happened_at).toBe('2026-10-03 00:00:00.000');
    expect(rows[0]?.content_size).toBe(5);
    expect(rows.slice(1, 8).map((row) => row.document)).toEqual([
      [],
      'hello',
      '123',
      123,
      true,
      null,
      null,
    ]);
    const [types] = (await restore.database.execute(
      sql`SELECT id,JSON_TYPE(document) AS kind, document IS NULL AS sql_null FROM audit_backup_binary_fixture WHERE id BETWEEN 7 AND 8 ORDER BY id`,
    )) as unknown as [{ id: number; kind: string | null; sql_null: number }[], unknown];
    expect(types).toEqual([
      { id: 7, kind: 'NULL', sql_null: 0 },
      { id: 8, kind: null, sql_null: 1 },
    ]);
    const [exact] = (await restore.database.execute(
      sql`SELECT CAST(document AS CHAR) AS value FROM audit_backup_binary_fixture WHERE id>=9 ORDER BY id`,
    )) as unknown as [{ value: string }[], unknown];
    expect(exact).toEqual([
      { value: '9007199254740993' },
      { value: '{"nested": 9007199254740993}' },
    ]);
  }, 60000);
  it('rolls back a missing authenticated tail or bad checksum and restores foreign-key checks', async () => {
    await restore.database.execute(sql`DELETE FROM audit_backup_binary_fixture`);
    const frames: BackupFrame[] = [];
    await withTransaction(client, async (tx) => {
      for await (const frame of createBackupFrames(tx, ['audit_backup_binary_fixture'], now, {
        tableCount: 0,
        rowCount: 0,
      }))
        frames.push(frame);
    });
    const truncated = await chunks(frames.slice(0, -1));
    await expect(restoreBackupArchive(restore, truncated, Buffer.alloc(32, 1))).rejects.toThrow(
      'Truncated',
    );
    const bad = frames.map((frame) =>
      frame.kind === 'table-end' ? { ...frame, sha256: '0'.repeat(64) } : frame,
    );
    await expect(
      restoreBackupArchive(restore, await chunks(bad), Buffer.alloc(32, 1)),
    ).rejects.toThrow('checksum');
    const [rows] = (await restore.database.execute(
      sql`SELECT COUNT(*) AS n,@@foreign_key_checks AS fk FROM audit_backup_binary_fixture`,
    )) as unknown as [{ n: number; fk: number }[], unknown];
    expect(rows[0]).toEqual({ n: 0, fk: 1 });
  });
  it('restores legacy v1/v2 binary data and rolls back a legacy checksum mismatch', async () => {
    const [rows] = (await client.database.execute(
      sql`SELECT * FROM audit_backup_binary_fixture WHERE id=1`,
    )) as unknown as [Record<string, unknown>[], unknown];
    const payload = {
      format: 'medical-schedule-backup' as const,
      formatVersion: 2 as const,
      createdAt: now.toISOString(),
      tables: {
        audit_backup_binary_fixture: {
          rows,
          rowCount: rows.length,
          sha256: computeTableChecksum(rows),
        },
      },
    };
    const content = Buffer.from(JSON.stringify(encryptBackupArchive(payload, Buffer.alloc(32, 1))));
    expect(await restoreBackupArchive(restore, content, Buffer.alloc(32, 1))).toMatchObject({
      rowCount: 1,
      mismatches: [],
    });
    await restore.database.execute(sql`DELETE FROM audit_backup_binary_fixture`);
    expect(
      await restoreBackupArchive(
        restore,
        Buffer.from(
          JSON.stringify(
            encryptBackupArchive({ ...payload, formatVersion: 1 }, Buffer.alloc(32, 1)),
          ),
        ),
        Buffer.alloc(32, 1),
      ),
    ).toMatchObject({ rowCount: 1, mismatches: [] });
    await restore.database.execute(sql`DELETE FROM audit_backup_binary_fixture`);
    payload.tables.audit_backup_binary_fixture.sha256 = '0'.repeat(64);
    await expect(
      restoreBackupArchive(
        restore,
        Buffer.from(JSON.stringify(encryptBackupArchive(payload, Buffer.alloc(32, 1)))),
        Buffer.alloc(32, 1),
      ),
    ).rejects.toThrow('checksum');
    const [count] = (await restore.database.execute(
      sql`SELECT COUNT(*) AS n FROM audit_backup_binary_fixture`,
    )) as unknown as [{ n: number }[], unknown];
    expect(count[0]?.n).toBe(0);
  });
  it('keeps a newly registered backup and retries an interrupted archive cleanup', async () => {
    const storage = new LocalBackupStorage(output);
    const id = randomUUID(),
      key = `${id}.pending.backup`;
    await storage.write(key, Buffer.from('synthetic old archive'));
    await client.database.insert(backupArchives).values({
      id,
      backupKind: 'daily',
      storageKey: key,
      fileSize: 21,
      rowCount: 0,
      tableCount: 0,
      sha256: '0'.repeat(64),
      createdAt: now,
      deletedAt: now,
    });
    class FaultingStorage extends LocalBackupStorage {
      override async delete(target: string) {
        if (target === key) throw new Error('synthetic cleanup failure');
        await super.delete(target);
      }
    }
    await expect(
      new DatabaseBackupJob(client, {
        storage: new FaultingStorage(output),
        encryptionKey: Buffer.alloc(32, 1),
      }).run(now),
    ).rejects.toThrow('cleanup failure');
    const registered = await client.database.select().from(backupArchives);
    expect(registered.some((entry) => entry.id === id && entry.deletedAt !== null)).toBe(true);
    for (const entry of registered.filter((entry) => entry.deletedAt === null))
      expect((await storage.read(entry.storageKey)).length).toBe(entry.fileSize);
    expect(
      (
        await new DatabaseBackupJob(client, { storage, encryptionKey: Buffer.alloc(32, 1) }).run(
          now,
        )
      ).deletedArchives,
    ).toBeGreaterThanOrEqual(1);
    expect(
      await client.database.select().from(backupArchives).where(eq(backupArchives.id, id)),
    ).toEqual([]);
    await expect(storage.read(key)).rejects.toMatchObject({ code: 'ENOENT' });
  });
});

async function seedNotification() {
  const id = randomUUID(),
    userId = randomUUID();
  await client.database.insert(users).values({ id: userId, cloudbaseUid: `synthetic-${userId}` });
  await client.database.insert(notifications).values({
    id,
    recipientUserId: userId,
    notificationType: 'swap_approved',
    title: '合成通知',
    body: '不发送真实消息',
  });
  await client.database
    .insert(notificationDeliveries)
    .values({ id: randomUUID(), notificationId: id });
  await client.database.insert(webPushSubscriptions).values({
    id: randomUUID(),
    userId,
    endpoint: 'https://synthetic.invalid',
    auth: 'synthetic',
    p256dh: 'synthetic',
  });
  return id;
}
