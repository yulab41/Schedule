import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

import { createApp } from '../../../apps/api/dist/app.js';
import { createFakeAuthPort, resetDatabase } from '@schedule/test-fixtures';
import {
  createDatabaseClient,
  groupMemberships,
  groups,
  migrateDatabase,
  type ScheduleDatabase,
  userProfiles,
  users,
  type DatabaseClient,
  type DatabaseConnectionOptions,
} from '@schedule/database';
import { sql } from 'drizzle-orm';

const migrationsDirectory = fileURLToPath(new URL('../../../migrations', import.meta.url));
const databaseOptions = getTestDatabaseOptions();
const userIds: string[] = [];
const groupIds: string[] = [];

const resolveLoadToken = (token: string): string | undefined => {
  if (!token.startsWith('load-token-')) {
    return undefined;
  }
  const index = Number(token.slice('load-token-'.length));
  if (!Number.isInteger(index) || index < 0 || index >= 2000) {
    return undefined;
  }
  return `load-uid-${String(index).padStart(4, '0')}`;
};

if (databaseOptions === undefined) {
  console.error('TEST_MYSQL_* settings are required for the load test.');
  process.exit(1);
}

const client = createDatabaseClient(databaseOptions);
const startedAt = Date.now();

try {
  await resetDatabase(client);
  await migrateDatabase(client, migrationsDirectory);

  const coldStart = await measure(async () => {
    const app = createApp({
      authPort: createFakeAuthPort(resolveLoadToken),
      databaseClient: client,
      logger: false,
      platformAdminUids: new Set(['load-uid-0000']),
    });
    const firstRequest = await measure(() => app.inject({ method: 'GET', url: '/health' }));
    return { firstRequestMs: firstRequest.ms };
  });

  const seed = await measure(() => seedDataset(client));
  const app = createApp({
    authPort: createFakeAuthPort(resolveLoadToken),
    databaseClient: client,
    logger: false,
    platformAdminUids: new Set(['load-uid-0000']),
  });

  const calendarScenario = await runCalendarReads(app);
  const leaveScenario = await runLeaveSubmissions(app);
  const swapScenario = await runConcurrentSwapRace(app);
  const generationScenario = await runHundredMemberYear(app);
  const databaseMetrics = await collectDatabaseMetrics(client);

  const summary = {
    coldStartMs: coldStart.ms,
    firstRequestMs: coldStart.result.firstRequestMs,
    createdAt: new Date().toISOString(),
    databaseMetrics,
    generation: generationScenario,
    leaves: leaveScenario,
    metadata: {
      database: databaseOptions.database,
      groups: 100,
      users: 2000,
    },
    totalElapsedMs: Date.now() - startedAt,
    calendarReads: calendarScenario,
    swaps: swapScenario,
    seedMs: seed.ms,
  };

  console.log(JSON.stringify(summary, null, 2));

  assertAcceptance(summary);
} finally {
  await client.close();
}

async function runCalendarReads(app: ReturnType<typeof createApp>) {
  const month = getNextBusinessMonth();
  const requests = Array.from({ length: 100 }, (_, index) => {
    const groupIndex = index % 100;
    const memberIndex = 1 + (Math.floor(index / 100) % 19);
    return {
      groupIndex,
      token: `load-token-${groupIndex * 20 + memberIndex}`,
    };
  });

  return measure(async () => {
    const responses = await Promise.all(
      requests.map(({ groupIndex, token }) =>
        app.inject({
          headers: { authorization: `Bearer ${token}` },
          method: 'GET',
          url: `/groups/${groupIds[groupIndex]}/calendar?businessMonth=${month}`,
        }),
      ),
    );
    const non200 = responses.filter((response) => response.statusCode !== 200).length;
    if (non200 !== 0) {
      throw new Error(`calendar load: ${non200} responses were not 200`);
    }
    return { requests: responses.length };
  });
}

async function runLeaveSubmissions(app: ReturnType<typeof createApp>) {
  const startsAt = `${getNextBusinessMonth()}-10T00:00:00.000Z`;
  const endsAt = `${getNextBusinessMonth()}-12T00:00:00.000Z`;

  const submitted = await measure(async () => {
    const responses = await Promise.all(
      Array.from({ length: 100 }, (_, index) =>
        app.inject({
          headers: { authorization: `Bearer load-token-${index * 20 + 1}` },
          method: 'POST',
          payload: {
            endsAt,
            isAllDay: true,
            leaveType: 'sick',
            reason: '负载测试病假',
            startsAt,
          },
          url: `/groups/${groupIds[index]}/leave-requests`,
        }),
      ),
    );
    const created = responses.filter((response) => response.statusCode === 201).length;
    if (created !== 100) {
      throw new Error(`leave load: only ${created}/100 submissions were created`);
    }
    return { created };
  });

  const approved = await measure(async () => {
    let completed = 0;
    for (let index = 0; index < 20; index += 1) {
      const token = `load-token-${index * 20}`;
      const approvals = (
        await app.inject({
          headers: { authorization: `Bearer ${token}` },
          method: 'GET',
          url: `/groups/${groupIds[index]}/leave-requests/approvals`,
        })
      ).json() as readonly {
        id: string;
        version: number;
      }[];
      const leave = approvals[0];
      if (leave === undefined) {
        continue;
      }
      const preview = (
        await app.inject({
          headers: { authorization: `Bearer ${token}` },
          method: 'POST',
          payload: {},
          url: `/groups/${groupIds[index]}/leave-requests/${leave.id}/preview`,
        })
      ).json() as {
        leaveRequestVersion: number;
        periodVersions: Record<string, number>;
        rulesVersion: number;
      };
      const approve = await app.inject({
        headers: { authorization: `Bearer ${token}` },
        method: 'POST',
        payload: {
          expectedPeriodVersions: preview.periodVersions,
          expectedRulesVersion: preview.rulesVersion,
          expectedVersion: preview.leaveRequestVersion,
          operationId: randomUUID(),
        },
        url: `/groups/${groupIds[index]}/leave-requests/${leave.id}/approve`,
      });
      if (approve.statusCode === 200) {
        completed += 1;
      }
    }
    return { completed };
  });

  return { approved, submitted };
}

async function runConcurrentSwapRace(app: ReturnType<typeof createApp>) {
  const ownerToken = 'load-token-1980';
  const memberToken = 'load-token-1981';
  const groupId = await createGroup(app, ownerToken, 'Swap Race Group', '0900');
  const swapMemberUserId = userIds[1981];
  if (swapMemberUserId === undefined) {
    throw new Error('swap race: member user id missing');
  }
  await client.database.insert(groupMemberships).values({
    groupId,
    id: randomUUID(),
    role: 'member',
    userId: swapMemberUserId,
  });

  const config = (
    await app.inject({
      headers: { authorization: `Bearer ${ownerToken}` },
      method: 'GET',
      url: `/groups/${groupId}/scheduling-config`,
    })
  ).json() as {
    groupMembers: readonly { membershipId: string }[];
    rulesVersion: number;
    shiftTypes: readonly { id: string; isAllDay: boolean }[];
  };
  const role = (
    await app.inject({
      headers: { authorization: `Bearer ${ownerToken}` },
      method: 'POST',
      payload: { name: '一线' },
      url: `/groups/${groupId}/schedule-roles`,
    })
  ).json() as { id: string };
  const memberIds = config.groupMembers.slice(0, 2).map((member) => member.membershipId);
  const filledRole = (
    await app.inject({
      headers: { authorization: `Bearer ${ownerToken}` },
      method: 'PUT',
      payload: { membershipIds: memberIds },
      url: `/groups/${groupId}/schedule-roles/${role.id}/members`,
    })
  ).json() as { members: readonly { id: string }[] };
  const defaultShiftTypeId =
    config.shiftTypes.find((shiftType) => shiftType.isAllDay)?.id ?? config.shiftTypes[0]?.id ?? '';
  const rotate = await app.inject({
    headers: { authorization: `Bearer ${ownerToken}` },
    method: 'PUT',
    payload: {
      currentPosition: 1,
      defaultShiftTypeId,
      requiredMembersPerDay: 2,
      startDate: `${getNextBusinessMonth()}-01`,
      startingMemberScheduleRoleId: filledRole.members[0]?.id ?? '',
    },
    url: `/groups/${groupId}/schedule-roles/${role.id}/rotation-rule`,
  });
  if (rotate.statusCode !== 200) {
    throw new Error(`swap race: rotation rule setup failed ${rotate.statusCode}: ${rotate.body}`);
  }
  const freshConfig = (
    await app.inject({
      headers: { authorization: `Bearer ${ownerToken}` },
      method: 'GET',
      url: `/groups/${groupId}/scheduling-config`,
    })
  ).json() as { rulesVersion: number };

  const month = getNextBusinessMonth();
  const generated = await app.inject({
    headers: { authorization: `Bearer ${ownerToken}` },
    method: 'POST',
    payload: {
      acknowledgeBlockers: true,
      businessMonth: month,
      operationId: randomUUID(),
      publishMode: 'published',
      rulesVersion: freshConfig.rulesVersion,
      scheduleRoleIds: [role.id],
    },
    url: `/groups/${groupId}/schedules/generate`,
  });
  if (generated.statusCode !== 200) {
    throw new Error(`swap race: generation failed ${generated.statusCode}: ${generated.body}`);
  }

  const calendar = (
    await app.inject({
      headers: { authorization: `Bearer ${ownerToken}` },
      method: 'GET',
      url: `/groups/${groupId}/calendar?businessMonth=${month}`,
    })
  ).json() as {
    assignments: readonly {
      businessDate: string;
      id: string;
      plannedMembershipId: string | null;
      slotPosition: number;
    }[];
  };
  type CalendarAssignment = (typeof calendar.assignments)[number];
  const byDate = new Map<string, CalendarAssignment[]>();
  for (const assignment of calendar.assignments) {
    const list = byDate.get(assignment.businessDate) ?? [];
    list.push(assignment);
    byDate.set(assignment.businessDate, list);
  }
  const pair = [...byDate.values()].find((list) => list.length >= 2);
  if (pair === undefined) {
    throw new Error('swap race: no day with two assignments was generated');
  }
  const initiatorAssignment = pair[0];
  const targetAssignment = pair[1];
  const targetMembershipId = initiatorAssignment?.plannedMembershipId ?? '';
  if (initiatorAssignment === undefined || targetMembershipId === '') {
    throw new Error('swap race: could not choose an assignment pair');
  }

  const result = await measure(async () => {
    const responses = await Promise.all(
      Array.from({ length: 20 }, () =>
        app.inject({
          headers: { authorization: `Bearer ${memberToken}` },
          method: 'POST',
          payload: {
            initiatorAssignmentId: targetAssignment?.id,
            operationId: randomUUID(),
            targetAssignmentId: initiatorAssignment.id,
            targetMembershipId,
          },
          url: `/groups/${groupId}/swaps`,
        }),
      ),
    );
    const created = responses.filter((response) => response.statusCode === 201).length;
    const conflicts = responses.filter((response) => response.statusCode === 409).length;
    if (created !== 1 || conflicts !== 19) {
      throw new Error(`swap race: created=${created} conflicts=${conflicts}`);
    }
    return { conflicts, created };
  });

  return { ...result, concurrentRequests: 20 };
}

async function runHundredMemberYear(app: ReturnType<typeof createApp>) {
  const ownerToken = 'load-token-1000';
  const bigGroupId = await createGroup(app, ownerToken, '100 Member Group', '0901');
  const bigMemberIds = userIds.slice(1001, 1100);
  await client.database.insert(groupMemberships).values(
    bigMemberIds.map((userId) => ({
      groupId: bigGroupId,
      id: randomUUID(),
      role: 'member' as const,
      userId,
    })),
  );

  const config = (
    await app.inject({
      headers: { authorization: `Bearer ${ownerToken}` },
      method: 'GET',
      url: `/groups/${bigGroupId}/scheduling-config`,
    })
  ).json() as {
    groupMembers: readonly { membershipId: string }[];
    rulesVersion: number;
    shiftTypes: readonly { id: string; isAllDay: boolean }[];
  };
  const role = (
    await app.inject({
      headers: { authorization: `Bearer ${ownerToken}` },
      method: 'POST',
      payload: { name: '主班' },
      url: `/groups/${bigGroupId}/schedule-roles`,
    })
  ).json() as { id: string };
  const allMemberIds = config.groupMembers.map((member) => member.membershipId);
  if (allMemberIds.length !== 100) {
    throw new Error(`100-member setup: expected 100 members, got ${allMemberIds.length}`);
  }
  const filledRole = (
    await app.inject({
      headers: { authorization: `Bearer ${ownerToken}` },
      method: 'PUT',
      payload: { membershipIds: allMemberIds },
      url: `/groups/${bigGroupId}/schedule-roles/${role.id}/members`,
    })
  ).json() as { members: readonly { id: string }[] };
  const defaultShiftTypeId =
    config.shiftTypes.find((shiftType) => shiftType.isAllDay)?.id ?? config.shiftTypes[0]?.id ?? '';
  await app.inject({
    headers: { authorization: `Bearer ${ownerToken}` },
    method: 'PUT',
    payload: {
      currentPosition: 1,
      defaultShiftTypeId,
      requiredMembersPerDay: 3,
      startDate: `${getNextBusinessMonth()}-01`,
      startingMemberScheduleRoleId: filledRole.members[0]?.id ?? '',
    },
    url: `/groups/${bigGroupId}/schedule-roles/${role.id}/rotation-rule`,
  });
  const freshConfig = (
    await app.inject({
      headers: { authorization: `Bearer ${ownerToken}` },
      method: 'GET',
      url: `/groups/${bigGroupId}/scheduling-config`,
    })
  ).json() as { rulesVersion: number };

  const startMonth = getNextBusinessMonth();
  const [startYearText, startMonthText] = startMonth.split('-');
  const months = Array.from({ length: 12 }, (_, index) => {
    const absolute = Number(startYearText) * 12 + (Number(startMonthText) - 1) + index;
    const year = Math.floor(absolute / 12);
    const month = (absolute % 12) + 1;
    return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}`;
  });

  const previews = await measure(async () => {
    const responses = await Promise.all(
      months.map((businessMonth) =>
        app.inject({
          headers: { authorization: `Bearer ${ownerToken}` },
          method: 'POST',
          payload: {
            businessMonth,
            rulesVersion: freshConfig.rulesVersion,
            scheduleRoleIds: [role.id],
          },
          url: `/groups/${bigGroupId}/schedules/generate-preview`,
        }),
      ),
    );
    const ok = responses.filter((response) => response.statusCode === 200).length;
    if (ok !== 12) {
      throw new Error(`12-month preview: only ${ok}/12 succeeded`);
    }
    return { months: 12 };
  });

  const saved = await measure(async () => {
    const response = await app.inject({
      headers: { authorization: `Bearer ${ownerToken}` },
      method: 'POST',
      payload: {
        acknowledgeBlockers: true,
        businessMonth: startMonth,
        operationId: randomUUID(),
        publishMode: 'published',
        rulesVersion: freshConfig.rulesVersion,
        scheduleRoleIds: [role.id],
      },
      url: `/groups/${bigGroupId}/schedules/generate`,
    });
    if (response.statusCode !== 200) {
      throw new Error(`12-month save failed with ${response.statusCode}`);
    }
    return { published: true };
  });

  return { previews, saved };
}

async function seedDataset(databaseClient: DatabaseClient): Promise<void> {
  const usersChunk: { cloudbaseUid: string; id: string }[] = [];
  const profilesChunk: { id: string; realName: string; userId: string }[] = [];
  const groupChunk: { groupCode: string; id: string; name: string; ownerUserId: string }[] = [];
  const membershipChunk: {
    groupId: string;
    id: string;
    role: 'member' | 'owner';
    userId: string;
  }[] = [];

  for (let index = 0; index < 2000; index += 1) {
    const userId = randomUUID();
    userIds[index] = userId;
    usersChunk.push({ cloudbaseUid: `load-uid-${String(index).padStart(4, '0')}`, id: userId });
    profilesChunk.push({
      id: userId,
      realName: `Load User ${String(index).padStart(4, '0')}`,
      userId,
    });
  }
  for (let index = 0; index < 100; index += 1) {
    const groupId = randomUUID();
    groupIds[index] = groupId;
    const ownerUserId = userIds[index * 20] ?? '';
    groupChunk.push({
      groupCode: String(index).padStart(4, '0'),
      id: groupId,
      name: `Load Group ${String(index).padStart(3, '0')}`,
      ownerUserId,
    });
    for (let member = 0; member < 20; member += 1) {
      membershipChunk.push({
        groupId,
        id: randomUUID(),
        role: member === 0 ? 'owner' : 'member',
        userId: userIds[index * 20 + member] ?? '',
      });
    }
  }

  await insertChunks(databaseClient, users, usersChunk);
  await insertChunks(databaseClient, userProfiles, profilesChunk);
  await insertChunks(databaseClient, groups, groupChunk);
  await insertChunks(databaseClient, groupMemberships, membershipChunk);

  const [counts] = (await databaseClient.database.execute(
    sql`SELECT
        (SELECT COUNT(*) FROM users) AS users,
        (SELECT COUNT(*) FROM user_profiles) AS profiles,
        (SELECT COUNT(*) FROM \`groups\`) AS \`groups\`,
        (SELECT COUNT(*) FROM group_memberships) AS memberships`,
  )) as unknown as [
    { groups: number; memberships: number; profiles: number; users: number }[],
    unknown,
  ];
  if (counts[0]?.users !== 2000 || counts[0]?.groups !== 100 || counts[0]?.memberships !== 2000) {
    throw new Error(`seed counts mismatch: ${JSON.stringify(counts[0])}`);
  }
}

type AnyInsertTable = Parameters<ScheduleDatabase['insert']>[0];

async function insertChunks(
  databaseClient: DatabaseClient,
  table: AnyInsertTable,
  rows: readonly AnyInsertTable['$inferInsert'][],
): Promise<void> {
  for (let index = 0; index < rows.length; index += 500) {
    await databaseClient.database.insert(table).values(rows.slice(index, index + 500));
  }
}

async function createGroup(
  app: ReturnType<typeof createApp>,
  token: string,
  name: string,
  groupCode: string,
): Promise<string> {
  const response = await app.inject({
    headers: { authorization: `Bearer ${token}` },
    method: 'POST',
    payload: { groupCode, name },
    url: '/groups',
  });
  if (response.statusCode !== 201) {
    throw new Error(`create group ${name} failed with ${response.statusCode}`);
  }
  return (response.json() as { id: string }).id;
}

async function collectDatabaseMetrics(databaseClient: DatabaseClient) {
  const [status] = (await databaseClient.database.execute(
    sql`SHOW GLOBAL STATUS WHERE Variable_name IN ('Threads_connected', 'Threads_running', 'Questions')`,
  )) as unknown as [{ Value: string; Variable_name: string }[], unknown];
  const [tables] = (await databaseClient.database.execute(
    sql`SELECT
        (SELECT COUNT(*) FROM shift_assignments) AS assignments,
        (SELECT COUNT(*) FROM schedule_periods) AS periods,
        (SELECT COUNT(*) FROM swap_requests) AS swaps,
        (SELECT COUNT(*) FROM leave_requests) AS leaves`,
  )) as unknown as [
    { assignments: number; leaves: number; periods: number; swaps: number }[],
    unknown,
  ];
  return {
    ...Object.fromEntries(status.map((row) => [row.Variable_name, Number(row.Value)])),
    tables: tables[0],
  };
}

async function measure<Result>(
  operation: () => Promise<Result>,
): Promise<{ ms: number; result: Result }> {
  const start = Date.now();
  const result = await operation();
  return { ms: Date.now() - start, result };
}

function getNextBusinessMonth(): string {
  const now = new Date(Date.now() + 8 * 60 * 60 * 1000);
  const absolute = now.getUTCFullYear() * 12 + now.getUTCMonth() + 1;
  const year = Math.floor(absolute / 12);
  const month = (absolute % 12) + 1;
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}`;
}

function assertAcceptance(summary: Record<string, unknown>): void {
  const leaves = summary.leaves as {
    approved: { result: { completed: number } };
    submitted: { result: { created: number } };
  };
  const swaps = summary.swaps as { result: { conflicts: number; created: number } };
  const generation = summary.generation as {
    previews: { result: { months: number } };
    saved: { result: { published: boolean } };
  };
  if (leaves.submitted.result.created !== 100 || leaves.approved.result.completed < 19) {
    throw new Error('acceptance: leave submissions/approvals did not reach target');
  }
  if (swaps.result.created !== 1 || swaps.result.conflicts !== 19) {
    throw new Error('acceptance: concurrent same-shift swap did not keep exactly one winner');
  }
  if (generation.previews.result.months !== 12 || !generation.saved.result.published) {
    throw new Error('acceptance: 100-member 12-month generation did not complete');
  }
}

function getTestDatabaseOptions(): DatabaseConnectionOptions | undefined {
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
