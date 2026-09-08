import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import {
  groups,
  memberScheduleRoles,
  groupMemberships,
  userProfiles,
  shiftTypes,
  type DatabaseClient,
} from '@schedule/database';
import { and, asc, eq, isNull } from 'drizzle-orm';
import type { ScheduleGenerationPreview, SchedulePeriodSummary } from '@schedule/contracts';
import { getBusinessDates } from '@schedule/scheduling-domain';
import { ScheduleRepository } from '../modules/schedules/schedule-repository.js';

interface FixturePattern {
  readonly defaultShiftTypeId: string;
  readonly requiredMembersPerDay: number;
  readonly startDate?: string;
  readonly startingMemberScheduleRoleId?: string | null;
  readonly currentPosition?: number;
}
const patterns = new WeakMap<DatabaseClient, Map<string, FixturePattern>>();

/** Test data only. No production rotation rule or HTTP generation route is registered. */
export async function configureScheduleFixture(
  client: DatabaseClient,
  groupId: string,
  roleId: string,
  pattern: FixturePattern,
): Promise<void> {
  const current = patterns.get(client) ?? new Map<string, FixturePattern>();
  current.set(`${groupId}:${roleId}`, pattern);
  patterns.set(client, current);
}

export interface FixtureScheduleResult {
  readonly periods: readonly SchedulePeriodSummary[];
  readonly preview: ScheduleGenerationPreview;
}
export interface FixtureSaveRequest {
  readonly businessMonth: string;
  readonly scheduleRoleIds: readonly string[];
  readonly rulesVersion: number;
  readonly publishMode?: 'draft' | 'published';
  readonly operationId: string;
  readonly acknowledgeBlockers?: boolean;
  readonly acknowledgeWorkflowRevocations?: boolean;
}
interface FixtureResponse {
  readonly statusCode: number;
  readonly body: string;
  json<Output = FixtureScheduleResult>(): Output;
}

/** Seed snapshots through the real repository, then use the real draft-preview/publication APIs. */
export async function createScheduleFixture(
  app: FastifyInstance,
  client: DatabaseClient,
  input: {
    readonly headers: { readonly authorization: string };
    readonly payload: {
      readonly businessMonth: string;
      readonly scheduleRoleIds: readonly string[];
      readonly rulesVersion: number;
      readonly publishMode?: 'draft' | 'published';
      readonly operationId?: string;
      readonly acknowledgeBlockers?: boolean;
      readonly acknowledgeWorkflowRevocations?: boolean;
    };
  },
): Promise<FixtureResponse> {
  const { businessMonth, scheduleRoleIds, rulesVersion } = input.payload;
  const groupId = await roleGroupId(client, scheduleRoleIds[0] ?? '');
  const [group] = await client.database
    .select()
    .from(groups)
    .where(eq(groups.id, groupId))
    .limit(1);
  if (group === undefined) throw new Error('Fixture group missing');
  const repository = new ScheduleRepository(client);
  const periods: SchedulePeriodSummary[] = [];
  let preview: ScheduleGenerationPreview | undefined;
  for (const roleId of scheduleRoleIds) {
    const pattern = patterns.get(client)?.get(`${group.id}:${roleId}`);
    const members = await client.database
      .select({
        id: memberScheduleRoles.id,
        membershipId: memberScheduleRoles.membershipId,
        realName: userProfiles.realName,
      })
      .from(memberScheduleRoles)
      .innerJoin(groupMemberships, eq(groupMemberships.id, memberScheduleRoles.membershipId))
      .innerJoin(userProfiles, eq(userProfiles.userId, groupMemberships.userId))
      .where(
        and(eq(memberScheduleRoles.scheduleRoleId, roleId), isNull(memberScheduleRoles.deletedAt)),
      )
      .orderBy(asc(userProfiles.realName), asc(memberScheduleRoles.id));
    const [shift] = await client.database
      .select()
      .from(shiftTypes)
      .where(
        and(
          eq(shiftTypes.groupId, group.id),
          eq(shiftTypes.isAllDay, 1),
          isNull(shiftTypes.deletedAt),
        ),
      )
      .limit(1);
    if (shift === undefined) throw new Error('Fixture shift missing');
    const firstDate = `${businessMonth}-01`;
    const [year, month] = businessMonth.split('-').map(Number);
    const endDate = new Date(Date.UTC(year ?? 2026, month ?? 1, 0)).toISOString().slice(0, 10);
    const anchor = pattern?.startDate ?? firstDate;
    const startIndex = Math.max(
      0,
      members.findIndex((m) => m.id === pattern?.startingMemberScheduleRoleId),
    );
    const perDay = pattern?.requiredMembersPerDay ?? 1;
    const assignments = getBusinessDates(firstDate, endDate).flatMap((businessDate) =>
      Array.from({ length: perDay }, (_, index) => {
        const day = Math.round((Date.parse(businessDate) - Date.parse(anchor)) / 86_400_000);
        const member =
          members.length === 0
            ? undefined
            : members[
                (((day * perDay + index + startIndex) % members.length) + members.length) %
                  members.length
              ];
        return {
          businessDate,
          shiftTypeId: pattern?.defaultShiftTypeId ?? shift.id,
          slotPosition: index + 1,
          ...(member === undefined ? {} : { plannedMembershipId: member.membershipId }),
        };
      }),
    );
    const period = await repository.createDraft({
      actorUserId: group.ownerUserId,
      assignments,
      businessMonth,
      expectedRulesVersion: rulesVersion,
      groupId: group.id,
      operationId: randomUUID(),
      scheduleRoleId: roleId,
    });
    const previewResponse = await app.inject({
      headers: input.headers,
      method: 'GET',
      url: `/groups/${group.id}/schedules/${period.id}/preview`,
    });
    if (previewResponse.statusCode !== 200) return previewResponse;
    preview = previewResponse.json<ScheduleGenerationPreview>();
    if ((input.payload.publishMode ?? group.schedulePublishMode) === 'published') {
      const operationId = randomUUID();
      const response = await app.inject({
        headers: { ...input.headers, 'idempotency-key': operationId },
        method: 'POST',
        url: `/groups/${group.id}/schedules/${period.id}/publish`,
        payload: {
          expectedVersion: period.version,
          operationId,
          acknowledgeBlockers: input.payload.acknowledgeBlockers ?? true,
          acknowledgeWorkflowRevocations: input.payload.acknowledgeWorkflowRevocations ?? true,
          replacePublished: true,
        },
      });
      if (response.statusCode !== 200) return response;
      const published = response.json<{ period: SchedulePeriodSummary }>();
      periods.push(published.period);
    } else periods.push({ ...period, businessMonth });
  }
  if (preview === undefined) throw new Error('Fixture requires a role');
  const result = { periods, preview };
  return { statusCode: 200, body: JSON.stringify(result), json: <Output>() => result as Output };
}

async function roleGroupId(client: DatabaseClient, roleId: string): Promise<string> {
  const { scheduleRoles } = await import('@schedule/database');
  const [role] = await client.database
    .select({ groupId: scheduleRoles.groupId })
    .from(scheduleRoles)
    .where(eq(scheduleRoles.id, roleId));
  if (role === undefined) throw new Error('Fixture role missing');
  return role.groupId;
}
