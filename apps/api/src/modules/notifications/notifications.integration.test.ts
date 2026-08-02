import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

import type { NotificationPage, NotificationRecord } from '@schedule/contracts';
import {
  createTestDatabaseClient,
  migrateDatabase,
  type DatabaseClient,
  type DatabaseConnectionOptions,
} from '@schedule/database';
import { sql } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { AuthPort } from '../../adapters/auth/auth-port.js';
import { createApp } from '../../app.js';
import { DutyReminderJob } from '../../jobs/duty-reminders.js';
import { NotificationRetryJob } from '../../jobs/notification-retry.js';
import type { PushDispatcher } from './notification-dispatcher.js';
import { createPushDispatcher } from './notification-dispatcher.js';

const migrationsDirectory = fileURLToPath(new URL('../../../../../migrations', import.meta.url));
const databaseOptions = getTestDatabaseOptions();
const describeWithDatabase = databaseOptions === undefined ? describe.skip : describe;

describeWithDatabase('notification workflows', () => {
  let allDayShiftTypeId: string;
  let app: ReturnType<typeof createApp>;
  let client: DatabaseClient;

  beforeEach(async () => {
    client = createTestDatabaseClient(databaseOptions as DatabaseConnectionOptions);
    await resetDatabase(client);
    await migrateDatabase(client, migrationsDirectory);
    app = createApp({
      authPort: createFakeAuthPort({
        'a-token': 'cloudbase-a',
        'b-token': 'cloudbase-b',
        'outsider-token': 'cloudbase-outsider',
        'owner-token': 'cloudbase-owner',
      }),
      databaseClient: client,
      logger: false,
    });
    await registerUser('owner-token', 'Owner Doctor');
    await registerUser('a-token', 'A Doctor');
    await registerUser('b-token', 'B Doctor');
    await registerUser('outsider-token', 'Outside Doctor');
  });

  afterEach(async () => {
    if (app !== undefined) {
      await app.close();
    }

    if (client !== undefined) {
      await client.close();
    }
  });

  it('writes leave workflow notifications and supports unread and read states', async () => {
    const context = await seedMembersOnly();

    const submitResponse = await submitLeave('a-token', context.groupId);
    expect(submitResponse.statusCode).toBe(201);

    const ownerPage = await listNotifications('owner-token', {});
    expect(ownerPage.statusCode).toBe(200);
    const ownerBody = ownerPage.json() as NotificationPage;
    expect(ownerBody.unreadCount).toBe(1);
    expect(ownerBody.notifications).toHaveLength(1);
    const pendingNotification = ownerBody.notifications[0];
    if (pendingNotification === undefined) {
      throw new Error('Expected the owner to receive an approval notification.');
    }
    expect(pendingNotification.notificationType).toBe('approval_pending');
    expect(pendingNotification.payload).toMatchObject({ requestType: 'leave' });

    const memberPage = await listNotifications('a-token', {});
    expect((memberPage.json() as NotificationPage).notifications).toEqual([]);
    const outsiderPage = await listNotifications('outsider-token', {});
    expect((outsiderPage.json() as NotificationPage).notifications).toEqual([]);

    const unreadCount = await getUnreadCount('owner-token');
    expect(unreadCount.statusCode).toBe(200);
    expect((unreadCount.json() as { unreadCount: number }).unreadCount).toBe(1);

    const readResponse = await markNotificationRead('owner-token', pendingNotification.id);
    expect(readResponse.statusCode).toBe(200);
    const readBody = readResponse.json() as NotificationRecord;
    expect(readBody.isRead).toBe(true);
    expect((await listNotifications('owner-token', { unreadOnly: 'true' })).json()).toMatchObject({
      notifications: [],
      unreadCount: 0,
    });

    const leaveRequestId = (
      (await listMyLeaves('a-token', context.groupId)).json() as { id: string }[]
    )[0] as { id: string };
    const rejectResponse = await rejectLeave('owner-token', context.groupId, leaveRequestId.id);
    expect(rejectResponse.statusCode).toBe(200);
    const rejectedForMember = (await listNotifications('a-token', {})).json() as NotificationPage;
    expect(rejectedForMember.notifications[0]?.notificationType).toBe('leave_request_rejected');
  });

  it('writes swap workflow notifications only to affected members and admins', async () => {
    const context = await seedSwapEvents();

    const created = (
      await createSwap('a-token', context.groupId, {
        initiatorAssignmentId: context.assignments.aSep1,
        operationId: randomUUID(),
        targetAssignmentId: context.assignments.bSep2,
        targetMembershipId: context.membershipIds.b,
      })
    ).json() as { id: string; version: number };
    const targetCreated = (await listNotifications('b-token', {})).json() as NotificationPage;
    expect(targetCreated.notifications[0]?.notificationType).toBe('swap_request_created');
    expect((await listNotifications('owner-token', {})).json()).toMatchObject({
      notifications: [],
    });

    await acceptSwap('b-token', context.groupId, created.id, {
      expectedVersion: 1,
      operationId: randomUUID(),
    });
    const initiatorAccepted = (await listNotifications('a-token', {})).json() as NotificationPage;
    expect(initiatorAccepted.notifications[0]?.notificationType).toBe('swap_request_accepted');
    const ownerPending = (await listNotifications('owner-token', {})).json() as NotificationPage;
    expect(ownerPending.notifications[0]?.notificationType).toBe('approval_pending');
    expect(ownerPending.notifications[0]?.payload).toMatchObject({ requestType: 'swap' });

    await approveSwap('owner-token', context.groupId, created.id, {
      expectedVersion: 2,
      operationId: randomUUID(),
    });
    const bothChanged = await Promise.all([
      listNotifications('a-token', {}),
      listNotifications('b-token', {}),
    ]);
    for (const response of bothChanged) {
      const page = response.json() as NotificationPage;
      expect(
        page.notifications.some(
          (notification) => notification.notificationType === 'schedule_changed',
        ),
      ).toBe(true);
    }
    expect((await listNotifications('outsider-token', {})).json()).toMatchObject({
      notifications: [],
    });
  });

  it('runs duty reminders once per lead with member overrides and notifies only affected members', async () => {
    const context = await seedSwapEvents();
    const job = new DutyReminderJob(client);

    const firstRun = await job.run(new Date('2026-08-31T01:00:00.000Z'));
    expect(firstRun.created).toBe(1);
    expect(firstRun.duplicate).toBe(0);
    const memberANotifications = (
      await listNotifications('a-token', {})
    ).json() as NotificationPage;
    const dutyRemindersForA = memberANotifications.notifications.filter(
      (notification) => notification.notificationType === 'duty_reminder',
    );
    expect(dutyRemindersForA).toHaveLength(1);
    expect(dutyRemindersForA[0]?.payload).toMatchObject({ leadHours: 24 });
    const dutyRemindersForB = (
      (await listNotifications('b-token', {})).json() as NotificationPage
    ).notifications.filter((notification) => notification.notificationType === 'duty_reminder');
    expect(dutyRemindersForB).toEqual([]);

    const secondRun = await job.run(new Date('2026-08-31T01:00:00.000Z'));
    expect(secondRun.created).toBe(0);
    expect(secondRun.duplicate).toBe(1);
    const afterSecondRun = (
      (await listNotifications('a-token', {})).json() as NotificationPage
    ).notifications.filter((notification) => notification.notificationType === 'duty_reminder');
    expect(afterSecondRun).toHaveLength(1);

    const twoHourRun = await job.run(new Date('2026-08-31T23:00:00.000Z'));
    expect(twoHourRun.created).toBe(1);
    expect(twoHourRun.duplicate).toBe(1);

    await updateMyNotificationPreferences('a-token', context.groupId, { dutyReminderHours: [] });
    await updateMyNotificationPreferences('b-token', context.groupId, { dutyReminderHours: [] });
    const disabledRun = await job.run(new Date('2026-09-01T00:30:00.000Z'));
    expect(disabledRun.created).toBe(0);

    await updateMyNotificationPreferences('a-token', context.groupId, { dutyReminderHours: [6] });
    const sixHourRun = await job.run(new Date('2026-08-31T18:30:00.000Z'));
    expect(sixHourRun.created).toBe(1);
    const latest = (await listNotifications('a-token', {})).json() as NotificationPage;
    const latestReminders = latest.notifications.filter(
      (notification) => notification.notificationType === 'duty_reminder',
    );
    expect(latestReminders[0]?.payload).toMatchObject({ leadHours: 6 });
  });

  it('notifies administrators about upcoming vacancies once per assignment', async () => {
    const context = await seedSwapEvents();
    const job = new DutyReminderJob(client);
    const memberReminderRun = await job.run(new Date('2026-08-31T01:00:00.000Z'));
    expect(memberReminderRun.created).toBe(1);

    await client.database.execute(
      sql`UPDATE shift_assignments
          SET planned_membership_id = NULL,
              planned_member_name = NULL,
              actual_membership_id = NULL,
              actual_member_name = NULL
          WHERE id = ${context.assignments.bSep2}`,
    );

    const firstRun = await job.run(new Date('2026-09-01T01:00:00.000Z'));
    expect(firstRun.created).toBe(1);
    const ownerPage = (await listNotifications('owner-token', {})).json() as NotificationPage;
    expect(ownerPage.notifications[0]?.notificationType).toBe('vacancy_reminder');
    const memberPage = (await listNotifications('a-token', {})).json() as NotificationPage;
    const dutyRemindersForA = memberPage.notifications.filter(
      (notification) => notification.notificationType === 'duty_reminder',
    );
    expect(dutyRemindersForA).toHaveLength(1);
    const dutyRemindersForB = (
      (await listNotifications('b-token', {})).json() as NotificationPage
    ).notifications.filter((notification) => notification.notificationType === 'duty_reminder');
    expect(dutyRemindersForB).toEqual([]);

    const secondRun = await job.run(new Date('2026-09-01T02:00:00.000Z'));
    expect(secondRun.created).toBe(0);
    expect(secondRun.duplicate).toBe(1);
  });

  it('retries browser deliveries with limited attempts without rolling back business data', async () => {
    const context = await seedMembersOnly();
    await savePushSubscription('owner-token', {
      endpoint: 'https://push.example.com/endpoint-a',
      keys: { auth: 'auth-a', p256dh: 'p256dh-a' },
    });
    await submitLeave('a-token', context.groupId);
    const deliveryIds = await getDeliveryIds();
    expect(deliveryIds).toHaveLength(1);

    const failingDispatcher = new FailingPushDispatcher(1);
    const retryJob = new NotificationRetryJob(client, failingDispatcher);
    const firstRunTime = new Date();
    const firstRun = await retryJob.run(firstRunTime);
    expect(firstRun.attempted).toBe(1);
    expect(firstRun.failed).toBe(1);
    const afterFirstFailure = await getDeliveryIds();
    expect(afterFirstFailure[0]?.attempts).toBe(1);
    expect(afterFirstFailure[0]?.status).toBe('pending');

    const notDueRun = await retryJob.run(new Date(firstRunTime.valueOf() + 60_000));
    expect(notDueRun.attempted).toBe(0);

    const secondRun = await retryJob.run(new Date(firstRunTime.valueOf() + 6 * 60_000));
    expect(secondRun.sent).toBe(1);
    expect((await getDeliveryIds())[0]?.status).toBe('sent');

    const leaveRequestRows = (
      await client.database.execute(sql`SELECT COUNT(*) AS count FROM leave_requests`)
    )[0] as unknown as readonly { count: number }[];
    expect(leaveRequestRows[0]?.count).toBe(1);

    await savePushSubscription('b-token', {
      endpoint: 'https://push.example.com/endpoint-b',
      keys: { auth: 'auth-b', p256dh: 'p256dh-b' },
    });
    await submitLeave('b-token', context.groupId);
    const alwaysFailingJob = new NotificationRetryJob(client, new FailingPushDispatcher(100));
    const failingRunTime = new Date();
    await alwaysFailingJob.run(failingRunTime);
    await alwaysFailingJob.run(new Date(failingRunTime.valueOf() + 10 * 60_000));
    await alwaysFailingJob.run(new Date(failingRunTime.valueOf() + 60 * 60_000));
    const deliveriesAfterFailures = await getDeliveryIds();
    const lastDelivery = deliveriesAfterFailures.at(-1);
    const failedDeliveries = deliveriesAfterFailures.filter(
      (delivery) =>
        lastDelivery !== undefined && delivery.notificationId === lastDelivery.notificationId,
    );
    expect(failedDeliveries.length).toBe(1);
    expect(failedDeliveries[0]?.attempts).toBe(3);
    expect(failedDeliveries[0]?.status).toBe('failed');

    await submitLeave(
      'b-token',
      context.groupId,
      '2026-09-05T00:00:00.000Z',
      '2026-09-06T00:00:00.000Z',
    );
    const skippedJob = new NotificationRetryJob(client, createPushDispatcher({}));
    const skippedRun = await skippedJob.run(new Date());
    expect(skippedRun.skipped).toBeGreaterThanOrEqual(1);
  });

  it('writes a conflict notification when publication is blocked', async () => {
    const context = await seedMembersOnly();
    const config = await getConfig('owner-token', context.groupId);
    const allDayShift = config.shiftTypes.find((shiftType) => shiftType.isEnabled);
    allDayShiftTypeId = allDayShift?.id as string;
    const roleId = await createRole(context.groupId, 'Primary');
    const members = await listGroupMembers(context.groupId);
    const membershipById = new Map(members.map((member) => [member.realName, member.id]));
    const membershipIds = {
      a: membershipById.get('A Doctor') as string,
      b: membershipById.get('B Doctor') as string,
    };
    await replaceRoleMembers(context.groupId, roleId, [membershipIds.a, membershipIds.b]);
    const roleConfig = (await getConfig('owner-token', context.groupId)).roles.find(
      (role) => role.id === roleId,
    );
    const startingMemberScheduleRoleId = roleConfig?.members.find(
      (member) => member.realName === 'A Doctor',
    )?.id;
    await updateRotationRule(context.groupId, roleId, {
      currentPosition: 1,
      defaultShiftTypeId: allDayShiftTypeId,
      requiredMembersPerDay: 1,
      startDate: '2026-09-01',
      startingMemberScheduleRoleId: startingMemberScheduleRoleId as string,
    });
    const rulesVersion = (await getConfig('owner-token', context.groupId)).rulesVersion;
    const generation = await generateSchedule(context.groupId, roleId, rulesVersion, 'draft');
    expect(generation.statusCode).toBe(200);
    const period = (generation.json() as { periods: readonly { id: string; version: number }[] })
      .periods[0];
    if (period === undefined) {
      throw new Error('Expected a generated draft period.');
    }
    await client.database.execute(
      sql`UPDATE shift_assignments
          SET planned_membership_id = NULL,
              planned_member_name = NULL
          WHERE schedule_period_id = ${period.id}
          LIMIT 1`,
    );

    const blockedPublish = await publishPeriod('owner-token', context.groupId, period.id, {
      acknowledgeBlockers: false,
      expectedVersion: period.version,
      operationId: randomUUID(),
    });
    expect(blockedPublish.statusCode).toBe(409);
    const ownerPage = (await listNotifications('owner-token', {})).json() as NotificationPage;
    const conflictNotification = ownerPage.notifications.find(
      (notification) => notification.notificationType === 'conflict_detected',
    );
    expect(conflictNotification).toBeDefined();
    expect(conflictNotification?.payload).toMatchObject({ preview: { vacancies: 1 } });
  });

  it('enforces notification settings permissions and validates push subscriptions', async () => {
    const context = await seedMembersOnly();

    const memberUpdate = await app.inject({
      headers: { authorization: 'Bearer a-token' },
      method: 'PUT',
      payload: { dutyReminderHours: [12] },
      url: `/groups/${context.groupId}/notification-settings`,
    });
    expect(memberUpdate.statusCode).toBe(403);

    const defaults = await getGroupNotificationSettings('owner-token', context.groupId);
    expect(defaults.statusCode).toBe(200);
    expect(defaults.json()).toMatchObject({ dutyReminderHours: [24, 2] });

    const updated = await updateGroupNotificationSettings('owner-token', context.groupId, {
      dutyReminderHours: [48, 12, 6],
    });
    expect(updated.statusCode).toBe(200);
    expect(updated.json()).toMatchObject({ dutyReminderHours: [48, 12, 6] });

    const invalid = await updateGroupNotificationSettings('owner-token', context.groupId, {
      dutyReminderHours: [],
    });
    expect(invalid.statusCode).toBe(400);

    const myPreferences = await getMyNotificationPreferences('a-token', context.groupId);
    expect(myPreferences.statusCode).toBe(200);
    expect(myPreferences.json()).toMatchObject({
      browserNotificationsEnabled: true,
      dutyReminderHours: null,
    });

    const updatedPreferences = await updateMyNotificationPreferences('a-token', context.groupId, {
      browserNotificationsEnabled: false,
      dutyReminderHours: [4],
    });
    expect(updatedPreferences.statusCode).toBe(200);
    expect(updatedPreferences.json()).toMatchObject({
      browserNotificationsEnabled: false,
      dutyReminderHours: [4],
    });

    const pushConfig = await app.inject({
      headers: { authorization: 'Bearer owner-token' },
      method: 'GET',
      url: '/notifications/push-config',
    });
    expect(pushConfig.statusCode).toBe(200);
    expect((pushConfig.json() as { vapidPublicKey: string | null }).vapidPublicKey).toBeNull();

    const badSubscription = await savePushSubscription('owner-token', {
      endpoint: 'not-a-url',
      keys: { auth: 'auth', p256dh: 'p256dh' },
    });
    expect(badSubscription.statusCode).toBe(400);

    const saved = await savePushSubscription('owner-token', {
      endpoint: 'https://push.example.com/owner-endpoint',
      keys: { auth: 'auth-owner', p256dh: 'p256dh-owner' },
    });
    expect(saved.statusCode).toBe(200);
    const [subscriptions] = await client.database.execute<{ count: number }>(
      sql`SELECT COUNT(*) AS count FROM web_push_subscriptions`,
    );
    expect(subscriptions).toEqual([{ count: 1 }]);

    const deleted = await app.inject({
      headers: { authorization: 'Bearer owner-token' },
      method: 'DELETE',
      url: '/notifications/push-subscription',
    });
    expect(deleted.statusCode).toBe(200);
    const [afterDelete] = await client.database.execute<{ count: number }>(
      sql`SELECT COUNT(*) AS count FROM web_push_subscriptions`,
    );
    expect(afterDelete).toEqual([{ count: 0 }]);
  });

  async function seedMembersOnly(): Promise<{ readonly groupId: string }> {
    const groupId = await createGroup('Notifications group', '8899');
    await addRosterEntry(groupId, 'A Doctor');
    await addRosterEntry(groupId, 'B Doctor');
    await claimGroup('a-token', '8899');
    await claimGroup('b-token', '8899');
    return { groupId };
  }

  async function seedSwapEvents(): Promise<Context> {
    const groupId = await createGroup('Notifications schedule group', '7788');
    await addRosterEntry(groupId, 'A Doctor');
    await addRosterEntry(groupId, 'B Doctor');
    await claimGroup('a-token', '7788');
    await claimGroup('b-token', '7788');

    const config = await getConfig('owner-token', groupId);
    const allDayShift = config.shiftTypes.find((shiftType) => shiftType.isEnabled);
    allDayShiftTypeId = allDayShift?.id as string;
    const roleId = await createRole(groupId, 'Primary');
    const members = await listGroupMembers(groupId);
    const membershipById = new Map(members.map((member) => [member.realName, member.id]));
    const membershipIds = {
      a: membershipById.get('A Doctor') as string,
      b: membershipById.get('B Doctor') as string,
    };
    await replaceRoleMembers(groupId, roleId, [membershipIds.a, membershipIds.b]);
    const roleConfig = (await getConfig('owner-token', groupId)).roles.find(
      (role) => role.id === roleId,
    );
    const startingMemberScheduleRoleId = roleConfig?.members.find(
      (member) => member.realName === 'A Doctor',
    )?.id;
    await updateRotationRule(groupId, roleId, {
      currentPosition: 1,
      defaultShiftTypeId: allDayShiftTypeId,
      requiredMembersPerDay: 1,
      startDate: '2026-09-01',
      startingMemberScheduleRoleId: startingMemberScheduleRoleId as string,
    });
    const rulesVersion = (await getConfig('owner-token', groupId)).rulesVersion;
    expect((await generateSchedule(groupId, roleId, rulesVersion, 'published')).statusCode).toBe(
      200,
    );

    const assignmentRows = (
      await client.database.execute(
        sql`SELECT id, business_date AS businessDate
            FROM shift_assignments
            WHERE business_date IN ('2026-09-01', '2026-09-02')
            ORDER BY business_date`,
      )
    )[0] as unknown as readonly { businessDate: string; id: string }[];
    const byDate = new Map(assignmentRows.map((row) => [row.businessDate, row.id]));
    const aSep1 = byDate.get('2026-09-01') as string;
    const bSep2 = byDate.get('2026-09-02') as string;
    expect(aSep1).toBeDefined();
    expect(bSep2).toBeDefined();

    return {
      assignments: { aSep1, bSep2 },
      groupId,
      membershipIds,
      roleId,
    };
  }

  async function registerUser(token: string, realName: string): Promise<void> {
    const response = await app.inject({
      headers: { authorization: `Bearer ${token}` },
      method: 'POST',
      payload: { realName },
      url: '/users',
    });
    expect(response.statusCode).toBe(201);
  }

  async function createGroup(name: string, groupCode: string): Promise<string> {
    const response = await app.inject({
      headers: { authorization: 'Bearer owner-token' },
      method: 'POST',
      payload: { groupCode, name },
      url: '/groups',
    });
    expect(response.statusCode).toBe(201);
    return (response.json() as { id: string }).id;
  }

  async function addRosterEntry(groupId: string, realName: string): Promise<void> {
    const response = await app.inject({
      headers: { authorization: 'Bearer owner-token' },
      method: 'POST',
      payload: { realNames: [realName] },
      url: `/groups/${groupId}/roster-entries`,
    });
    expect(response.statusCode).toBe(200);
  }

  async function claimGroup(token: string, groupCode: string): Promise<void> {
    const response = await app.inject({
      headers: { authorization: `Bearer ${token}` },
      method: 'POST',
      payload: { groupCode },
      url: '/groups/claim',
    });
    expect(response.statusCode).toBe(201);
  }

  async function listGroupMembers(groupId: string): Promise<MemberResponse[]> {
    const response = await app.inject({
      headers: { authorization: 'Bearer owner-token' },
      method: 'GET',
      url: `/groups/${groupId}/members`,
    });
    expect(response.statusCode).toBe(200);
    return response.json() as MemberResponse[];
  }

  async function getConfig(token: string, groupId: string): Promise<ConfigResponse> {
    const response = await app.inject({
      headers: { authorization: `Bearer ${token}` },
      method: 'GET',
      url: `/groups/${groupId}/scheduling-config`,
    });
    expect(response.statusCode).toBe(200);
    return response.json() as ConfigResponse;
  }

  async function createRole(groupId: string, name: string): Promise<string> {
    const response = await app.inject({
      headers: { authorization: 'Bearer owner-token' },
      method: 'POST',
      payload: { name },
      url: `/groups/${groupId}/schedule-roles`,
    });
    expect(response.statusCode).toBe(201);
    return (response.json() as { id: string }).id;
  }

  async function replaceRoleMembers(
    groupId: string,
    roleId: string,
    membershipIds: readonly string[],
  ): Promise<void> {
    const response = await app.inject({
      headers: { authorization: 'Bearer owner-token' },
      method: 'PUT',
      payload: { membershipIds },
      url: `/groups/${groupId}/schedule-roles/${roleId}/members`,
    });
    expect(response.statusCode).toBe(200);
  }

  async function updateRotationRule(
    groupId: string,
    roleId: string,
    payload: {
      readonly currentPosition: number;
      readonly defaultShiftTypeId: string;
      readonly requiredMembersPerDay: number;
      readonly startDate: string;
      readonly startingMemberScheduleRoleId: string;
    },
  ): Promise<void> {
    const response = await app.inject({
      headers: { authorization: 'Bearer owner-token' },
      method: 'PUT',
      payload,
      url: `/groups/${groupId}/schedule-roles/${roleId}/rotation-rule`,
    });
    expect(response.statusCode).toBe(200);
  }

  async function generateSchedule(
    groupId: string,
    roleId: string,
    rulesVersion: number,
    publishMode: 'draft' | 'published',
  ) {
    return app.inject({
      headers: { authorization: 'Bearer owner-token' },
      method: 'POST',
      payload: {
        businessMonth: '2026-09',
        operationId: randomUUID(),
        publishMode,
        rulesVersion,
        scheduleRoleIds: [roleId],
      },
      url: `/groups/${groupId}/schedules/generate`,
    });
  }

  async function publishPeriod(
    token: string,
    groupId: string,
    periodId: string,
    body: { acknowledgeBlockers: boolean; expectedVersion: number; operationId: string },
  ) {
    return app.inject({
      headers: { authorization: `Bearer ${token}` },
      method: 'POST',
      payload: body,
      url: `/groups/${groupId}/schedules/${periodId}/publish`,
    });
  }

  async function submitLeave(
    token: string,
    groupId: string,
    startsAt = '2026-09-02T00:00:00.000Z',
    endsAt = '2026-09-03T00:00:00.000Z',
  ) {
    return app.inject({
      headers: { authorization: `Bearer ${token}` },
      method: 'POST',
      payload: {
        endsAt,
        isAllDay: true,
        leaveType: 'sick',
        reason: '休息',
        startsAt,
      },
      url: `/groups/${groupId}/leave-requests`,
    });
  }

  async function listMyLeaves(token: string, groupId: string) {
    return app.inject({
      headers: { authorization: `Bearer ${token}` },
      method: 'GET',
      url: `/groups/${groupId}/leave-requests`,
    });
  }

  async function rejectLeave(token: string, groupId: string, leaveRequestId: string) {
    return app.inject({
      headers: { authorization: `Bearer ${token}` },
      method: 'POST',
      payload: { expectedVersion: 1, operationId: randomUUID() },
      url: `/groups/${groupId}/leave-requests/${leaveRequestId}/reject`,
    });
  }

  async function createSwap(
    token: string,
    groupId: string,
    body: {
      readonly initiatorAssignmentId: string;
      readonly operationId: string;
      readonly targetAssignmentId: string;
      readonly targetMembershipId: string;
    },
  ) {
    return app.inject({
      headers: { authorization: `Bearer ${token}` },
      method: 'POST',
      payload: body,
      url: `/groups/${groupId}/swaps`,
    });
  }

  async function acceptSwap(
    token: string,
    groupId: string,
    swapRequestId: string,
    body: { readonly expectedVersion: number; readonly operationId: string },
  ) {
    return app.inject({
      headers: { authorization: `Bearer ${token}` },
      method: 'POST',
      payload: body,
      url: `/groups/${groupId}/swaps/${swapRequestId}/accept`,
    });
  }

  async function approveSwap(
    token: string,
    groupId: string,
    swapRequestId: string,
    body: { readonly expectedVersion: number; readonly operationId: string },
  ) {
    return app.inject({
      headers: { authorization: `Bearer ${token}` },
      method: 'POST',
      payload: body,
      url: `/groups/${groupId}/swaps/${swapRequestId}/approve`,
    });
  }

  async function listNotifications(token: string, query: { readonly unreadOnly?: string }) {
    const params = new URLSearchParams();
    if (query.unreadOnly !== undefined) {
      params.set('unreadOnly', query.unreadOnly);
    }
    const queryString = params.toString();
    return app.inject({
      headers: { authorization: `Bearer ${token}` },
      method: 'GET',
      url: `/notifications${queryString === '' ? '' : `?${queryString}`}`,
    });
  }

  async function getUnreadCount(token: string) {
    return app.inject({
      headers: { authorization: `Bearer ${token}` },
      method: 'GET',
      url: '/notifications/unread-count',
    });
  }

  async function markNotificationRead(token: string, notificationId: string) {
    return app.inject({
      headers: { authorization: `Bearer ${token}` },
      method: 'POST',
      url: `/notifications/${notificationId}/read`,
    });
  }

  async function getGroupNotificationSettings(token: string, groupId: string) {
    return app.inject({
      headers: { authorization: `Bearer ${token}` },
      method: 'GET',
      url: `/groups/${groupId}/notification-settings`,
    });
  }

  async function updateGroupNotificationSettings(
    token: string,
    groupId: string,
    body: { readonly dutyReminderHours: readonly number[] },
  ) {
    return app.inject({
      headers: { authorization: `Bearer ${token}` },
      method: 'PUT',
      payload: body,
      url: `/groups/${groupId}/notification-settings`,
    });
  }

  async function getMyNotificationPreferences(token: string, groupId: string) {
    return app.inject({
      headers: { authorization: `Bearer ${token}` },
      method: 'GET',
      url: `/groups/${groupId}/notification-preferences/mine`,
    });
  }

  async function updateMyNotificationPreferences(
    token: string,
    groupId: string,
    body: {
      readonly browserNotificationsEnabled?: boolean;
      readonly dutyReminderHours?: readonly number[] | null;
    },
  ) {
    return app.inject({
      headers: { authorization: `Bearer ${token}` },
      method: 'PUT',
      payload: body,
      url: `/groups/${groupId}/notification-preferences/mine`,
    });
  }

  async function savePushSubscription(
    token: string,
    body: { endpoint: string; keys: { auth: string; p256dh: string } },
  ) {
    return app.inject({
      headers: { authorization: `Bearer ${token}` },
      method: 'PUT',
      payload: body,
      url: '/notifications/push-subscription',
    });
  }

  async function getDeliveryIds(): Promise<
    readonly { attempts: number; notificationId: string; status: string }[]
  > {
    const [rows] = await client.database.execute(
      sql`SELECT attempts, notification_id AS notificationId, status
          FROM notification_deliveries
          ORDER BY created_at`,
    );
    return rows as unknown as readonly {
      attempts: number;
      notificationId: string;
      status: string;
    }[];
  }
});

interface Context {
  readonly assignments: { readonly aSep1: string; readonly bSep2: string };
  readonly groupId: string;
  readonly membershipIds: { readonly a: string; readonly b: string };
  readonly roleId: string;
}

interface MemberResponse {
  readonly id: string;
  readonly realName: string;
}

interface ConfigResponse {
  readonly roles: readonly {
    readonly id: string;
    readonly members: readonly { readonly id: string; readonly realName: string }[];
  }[];
  readonly rulesVersion: number;
  readonly shiftTypes: readonly {
    readonly id: string;
    readonly isEnabled: boolean;
  }[];
}

class FailingPushDispatcher implements PushDispatcher {
  public readonly isConfigured = true;
  public readonly vapidPublicKey: string | null = 'test-public-key';
  private failuresLeft: number;

  public constructor(failures: number) {
    this.failuresLeft = failures;
  }

  public async send(): Promise<void> {
    if (this.failuresLeft > 0) {
      this.failuresLeft -= 1;
      throw new Error('模拟推送失败');
    }
  }
}

function createFakeAuthPort(tokens: Readonly<Record<string, string>>): AuthPort {
  return {
    authenticate: async ({ authorization }) => {
      const token = authorization?.replace(/^Bearer\s+/iu, '');
      const cloudbaseUid = token === undefined ? undefined : tokens[token];
      return cloudbaseUid === undefined ? undefined : { cloudbaseUid };
    },
  };
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
  await client.database.execute(sql`DROP TABLE IF EXISTS manual_schedule_cells`);
  await client.database.execute(sql`DROP TABLE IF EXISTS manual_schedule_template_members`);
  await client.database.execute(sql`DROP TABLE IF EXISTS manual_schedule_templates`);
  await client.database.execute(sql`DROP TABLE IF EXISTS duty_adjustments`);
  await client.database.execute(sql`DROP TABLE IF EXISTS notification_deliveries`);
  await client.database.execute(sql`DROP TABLE IF EXISTS notifications`);
  await client.database.execute(sql`DROP TABLE IF EXISTS notification_preferences`);
  await client.database.execute(sql`DROP TABLE IF EXISTS notification_settings`);
  await client.database.execute(sql`DROP TABLE IF EXISTS web_push_subscriptions`);
  await client.database.execute(sql`DROP TABLE IF EXISTS notification_batches`);
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
