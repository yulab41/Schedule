import { randomUUID } from 'node:crypto';
import { createDatabaseClient } from '@schedule/database';
import { loadEnvironment } from '../config/env.js';
import { MiniTimelineCleanup } from '../modules/events/mini-timeline-cleanup.js';

const beforeText = process.env.SCHEDULE_TIMELINE_BEFORE;
if (beforeText === undefined || !/(?:Z|[+-]\d{2}:\d{2})$/u.test(beforeText))
  throw new Error('SCHEDULE_TIMELINE_BEFORE must include a timezone.');
const before = new Date(beforeText);
if (!Number.isFinite(before.valueOf())) throw new Error('Invalid timeline cutoff.');
const backfills = process.env.SCHEDULE_TIMELINE_INCLUDE_EXISTING_BACKFILLS ?? 'false';
if (backfills !== 'true' && backfills !== 'false')
  throw new Error('SCHEDULE_TIMELINE_INCLUDE_EXISTING_BACKFILLS must be true or false.');
const scope = process.env.SCHEDULE_TIMELINE_SCOPE;
if (scope === undefined || (scope !== 'all-groups' && !/^[\da-f-]{36}$/iu.test(scope)))
  throw new Error('Set SCHEDULE_TIMELINE_SCOPE to a group UUID or all-groups.');
const mode = process.env.SCHEDULE_TIMELINE_MODE ?? 'preview';
if (mode !== 'preview' && mode !== 'apply') throw new Error('Unknown timeline cleanup mode.');
const expectedFingerprint = process.env.SCHEDULE_TIMELINE_PREVIEW_FINGERPRINT;
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
  const cleanup = new MiniTimelineCleanup(client);
  const input = {
    before,
    includeExistingBackfills: backfills === 'true',
    ...(scope === 'all-groups' ? {} : { groupId: scope }),
  };
  const result =
    mode === 'preview'
      ? await cleanup.preview(input)
      : await cleanup.apply({
          ...input,
          expectedFingerprint: expectedFingerprint as string,
          operationId: randomUUID(),
        });
  process.stdout.write(`${JSON.stringify({ mode, ...result })}\n`);
} finally {
  await client.close();
}
