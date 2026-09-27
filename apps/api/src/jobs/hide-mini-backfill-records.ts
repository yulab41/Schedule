import { randomUUID } from 'node:crypto';
import { createDatabaseClient } from '@schedule/database';
import { loadEnvironment } from '../config/env.js';
import { MiniBackfillCleanup } from '../modules/past-schedules/mini-backfill-cleanup.js';

const scope = process.env.SCHEDULE_BACKFILL_SCOPE;
if (scope === undefined || (scope !== 'all-groups' && !/^[\da-f-]{36}$/iu.test(scope)))
  throw new Error('Set SCHEDULE_BACKFILL_SCOPE to a group UUID or all-groups.');
const mode = process.env.SCHEDULE_BACKFILL_MODE ?? 'preview';
if (mode !== 'preview' && mode !== 'apply') throw new Error('Unknown backfill cleanup mode.');
const expectedFingerprint = process.env.SCHEDULE_BACKFILL_PREVIEW_FINGERPRINT;
if (mode === 'apply' && !/^[\da-f]{64}$/u.test(expectedFingerprint ?? ''))
  throw new Error('Apply requires the reviewed preview fingerprint.');
const environment = loadEnvironment();
const client = createDatabaseClient({
  database: environment.MYSQL_DATABASE,
  host: environment.MYSQL_HOST,
  password: environment.MYSQL_PASSWORD,
  port: environment.MYSQL_PORT,
  user: environment.MYSQL_USER,
});
try {
  const cleanup = new MiniBackfillCleanup(client);
  const groupId = scope === 'all-groups' ? undefined : scope;
  const result =
    mode === 'preview'
      ? await cleanup.preview(groupId)
      : await cleanup.apply({
          ...(groupId === undefined ? {} : { groupId }),
          expectedFingerprint: expectedFingerprint as string,
          operationId: randomUUID(),
        });
  process.stdout.write(`${JSON.stringify({ mode, ...result })}\n`);
} finally {
  await client.close();
}
