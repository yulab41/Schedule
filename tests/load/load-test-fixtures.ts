import { randomUUID } from 'node:crypto';
import {
  groupMemberContacts,
  memberScheduleRoles,
  scheduleRoles,
  schedulePeriods,
  shiftAssignments,
  shiftTypes,
  scheduleEvents,
  type DatabaseClient,
} from '@schedule/database';

/** Synthetic, already-published dense nurse calendars, including historical months. */
export async function seedLoadCalendars(
  client: DatabaseClient,
  memberships: readonly { id: string; groupId: string; userId: string }[],
  groupIds: readonly string[],
  month: string,
): Promise<void> {
  const [year, monthNumber] = month.split('-').map(Number);
  if (!year || !monthNumber || monthNumber > 12) throw new Error('Invalid synthetic month');
  for (const groupId of groupIds) {
    const members = memberships.filter((member) => member.groupId === groupId);
    if (members.length !== 20) throw new Error('Dense calendar requires 20 synthetic members');
    const roleId = randomUUID();
    const shiftTypeId = randomUUID();
    await client.database.insert(shiftTypes).values({
      id: shiftTypeId,
      groupId,
      name: '合成全天班',
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
    await client.database.insert(scheduleRoles).values({ id: roleId, groupId, name: '合成护士' });
    await client.database.insert(memberScheduleRoles).values(
      members.map((m) => ({
        id: randomUUID(),
        scheduleRoleId: roleId,
        membershipId: m.id,
      })),
    );
    await client.database.insert(groupMemberContacts).values(
      members.map((m, i) => ({
        id: randomUUID(),
        membershipId: m.id,
        mobilePhone: `1990000${String(i).padStart(4, '0')}`,
        isConfirmed: 1,
      })),
    );
    for (const offset of [-2, -1, 0]) {
      const first = new Date(Date.UTC(year, monthNumber - 1 + offset, 1));
      const businessMonth = first.toISOString().slice(0, 10);
      const days = new Date(
        Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0),
      ).getUTCDate();
      const periodId = randomUUID();
      await client.database.insert(schedulePeriods).values({
        id: periodId,
        groupId,
        scheduleRoleId: roleId,
        businessMonth,
        revision: 1,
        rulesVersion: 1,
        status: 'published',
        publishedAt: first,
      });
      const assignments: (typeof shiftAssignments.$inferInsert)[] = [];
      for (let day = 1; day <= days; day++) {
        const businessDate = `${businessMonth.slice(0, 7)}-${String(day).padStart(2, '0')}`;
        const startsAt = new Date(`${businessDate}T00:00:00+08:00`);
        for (const [i, member] of members.entries())
          assignments.push({
            id: randomUUID(),
            schedulePeriodId: periodId,
            businessDate,
            slotPosition: i + 1,
            shiftTypeId,
            shiftTypeName: '合成全天班',
            shiftTypeAbbreviation: '值',
            shiftTypeColor: '#ffffff',
            shiftTypeTextColor: '#000000',
            shiftTypeConfigurationVersion: 1,
            shiftStartTime: '00:00:00',
            shiftEndTime: '00:00:00',
            crossesMidnight: 1,
            isAllDay: 1,
            countsTowardStatistics: 1,
            startsAt,
            endsAt: new Date(startsAt.valueOf() + 86400000),
            plannedMembershipId: member.id,
            actualMembershipId: member.id,
            plannedMemberName: `合成人员${i}`,
            actualMemberName: `合成人员${i}`,
          });
      }
      for (let start = 0; start < assignments.length; start += 200)
        await client.database
          .insert(shiftAssignments)
          .values(assignments.slice(start, start + 200));
      await client.database.insert(scheduleEvents).values({
        id: randomUUID(),
        groupId,
        schedulePeriodId: periodId,
        eventType: 'duty_adjustment_completed',
        eventStatus: 'completed',
        objectType: 'shift_assignment',
        operationId: randomUUID(),
        affectedShiftIds: [assignments[0]!.id as string],
        affectedMembershipIds: [members[0]!.id],
      });
    }
  }
}
