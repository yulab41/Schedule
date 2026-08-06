import { randomUUID } from 'node:crypto';

import type { DatabaseClient, DatabaseTransaction } from '@schedule/database';
import {
  dutyAdjustments,
  groups,
  schedulePeriods,
  shiftAssignments,
  swapRequests,
  withTransaction,
} from '@schedule/database';
import { and, eq, inArray, isNull, or, sql } from 'drizzle-orm';

import { EventWriter } from '../events/event-writer.js';
import { StatisticsService } from '../statistics/statistics-service.js';
import { activeAssignmentWorkflowStatuses } from './workflow-conflict-service.js';

export const staleWorkflowArchiveReason = '人员已不匹配，系统自动归档';

export interface StaleWorkflowCandidate {
  readonly affectedMembershipIds: readonly string[];
  readonly assignmentIds: readonly string[];
  readonly id: string;
  readonly kind: 'duty_adjustment' | 'swap';
  readonly version: number;
  readonly workflowSequence: number;
}

export interface ArchivedStaleWorkflow {
  readonly id: string;
  readonly kind: 'duty_adjustment' | 'swap';
  readonly version: number;
}

interface AssignmentExpectation {
  readonly assignmentId: string;
  readonly expectedMembershipId: string;
}

interface ScopeWorkflow {
  readonly affectedMembershipIds: readonly string[];
  readonly assignmentExpectations: readonly AssignmentExpectation[];
  readonly assignmentIds: readonly string[];
  readonly id: string;
  readonly kind: 'duty_adjustment' | 'swap';
  readonly status: string;
  readonly version: number;
  readonly workflowSequence: number;
}

export class WorkflowSelfHealingService {
  private readonly eventWriter = new EventWriter();
  private readonly statisticsService: StatisticsService;

  public constructor(private readonly databaseClient: DatabaseClient) {
    this.statisticsService = new StatisticsService(this.databaseClient);
  }

  public async findStaleCompletedWorkflows(
    transaction: DatabaseTransaction,
    input: {
      readonly assignmentIds: readonly string[];
      readonly groupId: string;
    },
  ): Promise<readonly StaleWorkflowCandidate[]> {
    return this.collectArchiveableCandidates(
      transaction,
      input.groupId,
      input.assignmentIds,
      false,
    );
  }

  public async archiveStaleCompletedWorkflows(
    transaction: DatabaseTransaction,
    input: {
      readonly actorUserId: string | null;
      readonly assignmentIds: readonly string[];
      readonly groupId: string;
      readonly operationId: string;
    },
  ): Promise<readonly ArchivedStaleWorkflow[]> {
    const archived: ArchivedStaleWorkflow[] = [];
    const businessMonths = new Set<string>();
    for (;;) {
      const candidates = await this.collectArchiveableCandidates(
        transaction,
        input.groupId,
        input.assignmentIds,
        true,
      );
      if (candidates.length === 0) {
        break;
      }
      const assignmentIds = [
        ...new Set(candidates.flatMap((candidate) => candidate.assignmentIds)),
      ];
      const assignments = await transaction
        .select()
        .from(shiftAssignments)
        .where(inArray(shiftAssignments.id, assignmentIds));
      const assignmentById = new Map(assignments.map((assignment) => [assignment.id, assignment]));
      const periodIds = [...new Set(assignments.map((assignment) => assignment.schedulePeriodId))];
      const periodRows =
        periodIds.length === 0
          ? []
          : await transaction
              .select()
              .from(schedulePeriods)
              .where(inArray(schedulePeriods.id, periodIds));
      const decidedAt = new Date();

      for (const candidate of candidates) {
        const nextVersion = candidate.version + 1;
        if (candidate.kind === 'swap') {
          await transaction
            .update(swapRequests)
            .set({
              decidedAt,
              revocationReason: staleWorkflowArchiveReason,
              status: 'revoked',
              version: sql`${swapRequests.version} + 1`,
            })
            .where(eq(swapRequests.id, candidate.id));
        } else {
          await transaction
            .update(dutyAdjustments)
            .set({
              decidedAt,
              revocationReason: staleWorkflowArchiveReason,
              status: 'revoked',
              version: sql`${dutyAdjustments.version} + 1`,
            })
            .where(eq(dutyAdjustments.id, candidate.id));
        }

        const periodByAssignmentId = new Map(
          candidate.assignmentIds
            .map((assignmentId) => {
              const assignment = assignmentById.get(assignmentId);
              return assignment === undefined
                ? undefined
                : [assignmentId, assignment.schedulePeriodId];
            })
            .filter((entry): entry is [string, string] => entry !== undefined),
        );
        const eventType = candidate.kind === 'swap' ? 'swap_revoked' : 'duty_adjustment_revoked';
        const objectType = candidate.kind === 'swap' ? 'swap_request' : 'duty_adjustment';
        for (const schedulePeriodId of new Set(periodByAssignmentId.values())) {
          const affectedShiftIds = candidate.assignmentIds.filter(
            (assignmentId) => periodByAssignmentId.get(assignmentId) === schedulePeriodId,
          );
          const firstAssignment = assignmentById.get(affectedShiftIds[0] ?? '');
          await this.eventWriter.append(transaction, {
            affectedMembershipIds: [...candidate.affectedMembershipIds],
            affectedShiftIds,
            afterData: {
              ...(candidate.kind === 'duty_adjustment' && firstAssignment !== undefined
                ? {
                    actualMemberId: firstAssignment.actualMembershipId,
                    actualMemberName: firstAssignment.actualMemberName,
                  }
                : {}),
              revocationReason: staleWorkflowArchiveReason,
              status: 'revoked',
              version: nextVersion,
            },
            beforeData: {
              status: 'completed',
              version: candidate.version,
            },
            eventStatus: 'completed',
            eventType,
            groupId: input.groupId,
            ...(input.actorUserId === null ? {} : { initiatedByUserId: input.actorUserId }),
            objectId: candidate.id,
            objectType,
            operationId: input.operationId,
            ...(input.actorUserId === null ? {} : { operatorUserId: input.actorUserId }),
            reason: staleWorkflowArchiveReason,
            schedulePeriodId,
          });
        }
        archived.push({ id: candidate.id, kind: candidate.kind, version: nextVersion });
      }
      for (const period of periodRows) {
        businessMonths.add(period.businessMonth);
      }
    }

    for (const businessMonth of businessMonths) {
      await this.statisticsService.refreshInTransaction(transaction, input.groupId, businessMonth);
    }

    return archived;
  }

  public async runStartupSweep(): Promise<readonly ArchivedStaleWorkflow[]> {
    return withTransaction(this.databaseClient, async (transaction) => {
      const lockRows = (
        await transaction.execute(
          sql`SELECT GET_LOCK('schedule-stale-workflow-sweep', 0) AS acquired`,
        )
      )[0] as unknown as readonly { acquired: number }[];
      if (lockRows[0]?.acquired !== 1) {
        return [];
      }
      try {
        const groupRows = await transaction
          .select({ id: groups.id })
          .from(groups)
          .where(isNull(groups.deletedAt));
        const archived: ArchivedStaleWorkflow[] = [];
        for (const group of groupRows) {
          const swapInitiatorRows = await transaction
            .select({ id: swapRequests.initiatorAssignmentId })
            .from(swapRequests)
            .where(
              and(
                eq(swapRequests.groupId, group.id),
                eq(swapRequests.status, 'completed'),
                isNull(swapRequests.deletedAt),
              ),
            );
          const swapTargetRows = await transaction
            .select({ id: swapRequests.targetAssignmentId })
            .from(swapRequests)
            .where(
              and(
                eq(swapRequests.groupId, group.id),
                eq(swapRequests.status, 'completed'),
                isNull(swapRequests.deletedAt),
              ),
            );
          const adjustmentRows = await transaction
            .select({ id: dutyAdjustments.coveredAssignmentId })
            .from(dutyAdjustments)
            .where(
              and(
                eq(dutyAdjustments.groupId, group.id),
                eq(dutyAdjustments.status, 'completed'),
                isNull(dutyAdjustments.deletedAt),
              ),
            );
          const assignmentIds = [
            ...new Set([
              ...swapInitiatorRows.map((row) => row.id),
              ...swapTargetRows.map((row) => row.id),
              ...adjustmentRows.map((row) => row.id),
            ]),
          ];
          archived.push(
            ...(await this.archiveStaleCompletedWorkflows(transaction, {
              actorUserId: null,
              assignmentIds,
              groupId: group.id,
              operationId: randomUUID(),
            })),
          );
        }
        return archived;
      } finally {
        await transaction.execute(sql`SELECT RELEASE_LOCK('schedule-stale-workflow-sweep')`);
      }
    });
  }

  private async collectArchiveableCandidates(
    transaction: DatabaseTransaction,
    groupId: string,
    assignmentIds: readonly string[],
    lockRows: boolean,
  ): Promise<readonly StaleWorkflowCandidate[]> {
    const uniqueAssignmentIds = [...new Set(assignmentIds)];
    if (uniqueAssignmentIds.length === 0) {
      return [];
    }

    let swapQuery = transaction
      .select()
      .from(swapRequests)
      .where(
        and(
          eq(swapRequests.groupId, groupId),
          inArray(swapRequests.status, [...activeAssignmentWorkflowStatuses]),
          or(
            inArray(swapRequests.initiatorAssignmentId, uniqueAssignmentIds),
            inArray(swapRequests.targetAssignmentId, uniqueAssignmentIds),
          ),
          isNull(swapRequests.deletedAt),
        ),
      );
    let dutyQuery = transaction
      .select()
      .from(dutyAdjustments)
      .where(
        and(
          eq(dutyAdjustments.groupId, groupId),
          inArray(dutyAdjustments.status, [...activeAssignmentWorkflowStatuses]),
          inArray(dutyAdjustments.coveredAssignmentId, uniqueAssignmentIds),
          isNull(dutyAdjustments.deletedAt),
        ),
      );
    if (lockRows) {
      swapQuery = swapQuery.for('update') as typeof swapQuery;
      dutyQuery = dutyQuery.for('update') as typeof dutyQuery;
    }
    const [swapRows, dutyRows] = await Promise.all([swapQuery, dutyQuery]);
    const workflowAssignmentIds = [
      ...new Set([
        ...swapRows.flatMap((row) => [row.initiatorAssignmentId, row.targetAssignmentId]),
        ...dutyRows.map((row) => row.coveredAssignmentId),
      ]),
    ];
    const assignments = await transaction
      .select()
      .from(shiftAssignments)
      .where(inArray(shiftAssignments.id, [...uniqueAssignmentIds, ...workflowAssignmentIds]));
    const assignmentById = new Map(assignments.map((assignment) => [assignment.id, assignment]));

    const scopeWorkflows: ScopeWorkflow[] = [
      ...swapRows.map((row): ScopeWorkflow => ({
        affectedMembershipIds: [row.initiatorMembershipId, row.targetMembershipId],
        assignmentExpectations: [
          {
            assignmentId: row.initiatorAssignmentId,
            expectedMembershipId: row.targetMembershipId,
          },
          {
            assignmentId: row.targetAssignmentId,
            expectedMembershipId: row.initiatorMembershipId,
          },
        ],
        assignmentIds: [row.initiatorAssignmentId, row.targetAssignmentId],
        id: row.id,
        kind: 'swap',
        status: row.status,
        version: row.version,
        workflowSequence: row.workflowSequence,
      })),
      ...dutyRows.map((row): ScopeWorkflow => ({
        affectedMembershipIds: [row.deductedMembershipId, row.overtimeMembershipId],
        assignmentExpectations: [
          {
            assignmentId: row.coveredAssignmentId,
            expectedMembershipId: row.overtimeMembershipId,
          },
        ],
        assignmentIds: [row.coveredAssignmentId],
        id: row.id,
        kind: 'duty_adjustment',
        status: row.status,
        version: row.version,
        workflowSequence: row.workflowSequence,
      })),
    ];
    const workflowsByAssignment = new Map<string, ScopeWorkflow[]>();
    for (const workflow of scopeWorkflows) {
      for (const assignmentId of workflow.assignmentIds) {
        workflowsByAssignment.set(assignmentId, [
          ...(workflowsByAssignment.get(assignmentId) ?? []),
          workflow,
        ]);
      }
    }

    const candidates = scopeWorkflows
      .filter(
        (workflow) =>
          workflow.status === 'completed' &&
          workflow.assignmentExpectations.some(
            (expectation) => !isAssignmentStateMatching(expectation, assignmentById),
          ),
      )
      .sort((first, second) => second.workflowSequence - first.workflowSequence);
    const archiveable: StaleWorkflowCandidate[] = [];
    for (const candidate of candidates) {
      const hasLaterActiveWorkflow = candidate.assignmentIds.some((assignmentId) =>
        (workflowsByAssignment.get(assignmentId) ?? []).some(
          (workflow) => workflow.workflowSequence > candidate.workflowSequence,
        ),
      );
      if (!hasLaterActiveWorkflow) {
        archiveable.push({
          affectedMembershipIds: candidate.affectedMembershipIds,
          assignmentIds: candidate.assignmentIds,
          id: candidate.id,
          kind: candidate.kind,
          version: candidate.version,
          workflowSequence: candidate.workflowSequence,
        });
      }
    }

    return archiveable;
  }
}

function isAssignmentStateMatching(
  expectation: AssignmentExpectation,
  assignmentById: ReadonlyMap<string, typeof shiftAssignments.$inferSelect>,
): boolean {
  const assignment = assignmentById.get(expectation.assignmentId);
  return (
    assignment !== undefined &&
    assignment.deletedAt === null &&
    assignment.actualMembershipId === expectation.expectedMembershipId
  );
}
